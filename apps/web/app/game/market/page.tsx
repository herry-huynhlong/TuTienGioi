import { ItemCategory, prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buyMarketListingAction, buySystemMarketItemAction, cancelMarketListingAction, sellItemAction, sellItemToNpcAction } from "@/lib/forms";
import { formatRarity } from "@/lib/format";
import { consolidateInventoryStacks, currentSystemMarketPeriod, getItemEconomy, marketListingMaxQuantity, recordOnboardingEvent, refreshSystemMarketStock } from "@ttg/game";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { GamePageBackground } from "@/components/GamePageBackground";
import { ItemDetailPanel, ItemSummaryCard } from "@/components/ItemCard";
import { ItemQuantityControl } from "@/components/ItemQuantityControl";
import { MarketFilterBar } from "@/components/MarketFilterBar";

const categories = [
  ["", "Tất cả"],
  ["subtype:Linh Thảo", "Linh Thảo"],
  ["subtype:Khoáng Vật", "Khoáng Vật"],
  ["alchemy", "Luyện Đan"],
  ["talisman", "Chế Phù"],
  ["formation", "Trận Pháp"],
  [ItemCategory.EQUIPMENT, "Trang bị"],
  [ItemCategory.CONSUMABLE, "Đan dược"],
  [ItemCategory.MATERIAL, "Nguyên liệu"],
  [ItemCategory.TECHNIQUE, "Bí tịch"],
  [ItemCategory.QUEST, "Khác"]
] as const;

const gradeFilters = [
  ["", "Tất cả"],
  ["HA", "Hạ Phẩm"],
  ["TRUNG", "Trung Phẩm"],
  ["THUONG", "Thượng Phẩm"]
] as const;

export default async function MarketPage({ searchParams }: { searchParams?: Promise<{ q?: string; category?: string; grade?: string; error?: string; ok?: string; tab?: string; sellItem?: string; detail?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/");
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const tab = params?.tab === "sell" || params?.tab === "my" ? params.tab : "buy";
  const category = categories.some(([value]) => value === params?.category) ? params?.category : "";
  const grade = gradeFilters.some(([value]) => value === params?.grade) ? params?.grade : "";
  if (user.character?.id) await consolidateInventoryStacks(prisma, user.character.id);
  const character = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      currentLocation: true,
      items: {
        where: { quantity: { gt: 0 }, equippedSlot: null },
        include: { template: true, listings: { where: { status: "ACTIVE" }, select: { id: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  await recordOnboardingEvent(prisma, character.id, "VIEW_MARKET");
  const atMarket = Array.isArray(character.currentLocation?.services) && character.currentLocation.services.includes("market");
  const selectedItem = character.items.find((item) => item.id === params?.sellItem) ?? character.items.find((item) => item.template.tradeable && !item.bound && item.listings.length === 0);
  await refreshSystemMarketStock(prisma);
  const periodKey = currentSystemMarketPeriod();
  const [rawSystemStocks, rawListings, myListings] = await Promise.all([
    prisma.systemMarketStock.findMany({
      where: {
        periodKey,
        stock: { gt: 0 },
        template: {
          ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
          ...(grade ? { rarity: grade as any } : {})
        }
      },
      include: { template: true },
      orderBy: [{ template: { rarity: "asc" } }, { template: { name: "asc" } }]
    }),
    prisma.marketListing.findMany({
      where: {
        status: "ACTIVE",
        sellerId: { not: character.id },
        item: {
          template: {
            ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
            ...(grade ? { rarity: grade as any } : {})
          }
        }
      },
      take: 30,
      include: { item: { include: { template: true } }, seller: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.marketListing.findMany({
      where: { sellerId: character.id, status: "ACTIVE" },
      include: { item: { include: { template: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);
  const systemStocks = rawSystemStocks.filter((stock) => marketCategoryMatches(stock.template, category ?? ""));
  const listings = rawListings.filter((listing) => marketCategoryMatches(listing.item.template, category ?? ""));
  const categoryOptions = visibleMarketCategories([...rawSystemStocks.map((stock) => stock.template), ...rawListings.map((listing) => listing.item.template)], category ?? "");

  return (
    <GamePageBackground type="market">
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Vạn Bảo Lâu</p>
        <h1 className="mt-1 text-3xl font-black">Vạn Bảo Lâu</h1>
        <p className="muted mt-2">Mua bán vật phẩm, đổi chiến lợi phẩm lấy Linh Thạch và bày hàng cho người chơi khác.</p>
      </header>
      <ActionAlert message={params?.error} />
      <ActionAlert message={params?.ok === "npc-sell" ? "Đã bán vật phẩm cho Vạn Bảo Lâu." : params?.ok === "listed" ? "Đã bày bán vật phẩm." : params?.ok} />
      {!atMarket ? (
        <section className="panel rounded-lg p-5">
          <h2 className="text-xl font-bold text-gold">Bạn chưa ở Vạn Bảo Lâu</h2>
          <p className="muted mt-2">Giao dịch chỉ mở khi nhân vật đứng tại địa điểm có Vạn Bảo Lâu hoặc dịch vụ mua bán.</p>
          <Link href="/game/world" className="btn mt-4">Xem bản đồ</Link>
        </section>
      ) : null}

      <nav className="tab-row mb-5">
        <Link href="/game/market?tab=buy" className={tab === "buy" ? "active" : ""}>Mua</Link>
        <Link href={selectedItem ? `/game/market?tab=sell&sellItem=${selectedItem.id}` : "/game/market?tab=sell"} className={tab === "sell" ? "active" : ""}>Bán</Link>
        <Link href="/game/market?tab=my" className={tab === "my" ? "active" : ""}>Hàng của tôi</Link>
      </nav>

      {tab === "buy" ? <BuyTab systemStocks={systemStocks} listings={listings} characterId={character.id} linhThach={character.linhThach} disabled={!atMarket} q={q} category={category ?? ""} grade={grade ?? ""} detail={params?.detail ?? ""} categories={categoryOptions} /> : null}
      {tab === "sell" ? <SellTab items={character.items} selectedItem={selectedItem} disabled={!atMarket} /> : null}
      {tab === "my" ? <MyListingsTab listings={myListings} /> : null}
    </div>
    </GamePageBackground>
  );
}

function BuyTab({ systemStocks, listings, characterId, linhThach, disabled, q, category, grade, detail, categories }: { systemStocks: Array<any>; listings: Array<any>; characterId: string; linhThach: bigint; disabled: boolean; q: string; category: string; grade: string; detail: string; categories: readonly (readonly [string, string])[] }) {
  const selectedSystem = detail.startsWith("system:") ? systemStocks.find((stock) => stock.id === detail.slice("system:".length)) : null;
  const selectedListing = detail.startsWith("listing:") ? listings.find((listing) => listing.id === detail.slice("listing:".length)) : null;
  return (
    <>
      <section className="panel rounded-lg p-5">
        <MarketFilterBar q={q} grade={grade} category={category} grades={gradeFilters} categories={categories} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="muted">{systemStocks.length} vật phẩm Vạn Bảo Lâu · {listings.length} hàng người chơi</span>
          <span className="text-gold">Linh thạch: <CurrencyAmount amount={linhThach} /></span>
        </div>
      </section>
      <h2 className="mt-5 text-xl font-black text-gold">Vạn Bảo Lâu</h2>
      {selectedSystem ? (
        <section className="panel rounded-lg p-5 mt-3">
          <ItemDetailPanel
            template={selectedSystem.template}
            details={[
              { label: "Nguồn", value: "Vạn Bảo Lâu" },
              { label: "Điều kiện", value: marketCondition(selectedSystem.template) },
              { label: "Còn lại", value: selectedSystem.stock.toLocaleString("vi-VN") },
              { label: "Giá", value: <><CurrencyAmount amount={selectedSystem.price} /> / cái</> }
            ]}
            showModifiers={false}
            action={<SystemBuyForm stock={selectedSystem} balance={linhThach} disabled={disabled} />}
          />
        </section>
      ) : null}
      {selectedListing ? (
        <section className="panel rounded-lg p-5 mt-3">
          <ItemDetailPanel
            template={selectedListing.item.template}
            details={[
              { label: "Nguồn", value: "Người chơi bày bán" },
              { label: "Điều kiện", value: marketCondition(selectedListing.item.template) },
              { label: "Người bán", value: selectedListing.seller.name },
              { label: "Số lượng", value: selectedListing.quantity.toLocaleString("vi-VN") },
              { label: "Giá", value: <><CurrencyAmount amount={selectedListing.price} /> / cái</> }
            ]}
            showModifiers={false}
            action={<PlayerBuyForm listing={selectedListing} balance={linhThach} disabled={disabled} />}
          />
        </section>
      ) : null}
      <section className="market-card-grid mt-3">
        {systemStocks.map((stock) => <SystemStockCard key={stock.id} stock={stock} balance={linhThach} disabled={disabled} selected={detail === `system:${stock.id}`} />)}
        {systemStocks.length === 0 ? <div className="empty-state panel rounded-lg p-5"><b>Không có vật phẩm Vạn Bảo Lâu phù hợp.</b><p>Hạ Phẩm và một phần Trung Phẩm sẽ được bổ sung theo kỳ.</p></div> : null}
      </section>
      <h2 className="mt-6 text-xl font-black text-gold">Hàng người chơi</h2>
      <section className="market-card-grid mt-5">
        {listings.map((listing) => <ListingCard key={listing.id} listing={listing} buyerId={characterId} balance={linhThach} disabled={disabled} selected={detail === `listing:${listing.id}`} />)}
        {listings.length === 0 ? <div className="empty-state panel rounded-lg p-5"><b>Chưa có hàng phù hợp.</b><p>Đổi bộ lọc hoặc quay lại sau khi người chơi khác bày hàng.</p></div> : null}
      </section>
    </>
  );
}

function marketCondition(template: any) {
  const economy = getItemEconomy(template);
  const parts = [];
  if (economy.requiredRealmOrder !== null) parts.push(`Cảnh giới bậc ${economy.requiredRealmOrder}+`);
  if (economy.requiredSectRank !== null) parts.push(`Tông Môn ${economy.requiredSectRank} phẩm trở lên`);
  return parts.length ? parts.join(" · ") : "Không";
}

function marketCategoryMatches(template: any, category: string) {
  if (!category) return true;
  const economy = getItemEconomy(template);
  const subType = economy.subType || "";
  if (category.startsWith("subtype:")) return subType === category.slice("subtype:".length);
  if (category === "alchemy") return subType === "Đan Dược" || economy.icon === "pill";
  if (category === "talisman") return subType === "Phù Lục" || subType === "Phù Chỉ" || subType === "Phù Phấn" || economy.icon === "paper" || economy.icon === "powder";
  if (category === "formation") return subType.includes("Trận") || economy.icon === "formation" || economy.icon === "flag";
  return template.category === category;
}

function visibleMarketCategories(templates: any[], activeCategory: string) {
  return categories.filter(([value]) => !value || value === activeCategory || templates.some((template) => marketCategoryMatches(template, value)));
}

function SystemBuyForm({ stock, balance, disabled }: { stock: any; balance: bigint; disabled: boolean }) {
  const affordable = stock.price > 0n ? Number(balance / stock.price) : stock.stock;
  const maxQuantity = Math.max(0, Math.min(stock.stock, 99, affordable));
  const disabledReason = disabled ? "Bạn phải đứng tại Vạn Bảo Lâu để giao dịch." : stock.stock <= 0 ? "Đã hết hàng." : affordable < 1 ? "Không đủ Linh Thạch." : "";
  return (
    <form action={buySystemMarketItemAction} className="item-card-action">
      <input type="hidden" name="stockId" value={stock.id} />
      <ItemQuantityControl max={maxQuantity} unitPrice={stock.price.toString()} submitLabel="Mua" disabled={disabled || maxQuantity < 1} disabledReason={disabledReason} />
    </form>
  );
}

function SystemStockCard({ stock, balance, disabled, selected }: { stock: any; balance: bigint; disabled: boolean; selected: boolean }) {
  return (
    <ItemSummaryCard
      template={stock.template}
      quantityLabel={`Còn ${stock.stock}`}
      priceLabel={<CurrencyAmount amount={stock.price} />}
      href={`/game/market?tab=buy&detail=system:${stock.id}`}
      selected={selected}
      action={<SystemBuyForm stock={stock} balance={balance} disabled={disabled} />}
    />
  );
}

function PlayerBuyForm({ listing, balance, disabled }: { listing: any; balance: bigint; disabled: boolean }) {
  const affordable = listing.price > 0n ? Number(balance / listing.price) : listing.quantity;
  const maxQuantity = Math.max(0, Math.min(listing.quantity, 99, affordable));
  const disabledReason = disabled ? "Bạn phải đứng tại Vạn Bảo Lâu để giao dịch." : listing.quantity <= 0 ? "Tin rao đã hết hàng." : affordable < 1 ? "Không đủ Linh Thạch." : "";
  return (
    <form action={buyMarketListingAction} className="item-card-action">
      <input type="hidden" name="listingId" value={listing.id} />
      <ItemQuantityControl max={maxQuantity} unitPrice={listing.price.toString()} submitLabel="Mua" disabled={disabled || maxQuantity < 1} disabledReason={disabledReason} />
    </form>
  );
}

function ListingCard({ listing, buyerId, balance, disabled, selected }: { listing: any; buyerId: string; balance: bigint; disabled: boolean; selected: boolean }) {
  return (
    <ItemSummaryCard
      template={listing.item.template}
      quantityLabel={`x${listing.quantity}`}
      priceLabel={<CurrencyAmount amount={listing.price} />}
      href={`/game/market?tab=buy&detail=listing:${listing.id}`}
      selected={selected}
      sellerLabel={`Người bán: ${listing.seller.name}`}
      action={buyerId === listing.sellerId ? <span className="badge">Của bạn</span> : <PlayerBuyForm listing={listing} balance={balance} disabled={disabled} />}
    />
  );
}

function SellTab({ items, selectedItem, disabled }: { items: Array<any>; selectedItem: any | undefined; disabled: boolean }) {
  const sellableItems = items.filter((item) => item.template.tradeable && !item.bound && item.listings.length === 0);
  return (
    <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <div className="panel rounded-lg p-5">
        <h2 className="text-xl font-bold text-gold">Chọn vật phẩm</h2>
        <div className="market-sell-list mt-4">
          {sellableItems.map((item) => (
            <Link key={item.id} href={`/game/market?tab=sell&sellItem=${item.id}`} className={selectedItem?.id === item.id ? "selected" : ""}>
              <b>{item.template.name}</b>
              <small>{formatRarity(item.template.rarity)} Phẩm · x{item.quantity}</small>
            </Link>
          ))}
          {sellableItems.length === 0 ? <p className="muted">Không có vật phẩm có thể giao dịch.</p> : null}
        </div>
      </div>
      <div className="panel rounded-lg p-5">
        {selectedItem ? <SellSelectedItem item={selectedItem} disabled={disabled} /> : <p className="muted">Chọn một vật phẩm để bán cho Vạn Bảo Lâu hoặc bày hàng.</p>}
      </div>
    </section>
  );
}

function SellSelectedItem({ item, disabled }: { item: any; disabled: boolean }) {
  const economy = getItemEconomy(item.template);
  const maxQuantity = marketListingMaxQuantity(item.quantity);
  return (
    <ItemDetailPanel
      template={item.template}
      details={[
        { label: "Sở hữu", value: item.quantity.toLocaleString("vi-VN") },
        { label: "Vạn Bảo Lâu thu mua", value: economy.sellableToNpc ? <><CurrencyAmount amount={economy.npcBuyPrice} /> / cái</> : "Không thu mua" },
        { label: "Rao tối đa", value: `${maxQuantity} / lần` }
      ]}
      showModifiers={false}
      action={(
      <div className="sell-mode-grid mt-5">
        <form action={sellItemToNpcAction} className="sell-mode-card">
          <input type="hidden" name="itemId" value={item.id} />
          <h3>Bán cho Vạn Bảo Lâu</h3>
          <p className="muted">Nhận Linh Thạch ngay theo giá thu mua của hệ thống.</p>
          <ItemQuantityControl max={item.quantity} unitPrice={economy.npcBuyPrice.toString()} submitLabel="Bán" disabled={disabled || !economy.sellableToNpc} />
        </form>

        <form action={sellItemAction} className="sell-mode-card">
          <input type="hidden" name="itemId" value={item.id} />
          <h3>Bày bán cho người chơi</h3>
          <p className="muted">Bạn tự đặt đơn giá. Giá hệ thống chỉ là tham khảo.</p>
          <ItemQuantityControl max={maxQuantity} disabled={disabled || maxQuantity < 1} />
          <label>Giá mỗi món<input className="field" name="price" inputMode="numeric" pattern="[0-9]+" min="1" defaultValue={economy.systemBasePrice.toString()} /></label>
          <button className="btn btn-secondary w-full" disabled={disabled || maxQuantity < 1}>Bày hàng</button>
        </form>
      </div>
      )}
    />
  );
}

function MyListingsTab({ listings }: { listings: Array<any> }) {
  return (
    <section className="market-card-grid">
      {listings.map((listing) => {
        return (
          <ItemSummaryCard
            key={listing.id}
            template={listing.item.template}
            quantityLabel={`x${listing.quantity}`}
            priceLabel={<CurrencyAmount amount={listing.price} />}
            action={(
              <form action={cancelMarketListingAction} className="item-card-action single">
                <input type="hidden" name="listingId" value={listing.id} />
                <button className="btn btn-secondary w-full">Gỡ hàng</button>
              </form>
            )}
          />
        );
      })}
      {listings.length === 0 ? <div className="empty-state panel rounded-lg p-5"><b>Chưa bày bán vật phẩm nào.</b><p>Chọn tab Bán để đưa vật phẩm lên chợ.</p></div> : null}
    </section>
  );
}


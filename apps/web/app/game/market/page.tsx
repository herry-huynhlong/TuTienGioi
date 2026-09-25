import { ItemCategory, prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { buyMarketListingAction, cancelMarketListingAction, sellItemAction, sellItemToNpcAction } from "@/lib/forms";
import { formatItemCategory, formatRarity } from "@/lib/format";
import { getItemEconomy, marketListingMaxQuantity, recordOnboardingEvent } from "@ttg/game";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";
import { Box, Gem, Hammer, Leaf, Pill, ScrollText, Shirt, Sparkles, Swords } from "lucide-react";

const categories = [
  ["", "Tất cả"],
  [ItemCategory.EQUIPMENT, "Trang bị"],
  [ItemCategory.CONSUMABLE, "Đan dược"],
  [ItemCategory.MATERIAL, "Nguyên liệu"],
  [ItemCategory.TECHNIQUE, "Bí tịch"],
  [ItemCategory.QUEST, "Khác"]
];

export default async function MarketPage({ searchParams }: { searchParams?: Promise<{ q?: string; category?: string; error?: string; tab?: string; sellItem?: string }> }) {
  const user = await getUser();
  const params = await searchParams;
  const q = params?.q?.trim() ?? "";
  const tab = params?.tab === "sell" || params?.tab === "my" ? params.tab : "buy";
  const category = categories.some(([value]) => value === params?.category) ? params?.category : "";
  const character = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
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
  const atMarket = character.currentLocation?.key === "cho-linh-bao";
  const selectedItem = character.items.find((item) => item.id === params?.sellItem) ?? character.items.find((item) => item.template.tradeable && !item.bound && item.listings.length === 0);
  const [listings, myListings] = await Promise.all([
    prisma.marketListing.findMany({
      where: {
        status: "ACTIVE",
        sellerId: { not: character.id },
        item: {
          template: {
            ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
            ...(category ? { category: category as ItemCategory } : {})
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

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Vạn Bảo Lâu</p>
        <h1 className="mt-1 text-3xl font-black">Chợ Linh Bảo</h1>
        <p className="muted mt-2">Mua bán vật phẩm, đổi chiến lợi phẩm lấy Linh Thạch và bày hàng cho người chơi khác.</p>
      </header>
      <ActionAlert message={params?.error} />
      {!atMarket ? (
        <section className="panel rounded-lg p-5">
          <h2 className="text-xl font-bold text-gold">Bạn chưa ở Chợ Linh Bảo</h2>
          <p className="muted mt-2">Giao dịch chỉ mở khi nhân vật đứng tại Chợ Linh Bảo trong Thanh Vân Đông Thành.</p>
          <Link href="/game/world" className="btn mt-4">Xem bản đồ</Link>
        </section>
      ) : null}

      <nav className="tab-row mb-5">
        <Link href="/game/market?tab=buy" className={tab === "buy" ? "active" : ""}>Mua</Link>
        <Link href={selectedItem ? `/game/market?tab=sell&sellItem=${selectedItem.id}` : "/game/market?tab=sell"} className={tab === "sell" ? "active" : ""}>Bán</Link>
        <Link href="/game/market?tab=my" className={tab === "my" ? "active" : ""}>Hàng của tôi</Link>
      </nav>

      {tab === "buy" ? <BuyTab listings={listings} characterId={character.id} linhThach={character.linhThach} disabled={!atMarket} q={q} category={category ?? ""} /> : null}
      {tab === "sell" ? <SellTab items={character.items} selectedItem={selectedItem} disabled={!atMarket} /> : null}
      {tab === "my" ? <MyListingsTab listings={myListings} /> : null}
    </div>
  );
}

function BuyTab({ listings, characterId, linhThach, disabled, q, category }: { listings: Array<any>; characterId: string; linhThach: bigint; disabled: boolean; q: string; category: string }) {
  return (
    <>
      <section className="panel rounded-lg p-5">
        <form className="market-toolbar">
          <input type="hidden" name="tab" value="buy" />
          <input className="field" name="q" placeholder="Tìm vật phẩm..." defaultValue={q} />
          <select className="field" name="category" defaultValue={category}>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="btn">Tìm</button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="muted">{listings.length} vật phẩm đang bày bán</span>
          <span className="text-gold">Linh thạch: {linhThach.toString()}</span>
        </div>
      </section>
      <section className="market-card-grid mt-5">
        {listings.map((listing) => <ListingCard key={listing.id} listing={listing} buyerId={characterId} balance={linhThach} disabled={disabled} />)}
        {listings.length === 0 ? <div className="empty-state panel rounded-lg p-5"><b>Chưa có hàng phù hợp.</b><p>Đổi bộ lọc hoặc quay lại sau khi người chơi khác bày hàng.</p></div> : null}
      </section>
    </>
  );
}

function ListingCard({ listing, buyerId, balance, disabled }: { listing: any; buyerId: string; balance: bigint; disabled: boolean }) {
  const economy = getItemEconomy(listing.item.template);
  const totalPrice = listing.price * BigInt(listing.quantity);
  const Icon = iconFor(economy.icon);
  return (
    <article className="market-listing-card">
      <span className="item-icon"><Icon size={22} aria-hidden /></span>
      <div>
        <b>{listing.item.template.name}</b>
        <small>{formatRarity(listing.item.template.rarity)} phẩm · {formatItemCategory(listing.item.template.category)}</small>
      </div>
      <div className="info-table">
        <div><span>Người bán</span><b>{listing.seller.name}</b></div>
        <div><span>Số lượng</span><b>{listing.quantity}</b></div>
        <div><span>Giá người chơi</span><b>{listing.price.toString()} / cái</b></div>
        <div><span>Giá hệ thống</span><b>{economy.systemBasePrice.toString()}</b></div>
      </div>
      {buyerId === listing.sellerId ? <span className="badge">Của bạn</span> : (
        <form action={buyMarketListingAction}>
          <input type="hidden" name="listingId" value={listing.id} />
          <button className="btn btn-secondary w-full" disabled={disabled || balance < totalPrice}>Mua {totalPrice.toString()}</button>
        </form>
      )}
    </article>
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
              <small>x{item.quantity}</small>
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
    <div className="sell-panel">
      <h2>{item.template.name}</h2>
      <div className="info-table mt-4">
        <div><span>Sở hữu</span><b>{item.quantity}</b></div>
        <div><span>Giá hệ thống</span><b>{economy.systemBasePrice.toString()} Linh thạch</b></div>
        <div><span>Vạn Bảo Lâu thu mua</span><b>{economy.sellableToNpc ? `${economy.npcBuyPrice.toString()} / cái` : "Không thu mua"}</b></div>
        <div><span>Rao tối đa</span><b>{maxQuantity} / lần</b></div>
      </div>

      <div className="sell-mode-grid mt-5">
        <form action={sellItemToNpcAction} className="sell-mode-card">
          <input type="hidden" name="itemId" value={item.id} />
          <h3>Bán cho Vạn Bảo Lâu</h3>
          <p className="muted">Nhận Linh Thạch ngay theo giá thu mua của hệ thống.</p>
          <label>Số lượng<input className="field" name="quantity" type="number" min="1" max={item.quantity} defaultValue="1" /></label>
          <button className="btn w-full" disabled={disabled || !economy.sellableToNpc}>Bán ngay</button>
        </form>

        <form action={sellItemAction} className="sell-mode-card">
          <input type="hidden" name="itemId" value={item.id} />
          <h3>Bày bán cho người chơi</h3>
          <p className="muted">Bạn tự đặt đơn giá. Giá hệ thống chỉ là tham khảo.</p>
          <label>Số lượng<input className="field" name="quantity" type="number" min="1" max={maxQuantity} defaultValue="1" /></label>
          <label>Giá mỗi món<input className="field" name="price" inputMode="numeric" pattern="[0-9]+" min="1" defaultValue={economy.systemBasePrice.toString()} /></label>
          <button className="btn btn-secondary w-full" disabled={disabled || maxQuantity < 1}>Bày hàng</button>
        </form>
      </div>
    </div>
  );
}

function MyListingsTab({ listings }: { listings: Array<any> }) {
  return (
    <section className="market-card-grid">
      {listings.map((listing) => {
        const economy = getItemEconomy(listing.item.template);
        const Icon = iconFor(economy.icon);
        return (
          <article key={listing.id} className="market-listing-card">
            <span className="item-icon"><Icon size={22} aria-hidden /></span>
            <div>
              <b>{listing.item.template.name}</b>
              <small>x{listing.quantity} · {listing.price.toString()} / cái</small>
            </div>
            <form action={cancelMarketListingAction}>
              <input type="hidden" name="listingId" value={listing.id} />
              <button className="btn btn-secondary w-full">Gỡ hàng</button>
            </form>
          </article>
        );
      })}
      {listings.length === 0 ? <div className="empty-state panel rounded-lg p-5"><b>Chưa bày bán vật phẩm nào.</b><p>Chọn tab Bán để đưa vật phẩm lên chợ.</p></div> : null}
    </section>
  );
}

function iconFor(icon: string) {
  return ({
    leaf: Leaf,
    ore: Hammer,
    wood: Leaf,
    core: Sparkles,
    sword: Swords,
    armor: Shirt,
    pill: Pill,
    manual: ScrollText,
    scroll: ScrollText,
    gem: Gem,
    box: Box
  } as const)[icon] ?? Box;
}

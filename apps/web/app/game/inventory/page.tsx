import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { consumeItemAction, equipItemAction, sellItemToNpcAction, unequipItemAction } from "@/lib/forms";
import { formatEquipmentSlot } from "@/lib/format";
import { getItemEconomy } from "@ttg/game";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";
import { formatCurrency, ItemDetailPanel, ItemSummaryCard } from "@/components/ItemCard";
import { ItemQuantityControl } from "@/components/ItemQuantityControl";

const equipmentSlots = ["WEAPON", "ARMOR", "HELMET", "BOOTS", "RING", "TALISMAN", "ARTIFACT"] as const;

type InventoryItem = {
  id: string;
  quantity: number;
  enhancement: number;
  equippedSlot: string | null;
  bound: boolean;
  quality: number;
  template: {
    name: string;
    category: string;
    rarity: string;
    itemFamily?: string | null;
    description: string;
    equipSlot: string | null;
    tradeable: boolean;
    baseModifiers: unknown;
    bindRules: unknown;
  };
  listings: { id: string; price: bigint; expiresAt: Date }[];
};

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<{ error?: string; item?: string; filter?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  if (!user) redirect("/");
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      currentLocation: true,
      items: {
        where: { quantity: { gt: 0 } },
        include: { template: true, listings: { where: { status: "ACTIVE" }, select: { id: true, price: true, expiresAt: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  const filter = params?.filter ?? "ALL";
  const equipped = c.items.filter((item) => item.equippedSlot);
  const inventory = c.items.filter((item) => !item.equippedSlot && (filter === "ALL" || item.template.category === filter));
  const selected = inventory.find((item) => item.id === params?.item) ?? inventory[0] ?? c.items.find((item) => item.equippedSlot);
  const atMarket = Array.isArray(c.currentLocation?.services) && c.currentLocation.services.includes("market");

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Inventory</p>
        <h1 className="mt-1 text-3xl font-black">Túi Đồ</h1>
        <p className="muted mt-2">Quản lý vật phẩm, trang bị, đan dược và tài nguyên giao thương.</p>
      </header>
      <ActionAlert message={params?.error} />

      <section className="grid gap-5 xl:grid-cols-[.7fr_1fr_.95fr]">
        <Panel title="Trang bị">
          <div className="equipment-slots">
            {equipmentSlots.map((slot) => {
              const item = equipped.find((entry) => entry.equippedSlot === slot);
              return (
                <div key={slot} className="equipment-slot-row">
                  <span>{formatEquipmentSlot(slot)}</span>
                  {item ? <Link href={`/game/inventory?item=${item.id}`}><b>{item.template.name}</b></Link> : <b>Trống</b>}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title={`Túi đồ (${inventory.length})`}>
          <InventoryFilters active={filter} />
          {inventory.length > 0 ? (
            <div className="inventory-grid mt-4">
              {inventory.map((item) => <ItemTile key={item.id} item={item} selected={selected?.id === item.id} />)}
            </div>
          ) : (
            <div className="empty-state">
              <b>Không có vật phẩm phù hợp.</b>
              <p>Lịch luyện, săn yêu hoặc giao dịch để nhận thêm vật phẩm.</p>
              <Link href="/game/location" className="btn btn-secondary mt-4">Tới địa điểm</Link>
            </div>
          )}
        </Panel>

        <Panel title="Chi tiết vật phẩm">
          {selected ? <ItemDetail item={selected} atMarket={atMarket} /> : <p className="muted">Chọn một vật phẩm để xem chi tiết.</p>}
        </Panel>
      </section>
    </div>
  );
}

function InventoryFilters({ active }: { active: string }) {
  const filters = [
    ["ALL", "Tất cả"],
    ["EQUIPMENT", "Trang bị"],
    ["CONSUMABLE", "Tiêu hao"],
    ["MATERIAL", "Nguyên liệu"],
    ["TECHNIQUE", "Bí tịch"],
    ["QUEST", "Khác"]
  ];
  return (
    <div className="tab-row">
      {filters.map(([value, label]) => <Link key={value} href={`/game/inventory?filter=${value}`} className={active === value ? "active" : ""}>{label}</Link>)}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel rounded-lg p-5">
      <h2 className="text-xl font-bold text-gold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ItemTile({ item, selected }: { item: InventoryItem; selected: boolean }) {
  const economy = getItemEconomy(item.template);
  return (
    <ItemSummaryCard
      template={item.template}
      quantityLabel={`x${item.quantity}`}
      priceLabel={`${formatCurrency(economy.systemBasePrice)} Linh Thạch`}
      href={`/game/inventory?item=${item.id}`}
      selected={selected}
    />
  );
}

function ItemDetail({ item, atMarket }: { item: InventoryItem; atMarket: boolean }) {
  const activeListing = item.listings[0];
  const canEquip = item.template.category === "EQUIPMENT" && Boolean(item.template.equipSlot) && !activeListing;
  const canConsume = item.template.category === "CONSUMABLE" && !activeListing;
  const canSell = item.template.tradeable && !item.bound && !activeListing;
  const economy = getItemEconomy(item.template);
  return (
    <ItemDetailPanel
      template={item.template}
      source="Túi Đồ"
      details={[
        { label: "Số lượng", value: `x${item.quantity}` },
        { label: "Điều kiện", value: item.bound || !item.template.tradeable ? "Không thể giao dịch" : "Có thể giao dịch" },
        ...(item.equippedSlot ? [{ label: "Đang trang bị", value: formatEquipmentSlot(item.equippedSlot) }] : [])
      ]}
      action={(
        <>
          {activeListing ? <p className="badge">Đang bày bán: {formatCurrency(activeListing.price)} Linh Thạch</p> : null}
        {item.equippedSlot ? (
          <form action={unequipItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button className="btn btn-secondary w-full">Tháo trang bị</button>
          </form>
        ) : null}
        {canEquip ? (
          <form action={equipItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button className="btn btn-secondary w-full">Trang bị</button>
          </form>
        ) : null}
        {canConsume ? (
          <form action={consumeItemAction} className="sell-mode-card">
            <input type="hidden" name="itemId" value={item.id} />
            <h3>Sử dụng vật phẩm</h3>
            <ItemQuantityControl max={item.quantity} submitLabel="Sử dụng" />
          </form>
        ) : null}
        {canSell && atMarket && economy.sellableToNpc ? (
          <form action={sellItemToNpcAction} className="sell-mode-card">
            <input type="hidden" name="itemId" value={item.id} />
            <h3>Bán nhanh cho Vạn Bảo Lâu</h3>
            <p className="muted">Giá bán do server tính theo cấu hình vật phẩm.</p>
            <ItemQuantityControl max={item.quantity} unitPrice={economy.npcBuyPrice.toString()} submitLabel="Bán" />
          </form>
        ) : null}
        {canSell && atMarket ? <Link href={`/game/market?tab=sell&sellItem=${item.id}`} className="btn w-full">Rao bán</Link> : null}
        {canSell && !atMarket ? <Link href="/game/world?error=Bạn cần tới Vạn Bảo Lâu để giao dịch." className="btn w-full">Tới Vạn Bảo Lâu</Link> : null}
        </>
      )}
    />
  );
}


import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { cancelMarketListingAction, consumeItemAction, equipItemAction, sellItemAction, unequipItemAction } from "@/lib/forms";
import { formatEquipmentSlot, formatItemCategory, formatRarity } from "@/lib/format";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const user = await getUser();
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: { items: { include: { template: true, listings: { where: { status: "ACTIVE" }, select: { id: true, price: true, expiresAt: true } } }, orderBy: { createdAt: "desc" } } }
  });
  const equipped = c.items.filter((item) => item.equippedSlot);
  const inventory = c.items.filter((item) => !item.equippedSlot);

  return (
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Inventory</p>
        <h1 className="mt-1 text-3xl font-black">Túi Đồ</h1>
        <p className="muted mt-2">Xem vật phẩm đang sở hữu. Trang bị/sử dụng vật phẩm là workflow riêng, chưa mở nút giả ở đây.</p>
      </header>
      <ActionAlert message={params?.error} />

      <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Panel title="Đang trang bị">
          {equipped.length > 0 ? (
            <div className="item-grid">
              {equipped.map((item) => <ItemCard key={item.id} item={item} mode="equipped" />)}
            </div>
          ) : (
            <div className="empty-state"><b>Chưa trang bị gì.</b><p>Vật phẩm trang bị sẽ xuất hiện tại đây khi hệ thống equipment được nối đầy đủ.</p></div>
          )}
        </Panel>

        <Panel title={`Túi đồ (${inventory.length})`}>
          {inventory.length > 0 ? (
            <div className="item-grid">
              {inventory.map((item) => <ItemCard key={item.id} item={item} mode="inventory" />)}
            </div>
          ) : (
            <div className="empty-state">
              <b>Túi đồ đang trống.</b>
              <p>Lịch luyện hoặc giao dịch để nhận vật phẩm đầu tiên.</p>
              <Link href="/game/location" className="btn btn-secondary mt-4">Tới địa điểm</Link>
            </div>
          )}
        </Panel>
      </section>
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

function ItemCard({ item, mode }: { item: { id: string; quantity: number; enhancement: number; equippedSlot: string | null; bound: boolean; listings: { id: string; price: bigint; expiresAt: Date }[]; template: { name: string; category: string; rarity: string; description: string; equipSlot: string | null; tradeable: boolean } }; mode: "equipped" | "inventory" }) {
  const activeListing = item.listings[0];
  const canEquip = mode === "inventory" && item.template.category === "EQUIPMENT" && Boolean(item.template.equipSlot) && !activeListing;
  const canConsume = mode === "inventory" && item.template.category === "CONSUMABLE" && !activeListing;
  const canSell = mode === "inventory" && item.template.tradeable && !item.bound && !activeListing;
  return (
    <div className="item-card">
      <b>{item.template.name} x{item.quantity}</b>
      <span>{formatItemCategory(item.template.category)} · {formatRarity(item.template.rarity)}{item.equippedSlot ? ` · ${formatEquipmentSlot(item.equippedSlot)}` : ""}</span>
      <p>{item.template.description}</p>
      {activeListing ? <span className="badge">Đang rao {activeListing.price.toString()} Linh Thạch</span> : null}
      <div className="item-actions">
        {activeListing ? (
          <form action={cancelMarketListingAction}>
            <input type="hidden" name="listingId" value={activeListing.id} />
            <button className="btn btn-secondary w-full">Hủy rao bán</button>
          </form>
        ) : null}
        {mode === "equipped" ? (
          <form action={unequipItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button className="btn btn-secondary w-full">Tháo</button>
          </form>
        ) : null}
        {canEquip ? (
          <form action={equipItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button className="btn btn-secondary w-full">Trang bị</button>
          </form>
        ) : null}
        {canConsume ? (
          <form action={consumeItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button className="btn btn-secondary w-full">Sử dụng</button>
          </form>
        ) : null}
        {canSell ? (
          <form action={sellItemAction} className="sell-form">
            <input type="hidden" name="itemId" value={item.id} />
            <input className="field" name="price" inputMode="numeric" pattern="[0-9]+" min="1" placeholder="Giá bán" required />
            <button className="btn w-full">Rao bán</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

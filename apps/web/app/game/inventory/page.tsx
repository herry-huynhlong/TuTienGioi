import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { consumeItemAction, equipItemAction, unequipItemAction } from "@/lib/forms";
import { formatEquipmentSlot, formatItemCategory, formatRarity } from "@/lib/format";
import { getItemEconomy, jsonRecord } from "@ttg/game";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";
import { Box, Gem, Hammer, Leaf, Pill, ScrollText, Shield, Shirt, Sparkles, Swords } from "lucide-react";

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
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user!.id },
    include: {
      currentLocation: true,
      items: {
        where: { quantity: { gt: 0 } },
        include: { template: true, listings: { where: { status: "ACTIVE" }, select: { id: true, price: true, expiresAt: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  const selected = c.items.find((item) => item.id === params?.item) ?? c.items.find((item) => !item.equippedSlot) ?? c.items[0];
  const filter = params?.filter ?? "ALL";
  const equipped = c.items.filter((item) => item.equippedSlot);
  const inventory = c.items.filter((item) => !item.equippedSlot && (filter === "ALL" || item.template.category === filter));
  const atMarket = c.currentLocation?.key === "cho-linh-bao";

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
  const Icon = iconFor(economy.icon);
  return (
    <Link href={`/game/inventory?item=${item.id}`} className={`inventory-tile ${selected ? "selected" : ""}`} title={`${item.template.name}\n${economy.usage}\nGiá hệ thống: ${economy.systemBasePrice.toString()} Linh thạch`}>
      <span className="item-icon"><Icon size={22} aria-hidden /></span>
      <b>{item.template.name}</b>
      <small>{formatSubType(economy.subType, item.template.category)} · {formatRarity(item.template.rarity)} phẩm</small>
      <em>x{item.quantity}</em>
    </Link>
  );
}

function ItemDetail({ item, atMarket }: { item: InventoryItem; atMarket: boolean }) {
  const economy = getItemEconomy(item.template);
  const Icon = iconFor(economy.icon);
  const activeListing = item.listings[0];
  const canEquip = item.template.category === "EQUIPMENT" && Boolean(item.template.equipSlot) && !activeListing;
  const canConsume = item.template.category === "CONSUMABLE" && !activeListing;
  const canSell = item.template.tradeable && !item.bound && !activeListing;
  const modifiers = Object.entries(jsonRecord(item.template.baseModifiers)).filter(([, value]) => typeof value === "number" || typeof value === "string" || typeof value === "boolean");
  return (
    <div className="item-detail">
      <div className="item-detail-head">
        <span className="item-icon item-icon-large"><Icon size={30} aria-hidden /></span>
        <div>
          <h3>{item.template.name}</h3>
          <p>{formatItemCategory(item.template.category)} · {formatSubType(economy.subType, item.template.category)}</p>
        </div>
      </div>

      <div className="info-table mt-4">
        <div><span>Phẩm cấp</span><b>{formatRarity(item.template.rarity)} phẩm</b></div>
        <div><span>Số lượng</span><b>{item.quantity}</b></div>
        <div><span>Giá hệ thống</span><b>{economy.systemBasePrice.toString()} Linh thạch</b></div>
        <div><span>Vạn Bảo Lâu thu mua</span><b>{economy.sellableToNpc ? `${economy.npcBuyPrice.toString()} / cái` : "Không thu mua"}</b></div>
        <div><span>Giao dịch</span><b>{item.bound || !item.template.tradeable ? "Không thể giao dịch" : "Có thể giao dịch"}</b></div>
        {item.equippedSlot ? <div><span>Đang trang bị</span><b>{formatEquipmentSlot(item.equippedSlot)}</b></div> : null}
      </div>

      {modifiers.length > 0 ? (
        <div className="item-stat-list">
          {modifiers.map(([key, value]) => <span key={key}>{formatModifier(key)} <b>{formatModifierValue(value)}</b></span>)}
        </div>
      ) : null}

      <p className="muted mt-4">{item.template.description}</p>
      <p className="muted mt-2">{economy.usage}</p>
      {activeListing ? <p className="badge mt-4">Đang bày bán: {activeListing.price.toString()} Linh thạch / cái</p> : null}

      <div className="item-actions mt-4">
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
          <form action={consumeItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button className="btn btn-secondary w-full">Sử dụng</button>
          </form>
        ) : null}
        {canSell && atMarket ? <Link href={`/game/market?tab=sell&sellItem=${item.id}`} className="btn w-full">Rao bán</Link> : null}
        {canSell && !atMarket ? <Link href="/game/world?error=Bạn cần tới Chợ Linh Bảo để giao dịch." className="btn w-full">Tới Chợ Linh Bảo</Link> : null}
      </div>
    </div>
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
    boots: Shield,
    ring: Gem,
    talisman: ScrollText,
    pill: Pill,
    manual: ScrollText,
    scroll: ScrollText,
    gem: Gem,
    box: Box
  } as const)[icon] ?? Box;
}

function formatSubType(value: string, category: string) {
  if (["WEAPON", "ARMOR", "HELMET", "BOOTS", "RING", "TALISMAN", "ARTIFACT"].includes(value)) return formatEquipmentSlot(value);
  if (value === category) return formatItemCategory(category);
  return value;
}

function formatModifier(key: string) {
  return ({ attack: "Công kích", defense: "Phòng ngự", speed: "Tốc độ", spirit: "Thần thức", hp: "Sinh lực", qi: "Chân nguyên", hpRestore: "Hồi sinh lực", qiRestore: "Hồi chân nguyên", cultivation: "Tu vi", cultivationBps: "Tốc độ tu luyện" } as Record<string, string>)[key] ?? key;
}

function formatModifierValue(value: unknown) {
  if (typeof value === "number") return value > 0 ? `+${value}` : value.toString();
  if (typeof value === "boolean") return value ? "Có" : "Không";
  return String(value);
}

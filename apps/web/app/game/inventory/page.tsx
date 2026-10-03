import { prisma } from "@ttg/db";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { consumeItemAction, equipItemAction, sellItemToNpcAction, teleportItemAction, unequipItemAction } from "@/lib/forms";
import { formatEquipmentSlot, formatLocationKind, formatRarity } from "@/lib/format";
import { consolidateInventoryStacks, getItemEconomy, getItemUsageDefinition } from "@ttg/game";
import Link from "next/link";
import { ActionAlert } from "@/components/ActionAlert";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { GamePageBackground } from "@/components/GamePageBackground";
import { ItemDetailPanel, ItemSummaryCard, ItemVisual } from "@/components/ItemCard";
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
    key: string;
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
  if (user.character?.id) await consolidateInventoryStacks(prisma, user.character.id);
  const c = await prisma.character.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      currentLocation: { include: { routesFrom: { where: { active: true }, include: { destination: true }, orderBy: { dangerLevel: "asc" } } } },
      items: {
        where: { quantity: { gt: 0 } },
        include: { template: true, listings: { where: { status: "ACTIVE" }, select: { id: true, price: true, expiresAt: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  const filter = params?.filter ?? "ALL";
  const equipped = c.items.filter((item) => item.equippedSlot);
  const inventory = c.items.filter((item) => !item.equippedSlot && matchesInventoryFilter(item, filter));
  const selected = c.items.find((item) => item.id === params?.item) ?? inventory[0] ?? equipped[0];
  const atMarket = Array.isArray(c.currentLocation?.services) && c.currentLocation.services.includes("market");
  const teleportDestinations = c.currentLocation?.routesFrom.map((route) => route.destination).filter((destination) => destination.id !== c.currentLocationId && destination.active && !destination.services.includes("boss") && !destination.services.includes("quest_only") && !destination.services.includes("sealed")) ?? [];

  return (
    <GamePageBackground type="inventory">
    <div className="p-5 lg:p-8">
      <header className="mb-5 border-b border-white/10 pb-4">
        <p className="text-xs font-bold uppercase text-jade">Inventory</p>
        <h1 className="mt-1 text-3xl font-black">Túi Đồ</h1>
        <p className="muted mt-2">Quản lý vật phẩm, trang bị, đan dược và tài nguyên giao thương.</p>
      </header>
      <ActionAlert message={params?.error} />

      <section className="grid gap-5 xl:grid-cols-[.7fr_1fr_.95fr]">
        <Panel title="Trang bị">
          <div className="equipment-slot-grid">
            {equipmentSlots.map((slot) => {
              const item = equipped.find((entry) => entry.equippedSlot === slot);
              return <EquipmentSlotCard key={slot} slot={slot} item={item} selected={selected?.id === item?.id} />;
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
          {selected ? <ItemDetail item={selected} atMarket={atMarket} teleportDestinations={teleportDestinations} /> : <p className="muted">Chọn một vật phẩm để xem chi tiết.</p>}
        </Panel>
      </section>
    </div>
    </GamePageBackground>
  );
}

function EquipmentSlotCard({ slot, item, selected }: { slot: string; item: InventoryItem | undefined; selected: boolean }) {
  const label = formatEquipmentSlot(slot);
  const content = (
    <>
      <span className="equipment-slot-label">{label}</span>
      <span className="equipment-slot-visual">
        {item ? <ItemVisual template={item.template} size="card" /> : <span className="equipment-empty-mark">+</span>}
      </span>
      <b>{item?.template.name ?? label}</b>
      <small>{item ? `${formatRarity(item.template.rarity)} Phẩm` : "Trống"}</small>
    </>
  );
  if (!item) return <div className="equipment-slot-card empty">{content}</div>;
  return (
    <Link href={`/game/inventory?item=${item.id}`} className={`equipment-slot-card grade-${item.template.rarity.toLowerCase()} ${selected ? "selected" : ""}`}>
      {content}
    </Link>
  );
}

function InventoryFilters({ active }: { active: string }) {
  const filters = [
    ["ALL", "Tất cả"],
    ["CONSUMABLE", "Đan Dược"],
    ["EQUIPMENT", "Trang bị"],
    ["MATERIAL", "Nguyên liệu"],
    ["TALISMAN", "Phù"],
    ["FORMATION", "Trận Pháp"],
    ["TECHNIQUE", "Bí tịch"],
    ["QUEST", "Khác"]
  ];
  return (
    <div className="tab-row">
      {filters.map(([value, label]) => <Link key={value} href={`/game/inventory?filter=${value}`} className={active === value ? "active" : ""}>{label}</Link>)}
    </div>
  );
}

function matchesInventoryFilter(item: InventoryItem, filter: string) {
  if (filter === "ALL") return true;
  const economy = getItemEconomy(item.template);
  if (filter === "TALISMAN") return economy.subType.includes("Phù") || economy.icon === "scroll";
  if (filter === "FORMATION") return economy.subType.includes("Trận") || economy.icon === "formation";
  if (filter === "QUEST") return item.template.category === "QUEST" || item.template.category === "COSMETIC";
  return item.template.category === filter;
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
      priceLabel={<CurrencyAmount amount={economy.systemBasePrice} />}
      href={`/game/inventory?item=${item.id}`}
      selected={selected}
    />
  );
}

function ItemDetail({ item, atMarket, teleportDestinations }: { item: InventoryItem; atMarket: boolean; teleportDestinations: Array<{ id: string; name: string; kind: string }> }) {
  const activeListing = item.listings[0];
  const usage = getItemUsageDefinition(item.template);
  const canEquip = item.template.category === "EQUIPMENT" && Boolean(item.template.equipSlot) && !activeListing;
  const canConsume = usage.action === "USE" && usage.runtime === "ACTIVE" && !activeListing;
  const canSell = item.template.tradeable && !item.bound && !activeListing;
  const economy = getItemEconomy(item.template);
  const canTeleport = usage.effects.some((effect) => effect.type === "TELEPORT") && !activeListing;
  const canChangeAppearance = usage.effects.some((effect) => effect.type === "CHANGE_APPEARANCE") && !activeListing;
  return (
    <ItemDetailPanel
      template={item.template}
      source="Túi Đồ"
      details={[
        { label: "Số lượng", value: `x${item.quantity}` },
        { label: "Công dụng", value: usage.usable ? usage.effects.map(describeEffect).join(", ") || "Theo ngữ cảnh" : "Nguyên liệu / không dùng trực tiếp" },
        { label: "Có thể dùng", value: usage.usable ? `${usage.combatUsable ? "Combat" : ""}${usage.combatUsable && usage.outOfCombatUsable ? " / " : ""}${usage.outOfCombatUsable ? "Ngoài combat" : ""}` || "Theo ngữ cảnh" : "Không" },
        { label: "Mục tiêu", value: usage.targetType === "ENEMY" ? "Kẻ địch" : usage.targetType === "SELF" ? "Bản thân" : usage.targetType === "LOCATION" ? "Địa điểm" : usage.targetType === "DESTINATION" ? "Điểm đến" : usage.targetType === "SEAL" ? "Phong ấn" : "Theo ngữ cảnh" },
        { label: "Tiêu hao", value: usage.consumptionMode === "CONSUME_ONE" ? "1 vật phẩm" : usage.consumptionMode === "NONE" ? "Không" : usage.consumptionMode },
        ...(usage.durationSeconds ? [{ label: "Thời lượng", value: `${Math.round(usage.durationSeconds / 60)} phút` }] : []),
        ...(usage.reason ? [{ label: "Điều kiện dùng", value: usage.reason }] : []),
        { label: "Điều kiện", value: item.bound || !item.template.tradeable ? "Không thể giao dịch" : "Có thể giao dịch" },
        ...(item.equippedSlot ? [{ label: "Đang trang bị", value: formatEquipmentSlot(item.equippedSlot) }] : [])
      ]}
      action={(
        <>
          {activeListing ? <p className="badge">Đang bày bán: <CurrencyAmount amount={activeListing.price} /></p> : null}
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
        {canTeleport ? (
          <form action={teleportItemAction} className="sell-mode-card">
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="actionKey" value={`teleport:${item.id}:${item.quantity}`} />
            <h3>Dịch chuyển</h3>
            <p className="muted">Chỉ tới địa điểm đã biết và không bị khóa.</p>
            {teleportDestinations.length > 0 ? (
              <>
                <select name="destinationLocationId" className="form-input">
                  {teleportDestinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name} · {formatLocationKind(destination.kind)}</option>)}
                </select>
                <button className="btn w-full">Dịch chuyển</button>
              </>
            ) : (
              <button className="btn w-full" disabled>Không có điểm đến hợp lệ</button>
            )}
          </form>
        ) : null}
        {canChangeAppearance ? (
          <Link href="/game/settings#appearance" className="btn w-full">Đổi ngoại hình</Link>
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

function describeEffect(effect: { type: string; payload: Record<string, unknown> }) {
  if (effect.type === "DEAL_DAMAGE") {
    const element = effect.payload.element === "FIRE" ? "Hỏa" : effect.payload.element === "LIGHTNING" ? "Lôi" : "thuộc tính";
    const hitCount = typeof effect.payload.hitCount === "number" && effect.payload.hitCount > 1 ? ` x${effect.payload.hitCount}` : "";
    return `Gây sát thương ${element}${hitCount}`;
  }
  if (effect.type === "APPLY_SHIELD") return `Tạo Hộ Thuẫn ${String(effect.payload.durationTurns ?? 3)} lượt`;
  if (effect.type === "APPLY_DEBUFF") return "Giảm 30% Speed trong 3 lượt";
  if (effect.type === "BUFF_STAT") {
    if (effect.payload.effectType === "DEFENSE_BPS") return "Tăng 25% phòng ngự trong 5 lượt";
    if (effect.payload.effectType === "STATUS_RESISTANCE_BPS") return "Tăng 30% kháng trạng thái";
    if (effect.payload.effectType === "SPEED_BPS") return "Tăng Speed tạm thời";
  }
  if (effect.type === "BREAKTHROUGH_BONUS") return "Hỗ trợ đột phá";
  if (effect.type === "ESCAPE") return "Rút khỏi biến cố thường";
  if (effect.type === "TELEPORT") return "Dịch chuyển tới địa điểm đã biết";
  if (effect.type === "BREAK_SEAL") return `Phá phong ấn cấp ${String(effect.payload.grade ?? 1)}`;
  if (effect.type === "CHANGE_APPEARANCE") return "Thay đổi ngoại hình nhân vật";
  return effect.type;
}


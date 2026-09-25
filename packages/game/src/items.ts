import type { ItemCategory, ItemTemplate, Rarity } from "@ttg/db";

export type ItemEconomy = {
  subType: string;
  icon: string;
  usage: string;
  systemBasePrice: bigint;
  npcBuyPrice: bigint;
  sellableToNpc: boolean;
};

type TemplateLike = {
  category: ItemCategory | string;
  rarity: Rarity | string;
  bindRules: unknown;
  baseModifiers: unknown;
  equipSlot?: string | null;
  tradeable: boolean;
};

const rarityPriceBps: Record<string, number> = {
  PHAM: 8000,
  HA: 10000,
  TRUNG: 18000,
  THUONG: 32000,
  CUC: 50000,
  HOANG: 80000,
  HUYEN: 120000,
  DIA: 180000,
  THIEN: 260000,
  TIEN: 400000
};

const categoryBasePrice: Record<string, bigint> = {
  MATERIAL: 25n,
  CONSUMABLE: 80n,
  EQUIPMENT: 180n,
  TECHNIQUE: 260n,
  COSMETIC: 120n,
  QUEST: 0n
};

const categoryIcon: Record<string, string> = {
  MATERIAL: "leaf",
  CONSUMABLE: "pill",
  EQUIPMENT: "sword",
  TECHNIQUE: "manual",
  COSMETIC: "gem",
  QUEST: "scroll"
};

const categoryUsage: Record<string, string> = {
  MATERIAL: "Nguyên liệu luyện chế hoặc giao thương.",
  CONSUMABLE: "Có thể sử dụng trực tiếp để nhận hiệu quả.",
  EQUIPMENT: "Có thể trang bị nếu phù hợp vị trí.",
  TECHNIQUE: "Bí tịch dùng để lĩnh ngộ công pháp.",
  COSMETIC: "Vật phẩm ngoại quan.",
  QUEST: "Vật phẩm liên quan nhiệm vụ."
};

const equipmentIcon: Record<string, string> = {
  WEAPON: "sword",
  ARMOR: "armor",
  HELMET: "armor",
  BOOTS: "boots",
  RING: "ring",
  TALISMAN: "talisman",
  ARTIFACT: "gem"
};

export function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function bigintFromMeta(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return BigInt(Math.floor(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function stringFromMeta(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getItemEconomy(template: TemplateLike): ItemEconomy {
  const meta = jsonRecord(template.bindRules);
  const systemBasePrice = bigintFromMeta(meta.systemBasePrice) ?? calculateSystemBasePrice(template.category, template.rarity, template.baseModifiers);
  const defaultNpcBuyPrice = (systemBasePrice * 7000n) / 10000n;
  const sellableToNpc = typeof meta.sellableToNpc === "boolean" ? meta.sellableToNpc : template.tradeable && template.category !== "QUEST";
  return {
    subType: stringFromMeta(meta.subType) ?? inferSubType(template.category, template.equipSlot),
    icon: stringFromMeta(meta.icon) ?? inferIcon(template.category, template.equipSlot),
    usage: stringFromMeta(meta.usage) ?? categoryUsage[template.category] ?? "Vật phẩm có thể dùng trong hành trình tu luyện.",
    systemBasePrice,
    npcBuyPrice: bigintFromMeta(meta.npcBuyPrice) ?? defaultNpcBuyPrice,
    sellableToNpc
  };
}

export function calculateSystemBasePrice(category: ItemCategory | string, rarity: Rarity | string, modifiers: unknown): bigint {
  const base = categoryBasePrice[category] ?? 20n;
  const bps = rarityPriceBps[rarity] ?? 10000;
  const modifierScore = Object.values(jsonRecord(modifiers)).reduce<number>((sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? Math.abs(value) : 0), 0);
  return ((base + BigInt(Math.round(modifierScore * 4))) * BigInt(bps)) / 10000n;
}

export function inferIcon(category: ItemCategory | string, equipSlot?: string | null) {
  if (equipSlot && equipmentIcon[equipSlot]) return equipmentIcon[equipSlot];
  return categoryIcon[category] ?? "box";
}

export function inferSubType(category: ItemCategory | string, equipSlot?: string | null) {
  if (equipSlot) return equipSlot;
  return category;
}

export function marketListingMaxQuantity(ownedQuantity: number) {
  return Math.max(0, Math.min(10, ownedQuantity));
}

import type { ItemCategory, ItemTemplate, Rarity } from "@ttg/db";

export type ItemEconomy = {
  subType: string;
  icon: string;
  visualKey: string;
  usage: string;
  systemBasePrice: bigint;
  npcBuyPrice: bigint;
  sellableToNpc: boolean;
  marketEnabled: boolean;
  systemMarketEnabled: boolean;
  sectExchangeEnabled: boolean;
  sectContributionPrice: number;
  donationContributionValue: number;
  auctionEligible: boolean;
  auctionClass: "NONE" | "STANDARD" | "PREMIUM";
  requiredRealmOrder: number | null;
  requiredSectRank: number | null;
  itemFamily: string | null;
  sources: string[];
};

type TemplateLike = {
  category: ItemCategory | string;
  rarity: Rarity | string;
  bindRules: unknown;
  baseModifiers: unknown;
  equipSlot?: string | null;
  tradeable: boolean;
  itemFamily?: string | null;
};

export type ProgressionItemDefinition = {
  key: string;
  itemFamily?: string;
  name: string;
  category: "MATERIAL" | "CONSUMABLE";
  rarity: "HA" | "TRUNG" | "THUONG";
  subType: string;
  icon: string;
  description: string;
  usage: string;
  basePrice: number;
  sectContributionPrice: number;
  systemMarketEnabled: boolean;
  auctionEligible?: boolean;
  tradeable?: boolean;
  sellableToNpc?: boolean;
  marketEnabled?: boolean;
  baseModifiers?: Record<string, number | boolean>;
  requiredRealmOrder?: number;
  requiredSectRank?: number;
  sources: string[];
};

const sellPriceBps = 7000n;

export const marketConfig = {
  buyMultiplierBps: 10000n,
  sellMultiplierBps: sellPriceBps,
  stockByRarity: {
    PHAM: { min: 30, max: 120 },
    HA: { min: 18, max: 60 },
    TRUNG: { min: 10, max: 34 },
    THUONG: { min: 3, max: 12 },
    CUC: { min: 0, max: 0 },
    HOANG: { min: 0, max: 0 },
    HUYEN: { min: 0, max: 0 },
    DIA: { min: 0, max: 0 },
    THIEN: { min: 0, max: 0 },
    TIEN: { min: 0, max: 0 }
  }
} as const;

export const progressionItemCatalog: ProgressionItemDefinition[] = [
  { key: "thanh-linh-thao", name: "Thanh Linh Thảo", category: "MATERIAL", rarity: "HA", subType: "Linh Thảo", icon: "herb", description: "Linh thảo phổ biến ở nơi linh khí mỏng.", usage: "Luyện đan cơ bản, nhiệm vụ thu thập, Linh Điền và giao dịch.", basePrice: 20, sectContributionPrice: 10, systemMarketEnabled: true, sources: ["Thanh Trúc Lâm", "Linh Khê", "Linh Điền"] },
  { key: "ngung-khi-thao", name: "Ngưng Khí Thảo", category: "MATERIAL", rarity: "HA", subType: "Linh Thảo", icon: "herb", description: "Lá cỏ ngưng tụ khí tức nhẹ, hợp với giai đoạn nhập môn.", usage: "Nguyên liệu đan dược và tu luyện giai đoạn đầu.", basePrice: 35, sectContributionPrice: 15, systemMarketEnabled: true, sources: ["Thanh Trúc Lâm", "Linh Khê"] },
  { key: "hac-thiet-quang", name: "Hắc Thiết Quặng", category: "MATERIAL", rarity: "HA", subType: "Khoáng Vật", icon: "ore", description: "Khoáng thạch đen nặng, dùng cho luyện khí sơ cấp.", usage: "Luyện khí cơ bản, nhiệm vụ, Tông Môn và Linh Khoáng.", basePrice: 30, sectContributionPrice: 15, systemMarketEnabled: true, sources: ["Thanh Vân Sơn", "Linh Khoáng"] },
  { key: "xich-dong-quang", name: "Xích Đồng Quặng", category: "MATERIAL", rarity: "HA", subType: "Khoáng Vật", icon: "ore", description: "Quặng đồng đỏ có thể dẫn linh lực yếu.", usage: "Luyện khí, crafting và mission.", basePrice: 40, sectContributionPrice: 20, systemMarketEnabled: true, sources: ["Thanh Vân Sơn", "Linh Khoáng"] },
  { key: "hoi-khi-dan", name: "Hồi Khí Đan", category: "CONSUMABLE", rarity: "HA", subType: "Đan Dược", icon: "pill", description: "Đan dược hạ phẩm giúp phục hồi chân nguyên.", usage: "Hồi Chân Nguyên khi lịch luyện hoặc chiến đấu.", basePrice: 80, sectContributionPrice: 40, systemMarketEnabled: true, baseModifiers: { qiRestore: 60 }, sources: ["Chợ Linh Bảo", "Luyện Đan"] },
  { key: "duong-the-dan", name: "Dưỡng Thể Đan", category: "CONSUMABLE", rarity: "HA", subType: "Đan Dược", icon: "pill", description: "Đan dược ôn dưỡng thân thể.", usage: "Hỗ trợ hồi phục Sinh Lực và Thể Lực trong progression hiện tại.", basePrice: 100, sectContributionPrice: 50, systemMarketEnabled: true, baseModifiers: { hpRestore: 80 }, sources: ["Chợ Linh Bảo", "Luyện Đan"] },
  { key: "truc-co-dan-ha", itemFamily: "truc-co-dan", name: "Trúc Cơ Đan", category: "CONSUMABLE", rarity: "HA", subType: "Đan Dược", icon: "pill", description: "Trúc Cơ Đan hạ phẩm, dùng cho tu sĩ Luyện Khí chuẩn bị đột phá.", usage: "Tăng nhẹ cơ hội đột phá Trúc Cơ. Đây là Hạ Phẩm dù tên gắn với cảnh giới Trúc Cơ.", basePrice: 400, sectContributionPrice: 200, systemMarketEnabled: true, baseModifiers: { breakthroughBps: 400 }, requiredRealmOrder: 1, sources: ["Chợ Linh Bảo", "Nhiệm vụ Tông Môn"] },
  { key: "yeu-thu-bi", name: "Yêu Thú Bì", category: "MATERIAL", rarity: "HA", subType: "Nguyên Liệu Yêu Thú", icon: "hide", description: "Da yêu thú cấp thấp, còn lưu yêu khí mỏng.", usage: "Drop yêu thú, crafting và mission.", basePrice: 25, sectContributionPrice: 10, systemMarketEnabled: true, sources: ["Yêu thú thường", "Thanh Trúc Lâm"] },
  { key: "yeu-thu-nha", name: "Yêu Thú Nha", category: "MATERIAL", rarity: "HA", subType: "Nguyên Liệu Yêu Thú", icon: "fang", description: "Nanh yêu thú cấp thấp.", usage: "Drop yêu thú, crafting và mission.", basePrice: 30, sectContributionPrice: 10, systemMarketEnabled: true, sources: ["Yêu thú thường", "Hắc Sơn"] },
  { key: "linh-moc", name: "Linh Mộc", category: "MATERIAL", rarity: "HA", subType: "Vật Liệu Tông Môn", icon: "wood", description: "Gỗ thấm linh khí, dùng cho kiến thiết cơ bản.", usage: "Tông Môn, crafting và mission.", basePrice: 50, sectContributionPrice: 25, systemMarketEnabled: true, sources: ["Linh Khê", "Linh Điền"] },
  { key: "tu-diep-linh-thao", name: "Tử Diệp Linh Thảo", category: "MATERIAL", rarity: "TRUNG", subType: "Linh Thảo", icon: "herb", description: "Linh thảo lá tím dùng cho đan dược trung cấp.", usage: "Luyện đan trung cấp và mission.", basePrice: 350, sectContributionPrice: 150, systemMarketEnabled: true, sources: ["Thanh Vân Sơn", "Nhiệm vụ ★★★"] },
  { key: "huyen-thiet", name: "Huyền Thiết", category: "MATERIAL", rarity: "TRUNG", subType: "Khoáng Vật", icon: "ore", description: "Khoáng thiết cứng và ổn định linh lực.", usage: "Luyện khí, Tông Môn, mission và Linh Khoáng.", basePrice: 500, sectContributionPrice: 220, systemMarketEnabled: true, sources: ["Linh Khoáng", "Thanh Linh Sơn Mạch"] },
  { key: "tinh-dong", name: "Tinh Đồng", category: "MATERIAL", rarity: "TRUNG", subType: "Khoáng Vật", icon: "ore", description: "Đồng đã ngưng luyện, hợp luyện khí.", usage: "Luyện khí và crafting.", basePrice: 450, sectContributionPrice: 200, systemMarketEnabled: true, sources: ["Linh Khoáng"] },
  { key: "bich-ngoc-tuy", name: "Bích Ngọc Tủy", category: "MATERIAL", rarity: "TRUNG", subType: "Vật Liệu Tu Luyện", icon: "crystal", description: "Ngọc tủy xanh dịu, chứa linh vận tinh thuần.", usage: "Tu luyện, crafting và mission.", basePrice: 800, sectContributionPrice: 350, systemMarketEnabled: true, sources: ["Thanh Linh Sơn Mạch", "Nhiệm vụ"] },
  { key: "tu-khi-dan", name: "Tụ Khí Đan", category: "CONSUMABLE", rarity: "TRUNG", subType: "Đan Dược", icon: "pill", description: "Đan dược trung phẩm giúp tụ khí nhanh hơn.", usage: "Tăng tu vi hoặc hồi Chân Nguyên theo hệ effect hiện tại.", basePrice: 1000, sectContributionPrice: 450, systemMarketEnabled: true, baseModifiers: { cultivation: 250, qiRestore: 120 }, sources: ["Chợ Linh Bảo", "Luyện Đan"] },
  { key: "duong-hon-dan", name: "Dưỡng Hồn Đan", category: "CONSUMABLE", rarity: "TRUNG", subType: "Đan Dược", icon: "pill", description: "Đan dược dưỡng thần hồn, hiện dùng làm item data.", usage: "Hỗ trợ thần thức khi hệ thống thần hồn mở về sau.", basePrice: 1200, sectContributionPrice: 500, systemMarketEnabled: true, baseModifiers: { spirit: 1 }, sources: ["Luyện Đan", "Nhiệm vụ"] },
  { key: "truc-co-dan-trung", itemFamily: "truc-co-dan", name: "Trúc Cơ Đan · Trung Phẩm", category: "CONSUMABLE", rarity: "TRUNG", subType: "Đan Dược", icon: "pill", description: "Trúc Cơ Đan trung phẩm, độ tinh luyện tốt hơn.", usage: "Tăng cơ hội đột phá Trúc Cơ tốt hơn bản Hạ Phẩm.", basePrice: 1800, sectContributionPrice: 800, systemMarketEnabled: true, baseModifiers: { breakthroughBps: 800 }, requiredRealmOrder: 1, sources: ["Chợ Linh Bảo stock thấp", "Tông Môn"] },
  { key: "yeu-dan-nhat-giai", name: "Yêu Đan Nhất Giai", category: "MATERIAL", rarity: "TRUNG", subType: "Vật Liệu Tu Luyện", icon: "core", description: "Yêu đan của yêu thú mạnh hơn bình thường.", usage: "Drop yêu thú mạnh, tu luyện, crafting và mission.", basePrice: 1500, sectContributionPrice: 650, systemMarketEnabled: true, sources: ["Yêu thú mạnh", "Nhiệm vụ ★★★"] },
  { key: "huyen-thu-cot", name: "Huyền Thú Cốt", category: "MATERIAL", rarity: "TRUNG", subType: "Nguyên Liệu Yêu Thú", icon: "bone", description: "Xương yêu thú đã hấp thu linh khí lâu năm.", usage: "Crafting và mission.", basePrice: 700, sectContributionPrice: 300, systemMarketEnabled: true, sources: ["Yêu thú mạnh"] },
  { key: "tu-linh-thach", name: "Tụ Linh Thạch", category: "MATERIAL", rarity: "TRUNG", subType: "Vật Liệu Tu Luyện", icon: "crystal", description: "Linh thạch đặc biệt giúp tụ linh trong động phủ.", usage: "Hỗ trợ tu luyện, Động Phủ, Tông Môn và crafting.", basePrice: 2000, sectContributionPrice: 900, systemMarketEnabled: true, sources: ["Linh Khoáng", "Tông Môn"] },
  { key: "thien-linh-thao", name: "Thiên Linh Thảo", category: "MATERIAL", rarity: "THUONG", subType: "Linh Thảo", icon: "herb", description: "Linh thảo thượng phẩm cực hiếm.", usage: "Luyện đan cao cấp, nhiệm vụ khó và sự kiện.", basePrice: 5000, sectContributionPrice: 2000, systemMarketEnabled: false, sources: ["Nhiệm vụ khó", "Bí cảnh"] },
  { key: "huyen-tinh", name: "Huyền Tinh", category: "MATERIAL", rarity: "THUONG", subType: "Khoáng Vật", icon: "crystal", description: "Tinh thể huyền quang, sinh ra trong khoáng mạch hiếm.", usage: "Luyện khí cao cấp và Tông Môn.", basePrice: 8000, sectContributionPrice: 3000, systemMarketEnabled: false, auctionEligible: true, sources: ["Linh Khoáng cấp cao"] },
  { key: "xich-viem-tinh-kim", name: "Xích Viêm Tinh Kim", category: "MATERIAL", rarity: "THUONG", subType: "Khoáng Vật", icon: "ore", description: "Tinh kim đỏ rực mang địa hỏa.", usage: "Luyện khí thượng phẩm.", basePrice: 12000, sectContributionPrice: 4500, systemMarketEnabled: false, auctionEligible: true, sources: ["Hỏa Diệm Linh Mạch", "Lịch Luyện hiếm"] },
  { key: "ngoc-tuy-tinh-hoa", name: "Ngọc Tủy Tinh Hoa", category: "MATERIAL", rarity: "THUONG", subType: "Vật Liệu Tu Luyện", icon: "crystal", description: "Tinh hoa ngọc tủy đã kết tụ nhiều năm.", usage: "Tu luyện, crafting và nhiệm vụ khó.", basePrice: 15000, sectContributionPrice: 5000, systemMarketEnabled: false, auctionEligible: true, sources: ["Nhiệm vụ Tông Môn ★★★★★", "Lịch Luyện hiếm"] },
  { key: "truc-co-dan-thuong", itemFamily: "truc-co-dan", name: "Trúc Cơ Đan · Thượng Phẩm", category: "CONSUMABLE", rarity: "THUONG", subType: "Đan Dược", icon: "pill", description: "Trúc Cơ Đan thượng phẩm, tinh luyện cao.", usage: "Tăng mạnh cơ hội đột phá Trúc Cơ, không đồng nghĩa người dùng phải ở cảnh giới cao.", basePrice: 10000, sectContributionPrice: 4000, systemMarketEnabled: false, auctionEligible: true, baseModifiers: { breakthroughBps: 1400 }, requiredRealmOrder: 1, sources: ["Luyện Đan"] },
  { key: "tay-tuy-dan", name: "Tẩy Tủy Đan", category: "CONSUMABLE", rarity: "THUONG", subType: "Đan Dược", icon: "pill", description: "Đan dược tẩy luyện kinh mạch.", usage: "Vật phẩm hiếm, hiệu ứng sâu hơn sẽ mở về sau.", basePrice: 18000, sectContributionPrice: 6000, systemMarketEnabled: false, auctionEligible: true, baseModifiers: { hpRestore: 200, qiRestore: 200 }, sources: ["Luyện Đan", "Boss cấp cao"] },
  { key: "yeu-dan-nhi-giai", name: "Yêu Đan Nhị Giai", category: "MATERIAL", rarity: "THUONG", subType: "Vật Liệu Tu Luyện", icon: "core", description: "Yêu đan nhị giai chứa yêu lực dày.", usage: "Tu luyện, crafting và mission khó.", basePrice: 14000, sectContributionPrice: 5000, systemMarketEnabled: false, auctionEligible: true, sources: ["Elite / Boss yêu thú"] },
  { key: "thien-tam-ti", name: "Thiên Tàm Ti", category: "MATERIAL", rarity: "THUONG", subType: "Vật liệu crafting", icon: "silk", description: "Sợi tằm trời bền nhẹ, dùng chế tạo pháp y.", usage: "Crafting cao cấp và nhiệm vụ.", basePrice: 9000, sectContributionPrice: 3500, systemMarketEnabled: false, auctionEligible: true, sources: ["Lịch Luyện hiếm", "Nhiệm vụ Tông Môn khó"] },
  { key: "dia-mach-linh-tinh", name: "Địa Mạch Linh Tinh", category: "MATERIAL", rarity: "THUONG", subType: "Vật Liệu Tu Luyện", icon: "crystal", description: "Tinh thể sinh trong địa mạch nồng đậm.", usage: "Động Phủ, Tông Môn, tu luyện và crafting.", basePrice: 22000, sectContributionPrice: 7000, systemMarketEnabled: false, auctionEligible: true, sources: ["Linh Khoáng Tông Môn cấp cao"] },
  { key: "tu-linh-ngoc", name: "Tụ Linh Ngọc", category: "MATERIAL", rarity: "THUONG", subType: "Vật Liệu Tu Luyện", icon: "gem", description: "Ngọc tụ linh thượng phẩm, giá trị cao.", usage: "Hỗ trợ tu luyện, Động Phủ, Tông Môn và crafting.", basePrice: 28000, sectContributionPrice: 8000, systemMarketEnabled: false, auctionEligible: true, sources: ["Boss cấp cao", "Nhiệm vụ Tông Môn ★★★★★"] }
];

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

export const itemSpecificVisualKeys = [
  "thanh-linh-thao",
  "ngung-khi-thao",
  "hac-thiet-quang",
  "xich-dong-quang",
  "hoi-khi-dan",
  "duong-the-dan",
  "truc-co-dan-ha",
  "yeu-thu-bi",
  "yeu-thu-nha",
  "linh-moc",
  "tu-diep-linh-thao",
  "huyen-thiet",
  "tinh-dong",
  "bich-ngoc-tuy",
  "tu-khi-dan",
  "duong-hon-dan",
  "truc-co-dan-trung",
  "yeu-dan-nhat-giai",
  "huyen-thu-cot",
  "tu-linh-thach",
  "thien-linh-thao",
  "huyen-tinh",
  "xich-viem-tinh-kim",
  "ngoc-tuy-tinh-hoa",
  "truc-co-dan-thuong",
  "tay-tuy-dan",
  "yeu-dan-nhi-giai",
  "thien-tam-ti",
  "dia-mach-linh-tinh",
  "tu-linh-ngoc",
  "huyen-thiet-kiem",
  "thanh-van-dao-bao",
  "thiet-moc-ho-phu",
  "nhan-tu-linh",
  "giay-than-hanh",
  "hoi-xuan-dan",
  "tu-linh-dan",
  "pha-canh-dan",
  "giai-doc-dan",
  "linh-thach"
] as const;

const itemSpecificVisualKeySet = new Set<string>(itemSpecificVisualKeys);

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

function stringArrayFromMeta(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim());
}

export function getItemEconomy(template: TemplateLike): ItemEconomy {
  const meta = jsonRecord(template.bindRules);
  const systemBasePrice = bigintFromMeta(meta.systemBasePrice) ?? calculateSystemBasePrice(template.category, template.rarity, template.baseModifiers);
  const defaultNpcBuyPrice = (systemBasePrice * marketConfig.sellMultiplierBps) / 10000n;
  const sellableToNpc = typeof meta.sellableToNpc === "boolean" ? meta.sellableToNpc : template.tradeable && template.category !== "QUEST";
  const sectContributionPrice = numberFromMeta(meta.sectContributionPrice) ?? defaultSectContributionPrice(template.rarity, systemBasePrice);
  return {
    subType: stringFromMeta(meta.subType) ?? inferSubType(template.category, template.equipSlot),
    icon: stringFromMeta(meta.icon) ?? inferIcon(template.category, template.equipSlot),
    visualKey: stringFromMeta(meta.visualKey) ?? itemVisualKey({ category: template.category, icon: stringFromMeta(meta.icon) ?? inferIcon(template.category, template.equipSlot), equipSlot: template.equipSlot }),
    usage: stringFromMeta(meta.usage) ?? categoryUsage[template.category] ?? "Vật phẩm có thể dùng trong hành trình tu luyện.",
    systemBasePrice,
    npcBuyPrice: bigintFromMeta(meta.npcBuyPrice) ?? defaultNpcBuyPrice,
    sellableToNpc,
    marketEnabled: boolFromMeta(meta.marketEnabled, template.tradeable),
    systemMarketEnabled: boolFromMeta(meta.systemMarketEnabled, false),
    sectExchangeEnabled: boolFromMeta(meta.sectExchangeEnabled, template.tradeable),
    sectContributionPrice,
    donationContributionValue: numberFromMeta(meta.donationContributionValue) ?? Math.max(1, Math.floor(sectContributionPrice * 0.4)),
    auctionEligible: boolFromMeta(meta.auctionEligible, String(template.rarity) === "TIEN"),
    auctionClass: auctionClassFromMeta(meta.auctionClass),
    requiredRealmOrder: numberFromMeta(meta.requiredRealmOrder),
    requiredSectRank: numberFromMeta(meta.requiredSectRank),
    itemFamily: stringFromMeta(meta.itemFamily) ?? template.itemFamily ?? null,
    sources: stringArrayFromMeta(meta.sources)
  };
}

function auctionClassFromMeta(value: unknown): "NONE" | "STANDARD" | "PREMIUM" {
  return value === "STANDARD" || value === "PREMIUM" ? value : "NONE";
}

export function canAuctionItem(template: TemplateLike) {
  const economy = getItemEconomy(template);
  if (!economy.auctionEligible || !template.tradeable) return false;
  if (String(template.category) === "EQUIPMENT") return economy.auctionClass === "PREMIUM";
  return true;
}

export function auctionClassLabel(template: TemplateLike) {
  const economy = getItemEconomy(template);
  return economy.auctionClass === "PREMIUM" ? "Trân Phẩm" : economy.auctionClass === "STANDARD" ? "Đấu Giá" : "";
}

function boolFromMeta(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function numberFromMeta(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function defaultSectContributionPrice(rarity: Rarity | string, basePrice: bigint) {
  const price = Number(basePrice);
  if (rarity === "THUONG") return Math.max(1000, Math.ceil(price * 0.32));
  if (rarity === "TRUNG") return Math.max(100, Math.ceil(price * 0.45));
  return Math.max(5, Math.ceil(price * 0.5));
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

export function itemVisualKey(item: { key?: string | null | undefined; category: ItemCategory | string; icon?: string | null | undefined; equipSlot?: string | null | undefined }) {
  if (item.key && itemSpecificVisualKeySet.has(item.key)) return item.key;
  const icon = item.icon ?? inferIcon(item.category, item.equipSlot);
  if (icon === "ore" || icon === "metal") return "default-ore";
  if (icon === "crystal" || icon === "core") return "default-crystal";
  if (icon === "formation" || icon === "flag") return "default-formation";
  if (icon === "paper" || icon === "powder" || icon === "ink") return "default-talisman";
  if (icon === "pill") return "default-pill";
  if (icon === "herb" || icon === "leaf") return "default-herb";
  if (icon === "sword") return "default-weapon";
  if (icon === "armor" || icon === "boots") return "default-armor";
  if (icon === "manual" || icon === "scroll") return "default-manual";
  if (icon === "gem" || icon === "ring" || icon === "talisman") return "default-artifact";
  return "default-material";
}

export function itemVisualFallbackKey(item: { category: ItemCategory | string; icon?: string | null | undefined; equipSlot?: string | null | undefined }) {
  return itemVisualKey({ category: item.category, icon: item.icon, equipSlot: item.equipSlot });
}

export function marketListingMaxQuantity(ownedQuantity: number) {
  return Math.max(0, Math.min(10, ownedQuantity));
}

export function currentSystemMarketPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const periodIndex = Math.floor((now.getTime() - start.getTime()) / (6 * 60 * 60_000));
  return `${start.toISOString().slice(0, 10)}:${periodIndex}`;
}

export function stockForSystemMarketItem(key: string, rarity: Rarity | string, now = new Date()) {
  const config = marketConfig.stockByRarity[String(rarity) as keyof typeof marketConfig.stockByRarity] ?? { min: 0, max: 0 };
  if (config.max <= 0) return 0;
  const seed = [...`${currentSystemMarketPeriod(now)}:${key}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return config.min + (seed % (config.max - config.min + 1));
}

export function itemStackKey(item: { templateId: string; quality: number; enhancement: number; bound: boolean; durability?: number | null; equippedSlot?: string | null; customModifiers?: unknown }) {
  return JSON.stringify({
    templateId: item.templateId,
    quality: item.quality,
    enhancement: item.enhancement,
    bound: item.bound,
    durability: item.durability ?? null,
    equippedSlot: item.equippedSlot ?? null,
    customModifiers: jsonRecord(item.customModifiers)
  });
}

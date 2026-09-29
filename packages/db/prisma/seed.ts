import argon2 from "argon2";
import { PrismaClient, Rarity, ItemCategory, EquipmentSlot, ProfessionRank, RecipeUnlockType } from "@prisma/client";
import { coreProfessionRecipes } from "./professionSeedData";

const prisma = new PrismaClient();

const itemSpecificVisualKeys = new Set([
  "thanh-linh-thao", "ngung-khi-thao", "hac-thiet-quang", "xich-dong-quang", "hoi-khi-dan", "duong-the-dan", "truc-co-dan-ha", "yeu-thu-bi",
  "yeu-thu-nha", "linh-moc", "tu-diep-linh-thao", "huyen-thiet", "tinh-dong", "bich-ngoc-tuy", "tu-khi-dan", "duong-hon-dan",
  "truc-co-dan-trung", "yeu-dan-nhat-giai", "huyen-thu-cot", "tu-linh-thach", "thien-linh-thao", "huyen-tinh", "xich-viem-tinh-kim", "ngoc-tuy-tinh-hoa",
  "truc-co-dan-thuong", "tay-tuy-dan", "yeu-dan-nhi-giai", "thien-tam-ti", "dia-mach-linh-tinh", "tu-linh-ngoc", "huyen-thiet-kiem", "thanh-van-dao-bao",
  "thiet-moc-ho-phu", "nhan-tu-linh", "giay-than-hanh", "hoi-xuan-dan", "tu-linh-dan", "pha-canh-dan", "giai-doc-dan", "linh-thach"
]);

function itemVisualKey(key: string, category: string, icon: string, equipSlot?: string | null) {
  if (itemSpecificVisualKeys.has(key)) return key;
  if (icon === "ore" || icon === "metal") return "default-ore";
  if (icon === "crystal" || icon === "core") return "default-crystal";
  if (icon === "formation" || icon === "flag") return "default-formation";
  if (icon === "paper" || icon === "powder" || icon === "ink") return "default-talisman";
  if (icon === "pill") return "default-pill";
  if (icon === "herb" || icon === "leaf") return "default-herb";
  if (icon === "sword") return "default-weapon";
  if (icon === "armor" || icon === "boots") return "default-armor";
  if (icon === "manual" || icon === "scroll") return "default-manual";
  if (icon === "formation" || icon === "flag") return "default-artifact";
  if (icon === "gem" || icon === "ring" || icon === "talisman") return "default-artifact";
  if (category === "EQUIPMENT" && equipSlot === "WEAPON") return "default-weapon";
  if (category === "EQUIPMENT") return "default-armor";
  return "default-material";
}

function professionItemVisualKey(key: string, category: string, icon: string, equipSlot?: string | null) {
  const folder = icon === "pill" ? "pill"
    : icon === "sword" ? "weapon"
    : icon === "armor" || icon === "boots" ? "armor"
    : icon === "ring" || icon === "talisman" || icon === "artifact" ? "accessory"
    : icon === "scroll" || icon === "paper" ? "talisman"
    : icon === "formation" || icon === "flag" ? "formation"
    : icon === "herb" || icon === "leaf" || icon === "root" || icon === "flower" || icon === "mushroom" ? "herb"
    : icon === "fruit" ? "fruit"
    : icon === "ore" || icon === "metal" ? "ore"
    : icon === "crystal" || icon === "gem" || icon === "core" ? "crystal"
    : icon === "hide" || icon === "fang" || icon === "bone" || icon === "blood" || icon === "scale" || icon === "shell" ? "beast"
    : icon === "powder" || icon === "ink" || icon === "sand" || icon === "water" ? "material"
    : category === "EQUIPMENT" && equipSlot === "WEAPON" ? "weapon"
    : category === "EQUIPMENT" ? "armor"
    : "material";
  return `${folder}/${key}`;
}

function professionMaterialSubType(key: string, icon: string) {
  if (key === "linh-thach") return "Tiền Tệ";
  if (icon === "herb" || icon === "leaf" || icon === "root") return "Linh Thảo";
  if (icon === "flower") return "Linh Hoa";
  if (icon === "fruit") return "Linh Quả";
  if (icon === "mushroom") return "Linh Chi";
  if (icon === "ore" || icon === "metal") return "Khoáng Vật";
  if (icon === "crystal" || icon === "gem") return "Tinh Thạch";
  if (icon === "core") return "Yêu Đan";
  if (icon === "hide" || icon === "fang" || icon === "bone" || icon === "blood" || icon === "scale" || icon === "shell") return "Nguyên Liệu Yêu Thú";
  if (icon === "paper") return "Phù Chỉ";
  if (icon === "powder") return "Phù Phấn";
  if (icon === "ink") return "Linh Mặc";
  if (icon === "flag") return "Trận Kỳ";
  if (icon === "water") return "Linh Dịch";
  return "Nguyên Liệu Nghề";
}

const realms = [
  "Phàm Nhân",
  "Luyện Khí",
  "Trúc Cơ",
  "Kim Đan",
  "Nguyên Anh",
  "Hóa Thần",
  "Luyện Hư",
  "Hợp Thể",
  "Đại Thừa",
  "Độ Kiếp",
  "Chân Tiên"
];

const talents = [
  ["kiem-tam", "Kiếm Tâm", "good", { attackBps: 800 }],
  ["dan-tam", "Đan Tâm", "good", { alchemyBps: 1000 }],
  ["hoa-linh-than-can", "Thân Cận Hỏa Linh", "good", { fireBps: 900 }],
  ["thien-sinh-than-luc", "Thiên Sinh Thần Lực", "good", { body: 5 }],
  ["troi-sinh-phu-quy", "Trời Sinh Phú Quý", "good", { wealthBps: 500 }],
  ["khi-van-chi-tu", "Khí Vận Chi Tử", "good", { luck: 8 }],
  ["the-chat-yeu-ot", "Thể Chất Yếu Ớt", "bad", { body: -2, speed: 1 }],
  ["tham-an", "Tham Ăn", "neutral", { cookingBps: 500 }],
  ["co-doc", "Cô Độc", "neutral", { soloBps: 500 }],
  ["thien-nhan", "Thiên Nhãn", "good", { explorationBps: 800 }],
  ["moc-linh-the", "Mộc Linh Thể", "good", { herbBps: 1000 }],
  ["loi-cot", "Lôi Cốt", "good", { critBps: 500 }],
  ["bang-tam", "Băng Tâm", "good", { resistBps: 600 }],
  ["thuong-nhan", "Thương Nhân", "good", { marketFeeBps: -100 }],
  ["tran-dao-so-giai", "Trận Đạo Sơ Giải", "good", { formationBps: 700 }],
  ["noi-tam-bat-on", "Nội Tâm Bất Ổn", "bad", { breakthroughBps: -500 }],
  ["can-than", "Cẩn Thận", "neutral", { defenseBps: 500 }],
  ["mao-hiem", "Mạo Hiểm", "neutral", { rareBps: 300 }],
  ["dao-tam-vung", "Đạo Tâm Vững", "good", { breakthroughBps: 700 }],
  ["duyen-npc", "Hữu Duyên", "good", { npcBps: 700 }]
] as const;

const zones = [
  ["thanh-van-thanh", "Thanh Vân Thành", 0, 1, "thanh-van-vuc"],
  ["hac-son", "Hắc Sơn", 1, 3, "thanh-van-vuc"],
  ["thanh-linh-son-mach", "Thanh Linh Sơn Mạch", 1, 4, "thanh-van-vuc"],
  ["van-yeu-lam", "Vạn Yêu Lâm", 2, 6, "nam-hoang"],
  ["thien-ha-hai", "Thiên Hà Hải", 3, 5, "dong-hai"],
  ["hoa-diem-coc", "Hỏa Diệm Cốc", 3, 7, "nam-hoang"],
  ["bang-nguyen", "Băng Nguyên", 4, 7, "bac-nguyen"],
  ["hoang-co-chi-dia", "Hoang Cổ Chi Địa", 5, 9, "trung-chau-vuc"],
  ["trung-chau", "Trung Châu", 2, 4, "trung-chau-vuc"]
] as const;

const regions = [
  ["thanh-van-vuc", "Thanh Vân Vực", "Vùng nhập đạo với thành thị, quan đạo và núi rừng vừa sức tân tu sĩ.", 1, "ôn hòa", "MEDIUM"],
  ["nam-hoang", "Nam Hoang", "Rừng sâu, độc khí và hỏa mạch khiến cơ duyên luôn đi cùng hiểm nguy.", 2, "nóng ẩm", "LOW"],
  ["dong-hai", "Đông Hải", "Hải vực rộng lớn, giao thương phát đạt và nhiều yêu vật dưới sóng.", 3, "hải dương", "MEDIUM"],
  ["bac-nguyen", "Bắc Nguyên", "Băng nguyên khắc nghiệt, ít người nhưng nhiều linh vật hiếm.", 4, "băng hàn", "LOW"],
  ["trung-chau-vuc", "Trung Châu Vực", "Trung tâm thế lực, thương hội, cổ địa và đại tông môn.", 5, "đa dạng", "HIGH"]
] as const;

const locations = [
  ["thanh-van-dong-thanh", "Thanh Vân Đông Thành", "thanh-van-thanh", "district", "Khu dân cư và phường hội đông đúc.", "HIGH", ["market", "inn", "mail"]],
  ["thanh-truc-lam", "Thanh Trúc Lâm", "hac-son", "forest", "Rừng trúc phía bắc Đông Thành, linh khí mỏng nhưng thường có dấu vết yêu thú cấp thấp.", "LOW", ["explore", "pve", "resource", "encounter"]],
  ["thanh-van-son", "Thanh Vân Sơn", "thanh-linh-son-mach", "mountain", "Dãy núi nhìn xuống Thanh Vân Vực, thích hợp tìm linh dược và luyện thân.", "MEDIUM", ["explore", "pve", "resource"]],
  ["linh-khe", "Linh Khê", "thanh-van-thanh", "river", "Dòng suối linh khí chảy qua rìa thành, an toàn hơn ngoại vực nhưng vẫn có cơ duyên nhỏ.", "MEDIUM", ["explore", "resource", "encounter"]],
  ["hac-phong-coc", "Hắc Phong Cốc", "hac-son", "valley", "Sơn cốc âm phong nặng, chỉ tu sĩ đã vững căn cơ mới nên tiến vào.", "LOW", ["explore", "pve", "event"]],
    ["cho-linh-bao", "Chợ Linh Bảo", "thanh-van-thanh", "market", "Nơi thương nhân và tu sĩ giao dịch vật phẩm phổ thông.", "HIGH", ["market", "auction", "npc_shop", "alchemy", "talisman"]],
  ["bac-mon", "Bắc Môn", "thanh-van-thanh", "gate", "Cửa bắc dẫn ra quan đạo, nhiều tiêu cục tụ tập.", "MEDIUM", ["travel", "caravan"]],
  ["thanh-van-quan-dao", "Thanh Vân Quan Đạo", "hac-son", "road", "Tuyến đường chính giữa thành và Hắc Sơn.", "LOW", ["travel", "encounter"]],
  ["hac-son-chan-nui", "Chân Núi Hắc Sơn", "hac-son", "wilds", "Dấu chân yêu thú xuất hiện dày hơn khi đêm xuống.", "LOW", ["explore", "pve"]],
  ["thanh-linh-son-mon", "Thanh Linh Sơn Môn", "thanh-linh-son-mach", "sect_land", "Sơn môn cũ còn tàn trận và linh khí mỏng.", "MEDIUM", ["explore", "formation"]],
  ["van-yeu-bia-rung", "Bìa Rừng Vạn Yêu", "van-yeu-lam", "wilds", "Nơi mùi yêu khí bắt đầu lẫn vào linh khí.", "LOW", ["explore", "pve"]],
  ["dong-hai-ben-cang", "Bến Cảng Đông Hải", "thien-ha-hai", "harbor", "Thuyền buôn, tán tu và tin đồn hải yêu tụ lại.", "MEDIUM", ["market", "caravan"]],
  ["hoa-diem-mach", "Hỏa Diệm Linh Mạch", "hoa-diem-coc", "resource", "Địa hỏa cuồn cuộn, hợp luyện khí nhưng dễ bỏng thần hồn.", "LOW", ["forging", "resource"]],
  ["bang-nguyen-tram-dich", "Trạm Dịch Băng Nguyên", "bang-nguyen", "outpost", "Điểm nghỉ hiếm hoi giữa gió tuyết.", "MEDIUM", ["travel", "inn"]],
  ["co-dia-ngoai-vi", "Ngoại Vi Hoang Cổ", "hoang-co-chi-dia", "ruin", "Tàn tích cổ xưa chưa ai vẽ hết bản đồ.", "NONE", ["explore", "secret"]],
  ["trung-chau-thuong-hoi", "Trung Châu Thương Hội", "trung-chau", "city_hub", "Trung tâm thương mại và tin tức của nhiều thế lực.", "HIGH", ["market", "auction", "contract"]]
] as const;

const locationVisualMeta: Record<string, { biome: string; visualKey: string; backgroundImage: string; imagePosition?: string; cultivationModifierBps?: number }> = {
  "thanh-van-dong-thanh": { biome: "cultivation_city", visualKey: "city/xianxia-city", backgroundImage: "/locations/city/xianxia-city.webp", imagePosition: "center center", cultivationModifierBps: -300 },
  "cho-linh-bao": { biome: "cultivation_city", visualKey: "city/xianxia-city", backgroundImage: "/locations/city/xianxia-city.webp", imagePosition: "center center", cultivationModifierBps: -200 },
  "bac-mon": { biome: "cultivation_city", visualKey: "city/xianxia-city", backgroundImage: "/locations/city/xianxia-city.webp", imagePosition: "center center", cultivationModifierBps: -100 },
  "thanh-truc-lam": { biome: "bamboo_forest", visualKey: "forest/bamboo-forest", backgroundImage: "/locations/forest/bamboo-forest.webp", imagePosition: "center center", cultivationModifierBps: 500 },
  "linh-khe": { biome: "forest", visualKey: "forest/cultivation-forest", backgroundImage: "/locations/forest/cultivation-forest.webp", imagePosition: "center center", cultivationModifierBps: 300 },
  "thanh-van-quan-dao": { biome: "forest_edge", visualKey: "forest/forest-edge", backgroundImage: "/locations/forest/forest-edge.webp", imagePosition: "center center", cultivationModifierBps: 0 },
  "hac-son-chan-nui": { biome: "monster_forest", visualKey: "forest/monster-forest", backgroundImage: "/locations/forest/monster-forest.webp", imagePosition: "center center", cultivationModifierBps: 800 },
  "van-yeu-bia-rung": { biome: "monster_forest", visualKey: "forest/monster-forest", backgroundImage: "/locations/forest/monster-forest.webp", imagePosition: "center center", cultivationModifierBps: 900 },
  "thanh-van-son": { biome: "mountain", visualKey: "mountain/immortal-mountain", backgroundImage: "/locations/mountain/immortal-mountain.webp", imagePosition: "center center", cultivationModifierBps: 700 },
  "hac-phong-coc": { biome: "mountain", visualKey: "mountain/immortal-mountain", backgroundImage: "/locations/mountain/immortal-mountain.webp", imagePosition: "center center", cultivationModifierBps: 900 },
  "thanh-linh-son-mon": { biome: "sect", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 1200 },
  "bang-nguyen-tram-dich": { biome: "village", visualKey: "village/ancient-village", backgroundImage: "/locations/village/ancient-village.webp", imagePosition: "center center", cultivationModifierBps: 200 },
  "co-dia-ngoai-vi": { biome: "ruins", visualKey: "ruins/ancient-ruins", backgroundImage: "/locations/ruins/ancient-ruins.webp", imagePosition: "center center", cultivationModifierBps: 1100 },
  "hoa-diem-mach": { biome: "cave", visualKey: "cave/cultivation-cave", backgroundImage: "/locations/cave/cultivation-cave.webp", imagePosition: "center center", cultivationModifierBps: 1000 },
  "dong-hai-ben-cang": { biome: "cultivation_city", visualKey: "city/xianxia-city", backgroundImage: "/locations/city/xianxia-city.webp", imagePosition: "center center", cultivationModifierBps: -100 },
  "trung-chau-thuong-hoi": { biome: "cultivation_city", visualKey: "city/xianxia-city", backgroundImage: "/locations/city/xianxia-city.webp", imagePosition: "center center", cultivationModifierBps: 100 }
};

const routes = [
  ["dong-thanh-to-thanh-truc-lam", "Thanh Vân Đông Thành → Thanh Trúc Lâm", "thanh-van-dong-thanh", "thanh-truc-lam", 5, 0, 1, "MEDIUM", false, true],
  ["thanh-truc-lam-to-dong-thanh", "Thanh Trúc Lâm → Thanh Vân Đông Thành", "thanh-truc-lam", "thanh-van-dong-thanh", 5, 0, 1, "MEDIUM", false, true],
  ["thanh-truc-lam-to-thanh-van-son", "Thanh Trúc Lâm → Thanh Vân Sơn", "thanh-truc-lam", "thanh-van-son", 8, 20, 2, "LOW", true, true],
  ["thanh-van-son-to-thanh-truc-lam", "Thanh Vân Sơn → Thanh Trúc Lâm", "thanh-van-son", "thanh-truc-lam", 8, 20, 2, "LOW", true, true],
  ["thanh-truc-lam-to-linh-khe", "Thanh Trúc Lâm → Linh Khê", "thanh-truc-lam", "linh-khe", 6, 0, 1, "MEDIUM", false, true],
  ["linh-khe-to-thanh-truc-lam", "Linh Khê → Thanh Trúc Lâm", "linh-khe", "thanh-truc-lam", 6, 0, 1, "MEDIUM", false, true],
  ["thanh-van-son-to-hac-phong-coc", "Thanh Vân Sơn → Hắc Phong Cốc", "thanh-van-son", "hac-phong-coc", 12, 45, 4, "LOW", true, false],
  ["hac-phong-coc-to-thanh-van-son", "Hắc Phong Cốc → Thanh Vân Sơn", "hac-phong-coc", "thanh-van-son", 12, 45, 4, "LOW", true, false],
  ["bac-mon-to-quan-dao", "Bắc Môn → Thanh Vân Quan Đạo", "bac-mon", "thanh-van-quan-dao", 8, 30, 2, "MEDIUM", false, true],
  ["quan-dao-to-hac-son", "Thanh Vân Quan Đạo → Chân Núi Hắc Sơn", "thanh-van-quan-dao", "hac-son-chan-nui", 12, 45, 4, "LOW", true, true],
  ["dong-thanh-to-cho", "Đông Thành → Chợ Linh Bảo", "thanh-van-dong-thanh", "cho-linh-bao", 3, 0, 0, "HIGH", false, false],
  ["cho-to-bac-mon", "Chợ Linh Bảo → Bắc Môn", "cho-linh-bao", "bac-mon", 5, 10, 1, "HIGH", false, true],
  ["hac-son-to-son-mon", "Chân Núi Hắc Sơn → Thanh Linh Sơn Môn", "hac-son-chan-nui", "thanh-linh-son-mon", 18, 60, 5, "LOW", true, true],
  ["ben-cang-to-trung-chau", "Bến Cảng Đông Hải → Trung Châu Thương Hội", "dong-hai-ben-cang", "trung-chau-thuong-hoi", 45, 240, 3, "MEDIUM", false, true],
  ["van-yeu-to-hoa-diem", "Bìa Rừng Vạn Yêu → Hỏa Diệm Linh Mạch", "van-yeu-bia-rung", "hoa-diem-mach", 32, 120, 7, "LOW", true, true],
  ["bang-nguyen-to-co-dia", "Trạm Dịch Băng Nguyên → Ngoại Vi Hoang Cổ", "bang-nguyen-tram-dich", "co-dia-ngoai-vi", 70, 350, 9, "NONE", true, false]
] as const;

const defaultRouteEncounterTable = [
  { key: "safe-passage", weight: 50 },
  { key: "resource-cache", weight: 18 },
  { key: "wandering-monster", weight: 18 },
  { key: "traveler", weight: 10 },
  { key: "rare-omen", weight: 4 }
];

const materials = [
  "Thanh Linh Thảo", "Ngưng Lộ Thảo", "Hỏa Linh Chi", "Băng Tâm Hoa", "Hắc Thiết Quặng", "Thanh Mộc", "Yêu Đan Cấp Thấp",
  "Lang Nha", "Yêu Lang Bì", "Lôi Tinh", "Ngọc Tủy", "Huyền Thiết", "Tinh Kim", "Linh Sa", "Chu Sa",
  "Xương Linh Thú", "Hải Châu", "Huyết Tinh", "Tàn Quyển", "Trận Kỳ", "Linh Mễ", "Dược Lộ"
];

function zoneResourceTable(zoneKey: string) {
  if (zoneKey === "hac-son") return [{ key: "thanh-linh-thao", weight: 55 }, { key: "lang-nha", weight: 18 }, { key: "yeu-dan-cap-thap", weight: 10 }];
  if (zoneKey === "thanh-linh-son-mach") return [{ key: "ngung-lo-thao", weight: 35 }, { key: "hac-thiet-quang", weight: 45 }, { key: "hoa-linh-chi", weight: 15 }];
  return [{ key: "thanh-linh-thao", weight: 45 }, { key: "ngung-lo-thao", weight: 30 }, { key: "hac-thiet-quang", weight: 20 }];
}

function monsterLootTable(monsterKey: string) {
  if (monsterKey === "yeu-lang") return [{ key: "lang-nha", weight: 65, minQuantity: 1, maxQuantity: 2 }, { key: "yeu-lang-bi", weight: 45, minQuantity: 1, maxQuantity: 1 }, { key: "yeu-dan-cap-thap", weight: 25, minQuantity: 1, maxQuantity: 1 }];
  if (monsterKey === "xich-hoa-xa") return [{ key: "yeu-dan-cap-thap", weight: 35, minQuantity: 1, maxQuantity: 1 }, { key: "hoa-linh-chi", weight: 30, minQuantity: 1, maxQuantity: 1 }];
  return [{ key: "yeu-dan-cap-thap", weight: 35, minQuantity: 1, maxQuantity: 1 }, { key: "hac-thiet-quang", weight: 20, minQuantity: 1, maxQuantity: 1 }];
}

async function main() {
  const world = await prisma.world.upsert({
    where: { key: "tu-tien-gioi" },
    update: { name: "Tu Tiên Giới" },
    create: {
      key: "tu-tien-gioi",
      name: "Tu Tiên Giới",
      description: "Thế giới tu tiên persistent nơi địa vực, tuyến đường, tông môn và kinh tế liên kết với nhau.",
      calendar: { year: 1, month: 1, day: 1, season: "Xuân" }
    }
  });

  const regionByKey = new Map<string, string>();
  for (const [key, name, description, order, climate, lawLevel] of regions) {
    const region = await prisma.region.upsert({
      where: { key },
      update: { worldId: world.id, name, description, order, climate, lawLevel: lawLevel as never },
      create: { key, worldId: world.id, name, description, order, climate, lawLevel: lawLevel as never }
    });
    regionByKey.set(key, region.id);
  }

  for (let i = 0; i < realms.length; i++) {
    const realm = await prisma.realm.upsert({
      where: { key: realms[i]!.toLowerCase().replaceAll(" ", "-") },
      update: {},
      create: { key: realms[i]!.toLowerCase().replaceAll(" ", "-"), name: realms[i]!, order: i, description: `${realms[i]} là một bậc trên tiên lộ.` }
    });
    const stageNames = i === 1 ? Array.from({ length: 9 }, (_, n) => `Tầng ${n + 1}`) : ["Sơ Kỳ", "Trung Kỳ", "Hậu Kỳ", "Đại Viên Mãn"];
    for (let s = 0; s < stageNames.length; s++) {
      const required = BigInt(i * i * 1000 + s * Math.max(120, i * 600));
      await prisma.realmStage.upsert({
        where: { realmId_order: { realmId: realm.id, order: s } },
        update: {},
        create: {
          realmId: realm.id,
          name: stageNames[s]!,
          order: s,
          requiredCultivation: required,
          baseHp: 120 + i * 90 + s * 18,
          baseQi: 80 + i * 70 + s * 15,
          baseAttack: 15 + i * 14 + s * 4,
          baseDefense: 8 + i * 11 + s * 3,
          baseSpeed: 10 + i * 6 + s * 2,
          lifespanBonus: i * 45,
          breakthroughChanceBps: Math.max(2200, 8500 - i * 420 - s * 80),
          tribulationRequired: i >= 9
        }
      });
    }
  }

  for (const root of [
    ["kim", "Kim Linh Căn", ["Kim"], "Thượng", 11200],
    ["moc", "Mộc Linh Căn", ["Mộc"], "Trung", 10800],
    ["thuy", "Thủy Linh Căn", ["Thủy"], "Trung", 10600],
    ["hoa", "Hỏa Linh Căn", ["Hỏa"], "Thượng", 11200],
    ["tho", "Thổ Linh Căn", ["Thổ"], "Trung", 10500],
    ["phong-loi", "Phong Lôi Song Linh Căn", ["Phong", "Lôi"], "Biến Dị", 11800],
    ["bang", "Băng Linh Căn", ["Băng"], "Cực", 12100],
    ["tap", "Tạp Linh Căn", ["Kim", "Mộc", "Thủy", "Hỏa", "Thổ"], "Phàm", 9200]
  ] as const) {
    await prisma.spiritualRoot.upsert({
      where: { name: root[1] },
      update: {},
      create: { name: root[1], elements: [...root[2]], quality: root[3], multiplierBps: root[4], description: `${root[1]} ảnh hưởng tốc độ tu luyện và tương thích công pháp.` }
    });
  }

  for (const [key, name, polarity, effects] of talents) {
    await prisma.talent.upsert({ where: { key }, update: {}, create: { key, name, polarity, effects, description: `${name} mở ra một hướng phát triển riêng.` } });
  }

  for (const [key, name, minRealm, danger, regionKey] of zones) {
    await prisma.zone.upsert({
      where: { key },
      update: { regionId: regionByKey.get(regionKey), resourceTable: zoneResourceTable(key) },
      create: {
        key,
        regionId: regionByKey.get(regionKey),
        name,
        description: `${name} có linh khí, tài nguyên và cơ duyên riêng.`,
        minimumRealmOrder: minRealm,
        dangerLevel: danger,
        travelCost: BigInt(50 * (danger + 1)),
        travelMinutes: 3 + danger,
        resourceTable: zoneResourceTable(key),
        monsterTable: [{ key: "yeu-lang", weight: 60 }, { key: "xich-hoa-xa", weight: 30 }]
      }
    });
  }

  const locationByKey = new Map<string, string>();
  for (const [key, name, zoneKey, kind, description, securityLevel, services] of locations) {
    const zone = await prisma.zone.findUniqueOrThrow({ where: { key: zoneKey } });
    const visual = locationVisualMeta[key] ?? { biome: kind, visualKey: "wilderness/cultivation-wilderness", backgroundImage: "/locations/wilderness/cultivation-wilderness.webp", imagePosition: "center center", cultivationModifierBps: 0 };
    const location = await prisma.location.upsert({
      where: { key },
      update: { zoneId: zone.id, name, kind, biome: visual.biome, visualKey: visual.visualKey, backgroundImage: visual.backgroundImage, imagePosition: visual.imagePosition ?? "center center", cultivationModifierBps: visual.cultivationModifierBps ?? 0, description, securityLevel: securityLevel as never, services: [...services] },
      create: {
        key,
        zoneId: zone.id,
        name,
        kind,
        biome: visual.biome,
        visualKey: visual.visualKey,
        backgroundImage: visual.backgroundImage,
        imagePosition: visual.imagePosition ?? "center center",
        cultivationModifierBps: visual.cultivationModifierBps ?? 0,
        description,
        securityLevel: securityLevel as never,
        services: [...services],
        encounterTable: [{ key: "nothing", weight: 60 }, { key: "resource", weight: 25 }, { key: "monster", weight: 15 }]
      }
    });
    locationByKey.set(key, location.id);
  }

  for (const [key, name, originKey, destinationKey, travelMinutes, travelCost, dangerLevel, securityLevel, ambushAllowed, caravanAllowed] of routes) {
    await prisma.route.upsert({
      where: { key },
      update: {
        name,
        originId: locationByKey.get(originKey)!,
        destinationId: locationByKey.get(destinationKey)!,
        travelMinutes,
        travelCost: BigInt(travelCost),
        dangerLevel,
        securityLevel: securityLevel as never,
        ambushAllowed,
        caravanAllowed,
        encounterTable: defaultRouteEncounterTable
      },
      create: {
        key,
        name,
        originId: locationByKey.get(originKey)!,
        destinationId: locationByKey.get(destinationKey)!,
        description: `${name} là một tuyến đường có rủi ro, chi phí và cơ duyên riêng.`,
        travelMinutes,
        travelCost: BigInt(travelCost),
        dangerLevel,
        securityLevel: securityLevel as never,
        ambushAllowed,
        caravanAllowed,
        encounterTable: defaultRouteEncounterTable,
        weatherModifiers: {},
        eventModifiers: {}
      }
    });
  }

  const thanhVanZone = await prisma.zone.findUniqueOrThrow({ where: { key: "thanh-van-thanh" } });
  await prisma.character.updateMany({
    where: { currentLocationId: null, locationId: thanhVanZone.id },
    data: { currentLocationId: locationByKey.get("thanh-van-dong-thanh")! }
  });

  async function dialogue(key: string, title: string, speaker: string, text: string, choices: string[]) {
    const set = await prisma.dialogueSet.upsert({
      where: { key },
      update: { title, active: true },
      create: { key, title, description: `${title} dialogue`, active: true }
    });
    const node = await prisma.dialogueNode.upsert({
      where: { dialogueSetId_key: { dialogueSetId: set.id, key: "root" } },
      update: { speaker, text, sortOrder: 0 },
      create: { dialogueSetId: set.id, key: "root", speaker, text, sortOrder: 0 }
    });
    await prisma.dialogueChoice.deleteMany({ where: { dialogueNodeId: node.id } });
    for (const [index, label] of choices.entries()) {
      await prisma.dialogueChoice.create({ data: { dialogueNodeId: node.id, label, action: index === 0 ? "QUEST" : null, sortOrder: index } });
    }
    return set;
  }

  const lucMinhDialogue = await dialogue("dlg-luc-minh", "Lục Minh", "Lục Minh", "Ngươi vừa đặt chân tới Thanh Vân Vực? Nếu chưa biết bắt đầu từ đâu, hãy thử ra ngoài thành nhìn một chút.", ["Nhận nhiệm vụ", "Hỏi về Thanh Vân Vực", "Rời đi"]);
  const emissaryDialogue = await dialogue("dlg-thanh-van-su-gia", "Thanh Vân Sứ Giả", "Thanh Vân Sứ Giả", "Các sơn môn quanh đây đang tuyển người. Nếu muốn đi xa hơn trên tiên lộ, ngươi nên tìm hiểu, nhưng không cần vội bái nhập.", ["Tìm hiểu sơn môn", "Hỏi về tông môn", "Rời đi"]);
  const merchantDialogue = await dialogue("dlg-van-bao-lau", "Vạn Bảo Lâu Quản Sự", "Quản Sự", "Vật phẩm có giá trị nếu đặt đúng nơi. Biết mua, biết bán, biết giữ lại mới là cách sống lâu.", ["Hỏi về Chợ Linh Bảo", "Rời đi"]);
  const herbFarmerDialogue = await dialogue("dlg-duoc-nong", "Dược Nông", "Dược Nông", "Thanh Trúc Lâm còn nhiều Thanh Linh Thảo. Người mới nếu cẩn thận vẫn có thể hái được.", ["Hỏi về linh thảo", "Rời đi"]);
  const woundedDialogue = await dialogue("dlg-tu-si-bi-thuong", "Tu Sĩ Bị Thương", "Tu Sĩ Bị Thương", "Ta bị yêu lang cắn ở bìa rừng. Nếu ngươi tìm được Thanh Linh Thảo, có thể cứu ta một mạng.", ["Nhận nhiệm vụ", "Bỏ qua"]);
  const wandererDialogue = await dialogue("dlg-du-phuong-dao-nhan", "Du Phương Đạo Nhân", "Du Phương Đạo Nhân", "Đường tu tiên không chỉ là cảnh giới. Có lúc một câu hỏi đúng còn quý hơn một viên đan.", ["Hỏi đạo", "Rời đi"]);
  const sectMissionDialogue = await dialogue("dlg-nhiem-vu-chap-su", "Nhiệm Vụ Chấp Sự", "Nhiệm Vụ Chấp Sự", "Nhiệm Vụ Đường ghi nhận công lao của đệ tử. Việc nhỏ tích lại cũng thành uy danh sơn môn.", ["Hỏi về nhiệm vụ", "Rời đi"]);
  const teachingDialogue = await dialogue("dlg-truyen-cong-truong-lao", "Truyền Công Trưởng Lão", "Truyền Công Trưởng Lão", "Công pháp không nằm ở trang giấy, mà ở cách ngươi vận chuyển từng hơi thở.", ["Hỏi về công pháp", "Rời đi"]);

  const npcProfiles = {
    "duoc-nong": {
      portraitUrl: "/npc/duoc-nong.webp",
      avatarUrl: "/npc/duoc-nong.webp",
      visualKey: "duoc-nong",
      metadata: {
        dialogueProfile: {
          first: "Lão phu quanh năm hái thuốc ở rìa rừng. Nếu đạo hữu biết nhìn lá nghe gió, Thanh Trúc Lâm sẽ không bạc đãi.",
          repeat: "Lại là đạo hữu. Hôm nay gió núi đổi hướng, linh thảo non dễ lộ dấu hơn mọi ngày.",
          moved: "Ngươi cũng tới đây sao? Lão phu theo mùi dược khí mà đến, xem ra chúng ta có duyên.",
          friendly: "Có người chịu nghe chuyện cỏ cây, lão phu cũng bớt cô quạnh.",
          activeQuest: "Việc tìm dược liệu cứ chậm mà chắc. Dược tính hỏng là cứu người không thành.",
          readyQuest: "Mùi Thanh Linh Thảo trên tay áo đạo hữu rất rõ. Đưa lão phu xem thử.",
          helped: "Ân tình lần trước lão phu còn nhớ. Sau này gặp thảo dược lạ, ta sẽ nhắc đạo hữu trước."
        },
        movementProfile: { type: "scheduled", route: ["thanh-truc-lam", "thanh-van-dong-thanh"] },
        role: "herbalist",
        relationshipType: "friendly"
      }
    },
    "tu-si-bi-thuong": {
      portraitUrl: "/npc/tu-si-bi-thuong.webp",
      avatarUrl: "/npc/tu-si-bi-thuong.webp",
      visualKey: "tu-si-bi-thuong",
      metadata: {
        dialogueProfile: {
          first: "Đạo hữu... xin dừng bước. Ta bị yêu thú tập kích, chân nguyên tán loạn. Nếu có Thanh Linh Thảo, có lẽ còn giữ được mạng này.",
          repeat: "Là đạo hữu sao... vết thương vẫn chưa ổn, nhưng thần trí đã tỉnh hơn trước.",
          moved: "Không ngờ lại gặp đạo hữu ở nơi này. Sau trận ấy, ta không dám ở lại rừng trúc quá lâu.",
          activeQuest: "Ba con yêu lang vẫn quanh quẩn gần đó. Xin đạo hữu cẩn thận.",
          readyQuest: "Khí tức yêu thú trên người đạo hữu rất rõ. Xem ra việc đã thành.",
          helped: "Ân cứu mạng ngày đó, tại hạ vẫn ghi nhớ. Nếu có ngày khôi phục, ta nhất định báo đáp."
        },
        movementProfile: { type: "questDriven", route: ["thanh-truc-lam", "thanh-van-dong-thanh"] },
        state: { wounded: true },
        role: "wounded-cultivator",
        relationshipType: "grateful"
      }
    },
    "du-phuong-dao-nhan": {
      portraitUrl: "/npc/du-phuong-dao-nhan.webp",
      avatarUrl: "/npc/du-phuong-dao-nhan.webp",
      visualKey: "du-phuong-dao-nhan",
      metadata: {
        dialogueProfile: {
          first: "Đạo hữu trông lạ mặt. Ta là kẻ du phương, đi qua nhiều vùng đất này, chỉ dừng chân ở nơi có cơ duyên.",
          repeat: "Ha ha, lại gặp đạo hữu rồi. Đường tu dài, có người nhớ mặt nhau đã là duyên.",
          moved: "Thật có duyên. Không ngờ lại gặp đạo hữu ở nơi này.",
          friendly: "Người biết hỏi đạo không nhiều. Ngươi có tâm, ta cũng nguyện nói thêm vài câu.",
          activeQuest: "Việc ta nhắc đạo hữu, tiến triển đến đâu rồi?",
          readyQuest: "Ánh mắt đạo hữu khác trước. Có lẽ ngươi đã hiểu điều cần hiểu.",
          helped: "Ân tình lần trước ta vẫn chưa quên. Giang hồ rộng, nợ ân tình lại càng rộng."
        },
        movementProfile: { type: "route", route: ["thanh-truc-lam", "thanh-van-dong-thanh", "bia-rung"] },
        role: "wandering-sage",
        relationshipType: "fate"
      }
    }
  } as const;

  const npcData = [
    ["luc-minh", "Lục Minh", "Dẫn Lộ Nhân", "Một tán tu từng nhiều năm dẫn người mới qua cửa Đông Thành.", "guide", "thanh-van-dong-thanh", lucMinhDialogue.id, ["GUIDE", "QUEST"], true, false, true],
    ["thanh-van-su-gia", "Thanh Vân Sứ Giả", "Sứ Giả Sơn Môn", "Người đưa tin giữa các sơn môn quanh Thanh Vân Vực.", "sect-disciple", "thanh-van-dong-thanh", emissaryDialogue.id, ["SECT", "QUEST"], true, false, true],
    ["van-bao-lau-quan-su", "Vạn Bảo Lâu Quản Sự", "Chưởng Quầy", "Quản sự chợ, nắm giá linh thảo, khoáng vật và chiến lợi phẩm phổ thông.", "merchant", "cho-linh-bao", merchantDialogue.id, ["MERCHANT", "LORE"], false, true, true],
    ["duoc-nong", "Dược Nông", "Người hái thuốc", "Lão nông quen từng vạt linh thảo ở rìa Thanh Trúc Lâm.", "elder", "thanh-truc-lam", herbFarmerDialogue.id, ["LORE", "QUEST"], false, false, true],
    ["tu-si-bi-thuong", "Tu Sĩ Bị Thương", "Tán tu gặp nạn", "Một tu sĩ trẻ đang dựa vào gốc trúc, hơi thở rối loạn.", "wandering-cultivator", "thanh-truc-lam", woundedDialogue.id, ["WANDERER", "QUEST"], true, false, false],
    ["du-phuong-dao-nhan", "Du Phương Đạo Nhân", "Khách lữ hành", "Đạo nhân đi qua nhiều vùng, thường xuất hiện khi cơ duyên vừa chớm.", "wandering-cultivator", "thanh-truc-lam", wandererDialogue.id, ["WANDERER", "LORE"], false, false, false],
    ["ngoai-mon-chap-su", "Ngoại Môn Chấp Sự", "Thanh Linh Sơn Môn", "Chấp sự phụ trách tiếp dẫn người ngoài sơn môn.", "sect-disciple", "thanh-linh-son-mon", emissaryDialogue.id, ["SECT", "QUEST"], true, false, true],
    ["nhiem-vu-chap-su", "Nhiệm Vụ Chấp Sự", "Nhiệm Vụ Đường", "NPC chức năng giải thích và dẫn tới hệ nhiệm vụ tông môn.", "sect-disciple", "thanh-linh-son-mon", sectMissionDialogue.id, ["SECT", "QUEST"], true, false, true],
    ["truyen-cong-truong-lao", "Truyền Công Trưởng Lão", "Tàng Kinh Các", "Trưởng lão trông coi truyền công và công pháp nhập môn.", "elder", "thanh-linh-son-mon", teachingDialogue.id, ["ELDER", "SECT", "LORE"], false, false, true]
  ] as const;

  const npcByKey = new Map<string, string>();
  for (const [key, name, title, description, iconKey, locationKey, dialogueSetId, npcTypes, questProvider, shopProvider, serviceProvider] of npcData) {
    const location = await prisma.location.findUniqueOrThrow({ where: { key: locationKey } });
    const profile = npcProfiles[key as keyof typeof npcProfiles];
    const routeKeys = profile?.metadata.movementProfile.route ?? [];
    const routeIds = routeKeys.map((routeKey) => locationByKey.get(routeKey)).filter(Boolean);
    const movementType = profile?.metadata.movementProfile.type ?? "fixed";
    const npc = await prisma.npc.upsert({
      where: { key },
      update: { name, title, description, iconKey, portraitUrl: profile?.portraitUrl, avatarUrl: profile?.avatarUrl, visualKey: profile?.visualKey, locationId: location.id, homeLocationId: location.id, regionId: location.zoneId ? (await prisma.zone.findUnique({ where: { id: location.zoneId } }))?.regionId ?? null : null, dialogueSetId, npcTypes: [...npcTypes] as never, questProvider, shopProvider, serviceProvider, spawnMode: movementType === "fixed" ? "STATIC" : movementType === "route" ? "RANDOM" : "EVENT", metadata: profile?.metadata ?? {}, active: true },
      create: { key, name, title, description, iconKey, portraitUrl: profile?.portraitUrl, avatarUrl: profile?.avatarUrl, visualKey: profile?.visualKey, locationId: location.id, homeLocationId: location.id, regionId: location.zoneId ? (await prisma.zone.findUnique({ where: { id: location.zoneId } }))?.regionId ?? null : null, dialogueSetId, npcTypes: [...npcTypes] as never, questProvider, shopProvider, serviceProvider, spawnMode: movementType === "fixed" ? "STATIC" : movementType === "route" ? "RANDOM" : "EVENT", metadata: profile?.metadata ?? {}, active: true }
    });
    await prisma.npcWorldState.upsert({
      where: { npcId: npc.id },
      update: { currentLocationId: location.id, movementType, route: routeIds, schedule: {}, state: profile && "state" in profile.metadata ? profile.metadata.state : {} },
      create: { npcId: npc.id, currentLocationId: location.id, movementType, route: routeIds, schedule: {}, state: profile && "state" in profile.metadata ? profile.metadata.state : {} }
    });
    npcByKey.set(key, npc.id);
  }

  const onboardingQuests = [
    ["buoc-dau-tien", "Bước Đầu Tiên", "Ra khỏi Đông Thành và tới Thanh Trúc Lâm để hiểu cách di chuyển ngoài thành.", "MAIN", "VISIT_LOCATION", { targetKey: "thanh-truc-lam", requireTurnIn: true }, 1, "TALK_TO_NPC", "luc-minh", "luc-minh", null, "san-yeu-dau-tien", { cultivation: 100, linhThach: 50 }, ["met_intro_guide"]],
    ["san-yeu-dau-tien", "Săn Yêu Thú Đầu Tiên", "Đánh bại 3 yêu thú yếu trong lúc lịch luyện hoặc săn bắn.", "MAIN", "KILL_MONSTER", { targetKey: "yeu-lang", requireTurnIn: true }, 3, "MONSTER_KILLED", "luc-minh", "luc-minh", "buoc-dau-tien", "thu-thap-linh-thao", { cultivation: 120, linhThach: 80 }, ["completed_first_hunt"]],
    ["thu-thap-linh-thao", "Thu Thập Linh Thảo", "Mang về 5 Thanh Linh Thảo từ các khu vực tài nguyên quanh Hắc Sơn.", "MAIN", "COLLECT_ITEM", { targetKey: "thanh-linh-thao", requireTurnIn: true }, 5, "ITEM_OBTAINED", "tu-si-bi-thuong", "tu-si-bi-thuong", "san-yeu-dau-tien", "tim-hieu-son-mon", { cultivation: 90, linhThach: 60, items: [{ key: "hoi-khi-dan", quantity: 1 }], npc: { relationshipScore: 18, moveToLocationKey: "thanh-van-dong-thanh", movementType: "questDriven" } }, ["helped_wounded_cultivator"]],
    ["tim-hieu-son-mon", "Tìm Hiểu Sơn Môn", "Mở danh sách Tông Môn hoặc ghé sơn môn để biết con đường tu hành theo thế lực.", "MAIN", "VISIT_SECT_PAGE", { requireTurnIn: true }, 1, "MANUAL", "thanh-van-su-gia", "thanh-van-su-gia", "thu-thap-linh-thao", null, { cultivation: 100, linhThach: 100 }, ["unlocked_sect_intro", "unlocked_market_intro"]]
  ] as const;

  for (const [key, title, description, type, objectiveType, objective, targetCount, triggerType, startNpcKey, turnInNpcKey, prerequisiteKey, nextQuestKey, reward, flags] of onboardingQuests) {
    await prisma.questTemplate.upsert({
      where: { key },
      update: { title, description, type: type as never, objectiveType: objectiveType as never, objective, targetCount, triggerType: triggerType as never, startNpcId: npcByKey.get(startNpcKey), turnInNpcId: npcByKey.get(turnInNpcKey), prerequisiteKey, nextQuestKey, reward, flagsOnComplete: [...flags], active: true },
      create: { key, title, description, type: type as never, objectiveType: objectiveType as never, objective, targetCount, triggerType: triggerType as never, startNpcId: npcByKey.get(startNpcKey), turnInNpcId: npcByKey.get(turnInNpcKey), prerequisiteKey, nextQuestKey, reward, flagsOnComplete: [...flags], active: true }
    });
  }

  const progressionItems = [
    ["thanh-linh-thao", null, "Thanh Linh Thảo", "MATERIAL", "HA", "Linh Thảo", "herb", "Linh thảo phổ biến ở nơi linh khí mỏng.", "Luyện đan cơ bản, nhiệm vụ thu thập, Linh Điền và giao dịch.", 20, 10, true, {}, null, null, false],
    ["ngung-khi-thao", null, "Ngưng Khí Thảo", "MATERIAL", "HA", "Linh Thảo", "herb", "Lá cỏ ngưng tụ khí tức nhẹ, hợp với giai đoạn nhập môn.", "Nguyên liệu đan dược và tu luyện giai đoạn đầu.", 35, 15, true, {}, null, null, false],
    ["hac-thiet-quang", null, "Hắc Thiết Quặng", "MATERIAL", "HA", "Khoáng Vật", "ore", "Khoáng thạch đen nặng, dùng cho luyện khí sơ cấp.", "Luyện khí cơ bản, nhiệm vụ, Tông Môn và Linh Khoáng.", 30, 15, true, {}, null, null, false],
    ["xich-dong-quang", null, "Xích Đồng Quặng", "MATERIAL", "HA", "Khoáng Vật", "ore", "Quặng đồng đỏ có thể dẫn linh lực yếu.", "Luyện khí, crafting và mission.", 40, 20, true, {}, null, null, false],
    ["hoi-khi-dan", null, "Hồi Khí Đan", "CONSUMABLE", "HA", "Đan Dược", "pill", "Đan dược hạ phẩm giúp phục hồi chân nguyên.", "Hồi Chân Nguyên khi lịch luyện hoặc chiến đấu.", 80, 40, true, { qiRestore: 60 }, null, null, false],
    ["duong-the-dan", null, "Dưỡng Thể Đan", "CONSUMABLE", "HA", "Đan Dược", "pill", "Đan dược ôn dưỡng thân thể.", "Hỗ trợ hồi phục Sinh Lực và Thể Lực trong progression hiện tại.", 100, 50, true, { hpRestore: 80 }, null, null, false],
    ["truc-co-dan-ha", "truc-co-dan", "Trúc Cơ Đan", "CONSUMABLE", "HA", "Đan Dược", "pill", "Trúc Cơ Đan hạ phẩm, dùng cho tu sĩ Luyện Khí chuẩn bị đột phá.", "Tăng nhẹ cơ hội đột phá Trúc Cơ. Đây là Hạ Phẩm dù tên gắn với cảnh giới Trúc Cơ.", 400, 200, true, { breakthroughBps: 400 }, 1, null, false],
    ["yeu-thu-bi", null, "Yêu Thú Bì", "MATERIAL", "HA", "Nguyên Liệu Yêu Thú", "hide", "Da yêu thú cấp thấp, còn lưu yêu khí mỏng.", "Drop yêu thú, crafting và mission.", 25, 10, true, {}, null, null, false],
    ["yeu-thu-nha", null, "Yêu Thú Nha", "MATERIAL", "HA", "Nguyên Liệu Yêu Thú", "fang", "Nanh yêu thú cấp thấp.", "Drop yêu thú, crafting và mission.", 30, 10, true, {}, null, null, false],
    ["linh-moc", null, "Linh Mộc", "MATERIAL", "HA", "Vật Liệu Tông Môn", "wood", "Gỗ thấm linh khí, dùng cho kiến thiết cơ bản.", "Tông Môn, crafting và mission.", 50, 25, true, {}, null, null, false],
    ["tu-diep-linh-thao", null, "Tử Diệp Linh Thảo", "MATERIAL", "TRUNG", "Linh Thảo", "herb", "Linh thảo lá tím dùng cho đan dược trung cấp.", "Luyện đan trung cấp và mission.", 350, 150, true, {}, null, null, false],
    ["huyen-thiet", null, "Huyền Thiết", "MATERIAL", "TRUNG", "Khoáng Vật", "ore", "Khoáng thiết cứng và ổn định linh lực.", "Luyện khí, Tông Môn, mission và Linh Khoáng.", 500, 220, true, {}, null, null, false],
    ["tinh-dong", null, "Tinh Đồng", "MATERIAL", "TRUNG", "Khoáng Vật", "ore", "Đồng đã ngưng luyện, hợp luyện khí.", "Luyện khí và crafting.", 450, 200, true, {}, null, null, false],
    ["bich-ngoc-tuy", null, "Bích Ngọc Tủy", "MATERIAL", "TRUNG", "Vật Liệu Tu Luyện", "crystal", "Ngọc tủy xanh dịu, chứa linh vận tinh thuần.", "Tu luyện, crafting và mission.", 800, 350, true, {}, null, null, false],
    ["tu-khi-dan", null, "Tụ Khí Đan", "CONSUMABLE", "TRUNG", "Đan Dược", "pill", "Đan dược trung phẩm giúp tụ khí nhanh hơn.", "Tăng tu vi hoặc hồi Chân Nguyên theo hệ effect hiện tại.", 1000, 450, true, { cultivation: 250, qiRestore: 120 }, null, null, false],
    ["duong-hon-dan", null, "Dưỡng Hồn Đan", "CONSUMABLE", "TRUNG", "Đan Dược", "pill", "Đan dược dưỡng thần hồn, hiện dùng làm item data.", "Hỗ trợ thần thức khi hệ thống thần hồn mở về sau.", 1200, 500, true, { spirit: 1 }, null, null, false],
    ["truc-co-dan-trung", "truc-co-dan", "Trúc Cơ Đan · Trung Phẩm", "CONSUMABLE", "TRUNG", "Đan Dược", "pill", "Trúc Cơ Đan trung phẩm, độ tinh luyện tốt hơn.", "Tăng cơ hội đột phá Trúc Cơ tốt hơn bản Hạ Phẩm.", 1800, 800, true, { breakthroughBps: 800 }, 1, null, false],
    ["yeu-dan-nhat-giai", null, "Yêu Đan Nhất Giai", "MATERIAL", "TRUNG", "Vật Liệu Tu Luyện", "core", "Yêu đan của yêu thú mạnh hơn bình thường.", "Drop yêu thú mạnh, tu luyện, crafting và mission.", 1500, 650, true, {}, null, null, false],
    ["huyen-thu-cot", null, "Huyền Thú Cốt", "MATERIAL", "TRUNG", "Nguyên Liệu Yêu Thú", "bone", "Xương yêu thú đã hấp thu linh khí lâu năm.", "Crafting và mission.", 700, 300, true, {}, null, null, false],
    ["tu-linh-thach", null, "Tụ Linh Thạch", "MATERIAL", "TRUNG", "Vật Liệu Tu Luyện", "crystal", "Linh thạch đặc biệt giúp tụ linh trong động phủ.", "Hỗ trợ tu luyện, Động Phủ, Tông Môn và crafting.", 2000, 900, true, {}, null, null, false],
    ["thien-linh-thao", null, "Thiên Linh Thảo", "MATERIAL", "THUONG", "Linh Thảo", "herb", "Linh thảo thượng phẩm cực hiếm.", "Luyện đan cao cấp, nhiệm vụ khó và sự kiện.", 5000, 2000, false, {}, null, 3, false],
    ["huyen-tinh", null, "Huyền Tinh", "MATERIAL", "THUONG", "Khoáng Vật", "crystal", "Tinh thể huyền quang, sinh ra trong khoáng mạch hiếm.", "Luyện khí cao cấp và Tông Môn.", 8000, 3000, false, {}, null, 3, true],
    ["xich-viem-tinh-kim", null, "Xích Viêm Tinh Kim", "MATERIAL", "THUONG", "Khoáng Vật", "ore", "Tinh kim đỏ rực mang địa hỏa.", "Luyện khí thượng phẩm.", 12000, 4500, false, {}, null, 3, true],
    ["ngoc-tuy-tinh-hoa", null, "Ngọc Tủy Tinh Hoa", "MATERIAL", "THUONG", "Vật Liệu Tu Luyện", "crystal", "Tinh hoa ngọc tủy đã kết tụ nhiều năm.", "Tu luyện, crafting và nhiệm vụ khó.", 15000, 5000, false, {}, null, 2, true],
    ["truc-co-dan-thuong", "truc-co-dan", "Trúc Cơ Đan · Thượng Phẩm", "CONSUMABLE", "THUONG", "Đan Dược", "pill", "Trúc Cơ Đan thượng phẩm, tinh luyện cao.", "Tăng mạnh cơ hội đột phá Trúc Cơ, không đồng nghĩa người dùng phải ở cảnh giới cao.", 10000, 4000, false, { breakthroughBps: 1400 }, 1, 3, true],
    ["tay-tuy-dan", null, "Tẩy Tủy Đan", "CONSUMABLE", "THUONG", "Đan Dược", "pill", "Đan dược tẩy luyện kinh mạch.", "Vật phẩm hiếm, hiệu ứng sâu hơn sẽ mở về sau.", 18000, 6000, false, { hpRestore: 200, qiRestore: 200 }, null, 2, true],
    ["yeu-dan-nhi-giai", null, "Yêu Đan Nhị Giai", "MATERIAL", "THUONG", "Vật Liệu Tu Luyện", "core", "Yêu đan nhị giai chứa yêu lực dày.", "Tu luyện, crafting và mission khó.", 14000, 5000, false, {}, null, 2, true],
    ["thien-tam-ti", null, "Thiên Tàm Ti", "MATERIAL", "THUONG", "Vật liệu crafting", "silk", "Sợi tằm trời bền nhẹ, dùng chế tạo pháp y.", "Crafting cao cấp và nhiệm vụ.", 9000, 3500, false, {}, null, 3, true],
    ["dia-mach-linh-tinh", null, "Địa Mạch Linh Tinh", "MATERIAL", "THUONG", "Vật Liệu Tu Luyện", "crystal", "Tinh thể sinh trong địa mạch nồng đậm.", "Động Phủ, Tông Môn, tu luyện và crafting.", 22000, 7000, false, {}, null, 2, true],
    ["tu-linh-ngoc", null, "Tụ Linh Ngọc", "MATERIAL", "THUONG", "Vật Liệu Tu Luyện", "gem", "Ngọc tụ linh thượng phẩm, giá trị cao.", "Hỗ trợ tu luyện, Động Phủ, Tông Môn và crafting.", 28000, 8000, false, {}, null, 1, true]
  ] as const;

  for (const [key, itemFamily, name, category, rarity, subType, icon, description, usage, systemBasePrice, sectContributionPrice, systemMarketEnabled, baseModifiers, requiredRealmOrder, requiredSectRank, auctionEligible] of progressionItems) {
    const bindRules = {
      subType,
      icon,
      visualKey: itemVisualKey(key, category, icon),
      usage,
      systemBasePrice,
      npcBuyPrice: Math.floor(systemBasePrice * 0.7),
      sellableToNpc: true,
      marketEnabled: true,
      systemMarketEnabled,
      sectExchangeEnabled: true,
      sectContributionPrice,
      donationContributionValue: Math.max(1, Math.floor(sectContributionPrice * 0.4)),
      auctionEligible,
      itemFamily,
      requiredRealmOrder,
      requiredSectRank
    };
    await prisma.itemTemplate.upsert({
      where: { key },
      update: { itemFamily, name, category: category as ItemCategory, rarity: rarity as Rarity, description, stackable: true, maxStack: 999, tradeable: true, baseModifiers, bindRules },
      create: { key, itemFamily, name, category: category as ItemCategory, rarity: rarity as Rarity, description, stackable: true, maxStack: 999, tradeable: true, baseModifiers, bindRules }
    });
  }

  await prisma.itemTemplate.upsert({
    where: { key: "linh-thach" },
    update: {
      name: "Linh Thạch",
      category: ItemCategory.MATERIAL,
      rarity: Rarity.PHAM,
      description: "Tinh thạch chứa linh khí, vừa là tài nguyên tu luyện vừa là đơn vị tiền tệ phổ biến.",
      stackable: true,
      maxStack: 999999,
      tradeable: false,
      baseModifiers: {},
      bindRules: {
        subType: "Tiền Tệ",
        icon: "crystal",
        visualKey: "linh-thach",
        usage: "Dùng làm tiền tệ giao dịch, phí dịch vụ và phần thưởng.",
        systemBasePrice: 1,
        npcBuyPrice: 1,
        sellableToNpc: false,
        marketEnabled: false,
        systemMarketEnabled: false,
        sectExchangeEnabled: false,
        sectContributionPrice: 0,
        donationContributionValue: 0
      }
    },
    create: {
      key: "linh-thach",
      name: "Linh Thạch",
      category: ItemCategory.MATERIAL,
      rarity: Rarity.PHAM,
      description: "Tinh thạch chứa linh khí, vừa là tài nguyên tu luyện vừa là đơn vị tiền tệ phổ biến.",
      stackable: true,
      maxStack: 999999,
      tradeable: false,
      baseModifiers: {},
      bindRules: {
        subType: "Tiền Tệ",
        icon: "crystal",
        visualKey: "linh-thach",
        usage: "Dùng làm tiền tệ giao dịch, phí dịch vụ và phần thưởng.",
        systemBasePrice: 1,
        npcBuyPrice: 1,
        sellableToNpc: false,
        marketEnabled: false,
        systemMarketEnabled: false,
        sectExchangeEnabled: false,
        sectContributionPrice: 0,
        donationContributionValue: 0
      }
    }
  });

  const equipment = [
    ["huyen-thiet-kiem", "Huyền Thiết Kiếm", "WEAPON", { attack: 5 }],
    ["thanh-van-dao-bao", "Thanh Vân Đạo Bào", "ARMOR", { defense: 3 }],
    ["thiet-moc-ho-phu", "Thiết Mộc Hộ Phù", "TALISMAN", { spirit: 3 }],
    ["nhan-tu-linh", "Nhẫn Tụ Linh", "RING", { cultivationBps: 300 }],
    ["giay-than-hanh", "Giày Thần Hành", "BOOTS", { speed: 8 }]
  ] as const;
  for (const [key, name, slot, mods] of equipment) {
    const systemBasePrice = 180 + Object.values(mods).reduce((sum, value) => sum + value * 5, 0);
    const icon = slot === "ARMOR" ? "armor" : slot === "BOOTS" ? "boots" : slot === "RING" ? "ring" : slot === "TALISMAN" ? "talisman" : "sword";
    const bindRules = { subType: slot, icon, visualKey: itemVisualKey(key, "EQUIPMENT", icon, slot), systemBasePrice, npcBuyPrice: Math.floor(systemBasePrice * 0.7), sellableToNpc: true, usage: `${name} có thể trang bị để tăng chỉ số.` };
    await prisma.itemTemplate.upsert({
      where: { key },
      update: { bindRules },
      create: { key, name, category: ItemCategory.EQUIPMENT, rarity: Rarity.TRUNG, description: `${name} có thể trang bị.`, equipSlot: slot as never, baseModifiers: mods, durability: undefined, bindRules } as never
    });
  }
  for (const [key, name, mods] of [
    ["hoi-xuan-dan", "Hồi Xuân Đan", { hpRestore: 80 }],
    ["tu-linh-dan", "Tụ Linh Đan", { cultivation: 250 }],
    ["pha-canh-dan", "Phá Cảnh Đan", { breakthroughBps: 900 }],
    ["giai-doc-dan", "Giải Độc Đan", { cleanse: true }]
  ] as const) {
    const bindRules = { subType: "Đan Dược", icon: "pill", visualKey: itemVisualKey(key, "CONSUMABLE", "pill"), systemBasePrice: 90, npcBuyPrice: 63, sellableToNpc: true, usage: `${name} có thể sử dụng trực tiếp.`, marketEnabled: true, systemMarketEnabled: false, sectExchangeEnabled: true, sectContributionPrice: 45, donationContributionValue: 18 };
    await prisma.itemTemplate.upsert({ where: { key }, update: { bindRules }, create: { key, name, category: ItemCategory.CONSUMABLE, rarity: Rarity.TRUNG, description: `${name} là đan dược hữu dụng.`, stackable: true, maxStack: 99, baseModifiers: mods, bindRules } });
  }

  for (const [key, name, type, mod] of [
    ["thanh-van-tam-phap", "Thanh Vân Tâm Pháp", "Tâm Pháp", 11000],
    ["liem-hoa-kiem-phap", "Liên Hoa Kiếm Pháp", "Kiếm Pháp", 10400],
    ["hac-son-quyen", "Hắc Sơn Quyền", "Quyền Pháp", 10200],
    ["than-hanh-bo", "Thần Hành Bộ", "Thân Pháp", 10100],
    ["hoa-van-bi-thuat", "Hỏa Vân Bí Thuật", "Bí Thuật", 10800]
  ] as const) {
    await prisma.technique.upsert({ where: { key }, update: {}, create: { key, name, type, rarity: Rarity.HOANG, realmOrder: 0, cultivationModifierBps: mod, effects: {}, description: `${name} định hình lối chơi của tu sĩ.` } });
  }

  for (const [key, name] of [
    ["alchemy", "Luyện Đan"], ["forging", "Luyện Khí"], ["talisman", "Chế Phù"], ["formation", "Trận Pháp"],
    ["mining", "Khai Khoáng"], ["herbalism", "Linh Thực"], ["doctor", "Dược Sư"], ["hunter", "Thợ Săn"], ["merchant", "Thương Nhân"]
  ] as const) {
    await prisma.profession.upsert({ where: { key }, update: {}, create: { key, name, description: `${name} tạo ra giá trị cho kinh tế người chơi.` } });
  }

  const rankRarity: Record<string, Rarity> = { APPRENTICE: Rarity.HA, ADEPT: Rarity.TRUNG, EXPERT: Rarity.THUONG, MASTER: Rarity.CUC, GRANDMASTER: Rarity.TIEN };
  const professionByKey = new Map((await prisma.profession.findMany()).map((profession) => [profession.key, profession]));
  const recipeKeys = new Set(coreProfessionRecipes.map((recipe) => recipe.key));
  await prisma.recipe.deleteMany({ where: { profession: { key: { in: ["alchemy", "forging", "talisman", "formation"] } }, key: { notIn: [...recipeKeys] }, jobs: { none: {} } } });

  const allRecipeItems = new Map<string, { key: string; name: string; category: ItemCategory; rarity: Rarity; subType: string; icon: string; description: string; usage: string; stackable: boolean; equipSlot?: EquipmentSlot; modifiers: Record<string, unknown>; price: number }>();
  for (const recipe of coreProfessionRecipes) {
    const rarity = rankRarity[recipe.rank] ?? Rarity.HA;
    allRecipeItems.set(recipe.outputKey, {
      key: recipe.outputKey,
      name: recipe.outputName,
      category: recipe.category as ItemCategory,
      rarity,
        subType: recipe.subType,
      icon: recipe.icon,
      description: recipe.description,
      usage: recipe.usage,
      stackable: recipe.category !== "EQUIPMENT",
      equipSlot: recipe.equipSlot as EquipmentSlot | undefined,
      modifiers: recipe.modifiers ?? {},
      price: Math.max(10, recipe.fee * 2)
    });
    for (const ingredient of recipe.ingredients) {
      if (allRecipeItems.has(ingredient.key)) continue;
      allRecipeItems.set(ingredient.key, {
        key: ingredient.key,
        name: ingredient.name,
        category: ItemCategory.MATERIAL,
        rarity,
        subType: ingredient.subType ?? professionMaterialSubType(ingredient.key, ingredient.icon ?? "material"),
        icon: ingredient.icon ?? "material",
        description: `${ingredient.name} là nguyên liệu dùng trong cây nghề nghiệp.`,
        usage: "Nguyên liệu chế tạo.",
        stackable: true,
        modifiers: {},
        price: Math.max(5, Math.floor(recipe.fee / 4))
      });
    }
  }

  for (const item of allRecipeItems.values()) {
    if (item.key === "linh-thach") continue;
    const bindRules = {
      subType: item.subType,
      icon: item.icon,
      visualKey: professionItemVisualKey(item.key, item.category, item.icon, item.equipSlot),
      usage: item.usage,
      systemBasePrice: item.price,
      npcBuyPrice: Math.floor(item.price * 0.7),
      sellableToNpc: true,
      marketEnabled: true,
      systemMarketEnabled: item.category === ItemCategory.MATERIAL && item.rarity !== Rarity.TIEN,
      sectExchangeEnabled: true,
      sectContributionPrice: Math.max(1, Math.floor(item.price * 0.4)),
      donationContributionValue: Math.max(1, Math.floor(item.price * 0.15))
    };
    await prisma.itemTemplate.upsert({
      where: { key: item.key },
      update: { name: item.name, category: item.category, rarity: item.rarity, description: item.description, stackable: item.stackable, maxStack: item.stackable ? 999 : 1, tradeable: true, equipSlot: item.equipSlot ?? null, baseModifiers: item.modifiers, bindRules },
      create: { key: item.key, name: item.name, category: item.category, rarity: item.rarity, description: item.description, stackable: item.stackable, maxStack: item.stackable ? 999 : 1, tradeable: true, equipSlot: item.equipSlot ?? null, baseModifiers: item.modifiers, bindRules }
    });
  }

  const itemByKey = new Map((await prisma.itemTemplate.findMany({ where: { key: { in: [...allRecipeItems.keys()] } } })).map((item) => [item.key, item]));
  for (const recipe of coreProfessionRecipes) {
    const profession = professionByKey.get(recipe.profession);
    const output = itemByKey.get(recipe.outputKey);
    if (!profession || !output) throw new Error(`Missing profession recipe seed dependency: ${recipe.key}`);
    const ingredients = recipe.ingredients.map((ingredient) => {
      const item = itemByKey.get(ingredient.key);
      if (!item) throw new Error(`Missing ingredient ${ingredient.key} for ${recipe.key}`);
      return { itemId: item.id, key: item.key, quantity: ingredient.qty };
    });
    await prisma.recipe.upsert({
      where: { key: recipe.key },
      update: {
        name: recipe.name,
        professionId: profession.id,
        outputTemplateId: output.id,
        ingredients,
        craftMinutes: recipe.minutes,
        fee: BigInt(recipe.fee),
        requiredLevel: ["APPRENTICE", "ADEPT", "EXPERT", "MASTER", "GRANDMASTER"].indexOf(recipe.rank) + 1,
        requiredRank: recipe.rank as ProfessionRank,
        unlockType: RecipeUnlockType.PROFESSION_RANK,
        station: recipe.station,
        outputQuantity: 1,
        professionExp: recipe.exp
      },
      create: {
        key: recipe.key,
        name: recipe.name,
        professionId: profession.id,
        outputTemplateId: output.id,
        ingredients,
        craftMinutes: recipe.minutes,
        fee: BigInt(recipe.fee),
        requiredLevel: ["APPRENTICE", "ADEPT", "EXPERT", "MASTER", "GRANDMASTER"].indexOf(recipe.rank) + 1,
        requiredRank: recipe.rank as ProfessionRank,
        unlockType: RecipeUnlockType.PROFESSION_RANK,
        station: recipe.station,
        outputQuantity: 1,
        professionExp: recipe.exp
      }
    });
  }

  for (const [key, name, hp, atk, def, spd] of [
    ["yeu-lang", "Yêu Lang", 90, 14, 6, 12],
    ["xich-hoa-xa", "Xích Hỏa Xà", 110, 18, 7, 10],
    ["thach-yeu", "Thạch Yêu", 150, 16, 14, 4],
    ["hai-yeu", "Hải Yêu", 130, 20, 8, 11],
    ["loi-ung", "Lôi Ưng", 100, 24, 5, 18],
    ["hac-son-quy", "Hắc Sơn Quỷ", 220, 28, 16, 8],
    ["bang-linh-thu", "Băng Linh Thú", 180, 22, 18, 9],
    ["hoa-diem-ma", "Hỏa Diệm Ma", 260, 35, 14, 13],
    ["co-long-tan-hon", "Cổ Long Tàn Hồn", 500, 48, 28, 16],
    ["linh-thu-nho", "Linh Thú Nhỏ", 60, 8, 4, 8]
  ] as const) {
    await prisma.monster.upsert({ where: { key }, update: { lootTable: monsterLootTable(key) }, create: { key, name, realmOrder: 0, hp, attack: atk, defense: def, speed: spd, lootTable: monsterLootTable(key), locationKey: "hac-son" } });
  }

  for (const [key, value] of [
    ["energy", { regenMinutes: 10, amount: 1 }],
    ["economy", { marketTaxBps: 500, auctionFeeBps: 300 }],
    ["features", { pvp: true, payment: true, sectWars: false, worldBoss: true, premiumStore: true }]
  ] as const) {
    await prisma.gameConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  await prisma.topupPackage.upsert({ where: { key: "jade-small" }, update: {}, create: { key: "jade-small", name: "Túi Tiên Ngọc", amountVnd: 50000, tienNgoc: 500 } });

  const firstStage = await prisma.realmStage.findFirstOrThrow({ orderBy: [{ realm: { order: "asc" } }, { order: "asc" }] });
  const firstRoot = await prisma.spiritualRoot.findFirstOrThrow();
  const passwordHash = await argon2.hash(process.env.ADMIN_PASSWORD || "admin123456");
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || "admin@example.com" },
    update: { role: "ADMIN" },
    create: { username: process.env.ADMIN_USERNAME || "admin", email: process.env.ADMIN_EMAIL || "admin@example.com", passwordHash, role: "ADMIN" }
  });
  await prisma.character.upsert({
    where: { userId: admin.id },
    update: { currentLocationId: locationByKey.get("thanh-van-dong-thanh")! },
    create: {
      userId: admin.id,
      name: "Thiên Đạo Quản Sự",
      realmStageId: firstStage.id,
      spiritualRootId: firstRoot.id,
      locationId: (await prisma.zone.findUniqueOrThrow({ where: { key: "thanh-van-thanh" } })).id,
      currentLocationId: locationByKey.get("thanh-van-dong-thanh"),
      linhThach: 1000000n,
      tienNgoc: 10000n
    }
  });
  await prisma.worldNews.create({ data: { title: "Thiên Đạo khai mở", body: "Tu Tiên Giới đã hình thành, nhân quả bắt đầu lưu chuyển.", category: "system", permanent: true } });
}

main().finally(async () => prisma.$disconnect());

import argon2 from "argon2";
import { PrismaClient, Rarity, ItemCategory, EquipmentSlot, ProfessionRank, RecipeUnlockType, SectAlignment, SectCaveQuality, SectFacilityType, SectMentorshipStatus, SectMentorshipType, SectRoleName } from "@prisma/client";
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
  ["trung-chau-thuong-hoi", "Trung Châu Thương Hội", "trung-chau", "city_hub", "Trung tâm thương mại và tin tức của nhiều thế lực.", "HIGH", ["market", "auction", "contract"]],
  ["thanh-van-son-mon", "Thanh Vân Sơn Môn", "thanh-linh-son-mach", "sect_gate", "Cổng núi mây xanh, nơi người ngoài dừng bước trước khi vào địa giới Thanh Vân Môn.", "MEDIUM", ["sect_entry", "quest", "dialogue"]],
  ["thanh-van-ngoai-mon", "Ngoại Môn", "thanh-linh-son-mach", "sect_outer", "Khu ngoại môn rộng dưới chân núi, nơi đệ tử mới nhận nhiệm vụ, bổng lộc và khảo hạch sơ cấp.", "MEDIUM", ["sect", "allowance", "quest", "training"]],
  ["thanh-van-noi-mon", "Nội Môn", "thanh-linh-son-mach", "sect_inner", "Sườn núi linh khí dày hơn, chỉ đệ tử đã qua Nội Môn Khảo Hạch mới được thường trú.", "MEDIUM", ["sect", "training", "profession", "quest"]],
  ["thanh-van-dai-dien", "Thanh Vân Đại Điện", "thanh-linh-son-mach", "sect_hall", "Đại điện chính nhìn xuống biển mây, nơi trưởng lão nghị sự và Tông Chủ ban lệnh.", "HIGH", ["sect_council", "promotion", "story"]],
  ["thanh-van-tang-kinh-cac", "Tàng Kinh Các", "thanh-linh-son-mach", "library", "Lầu các cất giữ tâm pháp, kiếm quyết và truyền thừa nhiều đời của Thanh Vân Môn.", "HIGH", ["library", "technique", "sect_exchange"]],
  ["thanh-van-dan-duong", "Đan Đường", "thanh-linh-son-mach", "alchemy_hall", "Nơi luyện đan, thẩm dược và phát commission nghề Luyện Đan.", "MEDIUM", ["alchemy", "profession", "commission", "material_exchange"]],
  ["thanh-van-khi-duong", "Khí Đường", "thanh-linh-son-mach", "forging_hall", "Lò luyện khí dùng địa hỏa ôn hòa để rèn pháp khí và trang bị nhập môn.", "MEDIUM", ["forging", "profession", "commission", "equipment"]],
  ["thanh-van-tran-duong", "Trận Đường", "thanh-linh-son-mach", "formation_hall", "Khu nghiên cứu trận kỳ, phù văn và tiết điểm Hộ Sơn Trận.", "MEDIUM", ["formation", "profession", "commission", "tutorial"]],
  ["thanh-van-nhiem-vu-duong", "Nhiệm Vụ Đường", "thanh-linh-son-mach", "mission_hall", "Bảng nhiệm vụ tông môn ghi nhận công lao, cống hiến và nhiệm vụ chu kỳ.", "MEDIUM", ["sect_mission", "contribution", "quest"]],
  ["thanh-van-giam-linh-dai", "Giám Linh Đài", "thanh-linh-son-mach", "spirit_testing", "Đài trắc linh căn đặt Trắc Linh Ngọc, dùng để ghi nhận tư chất đệ tử mới.", "HIGH", ["spiritual_root", "assessment", "quest"]],
  ["thanh-van-linh-dien", "Linh Điền", "thanh-linh-son-mach", "spirit_farm", "Ruộng linh khí trồng Thanh Linh Thảo và Ngưng Lộ Thảo cho ngoại môn chăm sóc.", "MEDIUM", ["farm", "herbalism", "gathering"]],
  ["thanh-van-linh-khoang", "Linh Khoáng", "thanh-linh-son-mach", "spirit_mine", "Hai nhánh khoáng mạch cấp Tam Phẩm cung cấp Hắc Thiết và Huyền Thiết.", "LOW", ["mine", "resource", "forging"]],
  ["thanh-van-dien-vo-truong", "Diễn Võ Trường", "thanh-linh-son-mach", "training_ground", "Khoảng sân đá dùng cho luận bàn, kiểm nghiệm chiến lực và khảo hạch.", "MEDIUM", ["training", "sparring", "exam"]],
  ["thanh-van-dong-phu-khu", "Đệ Tử Động Phủ Khu", "thanh-linh-son-mach", "cave_district", "Khu động phủ phân theo thân phận, ảnh hưởng trực tiếp tới tốc độ tu luyện trong tông.", "HIGH", ["sect_cave", "cultivation"]],
  ["thanh-van-hau-son", "Hậu Sơn", "thanh-linh-son-mach", "back_mountain", "Rừng núi phía sau sơn môn, yên tĩnh nhưng thường phát sinh dị biến.", "LOW", ["explore", "pve", "story_event"]]
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
  "trung-chau-thuong-hoi": { biome: "cultivation_city", visualKey: "city/xianxia-city", backgroundImage: "/locations/city/xianxia-city.webp", imagePosition: "center center", cultivationModifierBps: 100 },
  "thanh-van-son-mon": { biome: "sect", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 800 },
  "thanh-van-ngoai-mon": { biome: "sect", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 900 },
  "thanh-van-noi-mon": { biome: "sect", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 1200 },
  "thanh-van-dai-dien": { biome: "sect", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 1000 },
  "thanh-van-tang-kinh-cac": { biome: "sect_library", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 700 },
  "thanh-van-dan-duong": { biome: "alchemy_hall", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 600 },
  "thanh-van-khi-duong": { biome: "forging_hall", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 600 },
  "thanh-van-tran-duong": { biome: "formation_hall", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 700 },
  "thanh-van-nhiem-vu-duong": { biome: "mission_hall", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 500 },
  "thanh-van-giam-linh-dai": { biome: "spirit_testing", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 500 },
  "thanh-van-linh-dien": { biome: "spirit_farm", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 1000 },
  "thanh-van-linh-khoang": { biome: "spirit_mine", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 900 },
  "thanh-van-dien-vo-truong": { biome: "training_ground", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 600 },
  "thanh-van-dong-phu-khu": { biome: "cave_district", visualKey: "sect/cultivation-sect", backgroundImage: "/locations/sect/cultivation-sect.webp", imagePosition: "center center", cultivationModifierBps: 1300 },
  "thanh-van-hau-son": { biome: "back_mountain", visualKey: "mountain/immortal-mountain", backgroundImage: "/locations/mountain/immortal-mountain.webp", imagePosition: "center center", cultivationModifierBps: 1100 }
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
  ["thanh-linh-to-thanh-van-son-mon", "Thanh Linh Sơn Môn → Thanh Vân Sơn Môn", "thanh-linh-son-mon", "thanh-van-son-mon", 6, 0, 1, "MEDIUM", false, true],
  ["thanh-van-son-mon-to-thanh-linh", "Thanh Vân Sơn Môn → Thanh Linh Sơn Môn", "thanh-van-son-mon", "thanh-linh-son-mon", 6, 0, 1, "MEDIUM", false, true],
  ["thanh-van-son-mon-to-ngoai-mon", "Thanh Vân Sơn Môn → Ngoại Môn", "thanh-van-son-mon", "thanh-van-ngoai-mon", 4, 0, 1, "MEDIUM", false, true],
  ["ngoai-mon-to-son-mon", "Ngoại Môn → Thanh Vân Sơn Môn", "thanh-van-ngoai-mon", "thanh-van-son-mon", 4, 0, 1, "MEDIUM", false, true],
  ["ngoai-mon-to-nhiem-vu-duong", "Ngoại Môn → Nhiệm Vụ Đường", "thanh-van-ngoai-mon", "thanh-van-nhiem-vu-duong", 2, 0, 0, "HIGH", false, false],
  ["ngoai-mon-to-giam-linh-dai", "Ngoại Môn → Giám Linh Đài", "thanh-van-ngoai-mon", "thanh-van-giam-linh-dai", 2, 0, 0, "HIGH", false, false],
  ["ngoai-mon-to-dien-vo", "Ngoại Môn → Diễn Võ Trường", "thanh-van-ngoai-mon", "thanh-van-dien-vo-truong", 3, 0, 0, "HIGH", false, false],
  ["ngoai-mon-to-linh-dien", "Ngoại Môn → Linh Điền", "thanh-van-ngoai-mon", "thanh-van-linh-dien", 5, 0, 1, "MEDIUM", false, true],
  ["ngoai-mon-to-noi-mon", "Ngoại Môn → Nội Môn", "thanh-van-ngoai-mon", "thanh-van-noi-mon", 6, 0, 1, "MEDIUM", false, true],
  ["noi-mon-to-dai-dien", "Nội Môn → Thanh Vân Đại Điện", "thanh-van-noi-mon", "thanh-van-dai-dien", 4, 0, 0, "HIGH", false, false],
  ["noi-mon-to-tang-kinh", "Nội Môn → Tàng Kinh Các", "thanh-van-noi-mon", "thanh-van-tang-kinh-cac", 3, 0, 0, "HIGH", false, false],
  ["noi-mon-to-dan-duong", "Nội Môn → Đan Đường", "thanh-van-noi-mon", "thanh-van-dan-duong", 3, 0, 0, "HIGH", false, false],
  ["noi-mon-to-khi-duong", "Nội Môn → Khí Đường", "thanh-van-noi-mon", "thanh-van-khi-duong", 3, 0, 0, "HIGH", false, false],
  ["noi-mon-to-tran-duong", "Nội Môn → Trận Đường", "thanh-van-noi-mon", "thanh-van-tran-duong", 3, 0, 0, "HIGH", false, false],
  ["noi-mon-to-dong-phu", "Nội Môn → Đệ Tử Động Phủ Khu", "thanh-van-noi-mon", "thanh-van-dong-phu-khu", 4, 0, 0, "HIGH", false, false],
  ["noi-mon-to-linh-khoang", "Nội Môn → Linh Khoáng", "thanh-van-noi-mon", "thanh-van-linh-khoang", 8, 0, 2, "LOW", true, true],
  ["noi-mon-to-hau-son", "Nội Môn → Hậu Sơn", "thanh-van-noi-mon", "thanh-van-hau-son", 8, 0, 3, "LOW", true, true],
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

const thanhVanSectLocations = [
  { key: "thanh-van-son-mon", access: "OUTSIDER", services: ["sect_entry", "dialogue", "intro_quest"], note: "Người ngoài được tới để hỏi chuyện nhập môn." },
  { key: "thanh-van-ngoai-mon", access: "OUTER", services: ["allowance", "outer_exam", "training", "intro_quest"], note: "Ngoại Môn xử lý nhập môn, bổng lộc và khảo hạch sơ cấp." },
  { key: "thanh-van-noi-mon", access: "INNER", services: ["inner_training", "profession", "inner_exam"], note: "Nội Môn mở sau Nội Môn Khảo Hạch." },
  { key: "thanh-van-dai-dien", access: "TRUE_DISCIPLE", services: ["sect_council", "promotion", "main_story"], note: "Đại Điện dành cho sự vụ trưởng lão và Chân Truyền." },
  { key: "thanh-van-tang-kinh-cac", access: "OUTER", services: ["library_floor_1", "library_floor_2", "library_floor_3"], note: "Tầng 1 Ngoại Môn, tầng 2 Nội Môn, tầng 3 Chân Truyền." },
  { key: "thanh-van-dan-duong", access: "INNER", services: ["alchemy", "recipe", "commission", "material_exchange"], note: "Đan Đường mở nghề và commission Luyện Đan." },
  { key: "thanh-van-khi-duong", access: "INNER", services: ["forging", "recipe", "commission", "equipment"], note: "Khí Đường mở nghề và commission Luyện Khí." },
  { key: "thanh-van-tran-duong", access: "INNER", services: ["formation", "recipe", "commission", "formation_tutorial"], note: "Trận Đường mở nghề Trận Pháp và Hộ Sơn Trận." },
  { key: "thanh-van-nhiem-vu-duong", access: "OUTER", services: ["sect_mission", "contribution", "turn_in"], note: "Nhiệm vụ chu kỳ và cống hiến tông môn." },
  { key: "thanh-van-giam-linh-dai", access: "OUTER", services: ["spiritual_root_reveal", "talent_notice"], note: "Kiểm tra Linh Căn, không reroll." },
  { key: "thanh-van-linh-dien", access: "OUTER", services: ["farm", "herbalism", "gathering"], note: "Nguồn Linh Thảo và nhiệm vụ Linh Thực." },
  { key: "thanh-van-linh-khoang", access: "INNER", services: ["mine", "resource", "forging_material"], note: "Tam Phẩm có hai linh khoáng theo config." },
  { key: "thanh-van-dien-vo-truong", access: "OUTER", services: ["training", "sparring", "combat_exam"], note: "Kiểm nghiệm chiến lực và khảo hạch." },
  { key: "thanh-van-dong-phu-khu", access: "OUTER", services: ["sect_cave", "cultivation_bonus"], note: "30 động phủ theo phẩm cấp Tam Phẩm." },
  { key: "thanh-van-hau-son", access: "INNER", services: ["explore", "pve", "story_event"], note: "Hậu Sơn Dị Biến và quest story." }
] as const;

const thanhVanInnerRequirements = {
  "Phàm": { realm: "Luyện Khí tầng 9", realmOrder: 1, stageOrder: 8, contribution: 1500 },
  "Trung": { realm: "Luyện Khí tầng 7", realmOrder: 1, stageOrder: 6, contribution: 1000 },
  "Thượng": { realm: "Luyện Khí tầng 6", realmOrder: 1, stageOrder: 5, contribution: 800 },
  "Biến Dị": { realm: "Luyện Khí tầng 5", realmOrder: 1, stageOrder: 4, contribution: 600 },
  "Cực": { realm: "Luyện Khí tầng 5", realmOrder: 1, stageOrder: 4, contribution: 500 }
} as const;

const thanhVanPersonnel = [
  {
    key: "ta-thanh-huyen",
    name: "Tạ Thanh Huyền",
    title: "Tông Chủ Thanh Vân Môn",
    sectRole: SectRoleName.LEADER,
    contribution: 120000,
    realm: "Hóa Thần",
    stageOrder: 0,
    root: "Phong Lôi Song Linh Căn",
    locationKey: "thanh-van-dai-dien",
    npcTypes: ["SECT", "ELDER", "LORE"] as const,
    services: ["approve_true_disciple", "main_story", "special_promotion"],
    dialogue: [
      "Ngươi là đệ tử mới nhập môn?",
      "Thanh Vân Môn không thiếu người có tư chất, nhưng kẻ thật sự đi được xa lại chẳng có bao nhiêu."
    ],
    choices: ["Thỉnh an Tông Chủ", "Hỏi về Thanh Vân Môn", "Hỏi về con đường tu hành", "Rời đi"],
    movement: { type: "scheduled", route: ["thanh-van-dai-dien", "thanh-van-dien-vo-truong", "thanh-van-hau-son"] },
    profile: {
      temperament: ["điềm tĩnh", "ít nói", "nhìn người chuẩn"],
      specialties: ["Thanh Vân Kiếm Đạo", "Phong Lôi pháp", "Hộ Sơn Trận", "chỉ điểm Chân Truyền"],
      conditionalDialogue: {
        HIGH_TALENT_NOTICED: ["Ta đã nghe Giám Linh Chấp Sự nhắc tới ngươi.", "Thiên phú là thứ trời ban. Có giữ được hay không, phải xem chính ngươi."],
        "Băng Linh Căn": ["Băng khí tinh thuần như vậy quả thực hiếm thấy.", "Nhưng đừng cho rằng có tư chất là đủ để bước lên đỉnh."],
        "Phong Lôi Song Linh Căn": ["Phong Lôi đồng hiện... căn cốt của ngươi có đôi phần tương tự ta năm xưa."]
      }
    }
  },
  {
    key: "mac-van-son",
    name: "Mạc Vân Sơn",
    title: "Đại Trưởng Lão",
    sectRole: SectRoleName.ELDER,
    contribution: 88000,
    realm: "Nguyên Anh",
    stageOrder: 3,
    root: "Thổ Linh Căn",
    locationKey: "thanh-van-dai-dien",
    npcTypes: ["SECT", "ELDER", "QUEST"] as const,
    services: ["inner_exam", "true_disciple_review", "elder_management"],
    dialogue: ["Ta không quan tâm ngươi xuất thân thế nào.", "Muốn bước vào Nội Môn, hãy chứng minh ngươi có đủ bản lĩnh."],
    choices: ["Hỏi Nội Môn Khảo Hạch", "Hỏi Chân Truyền", "Nhận nhiệm vụ khó", "Rời đi"],
    movement: { type: "fixed", route: [] },
    profile: { conditionalDialogue: { "Tạp Linh Căn": ["Tư chất của ngươi không tốt, nhưng những gì ngươi làm được đã đủ để người khác ngậm miệng."] } }
  },
  {
    key: "co-truong-phong",
    name: "Cố Trường Phong",
    title: "Truyền Công Trưởng Lão",
    sectRole: SectRoleName.ELDER,
    contribution: 76000,
    realm: "Nguyên Anh",
    stageOrder: 3,
    root: "Kim Linh Căn",
    locationKey: "thanh-van-tang-kinh-cac",
    npcTypes: ["SECT", "ELDER", "LORE"] as const,
    services: ["technique_advice", "open_inventory_manual", "inheritance_quest"],
    dialogue: ["Công pháp không quý ở chỗ nhiều, mà ở chỗ có hợp với bản thân hay không.", "Học quá tạp chưa chắc là chuyện tốt."],
    choices: ["Xem công pháp đang có", "Hỏi công pháp theo Linh Căn", "Hỏi truyền thừa", "Rời đi"],
    movement: { type: "fixed", route: [] },
    profile: {
      conditionalDialogue: {
        "Kim Linh Căn": ["Kim khí của ngươi rất thuần, kiếm quyết thiên công phạt sẽ tương đối hợp."],
        "Hỏa Linh Căn": ["Nếu muốn theo Hỏa đạo, phải nhớ uy lực càng mạnh càng cần khả năng khống chế."],
        "Phong Lôi Song Linh Căn": ["Biến Dị Linh Căn như ngươi không thích hợp học quá tạp. Chọn đúng một con đường còn hơn tham nhiều."],
        "Băng Linh Căn": ["Băng đạo quý ở sự tĩnh và chuẩn. Công pháp quá nóng nảy chưa chắc thích hợp."]
      }
    }
  },
  {
    key: "han-thiet-son",
    name: "Hàn Thiết Sơn",
    title: "Chấp Pháp Trưởng Lão",
    sectRole: SectRoleName.ELDER,
    contribution: 70000,
    realm: "Nguyên Anh",
    stageOrder: 2,
    root: "Kim Linh Căn",
    locationKey: "thanh-van-dien-vo-truong",
    npcTypes: ["SECT", "ELDER", "GUARD"] as const,
    services: ["sect_rules", "discipline", "traitor_hunt_quest"],
    dialogue: ["Đã mặc đạo bào Thanh Vân, thì phải nhớ mình là người của Thanh Vân.", "Trong môn có tranh đấu không đáng sợ. Không có quy củ mới đáng sợ."],
    choices: ["Hỏi quy củ", "Hỏi Chấp Pháp nhiệm vụ", "Rời đi"],
    movement: { type: "fixed", route: [] },
    profile: {}
  },
  {
    key: "te-mac",
    name: "Tề Mặc",
    title: "Tàng Kinh Trưởng Lão",
    sectRole: SectRoleName.ELDER,
    contribution: 64000,
    realm: "Nguyên Anh",
    stageOrder: 1,
    root: "Thủy Linh Căn",
    locationKey: "thanh-van-tang-kinh-cac",
    npcTypes: ["SECT", "ELDER", "LORE"] as const,
    services: ["library_floor_access", "exchange_technique", "lost_manual_quest"],
    dialogue: ["Người mới chỉ được xem tầng ngoài.", "Muốn xem tầng cao hơn, hoặc tăng thân phận, hoặc mang đủ cống hiến tới."],
    choices: ["Hỏi tầng Tàng Kinh", "Đổi công pháp", "Hỏi bí tịch thất lạc", "Rời đi"],
    movement: { type: "fixed", route: [] },
    profile: {}
  },
  {
    key: "duoc-vo-tran",
    name: "Dược Vô Trần",
    title: "Đan Đường Trưởng Lão",
    sectRole: SectRoleName.ELDER,
    contribution: 52000,
    realm: "Kim Đan",
    stageOrder: 3,
    root: "Hỏa Linh Căn",
    locationKey: "thanh-van-dan-duong",
    npcTypes: ["SECT", "ELDER", "CRAFTSMAN", "QUEST"] as const,
    services: ["alchemy", "recipe", "profession_exam", "herb_exchange"],
    profession: { key: "alchemy", rank: ProfessionRank.MASTER, level: 60 },
    dialogue: ["Luyện đan không phải ném linh thảo vào lò rồi chờ.", "Không hiểu dược tính, lửa càng mạnh càng chỉ đốt sạch Linh Thạch."],
    choices: ["Xem việc Đan Đường", "Hỏi về Luyện Đan", "Nhận khảo hạch nghề", "Trao đổi dược liệu"],
    movement: { type: "fixed", route: [] },
    profile: {}
  },
  {
    key: "au-duong-thiet",
    name: "Âu Dương Thiết",
    title: "Khí Đường Trưởng Lão",
    sectRole: SectRoleName.ELDER,
    contribution: 52000,
    realm: "Kim Đan",
    stageOrder: 3,
    root: "Kim Linh Căn",
    locationKey: "thanh-van-khi-duong",
    npcTypes: ["SECT", "ELDER", "CRAFTSMAN", "QUEST"] as const,
    services: ["forging", "recipe", "equipment_commission"],
    profession: { key: "forging", rank: ProfessionRank.MASTER, level: 58 },
    dialogue: ["Pháp khí tốt không nằm ở chỗ hoa mỹ.", "Thứ quan trọng là nó còn nguyên sau khi ngươi sống sót trở về."],
    choices: ["Xem việc Khí Đường", "Hỏi về Luyện Khí", "Nhận commission", "Rời đi"],
    movement: { type: "fixed", route: [] },
    profile: {}
  },
  {
    key: "lac-tinh-ha",
    name: "Lạc Tinh Hà",
    title: "Trận Đường Trưởng Lão",
    sectRole: SectRoleName.ELDER,
    contribution: 50000,
    realm: "Kim Đan",
    stageOrder: 3,
    root: "Thổ Linh Căn",
    locationKey: "thanh-van-tran-duong",
    npcTypes: ["SECT", "ELDER", "CRAFTSMAN", "QUEST"] as const,
    services: ["formation", "recipe", "formation_tutorial", "mountain_array_quest"],
    profession: { key: "formation", rank: ProfessionRank.MASTER, level: 55 },
    dialogue: ["Trận pháp không phải sức mạnh của một người.", "Mượn thế đất, mượn linh khí, mượn thiên thời - đó mới là trận đạo."],
    choices: ["Hỏi Trận Pháp", "Học bố trận", "Hỏi Hộ Sơn Trận", "Rời đi"],
    movement: { type: "fixed", route: [] },
    profile: {}
  },
  {
    key: "tan-hoai-ngoc",
    name: "Tần Hoài Ngọc",
    title: "Giám Linh Chấp Sự",
    sectRole: SectRoleName.OFFICER,
    contribution: 18000,
    realm: "Kim Đan",
    stageOrder: 1,
    root: "Thủy Linh Căn",
    locationKey: "thanh-van-giam-linh-dai",
    npcTypes: ["SECT", "QUEST", "LORE"] as const,
    services: ["reveal_spiritual_root", "set_high_talent_notice", "elder_summon_event"],
    dialogue: ["Đặt tay lên Trắc Linh Ngọc.", "Đừng vận công. Nó sẽ tự phản ứng với căn cốt của ngươi."],
    choices: ["Kiểm tra Linh Căn", "Hỏi về Linh Căn", "Rời đi"],
    movement: { type: "fixed", route: [] },
    profile: { rootAssessment: { reroll: false, highTalentQualities: ["Thượng", "Biến Dị", "Cực"] } }
  },
  {
    key: "chu-thanh",
    name: "Chu Thành",
    title: "Ngoại Môn Chấp Sự",
    sectRole: SectRoleName.OFFICER,
    contribution: 12000,
    realm: "Trúc Cơ",
    stageOrder: 3,
    root: "Thổ Linh Căn",
    locationKey: "thanh-van-ngoai-mon",
    npcTypes: ["SECT", "QUEST"] as const,
    services: ["join_sect", "outer_allowance", "outer_rules", "entry_exam"],
    dialogue: ["Người mới nhập môn đều bắt đầu từ Ngoại Môn.", "Đừng xem thường hai chữ Ngoại Môn. Có người ở đây mười năm vẫn không vào được Nội Môn."],
    choices: ["Đăng ký nhập môn", "Hỏi về Ngoại Môn", "Hỏi về Nội Môn", "Nhận bổng lộc", "Rời đi"],
    movement: { type: "fixed", route: [] },
    profile: {}
  },
  {
    key: "phung-ky",
    name: "Phùng Kỳ",
    title: "Nhiệm Vụ Chấp Sự",
    sectRole: SectRoleName.OFFICER,
    contribution: 14000,
    realm: "Trúc Cơ",
    stageOrder: 3,
    root: "Mộc Linh Căn",
    locationKey: "thanh-van-nhiem-vu-duong",
    npcTypes: ["SECT", "QUEST"] as const,
    services: ["mission_board", "turn_in_mission", "contribution"],
    dialogue: ["Tông môn không nuôi người nhàn rỗi.", "Muốn có tài nguyên, hãy tự kiếm lấy cống hiến."],
    choices: ["Xem nhiệm vụ", "Nộp nhiệm vụ", "Hỏi về cống hiến", "Rời đi"],
    movement: { type: "fixed", route: [] },
    profile: {}
  },
  {
    key: "lang-tieu",
    name: "Lăng Tiêu",
    title: "Tông Chủ Chân Truyền",
    sectRole: SectRoleName.INNER,
    contribution: 36000,
    realm: "Kim Đan",
    stageOrder: 1,
    root: "Phong Lôi Song Linh Căn",
    locationKey: "thanh-van-dien-vo-truong",
    npcTypes: ["SECT", "QUEST", "LORE"] as const,
    services: ["combat_benchmark", "true_disciple_guidance", "rival_quest"],
    dialogue: ["Ngươi là người mới mà Giám Linh Chấp Sự vừa nhắc tới?", "Tu hành cho tốt. Thanh Vân Môn không thiếu người bắt đầu thấp rồi đi rất xa."],
    choices: ["Luận bàn", "Hỏi Chân Truyền", "Hỏi về Tông Chủ", "Rời đi"],
    movement: { type: "route", route: ["thanh-van-dai-dien", "thanh-van-dien-vo-truong", "thanh-van-hau-son"] },
    profile: { mentor: "ta-thanh-huyen", identity: "Tông Chủ Chân Truyền", conditionalDialogue: { HIGH_TALENT_NOTICED: ["Ta nghe nói tư chất của ngươi không tệ. Có thời gian, chúng ta có thể luận bàn."] } }
  },
  {
    key: "bach-ngung-suong",
    name: "Bạch Ngưng Sương",
    title: "Chân Truyền Đệ Tử",
    sectRole: SectRoleName.INNER,
    contribution: 30000,
    realm: "Trúc Cơ",
    stageOrder: 3,
    root: "Băng Linh Căn",
    locationKey: "thanh-van-tang-kinh-cac",
    npcTypes: ["SECT", "QUEST", "LORE"] as const,
    services: ["ice_lore", "technique_hint", "benchmark"],
    dialogue: ["Băng đạo quý ở sự tĩnh.", "Nếu tâm loạn, linh khí càng tinh thuần càng dễ phản phệ."],
    choices: ["Hỏi Băng đạo", "Hỏi Chân Truyền", "Rời đi"],
    movement: { type: "route", route: ["thanh-van-noi-mon", "thanh-van-tang-kinh-cac", "thanh-van-hau-son"] },
    profile: { mentor: "co-truong-phong", identity: "Chân Truyền Đệ Tử" }
  },
  {
    key: "hua-viem",
    name: "Hứa Viêm",
    title: "Nội Môn Đệ Tử",
    sectRole: SectRoleName.INNER,
    contribution: 4200,
    realm: "Trúc Cơ",
    stageOrder: 1,
    root: "Hỏa Linh Căn",
    locationKey: "thanh-van-noi-mon",
    npcTypes: ["SECT", "QUEST"] as const,
    services: ["inner_quest", "alchemy_friend", "sparring"],
    dialogue: ["Nội Môn không nhàn hơn Ngoại Môn, chỉ là việc khó hơn thôi.", "Nếu muốn thử sức, Diễn Võ Trường luôn có người chờ."],
    choices: ["Hỏi Nội Môn", "Hỏi Luyện Đan", "Luận bàn", "Rời đi"],
    movement: { type: "scheduled", route: ["thanh-van-noi-mon", "thanh-van-dan-duong", "thanh-van-dien-vo-truong"] },
    profile: {}
  },
  {
    key: "moc-thanh",
    name: "Mộc Thanh",
    title: "Ngoại Môn Đệ Tử",
    sectRole: SectRoleName.OUTER,
    contribution: 800,
    realm: "Luyện Khí",
    stageOrder: 5,
    root: "Mộc Linh Căn",
    locationKey: "thanh-van-linh-dien",
    npcTypes: ["SECT", "QUEST"] as const,
    services: ["outer_life", "herbalism_quest", "small_help"],
    dialogue: ["Ngoại Môn vất vả thật, nhưng ít nhất mỗi ngày đều thấy mình tiến thêm một chút.", "Nếu đi Linh Điền, nhớ phân biệt Thanh Linh Thảo già và non."],
    choices: ["Hỏi đời sống Ngoại Môn", "Hỏi Linh Thực", "Giúp thu thập", "Rời đi"],
    movement: { type: "scheduled", route: ["thanh-van-ngoai-mon", "thanh-van-linh-dien"] },
    profile: {}
  }
] as const;

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
  const locationNameByKey = new Map<string, string>();
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
    locationNameByKey.set(key, location.name);
  }

  await prisma.worldSeal.upsert({
    where: { key: "co-dia-ngoai-vi-co-cam" },
    update: {
      locationId: locationByKey.get("co-dia-ngoai-vi")!,
      name: "Phong Ấn Cổ",
      description: "Một tầng cấm chế phủ trên lối vào sâu hơn của cổ địa.",
      targetType: "RUIN_GATE",
      targetId: "co-dia-noi-vi",
      requiredBreakSealGrade: 1
    },
    create: {
      key: "co-dia-ngoai-vi-co-cam",
      locationId: locationByKey.get("co-dia-ngoai-vi")!,
      name: "Phong Ấn Cổ",
      description: "Một tầng cấm chế phủ trên lối vào sâu hơn của cổ địa.",
      targetType: "RUIN_GATE",
      targetId: "co-dia-noi-vi",
      requiredBreakSealGrade: 1,
      metadata: { source: "world_seed" }
    }
  });

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
  const merchantDialogue = await dialogue("dlg-van-bao-lau", "Vạn Bảo Lâu Quản Sự", "Quản Sự", "Khách quan đã tới Vạn Bảo Lâu, hẳn là muốn tìm chút đồ dùng trên con đường tu hành?", ["Xem hàng hóa", "Hỏi về Vạn Bảo Lâu", "Rời đi"]);
  const herbFarmerDialogue = await dialogue("dlg-duoc-nong", "Dược Nông", "Dược Nông", "Thanh Trúc Lâm còn nhiều Thanh Linh Thảo. Người mới nếu cẩn thận vẫn có thể hái được.", ["Hỏi về linh thảo", "Rời đi"]);
  const woundedDialogue = await dialogue("dlg-tu-si-bi-thuong", "Tu Sĩ Bị Thương", "Tu Sĩ Bị Thương", "Ta bị yêu lang cắn ở bìa rừng. Nếu ngươi tìm được Thanh Linh Thảo, có thể cứu ta một mạng.", ["Nhận nhiệm vụ", "Bỏ qua"]);
  const wandererDialogue = await dialogue("dlg-du-phuong-dao-nhan", "Du Phương Đạo Nhân", "Du Phương Đạo Nhân", "Đường tu tiên không chỉ là cảnh giới. Có lúc một câu hỏi đúng còn quý hơn một viên đan.", ["Hỏi đạo", "Rời đi"]);
  const sectMissionDialogue = await dialogue("dlg-nhiem-vu-chap-su", "Nhiệm Vụ Chấp Sự", "Nhiệm Vụ Chấp Sự", "Nhiệm Vụ Đường ghi nhận công lao của đệ tử. Việc nhỏ tích lại cũng thành uy danh sơn môn.", ["Hỏi về nhiệm vụ", "Rời đi"]);
  const teachingDialogue = await dialogue("dlg-truyen-cong-truong-lao", "Truyền Công Trưởng Lão", "Truyền Công Trưởng Lão", "Công pháp không nằm ở trang giấy, mà ở cách ngươi vận chuyển từng hơi thở.", ["Hỏi về công pháp", "Rời đi"]);

  const npcProfiles = {
    "luc-minh": {
      portraitUrl: "/npc/luc-minh.webp",
      avatarUrl: "/npc/luc-minh.webp",
      visualKey: "luc-minh",
      metadata: {
        dialogueProfile: {
          first: "Nhìn dáng vẻ của ngươi, có lẽ mới đặt chân vào con đường tu hành. Nếu chưa biết nên bắt đầu từ đâu, ta có thể chỉ cho vài điều.",
          repeat: "Đạo hữu lại tới rồi. Thanh Vân Vực rộng, nhưng từng bước nắm chắc là được.",
          activeQuest: "Việc đầu tiên cứ nhìn đường, nhớ lối, rồi hãy nghĩ tới chuyện săn yêu.",
          readyQuest: "Ánh mắt đã bớt lạ lẫm. Xem ra đạo hữu đã hiểu đường ra ngoài thành.",
          helped: "Tốt. Từ nay nếu lạc đường, cứ tìm dấu cũ mà đi."
        },
        movementProfile: { type: "fixed", route: [] },
        role: "beginner-guide",
        relationshipType: "mentor"
      }
    },
    "thanh-van-su-gia": {
      portraitUrl: "/npc/thanh-van-su-gia.webp",
      avatarUrl: "/npc/thanh-van-su-gia.webp",
      visualKey: "thanh-van-su-gia",
      metadata: {
        dialogueProfile: {
          first: "Phía trước là địa giới Thanh Vân. Người ngoài có thể qua lại, nhưng muốn bước sâu vào sơn môn phải tuân theo quy củ.",
          repeat: "Tông môn không chỉ là danh phận. Đó là trách nhiệm, công lao và quan hệ lâu dài.",
          activeQuest: "Cứ quan sát thêm Thanh Linh Sơn Môn, chưa cần vội quyết định.",
          readyQuest: "Nếu đã hiểu đại khái, ta sẽ ghi nhận ngươi đã nghe qua chuyện sơn môn.",
          helped: "Ngươi có tâm tìm hiểu, sau này vào núi sẽ bớt nhiều đường vòng."
        },
        movementProfile: { type: "fixed", route: [] },
        role: "sect-emissary",
        relationshipType: "official"
      }
    },
    "van-bao-lau-quan-su": {
      portraitUrl: "/npc/van-bao-lau-quan-su.webp",
      avatarUrl: "/npc/van-bao-lau-quan-su.webp",
      visualKey: "van-bao-lau-quan-su",
      metadata: {
        dialogueProfile: {
          first: "Khách quan lần đầu tới Vạn Bảo Lâu sao? Bản lâu buôn bán linh thảo, khoáng vật, đan dược và một số kỳ vật thường dùng. Chỉ cần có đủ Linh Thạch, tự nhiên có thể thương lượng.",
          repeat: "Khách quan lại tới rồi. Hôm nay muốn xem hàng, hay có vật gì cần xử lý?",
          friendly: "Ngươi mua bán cẩn thận, ta cũng nguyện chỉ vài giá thật.",
          helped: "Người biết giao dịch lâu dài luôn đáng nhớ hơn người chỉ mặc cả một lần."
        },
        movementProfile: { type: "fixed", route: [] },
        role: "treasure-pavilion-steward",
        relationshipType: "commercial"
      }
    },
    "duoc-nong": {
      portraitUrl: "/npc/duoc-nong.webp",
      avatarUrl: "/npc/duoc-nong.webp",
      visualKey: "duoc-nong",
      metadata: {
        dialogueProfile: {
          first: "Lại có tu sĩ tới Thanh Trúc Lâm tìm linh dược sao? Rừng này trông yên bình, nhưng không phải cây cỏ nào cũng có thể tùy tiện hái.",
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
          first: "Đạo hữu... xin dừng bước. Ta vừa bị mấy con Yêu Lang tập kích. Tuy miễn cưỡng thoát được, nhưng thương thế không nhẹ.",
          repeat: "Là đạo hữu sao... vết thương vẫn chưa ổn, nhưng thần trí đã tỉnh hơn trước.",
          moved: "Không ngờ lại gặp đạo hữu ở nơi này. Sau trận ấy, ta không dám ở lại rừng trúc quá lâu.",
          activeQuest: "Đạo hữu trở lại rồi. Đám yêu thú đã được xử lý chưa? Khí tức của chúng vẫn còn, chỉ cần thêm một chút nữa thôi.",
          readyQuest: "Khí tức yêu thú bám trên người đạo hữu... xem ra mọi chuyện đã giải quyết xong. Đại ân này ta ghi nhớ.",
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
    },
    "ngoai-mon-chap-su": {
      portraitUrl: "/npc/ngoai-mon-chap-su.webp",
      avatarUrl: "/npc/ngoai-mon-chap-su.webp",
      visualKey: "ngoai-mon-chap-su",
      metadata: {
        dialogueProfile: {
          first: "Đã vào ngoại môn thì phải biết quy củ. Nhiệm vụ, bổng lộc, chỗ ở và việc khảo hạch đều do các chấp sự phụ trách.",
          repeat: "Danh sách tiếp dẫn vẫn còn đây. Ngươi muốn hỏi chuyện nhập môn hay nhiệm vụ ngoại môn?",
          activeQuest: "Việc sơn môn không khó, khó là làm đều và làm đúng.",
          readyQuest: "Nếu đã chuẩn bị xong, ta sẽ ghi nhận vào sổ ngoại môn."
        },
        movementProfile: { type: "fixed", route: [] },
        role: "outer-sect-registrar",
        relationshipType: "official"
      }
    },
    "nhiem-vu-chap-su": {
      portraitUrl: "/npc/nhiem-vu-chap-su.webp",
      avatarUrl: "/npc/nhiem-vu-chap-su.webp",
      visualKey: "nhiem-vu-chap-su",
      metadata: {
        dialogueProfile: {
          first: "Việc trong tông nhiều vô kể. Hộ tống, thu thập, săn yêu thú, dò xét địa vực... chỉ cần có bản lĩnh thì không lo thiếu việc.",
          repeat: "Muốn nhận việc thì xem rõ điều kiện. Nhiều người thất bại không vì yếu, mà vì đọc thiếu một dòng.",
          activeQuest: "Nhiệm vụ đang làm thì cứ theo dấu ghi trong lệnh bài.",
          readyQuest: "Đủ chứng vật rồi sao? Đưa ta kiểm công."
        },
        movementProfile: { type: "fixed", route: [] },
        role: "mission-hall-clerk",
        relationshipType: "official"
      }
    },
    "truyen-cong-truong-lao": {
      portraitUrl: "/npc/truyen-cong-truong-lao.webp",
      avatarUrl: "/npc/truyen-cong-truong-lao.webp",
      visualKey: "truyen-cong-truong-lao",
      metadata: {
        dialogueProfile: {
          first: "Công pháp không quý ở chỗ nhiều, mà ở chỗ có hợp với bản thân hay không. Học quá tạp chưa chắc là chuyện tốt.",
          repeat: "Đừng tham nhanh. Một vòng chu thiên vững còn hơn mười lần cưỡng ép.",
          friendly: "Ngươi chịu lắng tâm, vậy ta có thể nói sâu hơn một chút.",
          helped: "Nếu sau này khí mạch rối, hãy nhớ quay về căn bản."
        },
        movementProfile: { type: "fixed", route: [] },
        role: "scripture-elder",
        relationshipType: "teacher"
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
    ["nhiem-vu-chap-su", "Nhiệm Vụ Chấp Sự", "Nhiệm Vụ Đường", "Chấp sự ghi nhận công lao, phát lệnh bài nhiệm vụ và giải thích cống hiến tông môn.", "sect-disciple", "thanh-linh-son-mon", sectMissionDialogue.id, ["SECT", "QUEST"], true, false, true],
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
    ["san-yeu-dau-tien", "Giúp Người Bị Thương", "Đánh bại 3 Yêu Lang quanh Thanh Trúc Lâm để giúp tu sĩ bị thương rời khỏi rừng.", "MAIN", "KILL_MONSTER", { targetKey: "yeu-lang", requireTurnIn: true }, 3, "MONSTER_KILLED", "tu-si-bi-thuong", "tu-si-bi-thuong", "buoc-dau-tien", "thu-thap-linh-thao", { cultivation: 140, linhThach: 300, items: [{ key: "duong-the-dan", quantity: 2 }], npc: { relationshipScore: 18, moveToLocationKey: "thanh-van-dong-thanh", movementType: "questDriven" } }, ["helped_wounded_cultivator", "completed_first_hunt"]],
    ["thu-thap-linh-thao", "Thu Thập Thanh Linh Thảo", "Mang về 5 Thanh Linh Thảo cho Dược Nông để học cách nhận biết linh dược phổ thông.", "MAIN", "COLLECT_ITEM", { targetKey: "thanh-linh-thao", requireTurnIn: true }, 5, "ITEM_OBTAINED", "duoc-nong", "duoc-nong", "san-yeu-dau-tien", "tim-hieu-son-mon", { cultivation: 90, linhThach: 200, items: [{ key: "hoi-khi-dan", quantity: 2 }], npc: { relationshipScore: 12 } }, ["learned_basic_herbs"]],
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

  const realmStageByName = async (realmName: string, stageOrder: number) => {
    return prisma.realmStage.findFirstOrThrow({
      where: { realm: { name: realmName }, order: stageOrder },
      include: { realm: true }
    });
  };

  const rootByName = new Map((await prisma.spiritualRoot.findMany()).map((root) => [root.name, root]));
  const professionByKeyForSect = new Map((await prisma.profession.findMany()).map((profession) => [profession.key, profession]));
  const sectCharacterByNpcKey = new Map<string, string>();
  const seedNpcPasswordHash = await argon2.hash("npc-seed-account-disabled");

  for (const member of thanhVanPersonnel) {
    const realmStage = await realmStageByName(member.realm, member.stageOrder);
    const root = rootByName.get(member.root);
    const currentLocationId = locationByKey.get(member.locationKey);
    if (!root || !currentLocationId) throw new Error(`Missing Thanh Van personnel dependency: ${member.key}`);
    const zoneId = (await prisma.location.findUniqueOrThrow({ where: { id: currentLocationId }, include: { zone: true } })).zoneId;
    const npcUser = await prisma.user.upsert({
      where: { email: `${member.key}@npc.tutiengioi.local` },
      update: { username: `npc-${member.key}` },
      create: {
        username: `npc-${member.key}`,
        email: `${member.key}@npc.tutiengioi.local`,
        passwordHash: seedNpcPasswordHash
      }
    });
    const character = await prisma.character.upsert({
      where: { userId: npcUser.id },
      update: {
        name: member.name,
        title: member.title,
        realmStageId: realmStage.id,
        spiritualRootId: root.id,
        locationId: zoneId,
        currentLocationId,
        sectId: null,
        cultivation: realmStage.requiredCultivation,
        maxHp: realmStage.baseHp,
        hp: realmStage.baseHp,
        maxQi: realmStage.baseQi,
        qi: realmStage.baseQi,
        attack: realmStage.baseAttack,
        defense: realmStage.baseDefense,
        speed: realmStage.baseSpeed,
        reputation: Math.floor(member.contribution / 10)
      },
      create: {
        userId: npcUser.id,
        name: member.name,
        title: member.title,
        realmStageId: realmStage.id,
        spiritualRootId: root.id,
        locationId: zoneId,
        currentLocationId,
        cultivation: realmStage.requiredCultivation,
        maxHp: realmStage.baseHp,
        hp: realmStage.baseHp,
        maxQi: realmStage.baseQi,
        qi: realmStage.baseQi,
        attack: realmStage.baseAttack,
        defense: realmStage.baseDefense,
        speed: realmStage.baseSpeed,
        reputation: Math.floor(member.contribution / 10),
        linhThach: BigInt(Math.max(1000, Math.floor(member.contribution / 2)))
      }
    });
    sectCharacterByNpcKey.set(member.key, character.id);
    if ("profession" in member && member.profession) {
      const profession = professionByKeyForSect.get(member.profession.key);
      if (profession) {
        await prisma.characterProfession.upsert({
          where: { characterId_professionId: { characterId: character.id, professionId: profession.id } },
          update: { level: member.profession.level, rank: member.profession.rank, specialization: member.title },
          create: { characterId: character.id, professionId: profession.id, level: member.profession.level, rank: member.profession.rank, specialization: member.title, unlockedRecipes: { source: "thanh_van_mon_seed" } }
        });
      }
    }
  }

  const leaderId = sectCharacterByNpcKey.get("ta-thanh-huyen");
  if (!leaderId) throw new Error("Missing Thanh Van Mon leader character.");
  const thanhVanMon = await prisma.sect.upsert({
    where: { tag: "TVM" },
    update: {
      name: "Thanh Vân Môn",
      description: "Tam Phẩm Tông Môn chính đạo tọa lạc trên Thanh Linh Sơn Mạch, nổi danh nhờ kiếm đạo, luyện khí, trận pháp và hệ thống truyền công hoàn chỉnh.",
      emblem: "mountain-sword",
      alignment: SectAlignment.RIGHTEOUS,
      rank: 3,
      level: 30,
      experience: 36000,
      treasury: 350000n,
      reputation: 68000,
      memberLimit: 30,
      recruiting: true,
      autoAccept: false,
      joinRequirement: "Qua khảo hạch nhập môn. Tất cả Linh Căn đều có đường vào Ngoại Môn.",
      notice: "Thanh Vân Môn trọng căn cơ, thực lực và cống hiến. Thiên tài được ưu tiên, người bền chí vẫn có đường tiến thân.",
      leaderId
    },
    create: {
      name: "Thanh Vân Môn",
      tag: "TVM",
      description: "Tam Phẩm Tông Môn chính đạo tọa lạc trên Thanh Linh Sơn Mạch, nổi danh nhờ kiếm đạo, luyện khí, trận pháp và hệ thống truyền công hoàn chỉnh.",
      emblem: "mountain-sword",
      alignment: SectAlignment.RIGHTEOUS,
      rank: 3,
      level: 30,
      experience: 36000,
      treasury: 350000n,
      reputation: 68000,
      memberLimit: 30,
      recruiting: true,
      autoAccept: false,
      joinRequirement: "Qua khảo hạch nhập môn. Tất cả Linh Căn đều có đường vào Ngoại Môn.",
      notice: "Thanh Vân Môn trọng căn cơ, thực lực và cống hiến. Thiên tài được ưu tiên, người bền chí vẫn có đường tiến thân.",
      leaderId
    }
  });

  for (const member of thanhVanPersonnel) {
    const characterId = sectCharacterByNpcKey.get(member.key);
    if (!characterId) continue;
    await prisma.character.update({ where: { id: characterId }, data: { sectId: thanhVanMon.id } });
    await prisma.sectMember.upsert({
      where: { characterId },
      update: { sectId: thanhVanMon.id, role: member.sectRole, contribution: member.contribution, weeklyContribution: Math.floor(member.contribution / 20) },
      create: { sectId: thanhVanMon.id, characterId, role: member.sectRole, contribution: member.contribution, weeklyContribution: Math.floor(member.contribution / 20) }
    });
  }

  const mentorshipSeeds = [
    {
      id: "seed-ta-thanh-huyen-lang-tieu",
      masterKey: "ta-thanh-huyen",
      discipleKey: "lang-tieu",
      type: SectMentorshipType.SECT_MASTER_DISCIPLE,
      mentorKey: "ta-thanh-huyen",
      questKey: "phong-loi-van-tam",
      reason: "Lăng Tiêu được Tông Chủ đích thân truyền đạo, giữ một suất thân truyền hiện hữu."
    },
    {
      id: "seed-co-truong-phong-bach-ngung-suong",
      masterKey: "co-truong-phong",
      discipleKey: "bach-ngung-suong",
      type: SectMentorshipType.ELDER_DISCIPLE,
      mentorKey: "co-truong-phong",
      questKey: "mot-kiem-mot-tam",
      reason: "Bạch Ngưng Sương theo Cố Trường Phong học kiếm đạo."
    }
  ];

  for (const relation of mentorshipSeeds) {
    const masterCharacterId = sectCharacterByNpcKey.get(relation.masterKey);
    const discipleCharacterId = sectCharacterByNpcKey.get(relation.discipleKey);
    if (!masterCharacterId || !discipleCharacterId) continue;
    await prisma.sectMentorship.upsert({
      where: { id: relation.id },
      update: {
        sectId: thanhVanMon.id,
        masterCharacterId,
        discipleCharacterId,
        type: relation.type,
        status: SectMentorshipStatus.ACTIVE,
        invitationReason: relation.reason,
        acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
        endedAt: null,
        rejectedAt: null,
        metadata: { source: "thanh_van_mon_seed", mentorKey: relation.mentorKey, questKey: relation.questKey }
      },
      create: {
        id: relation.id,
        sectId: thanhVanMon.id,
        masterCharacterId,
        discipleCharacterId,
        type: relation.type,
        status: SectMentorshipStatus.ACTIVE,
        invitationReason: relation.reason,
        acceptedAt: new Date("2026-01-01T00:00:00.000Z"),
        metadata: { source: "thanh_van_mon_seed", mentorKey: relation.mentorKey, questKey: relation.questKey }
      }
    });
  }

  const thanhVanMetadata = {
    grade: "TAM_PHAM",
    gradeLabel: "Tam Phẩm Tông Môn",
    worldSeed: true,
    foundedByPlayer: false,
    style: ["chính đạo", "kỷ luật", "coi trọng căn cơ", "coi trọng thực lực", "coi trọng cống hiến"],
    locations: thanhVanSectLocations,
    innerRequirements: thanhVanInnerRequirements,
    trueDiscipleRule: {
      base: ["Đang là Nội Môn", "Ít nhất Trúc Cơ", "Cống hiến đủ", "Thành tích tốt", "Mentor đồng ý", "Hoàn thành Chân Truyền Khảo Hạch"],
      byQuality: {
        "Phàm": "Cần thành tích đặc biệt",
        "Trung": "Cần performance cao",
        "Thượng": "Đủ tiêu chuẩn",
        "Biến Dị": "Được ưu tiên",
        "Cực": "Được ưu tiên mạnh"
      },
      autoPromote: false
    },
    leaderTrueDisciple: {
      max: 2,
      requirements: ["Nội Môn hoặc Chân Truyền", "Trúc Cơ cao tầng", "Thành tích đặc biệt", "Quan hệ với Tông Chủ", "Quest riêng"],
      earlyQuestRoots: ["Băng Linh Căn", "Phong Lôi Song Linh Căn"]
    },
    allowance: {
      OUTER: { linhThach: 100, items: [{ key: "tu-linh-dan", quantity: 1 }], cycle: "game_cycle" },
      INNER: { linhThach: 300, items: [{ key: "tu-linh-dan", quantity: 2 }], cycle: "game_cycle" },
      TRUE_DISCIPLE: { linhThach: 800, items: [{ key: "pha-canh-dan", quantity: 1 }], cycle: "game_cycle" },
      unlimitedClaim: false
    },
    rankUpRules: {
      5: { next: 4, leaderMinRealm: "Kim Đan" },
      4: { next: 3, leaderMinRealm: "Nguyên Anh" },
      3: { next: 2, leaderMinRealm: "Hóa Thần" },
      2: { next: 1, leaderMinRealm: "Luyện Hư" }
    }
  };

  const existingThanhVanLog = await prisma.sectLog.findFirst({ where: { sectId: thanhVanMon.id, message: "Thanh Vân Môn được ghi vào thế giới seed: Tam Phẩm Tông Môn, Tông Chủ Hóa Thần tầng 1." } });
  if (!existingThanhVanLog) {
    await prisma.sectLog.create({ data: {
      sectId: thanhVanMon.id,
      actorId: leaderId,
      type: "ADMIN",
      message: "Thanh Vân Môn được ghi vào thế giới seed: Tam Phẩm Tông Môn, Tông Chủ Hóa Thần tầng 1.",
      metadata: thanhVanMetadata
    } });
  }

  for (const [key, name, level, bonus] of [
    ["dai-dien", "Thanh Vân Đại Điện", 3, { authority: 3, promotion: true }],
    ["ngoai-mon", "Ngoại Môn", 3, { access: "OUTER", allowance: true }],
    ["noi-mon", "Nội Môn", 3, { access: "INNER", innerExam: true }],
    ["tang-kinh-cac", "Tàng Kinh Các", 3, { floors: 3, library: true }],
    ["dan-duong", "Đan Đường", 3, { profession: "alchemy", commission: true }],
    ["khi-duong", "Khí Đường", 3, { profession: "forging", commission: true }],
    ["tran-duong", "Trận Đường", 3, { profession: "formation", mountainArray: true }],
    ["linh-dien", "Linh Điền", 3, { farms: 6, crops: ["thanh-linh-thao", "ngung-lo-thao"] }],
    ["linh-khoang", "Linh Khoáng", 3, { mines: 2, resources: ["hac-thiet-quang", "huyen-thiet"] }],
    ["dong-phu", "Động Phủ", 3, { caves: 30, cultivation: true }]
  ] as const) {
    await prisma.sectBuilding.upsert({
      where: { sectId_key: { sectId: thanhVanMon.id, key } },
      update: { name, level, bonus },
      create: { sectId: thanhVanMon.id, key, name, level, bonus }
    });
  }

  for (const [facilityType, currentCapacity, maxCapacity] of [
    [SectFacilityType.FARM, 6, 6],
    [SectFacilityType.CAVE, 30, 30],
    [SectFacilityType.MINE, 2, 2],
    [SectFacilityType.STORAGE, 90, 90]
  ] as const) {
    await prisma.sectFacilityExpansion.upsert({
      where: { sectId_facilityType: { sectId: thanhVanMon.id, facilityType } },
      update: { currentCapacity, maxCapacity, expansionCount: 0 },
      create: { sectId: thanhVanMon.id, facilityType, currentCapacity, maxCapacity, expansionCount: 0 }
    });
  }

  for (let index = 1; index <= 30; index++) {
    const existingCave = await prisma.sectCave.findFirst({ where: { sectId: thanhVanMon.id, name: `Thanh Vân Động Phủ ${index}` } });
    const quality = index <= 2 ? SectCaveQuality.MYSTIC : index <= 10 ? SectCaveQuality.SPIRIT : SectCaveQuality.COMMON;
    const requiredRole = index <= 2 ? SectRoleName.INNER : index <= 10 ? SectRoleName.INNER : SectRoleName.OUTER;
    const data = {
      quality,
      cultivationBonusBps: index <= 2 ? 1500 : index <= 10 ? 1000 : 500,
      breakthroughBonusBps: index <= 2 ? 200 : index <= 10 ? 100 : 0,
      requiredRole,
      requiredRealmOrder: index <= 2 ? 2 : 0,
      status: "OPEN"
    };
    if (existingCave) await prisma.sectCave.update({ where: { id: existingCave.id }, data });
    else await prisma.sectCave.create({ data: { sectId: thanhVanMon.id, name: `Thanh Vân Động Phủ ${index}`, ...data } });
  }

  for (const techniqueKey of ["thanh-van-tam-phap", "liem-hoa-kiem-phap", "than-hanh-bo", "hoa-van-bi-thuat"]) {
    const technique = await prisma.technique.findUnique({ where: { key: techniqueKey } });
    if (!technique) continue;
    await prisma.sectLibraryTechnique.upsert({
      where: { sectId_techniqueId: { sectId: thanhVanMon.id, techniqueId: technique.id } },
      update: {
        accessRole: techniqueKey === "thanh-van-tam-phap" ? SectRoleName.OUTER : SectRoleName.INNER,
        requiredRealmOrder: technique.realmOrder,
        contributionCost: techniqueKey === "thanh-van-tam-phap" ? 100 : 600,
        source: "thanh_van_mon_seed"
      },
      create: {
        sectId: thanhVanMon.id,
        techniqueId: technique.id,
        accessRole: techniqueKey === "thanh-van-tam-phap" ? SectRoleName.OUTER : SectRoleName.INNER,
        requiredRealmOrder: technique.realmOrder,
        contributionCost: techniqueKey === "thanh-van-tam-phap" ? 100 : 600,
        source: "thanh_van_mon_seed"
      }
    });
  }

  for (const stock of [
    { key: "thanh-van-dao-bao", quantity: 60, quality: 1 },
    { key: "tu-linh-dan", quantity: 120, quality: 1 },
    { key: "hoi-khi-dan", quantity: 80, quality: 1 },
    { key: "thanh-linh-thao", quantity: 500, quality: 1 },
    { key: "hac-thiet-quang", quantity: 360, quality: 1 },
    { key: "huyen-thiet", quantity: 160, quality: 1 }
  ]) {
    const template = await prisma.itemTemplate.findUnique({ where: { key: stock.key } });
    if (!template) continue;
    await prisma.sectInventoryItem.upsert({
      where: { sectId_templateId_quality_enhancement_bound: { sectId: thanhVanMon.id, templateId: template.id, quality: stock.quality, enhancement: 0, bound: false } },
      update: { quantity: stock.quantity },
      create: { sectId: thanhVanMon.id, templateId: template.id, quantity: stock.quantity, quality: stock.quality, enhancement: 0, bound: false }
    });
  }

  for (const member of thanhVanPersonnel) {
    const dialogueSet = await dialogue(`dlg-${member.key}`, member.name, member.name, member.dialogue.join("\n\n"), [...member.choices]);
    const location = await prisma.location.findUniqueOrThrow({ where: { key: member.locationKey }, include: { zone: true } });
    const routeIds = member.movement.route.map((routeKey) => locationByKey.get(routeKey)).filter(Boolean);
    const npc = await prisma.npc.upsert({
      where: { key: member.key },
      update: {
        name: member.name,
        title: member.title,
        description: `${member.title} của Thanh Vân Môn. Cảnh giới ${member.realm}${member.realm === "Luyện Khí" || member.realm === "Trúc Cơ" ? ` tầng ${member.stageOrder + 1}` : member.stageOrder === 0 ? " tầng 1" : ""}.`,
        iconKey: member.sectRole === SectRoleName.LEADER ? "sect-master" : member.sectRole === SectRoleName.ELDER ? "elder" : "sect-disciple",
        portraitUrl: `/npc/${member.key}.webp`,
        avatarUrl: `/npc/${member.key}.webp`,
        visualKey: member.key,
        locationId: location.id,
        homeLocationId: location.id,
        regionId: location.zone.regionId,
        dialogueSetId: dialogueSet.id,
        npcTypes: [...member.npcTypes] as never,
        sectId: thanhVanMon.id,
        realm: `${member.realm}${member.realm === "Luyện Khí" || member.realm === "Trúc Cơ" ? ` tầng ${member.stageOrder + 1}` : member.stageOrder === 0 ? " tầng 1" : ""}`,
        roleTitle: member.title,
        questProvider: member.npcTypes.includes("QUEST"),
        shopProvider: member.services.some((service) => service.includes("exchange")),
        serviceProvider: true,
        spawnMode: member.movement.type === "fixed" ? "STATIC" : member.movement.type === "route" ? "RANDOM" : "EVENT",
        metadata: { ...member.profile, services: member.services, root: member.root, sectRole: member.sectRole, characterId: sectCharacterByNpcKey.get(member.key) },
        active: true
      },
      create: {
        key: member.key,
        name: member.name,
        title: member.title,
        description: `${member.title} của Thanh Vân Môn. Cảnh giới ${member.realm}${member.realm === "Luyện Khí" || member.realm === "Trúc Cơ" ? ` tầng ${member.stageOrder + 1}` : member.stageOrder === 0 ? " tầng 1" : ""}.`,
        iconKey: member.sectRole === SectRoleName.LEADER ? "sect-master" : member.sectRole === SectRoleName.ELDER ? "elder" : "sect-disciple",
        portraitUrl: `/npc/${member.key}.webp`,
        avatarUrl: `/npc/${member.key}.webp`,
        visualKey: member.key,
        locationId: location.id,
        homeLocationId: location.id,
        regionId: location.zone.regionId,
        dialogueSetId: dialogueSet.id,
        npcTypes: [...member.npcTypes] as never,
        sectId: thanhVanMon.id,
        realm: `${member.realm}${member.realm === "Luyện Khí" || member.realm === "Trúc Cơ" ? ` tầng ${member.stageOrder + 1}` : member.stageOrder === 0 ? " tầng 1" : ""}`,
        roleTitle: member.title,
        questProvider: member.npcTypes.includes("QUEST"),
        shopProvider: member.services.some((service) => service.includes("exchange")),
        serviceProvider: true,
        spawnMode: member.movement.type === "fixed" ? "STATIC" : member.movement.type === "route" ? "RANDOM" : "EVENT",
        metadata: { ...member.profile, services: member.services, root: member.root, sectRole: member.sectRole, characterId: sectCharacterByNpcKey.get(member.key) },
        active: true
      }
    });
    await prisma.npcWorldState.upsert({
      where: { npcId: npc.id },
      update: { currentLocationId: location.id, movementType: member.movement.type, route: routeIds, schedule: { source: "thanh_van_mon_seed" }, state: {} },
      create: { npcId: npc.id, currentLocationId: location.id, movementType: member.movement.type, route: routeIds, schedule: { source: "thanh_van_mon_seed" }, state: {} }
    });
    npcByKey.set(member.key, npc.id);
  }

  const sectQuestTemplates = [
    ["nhap-thanh-van-1", "Nhập Thanh Vân: Gặp Sứ Giả", "Nói chuyện Thanh Vân Sứ Giả để biết đường tới sơn môn.", "TALK_TO_NPC", {}, 1, "TALK_TO_NPC", "thanh-van-su-gia", "thanh-van-su-gia", null, "nhap-thanh-van-2", { cultivation: 60, linhThach: 50 }, ["thanh_van_intro_started"]],
    ["nhap-thanh-van-2", "Nhập Thanh Vân: Tới Ngoại Môn", "Tới gặp Chu Thành tại Ngoại Môn.", "VISIT_LOCATION", { targetKey: "thanh-van-ngoai-mon", requireTurnIn: true }, 1, "ENTER_LOCATION", "chu-thanh", "chu-thanh", "nhap-thanh-van-1", "nhap-thanh-van-3", { cultivation: 80, linhThach: 80 }, ["met_outer_registrar"]],
    ["nhap-thanh-van-3", "Nhập Thanh Vân: Giám Linh Đài", "Tới Giám Linh Đài và để Tần Hoài Ngọc kiểm tra Linh Căn.", "TALK_TO_NPC", { revealSpiritualRoot: true, setHighTalentNoticed: true }, 1, "TALK_TO_NPC", "tan-hoai-ngoc", "tan-hoai-ngoc", "nhap-thanh-van-2", "nhap-thanh-van-4", { cultivation: 100, linhThach: 100 }, ["spiritual_root_revealed"]],
    ["nhap-thanh-van-4", "Nhập Thanh Vân: Khảo Hạch", "Chứng minh căn cơ bằng cách đánh bại 3 Yêu Lang cấp thấp.", "KILL_MONSTER", { targetKey: "yeu-lang", requireTurnIn: true }, 3, "MONSTER_KILLED", "chu-thanh", "chu-thanh", "nhap-thanh-van-3", "nhap-thanh-van-5", { cultivation: 160, linhThach: 150, contribution: 60 }, ["entry_exam_passed"]],
    ["nhap-thanh-van-5", "Nhập Thanh Vân: Nhận Ngoại Môn Lệnh", "Quay lại Chu Thành để nhận thân phận Ngoại Môn Đệ Tử.", "JOIN_SECT", { sectTag: "TVM", role: "OUTER", manualApproval: true }, 1, "SECT_JOINED", "chu-thanh", "chu-thanh", "nhap-thanh-van-4", null, { cultivation: 220, linhThach: 500, contribution: 100, items: [{ key: "thanh-van-dao-bao", quantity: 1 }, { key: "tu-linh-dan", quantity: 3 }, { key: "hoi-khi-dan", quantity: 2 }, { key: "thanh-van-tam-phap", quantity: 1 }] }, ["joined_thanh_van_outer", "unlocked_sect_mission"]]
  ] as const;

  for (const [key, title, description, objectiveType, objective, targetCount, triggerType, startNpcKey, turnInNpcKey, prerequisiteKey, nextQuestKey, reward, flags] of sectQuestTemplates) {
    await prisma.questTemplate.upsert({
      where: { key },
      update: { title, description, type: "SECT" as never, objectiveType: objectiveType as never, objective, targetCount, triggerType: triggerType as never, startNpcId: npcByKey.get(startNpcKey), turnInNpcId: npcByKey.get(turnInNpcKey), prerequisiteKey, nextQuestKey, reward, flagsOnComplete: [...flags], active: true },
      create: { key, title, description, type: "SECT" as never, objectiveType: objectiveType as never, objective, targetCount, triggerType: triggerType as never, startNpcId: npcByKey.get(startNpcKey), turnInNpcId: npcByKey.get(turnInNpcKey), prerequisiteKey, nextQuestKey, reward, flagsOnComplete: [...flags], active: true }
    });
  }

  const sectMissionSeeds = [
    { key: "thu-thap-thanh-linh-thao", type: "COLLECT", title: "Thu thập Thanh Linh Thảo", description: "Mang Thanh Linh Thảo về Nhiệm Vụ Đường để bổ sung kho Đan Đường.", locationKey: "thanh-van-linh-dien", targetCount: 5, durationMinutes: 20, difficulty: 1, objective: { eventType: "ITEM_COLLECTED", itemKey: "thanh-linh-thao" }, reward: { linhThach: 120, contribution: 30, reputation: 6, items: [{ key: "tu-linh-dan", quantity: 1 }] } },
    { key: "diet-xich-nhan-lang", type: "HUNT", title: "Diệt Xích Nhãn Lang", description: "Dọn yêu thú cấp thấp quanh Hậu Sơn để giữ an toàn đường núi.", locationKey: "thanh-van-hau-son", targetCount: 3, durationMinutes: 30, difficulty: 2, objective: { eventType: "MONSTER_KILLED", monsterKey: "yeu-lang" }, reward: { linhThach: 220, contribution: 70, reputation: 16 } },
    { key: "nop-hac-thiet", type: "DONATE", title: "Nộp Hắc Thiết", description: "Giao Hắc Thiết Quặng cho Khí Đường rèn pháp khí nhập môn.", locationKey: "thanh-van-linh-khoang", targetCount: 8, durationMinutes: 15, difficulty: 1, objective: { eventType: "ITEM_COLLECTED", itemKey: "hac-thiet-quang" }, reward: { linhThach: 160, contribution: 50, reputation: 10 } },
    { key: "luyen-tu-khi-dan", type: "DELIVER", title: "Luyện Tụ Khí Đan", description: "Dược Vô Trần muốn thấy chính tay ngươi luyện được Tụ Khí Đan. Đan mua ngoài chợ không tính.", locationKey: "thanh-van-dan-duong", targetCount: 2, durationMinutes: 45, difficulty: 2, objective: { eventType: "CRAFT_COMPLETED", recipeKey: "recipe-tu-khi-dan", itemKey: "tu-khi-dan", professionKey: "alchemy", requiresProgressBeforeTurnIn: true, turnInItemKey: "tu-khi-dan" }, reward: { linhThach: 300, contribution: 100, reputation: 18 } },
    { key: "kiem-tra-tran-ky", type: "PATROL", title: "Kiểm tra trận kỳ", description: "Theo Lạc Tinh Hà rà soát Trận Kỳ Thử Nghiệm ở Trận Đường rồi quay về báo cáo.", locationKey: "thanh-van-tran-duong", targetCount: 1, durationMinutes: 40, difficulty: 2, objective: { eventType: "INTERACT_WORLD_OBJECT", worldObjectKey: "formation-training-node", interactionType: "INSPECT_FORMATION", requiresProgressBeforeTurnIn: true }, reward: { linhThach: 240, contribution: 85, reputation: 20 } },
    { key: "dieu-tra-hau-son", type: "EXPLORE", title: "Điều tra Hậu Sơn", description: "Ghi nhận dị động linh khí ở Hậu Sơn, chuẩn bị cho arc Hậu Sơn Dị Biến.", locationKey: "thanh-van-hau-son", targetCount: 1, durationMinutes: 60, difficulty: 3, objective: { eventType: "LOCATION_VISITED" }, reward: { linhThach: 360, contribution: 140, reputation: 35 } }
  ];

  for (const mission of sectMissionSeeds) {
    await prisma.sectMission.upsert({
      where: { sectId_periodKey_key: { sectId: thanhVanMon.id, periodKey: "seed", key: mission.key } },
      update: {
        type: mission.type,
        title: mission.title,
        description: mission.description,
        difficulty: mission.difficulty,
        durationMinutes: mission.durationMinutes,
        maxParticipants: mission.difficulty >= 3 ? 3 : 1,
        locationId: locationByKey.get(mission.locationKey),
        objective: { ...mission.objective, locationId: locationByKey.get(mission.locationKey), locationKey: mission.locationKey, locationName: locationNameByKey.get(mission.locationKey), source: "thanh_van_mon_seed" },
        targetCount: mission.targetCount,
        reward: mission.reward,
        status: "ACTIVE" as never,
        expiresAt: null
      },
      create: {
        sectId: thanhVanMon.id,
        periodKey: "seed",
        key: mission.key,
        type: mission.type,
        title: mission.title,
        description: mission.description,
        difficulty: mission.difficulty,
        durationMinutes: mission.durationMinutes,
        maxParticipants: mission.difficulty >= 3 ? 3 : 1,
        locationId: locationByKey.get(mission.locationKey),
        objective: { ...mission.objective, locationId: locationByKey.get(mission.locationKey), locationKey: mission.locationKey, locationName: locationNameByKey.get(mission.locationKey), source: "thanh_van_mon_seed" },
        targetCount: mission.targetCount,
        reward: mission.reward,
        status: "ACTIVE" as never
      }
    });
  }

  await prisma.sectAnnouncement.upsert({
    where: { id: `seed-announcement-${thanhVanMon.id}` },
    update: {
      title: "Thanh Vân Môn tuyển nhận đệ tử",
      body: "Người qua khảo hạch nhập môn đều có thể vào Ngoại Môn. Tư chất chỉ quyết định tốc độ được chú ý, không chặn đường tiến thân.",
      pinned: true,
      authorId: leaderId
    },
    create: {
      id: `seed-announcement-${thanhVanMon.id}`,
      sectId: thanhVanMon.id,
      title: "Thanh Vân Môn tuyển nhận đệ tử",
      body: "Người qua khảo hạch nhập môn đều có thể vào Ngoại Môn. Tư chất chỉ quyết định tốc độ được chú ý, không chặn đường tiến thân.",
      pinned: true,
      authorId: leaderId
    }
  });

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

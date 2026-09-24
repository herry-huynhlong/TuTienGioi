import argon2 from "argon2";
import { PrismaClient, Rarity, ItemCategory } from "@prisma/client";

const prisma = new PrismaClient();

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
  ["cho-linh-bao", "Chợ Linh Bảo", "thanh-van-thanh", "market", "Nơi thương nhân và tu sĩ giao dịch vật phẩm phổ thông.", "HIGH", ["market", "auction", "npc_shop"]],
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

const routes = [
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
  "Linh Thảo", "Hỏa Linh Thảo", "Băng Tâm Hoa", "Hắc Thiết Quặng", "Thanh Mộc", "Yêu Đan",
  "Lôi Tinh", "Ngọc Tủy", "Huyền Thiết", "Tinh Kim", "Linh Sa", "Chu Sa", "Da Yêu Lang",
  "Xương Linh Thú", "Hải Châu", "Huyết Tinh", "Tàn Quyển", "Trận Kỳ", "Linh Mễ", "Dược Lộ"
];

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
      update: { regionId: regionByKey.get(regionKey) },
      create: {
        key,
        regionId: regionByKey.get(regionKey),
        name,
        description: `${name} có linh khí, tài nguyên và cơ duyên riêng.`,
        minimumRealmOrder: minRealm,
        dangerLevel: danger,
        travelCost: BigInt(50 * (danger + 1)),
        travelMinutes: 3 + danger,
        resourceTable: [{ key: "linh-thao", weight: 50 }, { key: "hac-thiet-quang", weight: 30 }, { key: "yeu-dan", weight: 10 }],
        monsterTable: [{ key: "yeu-lang", weight: 60 }, { key: "xich-hoa-xa", weight: 30 }]
      }
    });
  }

  const locationByKey = new Map<string, string>();
  for (const [key, name, zoneKey, kind, description, securityLevel, services] of locations) {
    const zone = await prisma.zone.findUniqueOrThrow({ where: { key: zoneKey } });
    const location = await prisma.location.upsert({
      where: { key },
      update: { zoneId: zone.id, name, kind, description, securityLevel: securityLevel as never, services: [...services] },
      create: {
        key,
        zoneId: zone.id,
        name,
        kind,
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

  for (const name of materials) {
    const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "-").replaceAll("đ", "d");
    await prisma.itemTemplate.upsert({
      where: { key },
      update: {},
      create: { key, name, category: ItemCategory.MATERIAL, rarity: Rarity.HA, description: `${name} dùng trong luyện chế và giao thương.`, stackable: true, maxStack: 999, baseModifiers: {} }
    });
  }

  const equipment = [
    ["thanh-van-kiem", "Thanh Vân Kiếm", "WEAPON", { attack: 18 }],
    ["hac-thiet-giap", "Hắc Thiết Giáp", "ARMOR", { defense: 15 }],
    ["ngoc-boi-an-than", "Ngọc Bội An Thần", "TALISMAN", { spirit: 8 }],
    ["nhan-tu-linh", "Nhẫn Tụ Linh", "RING", { cultivationBps: 300 }],
    ["giay-than-hanh", "Giày Thần Hành", "BOOTS", { speed: 8 }]
  ] as const;
  for (const [key, name, slot, mods] of equipment) {
    await prisma.itemTemplate.upsert({
      where: { key },
      update: {},
      create: { key, name, category: ItemCategory.EQUIPMENT, rarity: Rarity.TRUNG, description: `${name} có thể trang bị.`, equipSlot: slot as never, baseModifiers: mods, durability: undefined } as never
    });
  }
  for (const [key, name, mods] of [
    ["hoi-khi-dan", "Hồi Khí Đan", { qiRestore: 60 }],
    ["hoi-xuan-dan", "Hồi Xuân Đan", { hpRestore: 80 }],
    ["tu-linh-dan", "Tụ Linh Đan", { cultivation: 250 }],
    ["pha-canh-dan", "Phá Cảnh Đan", { breakthroughBps: 900 }],
    ["giai-doc-dan", "Giải Độc Đan", { cleanse: true }]
  ] as const) {
    await prisma.itemTemplate.upsert({ where: { key }, update: {}, create: { key, name, category: ItemCategory.CONSUMABLE, rarity: Rarity.TRUNG, description: `${name} là đan dược hữu dụng.`, stackable: true, maxStack: 99, baseModifiers: mods } });
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

  const alchemy = await prisma.profession.findUniqueOrThrow({ where: { key: "alchemy" } });
  const tuLinhDan = await prisma.itemTemplate.findUniqueOrThrow({ where: { key: "tu-linh-dan" } });
  await prisma.recipe.upsert({
    where: { key: "recipe-tu-linh-dan" },
    update: {},
    create: { key: "recipe-tu-linh-dan", name: "Luyện Tụ Linh Đan", professionId: alchemy.id, outputTemplateId: tuLinhDan.id, ingredients: [{ key: "linh-thao", qty: 2 }], craftMinutes: 10, fee: 80n, requiredLevel: 1 }
  });

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
    await prisma.monster.upsert({ where: { key }, update: {}, create: { key, name, realmOrder: 0, hp, attack: atk, defense: def, speed: spd, lootTable: [{ key: "yeu-dan", weight: 30 }, { key: "linh-thao", weight: 50 }], locationKey: "hac-son" } });
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

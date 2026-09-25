export function formatSecurity(value: string) {
  return ({ HIGH: "Cao", MEDIUM: "Trung bình", LOW: "Thấp", NONE: "Không có" } as Record<string, string>)[value] ?? value;
}

export function formatLocationKind(value: string) {
  return ({
    district: "Khu dân cư",
    market: "Chợ",
    gate: "Cổng thành",
    road: "Quan đạo",
    wilds: "Ngoại vực",
    forest: "Rừng",
    mountain: "Núi",
    river: "Linh khê",
    valley: "Sơn cốc",
    sect_land: "Sơn môn",
    harbor: "Bến cảng",
    resource: "Tài nguyên",
    outpost: "Trạm dịch",
    ruin: "Di tích",
    city_hub: "Thành thị"
  } as Record<string, string>)[value] ?? value;
}

export function formatService(value: string) {
  return ({
    market: "Giao dịch",
    auction: "Đấu giá",
    npc_shop: "Cửa hàng NPC",
    inn: "Khách điếm",
    mail: "Thư tín",
    travel: "Di chuyển",
    caravan: "Tiêu cục",
    explore: "Khám phá",
    pve: "Săn yêu",
    resource: "Thu thập",
    encounter: "Điều tra",
    formation: "Trận pháp",
    secret: "Bí cảnh",
    forging: "Luyện khí",
    event: "Biến cố",
    contract: "Khế ước"
  } as Record<string, string>)[value] ?? value;
}

export function formatItemCategory(value: string) {
  return ({ MATERIAL: "Tài nguyên", CONSUMABLE: "Tiêu hao", EQUIPMENT: "Trang bị", TECHNIQUE: "Công pháp", COSMETIC: "Ngoại quan", QUEST: "Nhiệm vụ" } as Record<string, string>)[value] ?? value;
}

export function formatRarity(value: string) {
  return ({ PHAM: "Phàm", HA: "Hạ", TRUNG: "Trung", THUONG: "Thượng", CUC: "Cực", HOANG: "Hoàng", HUYEN: "Huyền", DIA: "Địa", THIEN: "Thiên", TIEN: "Tiên" } as Record<string, string>)[value] ?? value;
}

export function formatEquipmentSlot(value: string) {
  return ({ WEAPON: "Vũ khí", ARMOR: "Áo giáp", HELMET: "Mũ", BOOTS: "Giày", RING: "Nhẫn", TALISMAN: "Phù", ARTIFACT: "Pháp bảo" } as Record<string, string>)[value] ?? value;
}

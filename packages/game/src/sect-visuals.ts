export const sectBackgroundCatalog = [
  { key: "cloud-mountain", name: "Vân Sơn", file: "sect-bg-01.webp" },
  { key: "ancient-palace", name: "Cổ Điện", file: "sect-bg-02.webp" },
  { key: "moon-temple", name: "Nguyệt Điện", file: "sect-bg-03.webp" },
  { key: "sword-peak", name: "Kiếm Phong", file: "sect-bg-04.webp" },
  { key: "golden-gate", name: "Thiên Môn", file: "sect-bg-05.webp" },
  { key: "frost-sect", name: "Hàn Sơn", file: "sect-bg-06.webp" },
  { key: "fire-sect", name: "Xích Phong", file: "sect-bg-07.webp" },
  { key: "forest-sect", name: "Linh Lâm", file: "sect-bg-08.webp" }
] as const;

export const sectIconCatalog = [
  { key: "golden-dragon", name: "Kim Long Ấn", file: "kim-long-an.webp", backgroundKey: "golden-gate" },
  { key: "azure-dragon", name: "Thanh Long Ấn", file: "thanh-long-an.webp", backgroundKey: "cloud-mountain" },
  { key: "white-tiger", name: "Bạch Hổ Ấn", file: "bach-ho-an.webp", backgroundKey: "sword-peak" },
  { key: "vermillion-phoenix", name: "Chu Tước Ấn", file: "chu-tuoc-an.webp", backgroundKey: "fire-sect" },
  { key: "black-tortoise", name: "Huyền Vũ Ấn", file: "huyen-vu-an.webp", backgroundKey: "moon-temple" },
  { key: "immortal-sword", name: "Tiên Kiếm Ấn", file: "tien-kiem-an.webp", backgroundKey: "sword-peak" },
  { key: "lotus", name: "Liên Hoa Ấn", file: "lien-hoa-an.webp", backgroundKey: "forest-sect" },
  { key: "moon", name: "Nguyệt Luân Ấn", file: "nguyet-luan-an.webp", backgroundKey: "moon-temple" },
  { key: "sun", name: "Thái Dương Ấn", file: "thai-duong-an.webp", backgroundKey: "golden-gate" },
  { key: "mountain-peak", name: "Sơn Nhạc Ấn", file: "son-nhac-an.webp", backgroundKey: "cloud-mountain" },
  { key: "ancient-pagoda", name: "Bảo Tháp Ấn", file: "bao-thap-an.webp", backgroundKey: "ancient-palace" },
  { key: "spirit-crane", name: "Linh Hạc Ấn", file: "linh-hac-an.webp", backgroundKey: "cloud-mountain" },
  { key: "qilin", name: "Kỳ Lân Ấn", file: "ky-lan-an.webp", backgroundKey: "golden-gate" },
  { key: "celestial-cloud", name: "Thiên Vân Ấn", file: "thien-van-an.webp", backgroundKey: "cloud-mountain" },
  { key: "thunder-seal", name: "Lôi Ấn", file: "loi-an.webp", backgroundKey: "sword-peak" },
  { key: "flame-seal", name: "Hỏa Ấn", file: "hoa-an.webp", backgroundKey: "fire-sect" },
  { key: "ice-crystal", name: "Băng Tinh Ấn", file: "bang-tinh-an.webp", backgroundKey: "frost-sect" },
  { key: "yin-yang", name: "Âm Dương Ấn", file: "am-duong-an.webp", backgroundKey: "moon-temple" },
  { key: "sacred-tree", name: "Thần Mộc Ấn", file: "than-moc-an.webp", backgroundKey: "forest-sect" },
  { key: "heavenly-gate", name: "Thiên Khuyết Ấn", file: "thien-khuyet-an.webp", backgroundKey: "ancient-palace" }
] as const;

export type SectIconKey = (typeof sectIconCatalog)[number]["key"];
export type SectBackgroundKey = (typeof sectBackgroundCatalog)[number]["key"];

const iconKeySet = new Set<string>(sectIconCatalog.map((item) => item.key));
const backgroundKeySet = new Set<string>(sectBackgroundCatalog.map((item) => item.key));

export function isSectIconKey(value: unknown): value is SectIconKey {
  return typeof value === "string" && iconKeySet.has(value);
}

export function isSectBackgroundKey(value: unknown): value is SectBackgroundKey {
  return typeof value === "string" && backgroundKeySet.has(value);
}

export function normalizeSectIconKey(value: unknown): SectIconKey {
  if (isSectIconKey(value)) return value;
  return "golden-dragon";
}

export function normalizeSectBackgroundKey(value: unknown): SectBackgroundKey {
  if (isSectBackgroundKey(value)) return value;
  return "cloud-mountain";
}

export function sectIconAssetPath(value: unknown) {
  const key = normalizeSectIconKey(value);
  const icon = sectIconCatalog.find((item) => item.key === key) ?? sectIconCatalog[0]!;
  return `/sects/icons/${icon.file}`;
}

export function sectBackgroundAssetPath(value: unknown) {
  const key = normalizeSectBackgroundKey(value);
  const background = sectBackgroundCatalog.find((item) => item.key === key) ?? sectBackgroundCatalog[0]!;
  return `/sects/backgrounds/${background.file}`;
}

export function backgroundForSectIcon(value: unknown): SectBackgroundKey {
  const key = normalizeSectIconKey(value);
  const icon = sectIconCatalog.find((item) => item.key === key) ?? sectIconCatalog[0]!;
  return icon.backgroundKey;
}

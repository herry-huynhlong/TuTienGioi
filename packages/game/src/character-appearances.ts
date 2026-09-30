export type CharacterAppearance = {
  key: string;
  label: string;
  genderPresentation: "MALE" | "FEMALE";
  image: string;
  focalPoint: { x: number; y: number };
  description: string;
};

export const characterAppearances = [
  { key: "male-01", label: "Thanh Y Kiếm Tu", genderPresentation: "MALE", image: "/characters/default/male-01.webp", focalPoint: { x: 50, y: 18 }, description: "Thanh y, tóc đen dài, khí chất ôn hòa của kiếm tu sơ nhập." },
  { key: "male-02", label: "Huyền Bào Chiến Tu", genderPresentation: "MALE", image: "/characters/default/male-02.webp", focalPoint: { x: 50, y: 18 }, description: "Hắc bào lạnh, dáng cao, phù hợp chiến tu trầm mặc." },
  { key: "male-03", label: "Bạch Y Kiếm Tu", genderPresentation: "MALE", image: "/characters/default/male-03.webp", focalPoint: { x: 50, y: 18 }, description: "Bạch y thanh nhã, phong thái công tử thiên về kiếm đạo." },
  { key: "male-04", label: "Xích Y Hỏa Tu", genderPresentation: "MALE", image: "/characters/default/male-04.webp", focalPoint: { x: 50, y: 18 }, description: "Đỏ sẫm mạnh mẽ, chi tiết hộ cổ tay và hỏa khí rõ nét." },
  { key: "male-05", label: "Thanh Huyền Đạo Nhân", genderPresentation: "MALE", image: "/characters/default/male-05.webp", focalPoint: { x: 50, y: 18 }, description: "Đạo bào xanh xám, trầm ổn, giống tán tu trẻ đi đường dài." },
  { key: "female-01", label: "Thanh Y Linh Tu", genderPresentation: "FEMALE", image: "/characters/default/female-01.webp", focalPoint: { x: 50, y: 18 }, description: "Thanh y, tóc dài, khí chất ôn hòa và thanh nhã." },
  { key: "female-02", label: "Bạch Y Băng Tu", genderPresentation: "FEMALE", image: "/characters/default/female-02.webp", focalPoint: { x: 50, y: 18 }, description: "Bạch y lạnh, hơi hướng Băng hệ, trang phục tinh tế." },
  { key: "female-03", label: "Xích Y Hỏa Tu", genderPresentation: "FEMALE", image: "/characters/default/female-03.webp", focalPoint: { x: 50, y: 18 }, description: "Đỏ mạnh, Hỏa hệ rõ, uy nghiêm nhưng không phô trương." },
  { key: "female-04", label: "Tử Y Pháp Tu", genderPresentation: "FEMALE", image: "/characters/default/female-04.webp", focalPoint: { x: 50, y: 18 }, description: "Tím huyền bí, phù hợp phù tu, trận tu hoặc pháp tu." },
  { key: "female-05", label: "Mộc Y Dược Sư", genderPresentation: "FEMALE", image: "/characters/default/female-05.webp", focalPoint: { x: 50, y: 18 }, description: "Xanh lá nhạt, tự nhiên, thiên về dược sư và linh thực." }
] satisfies CharacterAppearance[];

export const defaultCharacterAppearanceKey = "male-01";

export function isValidCharacterAppearanceKey(key: string) {
  return characterAppearances.some((appearance) => appearance.key === key);
}

export function getCharacterAppearance(key?: string | null) {
  return characterAppearances.find((appearance) => appearance.key === key) ?? null;
}

export function deterministicCharacterAppearanceKey(seed?: string | null) {
  if (!seed) return defaultCharacterAppearanceKey;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return characterAppearances[Math.abs(hash) % characterAppearances.length]?.key ?? defaultCharacterAppearanceKey;
}

export function resolveCharacterVisual(input: { id?: string | null; appearanceKey?: string | null; avatar?: string | null; name?: string | null }) {
  const key = input.appearanceKey ?? deterministicCharacterAppearanceKey(input.id ?? input.name ?? null);
  const appearance = getCharacterAppearance(key);
  if (appearance) return { appearance, image: appearance.image, avatar: appearance.image, legacyAvatar: input.avatar ?? null, initials: initials(input.name) };
  return { appearance: null, image: null, avatar: input.avatar ?? null, legacyAvatar: input.avatar ?? null, initials: initials(input.name) };
}

function initials(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
}

export function characterAppearanceImage(key: string) {
  const appearance = getCharacterAppearance(key);
  if (!appearance) throw new Error("INVALID_APPEARANCE");
  return appearance.image;
}

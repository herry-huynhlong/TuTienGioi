import type { ProfessionRank } from "@ttg/db";

export const professionRanks = ["APPRENTICE", "ADEPT", "EXPERT", "MASTER", "GRANDMASTER"] as const;
export type ProfessionRankKey = typeof professionRanks[number];

export const professionRankLabels: Record<ProfessionRankKey, string> = {
  APPRENTICE: "Học Đồ",
  ADEPT: "Tiểu Thành",
  EXPERT: "Tinh Thông",
  MASTER: "Tông Sư",
  GRANDMASTER: "Đại Sư"
};

export const professionRankExpThresholds: Record<ProfessionRankKey, number | null> = {
  APPRENTICE: 1000,
  ADEPT: 3000,
  EXPERT: 8000,
  MASTER: 20000,
  GRANDMASTER: null
};

export const professionStationLabels: Record<string, string> = {
  ALCHEMY_FURNACE: "Lò Luyện Đan",
  FORGE: "Lò Luyện Khí",
  TALISMAN_TABLE: "Bàn Chế Phù",
  FORMATION_ALTAR: "Đàn Trận Pháp"
};

export const professionStationServices: Record<string, string[]> = {
  ALCHEMY_FURNACE: ["alchemy", "resource"],
  FORGE: ["forging"],
  TALISMAN_TABLE: ["talisman", "market"],
  FORMATION_ALTAR: ["formation"]
};

export function professionRankOrder(rank: ProfessionRank | ProfessionRankKey | string) {
  return Math.max(0, professionRanks.indexOf(rank as ProfessionRankKey));
}

export function professionRankAt(order: number): ProfessionRankKey {
  return professionRanks[Math.max(0, Math.min(professionRanks.length - 1, order))]!;
}

export function nextProfessionRank(rank: ProfessionRank | ProfessionRankKey | string) {
  const next = professionRankOrder(rank) + 1;
  return next < professionRanks.length ? professionRanks[next] : null;
}

export function isProfessionRank(value: unknown): value is ProfessionRankKey {
  return typeof value === "string" && professionRanks.includes(value as ProfessionRankKey);
}

export function professionExpGain(baseExp: number, currentRank: ProfessionRank | string, recipeRank: ProfessionRank | string) {
  const gap = professionRankOrder(currentRank) - professionRankOrder(recipeRank);
  if (gap <= 0) return baseExp;
  if (gap === 1) return Math.max(1, Math.floor(baseExp * 0.4));
  if (gap === 2) return Math.max(1, Math.floor(baseExp * 0.1));
  return 0;
}

export function promoteProfessionRank(rank: ProfessionRank | string, totalExperience: number) {
  let current = isProfessionRank(rank) ? rank : "APPRENTICE";
  while (true) {
    const threshold = professionRankExpThresholds[current];
    const next = nextProfessionRank(current);
    if (!threshold || !next || totalExperience < threshold) return current;
    current = next;
  }
}

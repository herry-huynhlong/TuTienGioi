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

export const professionFacilitySuccessBonusBps = {
  LOW: 500,
  MID: 1200,
  HIGH: 2000
} as const;

export type ProfessionFacilityGrade = keyof typeof professionFacilitySuccessBonusBps;

export const professionRankSuccessBonusBps: Record<ProfessionRankKey, number> = {
  APPRENTICE: 0,
  ADEPT: 1500,
  EXPERT: 3000,
  MASTER: 5000,
  GRANDMASTER: 7000
};

export const recipeDifficultyPenaltyBps: Record<ProfessionRankKey, number> = {
  APPRENTICE: 0,
  ADEPT: 1400,
  EXPERT: 3000,
  MASTER: 4800,
  GRANDMASTER: 6500
};

const masteryThresholds = [0, 20, 50, 100, 180, 300] as const;
const masteryBonusBps = [0, 700, 1400, 2200, 3000, 3500] as const;

export function masteryLevelForExp(exp: number) {
  let level = 0;
  for (let i = 0; i < masteryThresholds.length; i += 1) {
    if (exp >= masteryThresholds[i]!) level = i;
  }
  return level;
}

export function masteryBonusForLevel(level: number) {
  return masteryBonusBps[Math.max(0, Math.min(masteryBonusBps.length - 1, level))]!;
}

export function nextMasteryThreshold(level: number) {
  return masteryThresholds[Math.min(masteryThresholds.length - 1, Math.max(0, level + 1))] ?? masteryThresholds[masteryThresholds.length - 1]!;
}

export function resolveProfessionFacilityGrade(location: { kind?: string | null; services?: string[] | null } | null | undefined, station: string): ProfessionFacilityGrade {
  const services = location?.services ?? [];
  const kind = location?.kind ?? "";
  if (services.includes("grandmaster_facility") || services.includes("high_grade_profession")) return "HIGH";
  if (
    kind === "alchemy_hall" ||
    kind === "forging_hall" ||
    kind === "formation_hall" ||
    services.includes("profession") ||
    services.includes("recipe") ||
    services.includes("commission")
  ) return "MID";
  if ((professionStationServices[station] ?? []).some((service) => services.includes(service))) return "LOW";
  return "LOW";
}

export function calculateCraftSuccessChance(input: {
  professionRank: ProfessionRank | ProfessionRankKey | string;
  recipeRank: ProfessionRank | ProfessionRankKey | string;
  masteryExp?: number;
  masteryLevel?: number | undefined;
  facilityGrade: ProfessionFacilityGrade;
}) {
  const professionRank = isProfessionRank(input.professionRank) ? input.professionRank : "APPRENTICE";
  const recipeRank = isProfessionRank(input.recipeRank) ? input.recipeRank : "APPRENTICE";
  const professionOrder = professionRankOrder(professionRank);
  const recipeOrder = professionRankOrder(recipeRank);
  const rankGap = professionOrder - recipeOrder;
  const level = input.masteryLevel ?? masteryLevelForExp(input.masteryExp ?? 0);
  const baseBps = 1000;
  const rankBonusBps = professionRankSuccessBonusBps[professionRank];
  const overRankBonusBps = Math.max(0, rankGap) * 1700;
  const masteryBps = masteryBonusForLevel(level);
  const facilityBps = professionFacilitySuccessBonusBps[input.facilityGrade];
  const difficultyBps = recipeDifficultyPenaltyBps[recipeRank];
  let finalBps = baseBps + rankBonusBps + overRankBonusBps + masteryBps + facilityBps - difficultyBps;
  if (rankGap >= 3) finalBps = 10000;
  if (finalBps >= 9500 && rankGap >= 2) finalBps = 10000;
  finalBps = Math.max(500, Math.min(10000, finalBps));
  return {
    finalBps,
    percent: Math.round(finalBps / 100),
    breakdown: { baseBps, rankBonusBps, overRankBonusBps, masteryBps, facilityBps, difficultyBps },
    masteryLevel: level,
    facilityGrade: input.facilityGrade
  };
}

export function craftFailureExp(baseExp: number) {
  return Math.max(1, Math.floor(baseExp * 0.4));
}

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

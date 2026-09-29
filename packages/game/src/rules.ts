import type { Character, RealmStage, SpiritualRoot } from "@ttg/db";

export type DerivedStats = {
  hp: number;
  qi: number;
  attack: number;
  defense: number;
  speed: number;
  cultivationBps: number;
};

export function currentEnergy(character: Pick<Character, "energyStored" | "energyMax" | "energyUpdatedAt">, now = new Date(), regenMinutes = 10): number {
  const elapsed = Math.max(0, now.getTime() - character.energyUpdatedAt.getTime());
  const gained = Math.floor(elapsed / (regenMinutes * 60_000));
  return Math.min(character.energyMax, character.energyStored + gained);
}

export function calculateCultivationReward(baseReward: bigint, multiplierBps: number): bigint {
  return (baseReward * BigInt(multiplierBps)) / 10000n;
}

export const REAL_TIME_TO_GAME_TIME_MULTIPLIER = 24;
export const GAME_TIME_EPOCH = new Date("2026-01-01T00:00:00.000Z");
export const GAME_CALENDAR_START_YEAR = 312;
export const GAME_DAYS_PER_MONTH = 30;
export const GAME_MONTHS_PER_YEAR = 12;
export const REAL_MS_PER_GAME_DAY = Math.floor(86_400_000 / REAL_TIME_TO_GAME_TIME_MULTIPLIER);

export const cultivationActivityOptions = ["day", "week", "month", "year"] as const;
export type CultivationDurationKey = typeof cultivationActivityOptions[number];

export const cultivationDurationConfigs: Record<CultivationDurationKey, { label: string; gameDays: number; baseReward: bigint; energyCost: number }> = {
  day: { label: "1 Ngày", gameDays: 1, baseReward: 120n, energyCost: 3 },
  week: { label: "1 Tuần", gameDays: 7, baseReward: 840n, energyCost: 8 },
  month: { label: "1 Tháng", gameDays: 30, baseReward: 3600n, energyCost: 16 },
  year: { label: "1 Năm", gameDays: 360, baseReward: 43200n, energyCost: 30 }
};

export function explorationEnergyCost(minutes: number): number {
  if (minutes === 10) return 2;
  if (minutes === 30) return 5;
  if (minutes === 60) return 8;
  if (minutes <= 45) return 2;
  if (minutes <= 60) return 3;
  return Math.max(1, Math.ceil(minutes / 10));
}

export function isCultivationDurationKey(value: unknown): value is CultivationDurationKey {
  return typeof value === "string" && cultivationActivityOptions.includes(value as CultivationDurationKey);
}

export function cultivationEnergyCost(duration: CultivationDurationKey | number): number {
  if (typeof duration === "number") return Math.max(1, Math.ceil(duration / 5));
  return cultivationDurationConfigs[duration].energyCost;
}

export function cultivationBaseReward(duration: CultivationDurationKey | number): bigint {
  if (typeof duration === "number") return BigInt(duration * 10);
  return cultivationDurationConfigs[duration].baseReward;
}

export function gameDurationToRealMs(duration: CultivationDurationKey): number {
  return cultivationDurationConfigs[duration].gameDays * REAL_MS_PER_GAME_DAY;
}

export function realMsToGameMs(realMs: number) {
  return realMs * REAL_TIME_TO_GAME_TIME_MULTIPLIER;
}

export function getGameTime(now = new Date()) {
  const elapsedGameMs = Math.max(0, now.getTime() - GAME_TIME_EPOCH.getTime()) * REAL_TIME_TO_GAME_TIME_MULTIPLIER;
  const totalGameMinutes = Math.floor(elapsedGameMs / 60_000);
  const totalGameHours = Math.floor(totalGameMinutes / 60);
  const totalGameDays = Math.floor(totalGameHours / 24);
  const minute = totalGameMinutes % 60;
  const hour = totalGameHours % 24;
  const dayIndex = totalGameDays % GAME_DAYS_PER_MONTH;
  const monthIndex = Math.floor(totalGameDays / GAME_DAYS_PER_MONTH) % GAME_MONTHS_PER_YEAR;
  const year = GAME_CALENDAR_START_YEAR + Math.floor(totalGameDays / (GAME_DAYS_PER_MONTH * GAME_MONTHS_PER_YEAR));
  return {
    year,
    month: monthIndex + 1,
    day: dayIndex + 1,
    hour,
    minute,
    hourName: earthlyHourName(hour),
    phase: timePhase(hour),
    totalGameDays,
    label: `Tiên Lịch ${year} · Ngày ${dayIndex + 1} tháng ${monthIndex + 1} · ${earthlyHourName(hour)}`
  };
}

export function addGameDays(now: Date, gameDays: number) {
  return new Date(now.getTime() + gameDays * REAL_MS_PER_GAME_DAY);
}

function earthlyHourName(hour: number) {
  const names = ["Giờ Tý", "Giờ Sửu", "Giờ Sửu", "Giờ Dần", "Giờ Dần", "Giờ Mão", "Giờ Mão", "Giờ Thìn", "Giờ Thìn", "Giờ Tỵ", "Giờ Tỵ", "Giờ Ngọ", "Giờ Ngọ", "Giờ Mùi", "Giờ Mùi", "Giờ Thân", "Giờ Thân", "Giờ Dậu", "Giờ Dậu", "Giờ Tuất", "Giờ Tuất", "Giờ Hợi", "Giờ Hợi", "Giờ Tý"];
  return names[Math.max(0, Math.min(23, hour))]!;
}

function timePhase(hour: number) {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 16) return "noon";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}

export function travelDurationSeconds(travelMinutes: number): number {
  if (travelMinutes <= 5) return 15;
  if (travelMinutes <= 15) return 30;
  if (travelMinutes <= 35) return 60;
  return 90;
}

export const locationActivityConfigs = {
  explore: { durationSeconds: 45, energyCost: 2 },
  gather: { durationSeconds: 45, energyCost: 2 },
  hunt: { durationSeconds: 60, energyCost: 3 }
} as const;

export type LocationActivityMode = keyof typeof locationActivityConfigs;

export function calculateCharacterStats(
  character: Pick<Character, "body" | "attack" | "defense" | "speed">,
  stage: Pick<RealmStage, "baseHp" | "baseQi" | "baseAttack" | "baseDefense" | "baseSpeed">,
  root: Pick<SpiritualRoot, "multiplierBps">,
  equipmentModifiers: Array<Record<string, number>> = []
): DerivedStats {
  const bonus = equipmentModifiers.reduce<Record<string, number>>((acc, item) => {
    for (const [key, value] of Object.entries(item)) acc[key] = (acc[key] ?? 0) + value;
    return acc;
  }, {});
  return {
    hp: stage.baseHp + character.body * 8 + (bonus.hp ?? 0),
    qi: stage.baseQi + (bonus.qi ?? 0),
    attack: stage.baseAttack + character.attack + (bonus.attack ?? 0),
    defense: stage.baseDefense + character.defense + (bonus.defense ?? 0),
    speed: stage.baseSpeed + character.speed + (bonus.speed ?? 0),
    cultivationBps: root.multiplierBps + (bonus.cultivationBps ?? 0)
  };
}

export type Fighter = {
  name: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
};

export type WeightedEncounter = {
  key: string;
  weight: number;
};

export function parseEncounterTable(value: unknown): WeightedEncounter[] {
  if (!Array.isArray(value)) return [{ key: "safe-passage", weight: 1 }];
  const rows = value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const key = "key" in row ? row.key : undefined;
    const weight = "weight" in row ? row.weight : undefined;
    if (typeof key !== "string" || typeof weight !== "number" || weight <= 0) return [];
    return [{ key, weight }];
  });
  return rows.length > 0 ? rows : [{ key: "safe-passage", weight: 1 }];
}

export function simulateCombat(player: Fighter, enemy: Fighter, rng: () => number, maxTurns = 30) {
  const a = { ...player };
  const b = { ...enemy };
  const log: string[] = [];
  for (let turn = 1; turn <= maxTurns && a.hp > 0 && b.hp > 0; turn++) {
    const first = a.speed >= b.speed ? a : b;
    const second = first === a ? b : a;
    for (const [attacker, defender] of [[first, second], [second, first]] as const) {
      if (attacker.hp <= 0 || defender.hp <= 0) continue;
      const crit = rng() < 0.1;
      const raw = Math.max(1, attacker.attack - Math.floor(defender.defense * 0.45));
      const damage = Math.max(1, Math.floor(raw * (crit ? 1.7 : 1) * (0.85 + rng() * 0.3)));
      defender.hp = Math.max(0, defender.hp - damage);
      log.push(`Hiệp ${turn}: ${attacker.name} gây ${damage} sát thương${crit ? " chí mạng" : ""}.`);
    }
  }
  const winner = a.hp === b.hp ? "draw" : a.hp > b.hp ? "player" : "enemy";
  return { winner, log, remainingHp: Math.max(0, a.hp) };
}

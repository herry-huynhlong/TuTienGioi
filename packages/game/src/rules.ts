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

export const REAL_MINUTES_PER_GAME_DAY = 15;
export const REAL_TIME_TO_GAME_TIME_MULTIPLIER = Math.floor(1440 / REAL_MINUTES_PER_GAME_DAY);
export const GAME_TIME_EPOCH = new Date("2026-01-01T00:00:00.000Z");
export const GAME_CALENDAR_NAME = "Vạn Giới Lịch";
export const GAME_ERA_NAME = "Thiên Hoang";
export const GAME_CALENDAR_START_YEAR = 13;
export const GAME_DAYS_PER_MONTH = 30;
export const GAME_MONTHS_PER_YEAR = 12;
export const REAL_MS_PER_GAME_DAY = REAL_MINUTES_PER_GAME_DAY * 60_000;
export const MAX_OFFLINE_CULTIVATION_MINUTES = 480;
export const HP_REGEN_BPS_PER_GAME_DAY = 1500;
export const QI_REGEN_BPS_PER_GAME_DAY = 2000;
export const ENERGY_REGEN_BPS_PER_GAME_DAY = 2500;

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
    calendarName: GAME_CALENDAR_NAME,
    eraName: GAME_ERA_NAME,
    label: `${GAME_CALENDAR_NAME} · ${GAME_ERA_NAME} năm thứ ${year} · Ngày ${dayIndex + 1} tháng ${monthIndex + 1} · ${earthlyHourName(hour)}`
  };
}

export function gameDaysFromRealMs(realMs: number) {
  return Math.max(0, realMs) / REAL_MS_PER_GAME_DAY;
}

export function passiveRegenAmount(max: number, bpsPerGameDay: number, realMs: number, remainder = 0) {
  const scaled = Math.max(0, Math.floor((max * bpsPerGameDay * Math.max(0, realMs)) / REAL_MS_PER_GAME_DAY)) + Math.max(0, remainder);
  return { amount: Math.floor(scaled / 10000), remainder: scaled % 10000 };
}

export function continuousCultivationReward(baseRewardPerGameDay: bigint, multiplierBps: number, realMs: number) {
  if (realMs <= 0) return 0n;
  const base = (baseRewardPerGameDay * BigInt(Math.floor(realMs))) / BigInt(REAL_MS_PER_GAME_DAY);
  return calculateCultivationReward(base, multiplierBps);
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

export const trainingTypes = ["BODY", "ATTACK", "DEFENSE", "SPEED", "SPIRIT"] as const;
export type TrainingTypeKey = typeof trainingTypes[number];

export const trainingDurationOptions = ["short", "medium", "long", "day"] as const;
export type TrainingDurationKey = typeof trainingDurationOptions[number];

export const trainingDurationConfigs: Record<TrainingDurationKey, { label: string; gameMinutes: number; durationSeconds: number; energyCost: number; baseGain: number }> = {
  short: { label: "30 phút", gameMinutes: 30, durationSeconds: Math.ceil((30 * 60) / REAL_TIME_TO_GAME_TIME_MULTIPLIER), energyCost: 2, baseGain: 1 },
  medium: { label: "2 giờ", gameMinutes: 120, durationSeconds: Math.ceil((120 * 60) / REAL_TIME_TO_GAME_TIME_MULTIPLIER), energyCost: 5, baseGain: 3 },
  long: { label: "8 giờ", gameMinutes: 480, durationSeconds: Math.ceil((480 * 60) / REAL_TIME_TO_GAME_TIME_MULTIPLIER), energyCost: 12, baseGain: 8 },
  day: { label: "1 ngày", gameMinutes: 1440, durationSeconds: Math.ceil((1440 * 60) / REAL_TIME_TO_GAME_TIME_MULTIPLIER), energyCost: 24, baseGain: 20 }
};

export const trainingTypeConfigs: Record<TrainingTypeKey, { label: string; statKey: "body" | "attack" | "defense" | "speed" | "spirit"; description: string; modifierBps: number }> = {
  BODY: { label: "Thể Phách", statKey: "body", description: "Rèn luyện thân thể, tăng sức chịu đựng và nền tảng thể chất.", modifierBps: 10500 },
  ATTACK: { label: "Công Kích", statKey: "attack", description: "Luyện chiêu thức và lực bộc phát trong giao chiến.", modifierBps: 10000 },
  DEFENSE: { label: "Phòng Ngự", statKey: "defense", description: "Củng cố thủ thế, khí giáp và khả năng chịu đòn.", modifierBps: 10000 },
  SPEED: { label: "Thân Pháp", statKey: "speed", description: "Rèn bộ pháp, phản xạ và tốc độ ra tay.", modifierBps: 10000 },
  SPIRIT: { label: "Thần Thức", statKey: "spirit", description: "Tĩnh tâm luyện niệm, tăng cảm nhận và khống chế.", modifierBps: 9500 }
};

export function isTrainingType(value: unknown): value is TrainingTypeKey {
  return typeof value === "string" && trainingTypes.includes(value as TrainingTypeKey);
}

export function isTrainingDurationKey(value: unknown): value is TrainingDurationKey {
  return typeof value === "string" && trainingDurationOptions.includes(value as TrainingDurationKey);
}

export function trainingStatCap(realmOrder: number, stageOrder: number) {
  return 60 + realmOrder * 80 + stageOrder * 20;
}

export function calculateTrainingGain(input: { stat: number; statCap: number; baseGain: number; modifierBps: number }) {
  if (input.stat >= input.statCap) return 0;
  const modified = Math.max(0, Math.floor((input.baseGain * input.modifierBps) / 10000));
  if (modified <= 0) return 0;
  const remaining = Math.max(0, input.statCap - input.stat);
  const pressureBps = Math.max(1500, Math.min(10000, Math.floor((remaining * 10000) / Math.max(1, input.statCap))));
  const diminished = Math.max(1, Math.floor((modified * pressureBps) / 10000));
  return Math.min(remaining, diminished);
}

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

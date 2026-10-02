import {
  Currency,
  Prisma,
  SectAlignment,
  SectApplicationStatus,
  SectCaveQuality,
  SectFacilityType,
  SectInventoryLogType,
  SectLogType,
  SectMissionStatus,
  SectRoleName,
  SectWorkStatus,
  WalletTxType,
  type PrismaClient
} from "@ttg/db";
import { creditWallet, debitWallet } from "./services.js";
import { cultivationBaseReward, cultivationEnergyCost, currentEnergy } from "./rules.js";
import { getItemEconomy } from "./items.js";
import { changeSectContribution } from "./sect-contribution.js";
import { backgroundForSectIcon, isSectIconKey, normalizeSectIconKey } from "./sect-visuals.js";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export class SectError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type SectPermission =
  | "VIEW_ADMIN"
  | "APPROVE_APPLICATION"
  | "MANAGE_MEMBERS"
  | "MANAGE_NOTICE"
  | "UPGRADE_SECT"
  | "MANAGE_BUILDINGS"
  | "MANAGE_TREASURY"
  | "MANAGE_STORAGE"
  | "CREATE_MISSION"
  | "MANAGE_CAVES"
  | "MANAGE_LIBRARY";

export type SectRankConfig = {
  rank: number;
  label: string;
  shortLabel: string;
  maxMembers: number;
  reputationRequired: number;
  capacities: Record<"farm" | "cave" | "mine" | "storage", number>;
  caveQualities: SectCaveQuality[];
  techniqueRarities: string[];
  unlocks: string[];
  rankUpCost?: {
    treasury: bigint;
    resources: Array<{ key: string; quantity: number }>;
    memberCount: number;
  };
};

export const sectRanks: SectRankConfig[] = [
  { rank: 5, label: "Ngũ Phẩm Tông Môn", shortLabel: "Ngũ Phẩm", maxMembers: 5, reputationRequired: 10_000, capacities: { farm: 1, cave: 5, mine: 0, storage: 20 }, caveQualities: [SectCaveQuality.COMMON], techniqueRarities: ["HOANG"], unlocks: ["Tông Môn Đại Điện", "Kho Tông Môn", "Nhiệm vụ cơ bản", "Động Phủ phổ thông", "Linh Điền nhỏ"], rankUpCost: { treasury: 20_000n, resources: [{ key: "huyen-thiet", quantity: 100 }], memberCount: 3 } },
  { rank: 4, label: "Tứ Phẩm Tông Môn", shortLabel: "Tứ Phẩm", maxMembers: 15, reputationRequired: 20_000, capacities: { farm: 3, cave: 15, mine: 1, storage: 45 }, caveQualities: [SectCaveQuality.COMMON, SectCaveQuality.SPIRIT], techniqueRarities: ["HOANG", "HUYEN"], unlocks: ["Nội Môn", "Tàng Kinh Các", "Linh Khoáng", "Mở rộng Linh Điền", "Mở rộng Động Phủ"], rankUpCost: { treasury: 80_000n, resources: [{ key: "huyen-thiet", quantity: 300 }, { key: "thanh-linh-thao", quantity: 200 }], memberCount: 8 } },
  { rank: 3, label: "Tam Phẩm Tông Môn", shortLabel: "Tam Phẩm", maxMembers: 30, reputationRequired: 50_000, capacities: { farm: 6, cave: 30, mine: 2, storage: 90 }, caveQualities: [SectCaveQuality.COMMON, SectCaveQuality.SPIRIT, SectCaveQuality.MYSTIC], techniqueRarities: ["HOANG", "HUYEN", "DIA"], unlocks: ["Khoáng mạch trung cấp", "Nhiệm vụ trung cấp", "Động Phủ Huyền", "Tàng Kinh Các trung tầng"], rankUpCost: { treasury: 250_000n, resources: [{ key: "huyen-thiet", quantity: 900 }, { key: "ngung-lo-thao", quantity: 400 }], memberCount: 18 } },
  { rank: 2, label: "Nhị Phẩm Tông Môn", shortLabel: "Nhị Phẩm", maxMembers: 60, reputationRequired: 120_000, capacities: { farm: 10, cave: 60, mine: 4, storage: 160 }, caveQualities: [SectCaveQuality.SPIRIT, SectCaveQuality.MYSTIC, SectCaveQuality.EARTH], techniqueRarities: ["HUYEN", "DIA", "THIEN"], unlocks: ["Hộ Sơn Đại Trận", "Tài nguyên hiếm", "Động Phủ Địa Mạch", "Khu vực cao cấp"], rankUpCost: { treasury: 800_000n, resources: [{ key: "huyen-thiet", quantity: 2000 }, { key: "hoa-linh-chi", quantity: 800 }], memberCount: 40 } },
  { rank: 1, label: "Nhất Phẩm Tông Môn", shortLabel: "Nhất Phẩm", maxMembers: 100, reputationRequired: 0, capacities: { farm: 18, cave: 100, mine: 8, storage: 300 }, caveQualities: [SectCaveQuality.MYSTIC, SectCaveQuality.EARTH, SectCaveQuality.HEAVEN], techniqueRarities: ["DIA", "THIEN", "TIEN"], unlocks: ["Bí Cảnh Tông Môn", "Lãnh địa", "Khoáng mạch cao cấp", "Hoạt động endgame"] }
];

export const sectRoles: Record<SectRoleName, { label: string; order: number; permissions: SectPermission[] }> = {
  LEADER: { label: "Tông Chủ", order: 1, permissions: ["VIEW_ADMIN", "APPROVE_APPLICATION", "MANAGE_MEMBERS", "MANAGE_NOTICE", "UPGRADE_SECT", "MANAGE_BUILDINGS", "MANAGE_TREASURY", "MANAGE_STORAGE", "CREATE_MISSION", "MANAGE_CAVES", "MANAGE_LIBRARY"] },
  VICE_LEADER: { label: "Phó Tông Chủ", order: 2, permissions: ["VIEW_ADMIN", "APPROVE_APPLICATION", "MANAGE_MEMBERS", "MANAGE_NOTICE", "UPGRADE_SECT", "MANAGE_BUILDINGS", "MANAGE_TREASURY", "MANAGE_STORAGE", "CREATE_MISSION", "MANAGE_CAVES", "MANAGE_LIBRARY"] },
  ELDER: { label: "Trưởng Lão", order: 3, permissions: ["VIEW_ADMIN", "APPROVE_APPLICATION", "MANAGE_NOTICE", "MANAGE_BUILDINGS", "MANAGE_STORAGE", "CREATE_MISSION", "MANAGE_CAVES", "MANAGE_LIBRARY"] },
  OFFICER: { label: "Chấp Sự", order: 4, permissions: ["VIEW_ADMIN", "APPROVE_APPLICATION", "CREATE_MISSION"] },
  TRUE_DISCIPLE: { label: "Chân Truyền Đệ Tử", order: 5, permissions: [] },
  INNER: { label: "Nội Môn Đệ Tử", order: 6, permissions: [] },
  OUTER: { label: "Ngoại Môn Đệ Tử", order: 7, permissions: [] }
};

export const sectAlignments: Record<SectAlignment, string> = {
  RIGHTEOUS: "Chính đạo",
  NEUTRAL: "Trung lập",
  DEMONIC: "Ma đạo"
};

export const sectCreateCost = 5_000n;

export const sectEconomyConfig = {
  currencyContributionDivisor: 100n,
  currencyReputationDivisor: 500n,
  itemContributionPerNpcValue: 1,
  withdrawContributionCostPerNpcValue: 2
};

export function getSectItemContributionPrice(template: { category: string; rarity: string; bindRules?: unknown; baseModifiers?: unknown }) {
  return getItemEconomy(template as never).sectContributionPrice;
}

export function getSectItemDonationValue(template: { category: string; rarity: string; bindRules?: unknown; baseModifiers?: unknown }) {
  return getItemEconomy(template as never).donationContributionValue;
}

export const sectFacilityConfig = {
  defaults: {
    [SectFacilityType.FARM]: 1,
    [SectFacilityType.CAVE]: 1,
    [SectFacilityType.MINE]: 0,
    [SectFacilityType.STORAGE]: 20,
    [SectFacilityType.OTHER]: 0
  },
  expansionCost: {
    [SectFacilityType.FARM]: { treasury: 5_000n, resources: [{ key: "thanh-linh-thao", quantity: 25 }] },
    [SectFacilityType.CAVE]: { treasury: 8_000n, resources: [{ key: "huyen-thiet", quantity: 20 }] },
    [SectFacilityType.MINE]: { treasury: 15_000n, resources: [{ key: "huyen-thiet", quantity: 80 }] },
    [SectFacilityType.STORAGE]: { treasury: 6_000n, resources: [{ key: "linh-moc", quantity: 30 }] },
    [SectFacilityType.OTHER]: { treasury: 10_000n, resources: [] }
  }
} as const;

export const sectFarmConfig = {
  personalShareBps: 7000,
  sectShareBps: 3000,
  crops: {
    "thanh-linh-thao": { name: "Thanh Linh Thảo", durationMinutes: 10, baseYield: 10, contribution: 8, reputation: 1, requiredRank: 5 },
    "ngung-lo-thao": { name: "Ngưng Lộ Thảo", durationMinutes: 30, baseYield: 18, contribution: 18, reputation: 3, requiredRank: 4 },
    "hoa-linh-chi": { name: "Hỏa Linh Chi", durationMinutes: 60, baseYield: 24, contribution: 36, reputation: 5, requiredRank: 3 }
  }
} as const;

export const sectMineConfig = {
  personalShareBps: 4000,
  sectShareBps: 6000,
  mines: {
    "han-thiet-mach": { name: "Hàn Thiết Khoáng Mạch", resourceKey: "huyen-thiet", durationMinutes: 30, baseYield: 20, contribution: 22, reputation: 4, requiredRank: 4, workerLimit: 5, rareDrops: [{ key: "thien-tinh-sa", chanceBps: 300, quantity: 1 }] },
    "hac-thiet-mach": { name: "Hắc Thiết Khoáng Mạch", resourceKey: "hac-thiet-quang", durationMinutes: 10, baseYield: 12, contribution: 10, reputation: 2, requiredRank: 5, workerLimit: 3, rareDrops: [] }
  }
} as const;

export const sectCaveConfig = {
  roleBaseBps: {
    [SectRoleName.OUTER]: { name: "Ngoại Môn Động Phủ", cultivationBonusBps: 500, breakthroughBonusBps: 0 },
    [SectRoleName.INNER]: { name: "Nội Môn Động Phủ", cultivationBonusBps: 1000, breakthroughBonusBps: 100 },
    [SectRoleName.TRUE_DISCIPLE]: { name: "Chân Truyền Động Phủ", cultivationBonusBps: 1500, breakthroughBonusBps: 220 },
    [SectRoleName.OFFICER]: { name: "Chấp Sự Động Phủ", cultivationBonusBps: 1200, breakthroughBonusBps: 150 },
    [SectRoleName.ELDER]: { name: "Trưởng Lão Động Phủ", cultivationBonusBps: 1800, breakthroughBonusBps: 300 },
    [SectRoleName.VICE_LEADER]: { name: "Phó Tông Chủ Động Phủ", cultivationBonusBps: 2200, breakthroughBonusBps: 400 },
    [SectRoleName.LEADER]: { name: "Tông Chủ Động Phủ", cultivationBonusBps: 2500, breakthroughBonusBps: 500 }
  },
  rankMultiplierBps: { 5: 10000, 4: 11000, 3: 12000, 2: 13500, 1: 15000 } as Record<number, number>,
  qualities: {
    [SectCaveQuality.COMMON]: { label: "Phổ Thông", cultivationBonusBps: 500, breakthroughBonusBps: 0, requiredRole: SectRoleName.OUTER },
    [SectCaveQuality.SPIRIT]: { label: "Linh Động", cultivationBonusBps: 1000, breakthroughBonusBps: 100, requiredRole: SectRoleName.INNER },
    [SectCaveQuality.MYSTIC]: { label: "Huyền Động", cultivationBonusBps: 1500, breakthroughBonusBps: 200, requiredRole: SectRoleName.INNER },
    [SectCaveQuality.EARTH]: { label: "Địa Mạch Động Phủ", cultivationBonusBps: 2000, breakthroughBonusBps: 300, requiredRole: SectRoleName.ELDER },
    [SectCaveQuality.HEAVEN]: { label: "Thiên Linh Động Phủ", cultivationBonusBps: 2800, breakthroughBonusBps: 500, requiredRole: SectRoleName.ELDER }
  },
  allowMultiplePerCharacter: false
} as const;

export const sectLibraryConfig = {
  baseContributionCostByRarity: {
    PHAM: 80,
    HA: 160,
    TRUNG: 320,
    THUONG: 600,
    CUC: 900,
    HOANG: 1200,
    HUYEN: 2400,
    DIA: 6000,
    THIEN: 12000,
    TIEN: 30000
  } as Record<string, number>
};

export type SectMissionType = "HUNT" | "COLLECT" | "EXPLORE" | "DELIVER" | "PATROL" | "MINE" | "FARM" | "DONATE";
export type SectMissionEventType = "MONSTER_KILLED" | "ITEM_COLLECTED" | "LOCATION_VISITED" | "RESOURCE_MINED" | "ITEM_DONATED" | "FARM_HARVESTED" | "CRAFT_COMPLETED" | "INTERACT_WORLD_OBJECT";

export const sectMissionConfig = {
  refreshHours: 6,
  difficultyMultipliers: { 1: 1, 2: 1.5, 3: 2.2, 4: 3.2, 5: 5 },
  rankDifficulty: {
    5: [1, 2],
    4: [1, 2, 3],
    3: [2, 3, 4],
    2: [3, 4, 5],
    1: [4, 5]
  } as Record<number, number[]>,
  targetCountByDifficulty: {
    1: [3, 5],
    2: [5, 10],
    3: [10, 20],
    4: [20, 30],
    5: [1, 3]
  } as Record<number, [number, number]>,
  baseReward: { cultivation: 500, linhThach: 120, contribution: 25, reputation: 6 }
} as const;

export const sectMissionDefinitions = [
  {
    key: "patrol-sect",
    title: "Tuần tra sơn môn",
    description: "Canh phòng khu vực ngoại môn, ổn định khí vận tông môn.",
    difficulty: 1,
    durationMinutes: 10,
    reward: { linhThach: 120, contribution: 12, reputation: 5 }
  },
  {
    key: "gather-huyen-thiet",
    title: "Thu thập Huyền Thiết",
    description: "Tìm và giao nộp khoáng liệu dùng cho công trình tông môn.",
    difficulty: 3,
    durationMinutes: 30,
    reward: { linhThach: 300, contribution: 120, reputation: 50, itemKey: "huyen-thiet", itemQuantity: 1 }
  }
] as const;

export function getSectRank(rank: number) {
  return sectRanks.find((entry) => entry.rank === rank) ?? sectRanks[0]!;
}

export function getNextSectRank(rank: number) {
  return sectRanks.find((entry) => entry.rank === rank - 1) ?? null;
}

export function sectRankProgress(rank: number, reputation: number) {
  const current = getSectRank(rank);
  const next = getNextSectRank(rank);
  if (!next) return { current, next: null, required: 0, progress: 100 };
  const required = current.reputationRequired;
  return { current, next, required, progress: required > 0 ? Math.min(100, Math.floor((reputation / required) * 100)) : 100 };
}

export function hasSectPermission(role: SectRoleName | null | undefined, permission: SectPermission) {
  return role ? sectRoles[role].permissions.includes(permission) : false;
}

function normalizeTag(tag: string) {
  return tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function normalizeText(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

async function assertSectPermission(tx: Tx, actorId: string, sectId: string, permission: SectPermission) {
  const member = await tx.sectMember.findUnique({ where: { characterId: actorId } });
  if (!member || member.sectId !== sectId || !hasSectPermission(member.role, permission)) {
    throw new SectError("SECT_FORBIDDEN", "Bạn không có quyền xử lý sự vụ này.");
  }
  return member;
}

async function assertSectMember(tx: Tx, characterId: string) {
  const member = await tx.sectMember.findUnique({ where: { characterId }, include: { sect: true } });
  if (!member) throw new SectError("NOT_IN_SECT", "Bạn chưa thuộc tông môn.");
  return member;
}

function assertPositiveAmount(amount: bigint | number) {
  if (typeof amount === "bigint" ? amount <= 0n : !Number.isInteger(amount) || amount <= 0) {
    throw new SectError("INVALID_AMOUNT", "Số lượng không hợp lệ.");
  }
}

async function mutateContribution(
  tx: Tx,
  sectId: string,
  characterId: string,
  amount: number,
  type: string,
  reason: string,
  referenceType?: string,
  referenceId?: string,
  idempotencyKey?: string
) {
  try {
    return await changeSectContribution(tx, { sectId, characterId, delta: amount, sourceType: type, reason, sourceId: referenceId ?? referenceType ?? null, idempotencyKey: idempotencyKey ?? null });
  } catch (error) {
    if (error instanceof Error) throw new SectError("CONTRIBUTION_CHANGE_FAILED", error.message);
    throw error;
  }
}

function missionDefinition(key: string) {
  const mission = sectMissionDefinitions.find((entry) => entry.key === key);
  if (!mission) throw new SectError("MISSION_NOT_FOUND", "Nhiệm vụ tông môn không tồn tại.");
  return mission;
}

function currentMissionPeriodKey(now = new Date()) {
  const slot = now.getUTCHours() < 6 ? "00" : now.getUTCHours() < 12 ? "06" : now.getUTCHours() < 18 ? "12" : "18";
  return `${now.toISOString().slice(0, 10)}-${slot}`;
}

function missionDifficultyForRank(rank: number, seed: number) {
  const options = sectMissionConfig.rankDifficulty[rank] ?? sectMissionConfig.rankDifficulty[5]!;
  return options[seed % options.length]!;
}

function missionTargetCount(difficulty: number, seed: number) {
  const [min, max] = sectMissionConfig.targetCountByDifficulty[difficulty] ?? sectMissionConfig.targetCountByDifficulty[1]!;
  return min + (seed % (max - min + 1));
}

export function calculateSectMissionReward(input: { difficulty: number; targetStrength?: number; locationDanger?: number; sectRank: number }) {
  const multiplier = sectMissionConfig.difficultyMultipliers[input.difficulty as keyof typeof sectMissionConfig.difficultyMultipliers] ?? 1;
  const dangerFactor = 1 + Math.max(0, input.locationDanger ?? 0) * 0.12;
  const strengthFactor = 1 + Math.max(0, input.targetStrength ?? 0) * 0.08;
  const rankFactor = 1 + (5 - input.sectRank) * 0.08;
  const scale = multiplier * dangerFactor * strengthFactor * rankFactor;
  return {
    cultivation: Math.floor(sectMissionConfig.baseReward.cultivation * scale),
    linhThach: Math.floor(sectMissionConfig.baseReward.linhThach * scale),
    contribution: Math.floor(sectMissionConfig.baseReward.contribution * scale),
    reputation: Math.floor(sectMissionConfig.baseReward.reputation * scale)
  };
}

function objectiveRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rankAllows(currentRank: number, requiredRank: number) {
  return currentRank <= requiredRank;
}

function assertUnlocked(currentRank: number, requiredRank: number, label: string) {
  if (!rankAllows(currentRank, requiredRank)) throw new SectError("SECT_FEATURE_LOCKED", `${label} chưa mở ở phẩm cấp hiện tại.`);
}

function cropDefinition(key: string) {
  const crop = sectFarmConfig.crops[key as keyof typeof sectFarmConfig.crops];
  if (!crop) throw new SectError("CROP_NOT_FOUND", "Linh thảo không tồn tại.");
  return crop;
}

function mineDefinition(key: string) {
  const mine = sectMineConfig.mines[key as keyof typeof sectMineConfig.mines];
  if (!mine) throw new SectError("MINE_NOT_FOUND", "Khoáng mạch không tồn tại.");
  return mine;
}

function splitYield(total: number, personalShareBps: number) {
  const personal = Math.max(0, Math.floor((total * personalShareBps) / 10000));
  return { personal, sect: Math.max(0, total - personal) };
}

export function previewSectFarmReward(rank: number, cropKey: string) {
  const crop = cropDefinition(cropKey);
  assertUnlocked(rank, crop.requiredRank, "Linh Điền");
  const totalYield = Math.max(1, Math.floor(crop.baseYield * (1 + (5 - rank) * 0.12)));
  return { crop, totalYield, split: splitYield(totalYield, sectFarmConfig.personalShareBps), contribution: crop.contribution, reputation: crop.reputation };
}

export function previewSectMineReward(rank: number, mineKey: string) {
  const mine = mineDefinition(mineKey);
  assertUnlocked(rank, mine.requiredRank, "Linh Khoáng");
  const totalYield = Math.max(1, Math.floor(mine.baseYield * (1 + (5 - rank) * 0.1)));
  return { mine, totalYield, split: splitYield(totalYield, sectMineConfig.personalShareBps), contribution: mine.contribution, reputation: mine.reputation };
}

function qualityForRank(rank: number) {
  return getSectRank(rank).caveQualities.at(-1) ?? SectCaveQuality.COMMON;
}

export function getSectCaveBenefit(role: SectRoleName, sectRank: number) {
  const base = sectCaveConfig.roleBaseBps[role] ?? sectCaveConfig.roleBaseBps[SectRoleName.OUTER];
  const rankMultiplier = sectCaveConfig.rankMultiplierBps[sectRank] ?? 10000;
  return {
    name: base.name,
    cultivationBonusBps: Math.floor((base.cultivationBonusBps * rankMultiplier) / 10000),
    breakthroughBonusBps: Math.floor((base.breakthroughBonusBps * rankMultiplier) / 10000),
    rankMultiplierBps: rankMultiplier
  };
}

async function ensureFacility(tx: Tx, sectId: string, rank: number, facilityType: SectFacilityType) {
  const rankConfig = getSectRank(rank);
  const key = facilityType === SectFacilityType.FARM ? "farm" : facilityType === SectFacilityType.CAVE ? "cave" : facilityType === SectFacilityType.MINE ? "mine" : "storage";
  const maxCapacity = rankConfig.capacities[key];
  const fallback = Math.min(maxCapacity, sectFacilityConfig.defaults[facilityType]);
  const existing = await tx.sectFacilityExpansion.findUnique({ where: { sectId_facilityType: { sectId, facilityType } } });
  if (existing) {
    if (existing.maxCapacity !== maxCapacity) {
      return tx.sectFacilityExpansion.update({ where: { id: existing.id }, data: { maxCapacity, currentCapacity: Math.min(existing.currentCapacity, maxCapacity) } });
    }
    return existing;
  }
  return tx.sectFacilityExpansion.create({ data: { sectId, facilityType, currentCapacity: fallback, maxCapacity } });
}

async function ensureFarmPlots(tx: Tx, sectId: string, capacity: number) {
  for (let plotIndex = 1; plotIndex <= capacity; plotIndex++) {
    await tx.sectFarmPlot.upsert({
      where: { sectId_plotIndex: { sectId, plotIndex } },
      update: {},
      create: { sectId, plotIndex }
    });
  }
}

async function ensureCaves(tx: Tx, sectId: string, rank: number, capacity: number) {
  const existing = await tx.sectCave.count({ where: { sectId } });
  const quality = qualityForRank(rank);
  const config = sectCaveConfig.qualities[quality];
  for (let index = existing + 1; index <= capacity; index++) {
    await tx.sectCave.create({
      data: {
        sectId,
        name: `${config.label} ${index.toString().padStart(2, "0")}`,
        quality,
        cultivationBonusBps: config.cultivationBonusBps,
        breakthroughBonusBps: config.breakthroughBonusBps,
        requiredRole: config.requiredRole
      }
    });
  }
}

async function grantItem(tx: Tx, characterId: string, templateKey: string, quantity: number) {
  if (quantity <= 0) return null;
  const template = await tx.itemTemplate.findUnique({ where: { key: templateKey } });
  if (!template) throw new SectError("ITEM_TEMPLATE_NOT_FOUND", `Thiếu item template: ${templateKey}.`);
  await tx.itemInstance.create({ data: { ownerId: characterId, templateId: template.id, quantity } });
  return template;
}

async function grantSectItem(tx: Tx, sectId: string, characterId: string | null, templateKey: string, quantity: number, type: SectInventoryLogType, reason: string) {
  if (quantity <= 0) return null;
  const template = await tx.itemTemplate.findUnique({ where: { key: templateKey } });
  if (!template) throw new SectError("ITEM_TEMPLATE_NOT_FOUND", `Thiếu item template: ${templateKey}.`);
  const existing = await tx.sectInventoryItem.findUnique({
    where: { sectId_templateId_quality_enhancement_bound: { sectId, templateId: template.id, quality: 1, enhancement: 0, bound: false } }
  });
  const before = existing?.quantity ?? 0;
  const storage = await tx.sectInventoryItem.upsert({
    where: { sectId_templateId_quality_enhancement_bound: { sectId, templateId: template.id, quality: 1, enhancement: 0, bound: false } },
    update: { quantity: { increment: quantity } },
    create: { sectId, templateId: template.id, quantity, quality: 1, enhancement: 0, bound: false }
  });
  await tx.sectInventoryLog.create({ data: { sectId, characterId, templateId: template.id, type, quantity, beforeQuantity: before, afterQuantity: before + quantity, reason } });
  return { template, storage };
}

async function consumeSectItem(tx: Tx, sectId: string, templateKey: string, quantity: number, type: SectInventoryLogType, reason: string, actorId?: string) {
  if (quantity <= 0) return;
  const template = await tx.itemTemplate.findUnique({ where: { key: templateKey } });
  if (!template) throw new SectError("ITEM_TEMPLATE_NOT_FOUND", `Thiếu item template: ${templateKey}.`);
  const storage = await tx.sectInventoryItem.findUnique({
    where: { sectId_templateId_quality_enhancement_bound: { sectId, templateId: template.id, quality: 1, enhancement: 0, bound: false } }
  });
  if (!storage || storage.quantity < quantity) throw new SectError("INSUFFICIENT_SECT_RESOURCE", `Kho Tông Môn không đủ ${template.name}.`);
  const updated = await tx.sectInventoryItem.updateMany({ where: { id: storage.id, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
  if (updated.count !== 1) throw new SectError("INSUFFICIENT_SECT_RESOURCE", `Kho Tông Môn không đủ ${template.name}.`);
  await tx.sectInventoryLog.create({ data: { sectId, characterId: actorId ?? null, templateId: template.id, type, quantity: -quantity, beforeQuantity: storage.quantity, afterQuantity: storage.quantity - quantity, reason } });
}

function deterministicRollBps(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return Math.abs(hash) % 10000;
}

export async function createSect(
  db: Db,
  characterId: string,
  input: { name: string; tag: string; description: string; emblem?: string; iconKey?: string; backgroundKey?: string; alignment?: SectAlignment }
) {
  const name = normalizeText(input.name, 48);
  const tag = normalizeTag(input.tag);
  const description = normalizeText(input.description || "Thanh tu vấn đạo, cầu trường sinh.", 220);
  const iconKey = normalizeSectIconKey(input.iconKey ?? input.emblem ?? "golden-dragon");
  const emblem = iconKey;
  const backgroundKey = backgroundForSectIcon(iconKey);
  const alignment = input.alignment ?? SectAlignment.NEUTRAL;
  if (name.length < 3) throw new SectError("BAD_NAME", "Tên tông môn cần ít nhất 3 ký tự.");
  if (tag.length < 2) throw new SectError("BAD_TAG", "Ký hiệu tông môn cần 2-6 ký tự.");
  return db.$transaction(async (tx) => {
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId } });
    if (character.sectId) throw new SectError("ALREADY_IN_SECT", "Bạn đã thuộc một tông môn.");
    await debitWallet(tx, characterId, Currency.LINH_THACH, sectCreateCost, WalletTxType.SECT, "Sect", tag, `sect:create:${characterId}`);
    const rank = getSectRank(5);
    const sect = await tx.sect.create({
      data: {
        name,
        tag,
        description,
        emblem,
        iconKey,
        backgroundKey,
        alignment,
        rank: rank.rank,
        memberLimit: rank.maxMembers,
        leaderId: characterId,
        treasury: sectCreateCost / 5n,
        buildings: {
          create: [
            { key: "main-hall", name: "Tông Môn Đại Điện", bonus: { memberLimit: rank.maxMembers } },
            { key: "cave", name: "Động Phủ Ngoại Môn", bonus: { cultivationBps: 500 } }
          ]
        },
        announcements: {
          create: { authorId: characterId, title: "Khai sơn lập phái", body: `${name} chính thức dựng đạo thống.`, pinned: true }
        },
        logs: {
          create: { actorId: characterId, type: SectLogType.CREATE, message: `${character.name} khai sơn lập phái, dựng cờ ${tag}.` }
        },
        treasuryTransactions: {
          create: { characterId, type: "CREATE_SECT", currency: Currency.LINH_THACH, amount: sectCreateCost / 5n, before: 0n, after: sectCreateCost / 5n, reason: "Lập quỹ khai sơn ban đầu" }
        }
      }
    });
    await tx.character.update({ where: { id: characterId }, data: { sectId: sect.id } });
    await tx.sectMember.create({ data: { sectId: sect.id, characterId, role: SectRoleName.LEADER } });
    await ensureFacility(tx, sect.id, sect.rank, SectFacilityType.FARM);
    await ensureFacility(tx, sect.id, sect.rank, SectFacilityType.CAVE);
    await ensureFacility(tx, sect.id, sect.rank, SectFacilityType.MINE);
    await ensureFacility(tx, sect.id, sect.rank, SectFacilityType.STORAGE);
    await ensureFarmPlots(tx, sect.id, 1);
    await ensureCaves(tx, sect.id, sect.rank, 1);
    await tx.worldNews.create({ data: { title: `${name} khai sơn`, body: `${character.name} dựng cờ ${tag}, khai sinh một thế lực ${getSectRank(5).shortLabel}.`, category: "sect", permanent: true } });
    return sect;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function chooseSectIcon(db: Db, characterId: string, sectId: string, iconKey: string, now = new Date()) {
  if (!isSectIconKey(iconKey)) throw new SectError("INVALID_SECT_ICON", "Biểu tượng tông môn không hợp lệ.");
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    if (member.sectId !== sectId) throw new SectError("SECT_FORBIDDEN", "Bạn không thuộc tông môn này.");
    const sect = await tx.sect.findUniqueOrThrow({ where: { id: sectId } });
    if (sect.leaderId !== characterId) throw new SectError("SECT_FORBIDDEN", "Chỉ Tông Chủ mới được chọn biểu tượng khai sơn.");
    if (sect.iconLockedAt) throw new SectError("SECT_ICON_LOCKED", "Biểu tượng tông môn đã được xác nhận và không thể đổi.");
    const backgroundKey = backgroundForSectIcon(iconKey);
    const updated = await tx.sect.update({
      where: { id: sectId },
      data: {
        iconKey,
        backgroundKey,
        emblem: iconKey,
        iconLockedAt: now
      }
    });
    await tx.sectLog.create({
      data: {
        sectId,
        actorId: characterId,
        type: SectLogType.ADMIN,
        message: `${member.sect.name} xác lập biểu tượng sơn môn.`
      }
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function applyToSect(db: Db, characterId: string, sectId: string, message = "") {
  return db.$transaction(async (tx) => {
    const [character, sect] = await Promise.all([
      tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { realmStage: { include: { realm: true } } } }),
      tx.sect.findUniqueOrThrow({ where: { id: sectId }, include: { members: true } })
    ]);
    if (character.sectId) throw new SectError("ALREADY_IN_SECT", "Bạn đã thuộc một tông môn.");
    if (!sect.recruiting) throw new SectError("RECRUIT_CLOSED", "Tông môn này đang đóng tuyển.");
    if (sect.members.length >= sect.memberLimit) throw new SectError("SECT_FULL", "Tông môn đã đủ thành viên.");
    const existing = await tx.sectApplication.findFirst({ where: { characterId, status: SectApplicationStatus.PENDING } });
    if (existing) throw new SectError("APPLICATION_EXISTS", "Bạn đang có đơn xin gia nhập chờ duyệt.");
    if (sect.autoAccept) {
      await tx.character.update({ where: { id: characterId }, data: { sectId } });
      await tx.sectMember.create({ data: { sectId, characterId, role: SectRoleName.OUTER } });
      await tx.sectLog.create({ data: { sectId, actorId: characterId, type: SectLogType.MEMBER, message: `${character.name} gia nhập tông môn.` } });
      return { joined: true };
    }
    const application = await tx.sectApplication.create({
      data: { sectId, characterId, message: normalizeText(message, 180) }
    });
    await tx.sectLog.create({ data: { sectId, actorId: characterId, type: SectLogType.APPLICATION, message: `${character.name} gửi đơn xin gia nhập.` } });
    return { joined: false, application };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelSectApplication(db: Db, characterId: string, applicationId: string) {
  const updated = await db.sectApplication.updateMany({
    where: { id: applicationId, characterId, status: SectApplicationStatus.PENDING },
    data: { status: SectApplicationStatus.CANCELLED, decidedAt: new Date() }
  });
  if (updated.count !== 1) throw new SectError("APPLICATION_NOT_FOUND", "Không tìm thấy đơn đang chờ.");
  return { cancelled: true };
}

export async function approveSectApplication(db: Db, actorId: string, applicationId: string) {
  return db.$transaction(async (tx) => {
    const application = await tx.sectApplication.findUniqueOrThrow({
      where: { id: applicationId },
      include: { character: true, sect: { include: { members: true } } }
    });
    await assertSectPermission(tx, actorId, application.sectId, "APPROVE_APPLICATION");
    if (application.status !== SectApplicationStatus.PENDING) throw new SectError("APPLICATION_CLOSED", "Đơn này đã được xử lý.");
    if (application.character.sectId) throw new SectError("ALREADY_IN_SECT", "Người này đã thuộc tông môn khác.");
    if (application.sect.members.length >= application.sect.memberLimit) throw new SectError("SECT_FULL", "Tông môn đã đủ thành viên.");
    await tx.sectApplication.update({ where: { id: application.id }, data: { status: SectApplicationStatus.APPROVED, decidedById: actorId, decidedAt: new Date() } });
    await tx.character.update({ where: { id: application.characterId }, data: { sectId: application.sectId } });
    await tx.sectMember.create({ data: { sectId: application.sectId, characterId: application.characterId, role: SectRoleName.OUTER } });
    await tx.sectLog.create({ data: { sectId: application.sectId, actorId, type: SectLogType.MEMBER, message: `${application.character.name} được nhận làm Ngoại Môn Đệ Tử.` } });
    return { approved: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function rejectSectApplication(db: Db, actorId: string, applicationId: string) {
  return db.$transaction(async (tx) => {
    const application = await tx.sectApplication.findUniqueOrThrow({ where: { id: applicationId } });
    await assertSectPermission(tx, actorId, application.sectId, "APPROVE_APPLICATION");
    if (application.status !== SectApplicationStatus.PENDING) throw new SectError("APPLICATION_CLOSED", "Đơn này đã được xử lý.");
    await tx.sectApplication.update({ where: { id: application.id }, data: { status: SectApplicationStatus.REJECTED, decidedById: actorId, decidedAt: new Date() } });
    await tx.sectLog.create({ data: { sectId: application.sectId, actorId, type: SectLogType.APPLICATION, message: "Một đơn xin gia nhập đã bị từ chối." } });
    return { rejected: true };
  });
}

export async function depositSectCurrency(db: Db, characterId: string, amount: bigint, reason = "Cống hiến quỹ tông môn") {
  assertPositiveAmount(amount);
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    const contribution = Number(amount / sectEconomyConfig.currencyContributionDivisor);
    const reputation = Number(amount / sectEconomyConfig.currencyReputationDivisor);
    await debitWallet(tx, characterId, Currency.LINH_THACH, amount, WalletTxType.SECT, "Sect", member.sectId, `sect:deposit:${characterId}:${Date.now()}`);
    const before = member.sect.treasury;
    const after = before + amount;
    await tx.sect.update({ where: { id: member.sectId }, data: { treasury: after, reputation: { increment: reputation } } });
    const treasuryTx = await tx.sectTreasuryTransaction.create({
      data: { sectId: member.sectId, characterId, type: "DEPOSIT", currency: Currency.LINH_THACH, amount, before, after, reason }
    });
    if (contribution > 0) await mutateContribution(tx, member.sectId, characterId, contribution, "DONATION", reason, "SectTreasuryTransaction", treasuryTx.id, `sect:contribution:deposit:${treasuryTx.id}`);
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId: characterId, type: SectLogType.TREASURY, message: `Cống hiến ${amount.toLocaleString("vi-VN")} Linh Thạch vào quỹ tông môn.` } });
    return { amount, contribution, reputation, treasury: after };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function withdrawSectCurrency(db: Db, actorId: string, amount: bigint, reason = "Rút quỹ tông môn") {
  assertPositiveAmount(amount);
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, actorId);
    await assertSectPermission(tx, actorId, member.sectId, "MANAGE_TREASURY");
    const before = member.sect.treasury;
    const updated = await tx.sect.updateMany({ where: { id: member.sectId, treasury: { gte: amount } }, data: { treasury: { decrement: amount } } });
    if (updated.count !== 1) throw new SectError("INSUFFICIENT_TREASURY", "Quỹ tông môn không đủ.");
    const after = before - amount;
    await creditWallet(tx, actorId, Currency.LINH_THACH, amount, WalletTxType.SECT, "Sect", member.sectId, `sect:withdraw:${member.sectId}:${actorId}:${Date.now()}`);
    await tx.sectTreasuryTransaction.create({ data: { sectId: member.sectId, characterId: actorId, type: "WITHDRAW", currency: Currency.LINH_THACH, amount: -amount, before, after, reason } });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId, type: SectLogType.TREASURY, message: `Rút ${amount.toLocaleString("vi-VN")} Linh Thạch khỏi quỹ tông môn.` } });
    return { amount, treasury: after };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function depositSectItem(db: Db, characterId: string, itemId: string, quantity: number, reason = "Cống hiến vật phẩm") {
  assertPositiveAmount(quantity);
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: "ACTIVE" } } } });
    if (!item || item.ownerId !== characterId || item.quantity < quantity) throw new SectError("ITEM_NOT_FOUND", "Không đủ vật phẩm để cống hiến.");
    if (item.equippedSlot || item.listings.length > 0 || item.bound) throw new SectError("ITEM_LOCKED", "Vật phẩm này không thể đưa vào kho tông môn.");
    const updatedItem = await tx.itemInstance.updateMany({ where: { id: itemId, ownerId: characterId, quantity: { gte: quantity }, equippedSlot: null, bound: false }, data: { quantity: { decrement: quantity } } });
    if (updatedItem.count !== 1) throw new SectError("ITEM_NOT_FOUND", "Không đủ vật phẩm để cống hiến.");
    await tx.itemInstance.updateMany({ where: { id: itemId, quantity: { lte: 0 } }, data: { ownerId: null, quantity: 0 } });
    const existing = await tx.sectInventoryItem.findUnique({
      where: { sectId_templateId_quality_enhancement_bound: { sectId: member.sectId, templateId: item.templateId, quality: item.quality, enhancement: item.enhancement, bound: item.bound } }
    });
    const before = existing?.quantity ?? 0;
    const storage = await tx.sectInventoryItem.upsert({
      where: { sectId_templateId_quality_enhancement_bound: { sectId: member.sectId, templateId: item.templateId, quality: item.quality, enhancement: item.enhancement, bound: item.bound } },
      update: { quantity: { increment: quantity } },
      create: { sectId: member.sectId, templateId: item.templateId, quantity, quality: item.quality, enhancement: item.enhancement, bound: item.bound }
    });
    const economy = getItemEconomy(item.template as never);
    if (!economy.sectExchangeEnabled) throw new SectError("ITEM_NOT_DONATABLE", "Vật phẩm này không nhận vào kho tông môn.");
    const contribution = Math.max(1, quantity * economy.donationContributionValue);
    await mutateContribution(tx, member.sectId, characterId, contribution, "DONATION", reason, "SectInventoryItem", storage.id, `sect:item-donate:${itemId}:${quantity}:${Date.now()}`);
    await tx.sectInventoryLog.create({ data: { sectId: member.sectId, characterId, templateId: item.templateId, type: SectInventoryLogType.DEPOSIT, quantity, beforeQuantity: before, afterQuantity: before + quantity, reason } });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId: characterId, type: SectLogType.INVENTORY, message: `Gửi ${item.template.name} x${quantity} vào Kho Tông Môn.` } });
    return { itemName: item.template.name, quantity, contribution, afterQuantity: before + quantity };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function withdrawSectItem(db: Db, actorId: string, storageId: string, quantity: number, reason = "Rút vật phẩm") {
  assertPositiveAmount(quantity);
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, actorId);
    const storage = await tx.sectInventoryItem.findUnique({ where: { id: storageId }, include: { template: true } });
    if (!storage || storage.sectId !== member.sectId) throw new SectError("STORAGE_NOT_FOUND", "Không tìm thấy vật phẩm trong kho.");
    const economy = getItemEconomy(storage.template as never);
    if (!economy.sectExchangeEnabled) throw new SectError("ITEM_NOT_EXCHANGEABLE", "Vật phẩm này không mở đổi bằng cống hiến.");
    if (economy.requiredSectRank && member.sect.rank > economy.requiredSectRank) throw new SectError("SECT_RANK_REQUIRED", "Phẩm cấp tông môn chưa đủ để đổi vật phẩm này.");
    if (economy.requiredRealmOrder !== null) {
      const character = await tx.character.findUniqueOrThrow({ where: { id: actorId }, include: { realmStage: { include: { realm: true } } } });
      if (character.realmStage.realm.order < economy.requiredRealmOrder) throw new SectError("REALM_REQUIREMENT_NOT_MET", "Cảnh giới chưa đủ để đổi vật phẩm này.");
    }
    const hasPermission = hasSectPermission(member.role, "MANAGE_STORAGE");
    const contributionCost = hasPermission ? 0 : getSectItemContributionPrice(storage.template) * quantity;
    if (contributionCost > 0) await mutateContribution(tx, member.sectId, actorId, -contributionCost, "ITEM_EXCHANGE", `Đổi ${storage.template.name}`, "SectInventoryItem", storage.id, `sect:item-withdraw:${storage.id}:${actorId}:${quantity}:${Date.now()}`);
    const updated = await tx.sectInventoryItem.updateMany({ where: { id: storage.id, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
    if (updated.count !== 1) throw new SectError("INSUFFICIENT_STORAGE", "Kho tông môn không đủ vật phẩm.");
    await tx.itemInstance.create({ data: { ownerId: actorId, templateId: storage.templateId, quantity, quality: storage.quality, enhancement: storage.enhancement, bound: storage.bound } });
    await tx.sectInventoryLog.create({ data: { sectId: member.sectId, characterId: actorId, templateId: storage.templateId, type: SectInventoryLogType.WITHDRAW, quantity: -quantity, beforeQuantity: storage.quantity, afterQuantity: storage.quantity - quantity, reason } });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId, type: SectLogType.INVENTORY, message: `Rút ${storage.template.name} x${quantity} khỏi Kho Tông Môn.` } });
    return { itemName: storage.template.name, quantity, contributionCost, afterQuantity: storage.quantity - quantity };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function exchangeSectAppearanceTalisman(db: Db, characterId: string, actionKey: string) {
  const normalizedActionKey = actionKey.trim();
  if (!normalizedActionKey) throw new SectError("MISSING_ACTION_KEY", "Thiếu mã giao dịch.");
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    if (member.sect.tag !== "TVM" && member.sect.name !== "Thanh Vân Môn") throw new SectError("WRONG_SECT", "Chỉ đệ tử Thanh Vân Môn có thể đổi Dịch Dung Phù.");
    if (sectRoles[member.role].order > sectRoles.OUTER.order) throw new SectError("SECT_ROLE_REQUIRED", "Cần thân phận Ngoại Môn Đệ Tử trở lên.");
    const template = await tx.itemTemplate.findUnique({ where: { key: "dich-dung-phu" } });
    if (!template) throw new SectError("ITEM_NOT_FOUND", "Chưa có Dịch Dung Phù trong hệ thống.");
    const price = getSectItemContributionPrice(template);
    if (member.contribution < price) throw new SectError("INSUFFICIENT_CONTRIBUTION", "Không đủ điểm cống hiến.");
    const idempotencyKey = `sect:dich-dung-phu:${characterId}:${normalizedActionKey}`;
    const existingTx = await tx.sectContributionTransaction.findUnique({ where: { characterId_idempotencyKey: { characterId, idempotencyKey } } });
    if (existingTx) return { itemName: template.name, quantity: 1, contributionCost: price, repeated: true };
    await mutateContribution(tx, member.sectId, characterId, -price, "SECT_CONTRIBUTION_EXCHANGE", "Đổi Dịch Dung Phù", "ItemTemplate", template.id, idempotencyKey);
    const existing = await tx.itemInstance.findFirst({
      where: {
        ownerId: characterId,
        templateId: template.id,
        quantity: { lt: template.maxStack },
        quality: 1,
        enhancement: 0,
        bound: false,
        equippedSlot: null,
        durability: null,
        listings: { none: { status: "ACTIVE" } }
      },
      orderBy: { createdAt: "asc" }
    });
    if (existing) await tx.itemInstance.update({ where: { id: existing.id }, data: { quantity: { increment: 1 } } });
    else await tx.itemInstance.create({ data: { ownerId: characterId, templateId: template.id, quantity: 1, quality: 1, enhancement: 0, bound: false } });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId: characterId, type: SectLogType.INVENTORY, message: "Đổi Dịch Dung Phù bằng cống hiến tông môn." } });
    await tx.gameLog.create({ data: { characterId, type: "SECT_CONTRIBUTION_EXCHANGE", message: `Đổi Dịch Dung Phù, tiêu hao ${price} Cống Hiến.`, metadata: { itemKey: "dich-dung-phu", contributionCost: price } as Prisma.InputJsonValue } });
    return { itemName: template.name, quantity: 1, contributionCost: price };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function refreshSectMissionPool(db: Db | Tx, sectId: string, now = new Date()) {
  const periodKey = currentMissionPeriodKey(now);
  const run = async (tx: Tx) => {
    const sect = await tx.sect.findUniqueOrThrow({ where: { id: sectId } });
    const existing = await tx.sectMission.findMany({ where: { sectId, periodKey, status: SectMissionStatus.ACTIVE }, orderBy: [{ difficulty: "asc" }, { title: "asc" }] });
    if (existing.length >= 6) return existing;
    const [locations, monsters, itemTemplates] = await Promise.all([
      tx.location.findMany({ where: { active: true, minimumRealmOrder: { lte: Math.max(0, 6 - sect.rank) } }, include: { zone: true }, orderBy: [{ minimumRealmOrder: "asc" }, { name: "asc" }], take: 12 }),
      tx.monster.findMany({ where: { realmOrder: { lte: Math.max(0, 6 - sect.rank) } }, orderBy: [{ realmOrder: "asc" }, { name: "asc" }], take: 12 }),
      tx.itemTemplate.findMany({ where: { category: "MATERIAL" }, orderBy: { name: "asc" }, take: 18 })
    ]);
    const created = [];
    const safeLocations = locations.length ? locations : await tx.location.findMany({ where: { active: true }, include: { zone: true }, take: 3 });
    for (let index = existing.length; index < Math.min(12, 6 + Math.max(0, 5 - sect.rank) * 2); index++) {
      const location = safeLocations[index % safeLocations.length];
      if (!location) break;
      const difficulty = missionDifficultyForRank(sect.rank, index + location.zone.dangerLevel);
      const monster = monsters[(index + location.zone.dangerLevel) % Math.max(1, monsters.length)];
      const resourceTable = Array.isArray(location.zone.resourceTable) ? location.zone.resourceTable : [];
      const resourceKey = objectiveRecord(resourceTable[index % Math.max(1, resourceTable.length)]).key;
      const template = itemTemplates.find((item) => item.key === resourceKey) ?? itemTemplates[index % Math.max(1, itemTemplates.length)];
      const type: SectMissionType = index % 3 === 0 && monster ? "HUNT" : index % 3 === 1 && template ? "COLLECT" : "EXPLORE";
      const targetCount = type === "EXPLORE" ? 1 : missionTargetCount(difficulty, index + sect.rank + location.zone.dangerLevel);
      const reward = calculateSectMissionReward({ difficulty, targetStrength: monster?.realmOrder ?? 0, locationDanger: location.zone.dangerLevel, sectRank: sect.rank });
      const key = `${type.toLowerCase()}:${location.key}:${monster?.key ?? template?.key ?? "visit"}:${difficulty}`;
      const title = type === "HUNT" && monster ? `Săn ${monster.name}` : type === "COLLECT" && template ? `Thu thập ${template.name}` : `Tuần tra ${location.name}`;
      const objective = {
        eventType: type === "HUNT" ? "MONSTER_KILLED" : type === "COLLECT" ? "ITEM_COLLECTED" : "LOCATION_VISITED",
        monsterKey: type === "HUNT" ? monster?.key : null,
        itemKey: type === "COLLECT" ? template?.key : null,
        locationId: location.id,
        locationKey: location.key,
        locationName: location.name
      };
      created.push(await tx.sectMission.upsert({
        where: { sectId_periodKey_key: { sectId, periodKey, key } },
        update: {},
        create: {
          sectId,
          periodKey,
          key,
          type,
          title,
          description: `${title} tại ${location.name}. Nhiệm vụ được Thiên Cơ Bảng sinh từ địa đồ hiện tại.`,
          difficulty,
          durationMinutes: 0,
          maxParticipants: 99,
          locationId: location.id,
          objective: objective as Prisma.InputJsonValue,
          targetCount,
          reward: reward as Prisma.InputJsonValue,
          status: SectMissionStatus.ACTIVE
        }
      }));
    }
    return [...existing, ...created];
  };
  return "$transaction" in db ? db.$transaction((tx) => run(tx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }) : run(db);
}

export async function acceptSectMission(db: Db, characterId: string, missionIdOrKey: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    const active = await tx.sectMissionParticipant.findFirst({ where: { characterId, status: SectMissionStatus.ACTIVE } });
    if (active) throw new SectError("ACTIVE_MISSION", "Bạn đang có nhiệm vụ tông môn chưa hoàn thành.");
    await refreshSectMissionPool(tx, member.sectId, now);
    let mission = await tx.sectMission.findFirst({ where: { id: missionIdOrKey, sectId: member.sectId, status: SectMissionStatus.ACTIVE } });
    if (!mission) mission = await tx.sectMission.findFirst({ where: { key: missionIdOrKey, sectId: member.sectId, status: SectMissionStatus.ACTIVE }, orderBy: { createdAt: "desc" } });
    if (!mission) {
      const definition = missionDefinition(missionIdOrKey);
      mission = await tx.sectMission.upsert({
        where: { id: `${member.sectId}:${definition.key}` },
        update: {},
        create: {
          id: `${member.sectId}:${definition.key}`,
          sectId: member.sectId,
          key: definition.key,
          type: "PATROL",
          title: definition.title,
          description: definition.description,
          difficulty: definition.difficulty,
          durationMinutes: definition.durationMinutes,
          maxParticipants: 99,
          objective: { eventType: "LOCATION_VISITED" },
          targetCount: 1,
          reward: definition.reward as Prisma.InputJsonValue
        }
      });
    }
    const participant = await tx.sectMissionParticipant.create({
      data: { sectId: member.sectId, missionId: mission.id, missionKey: mission.key, characterId, progress: 0, targetCount: mission.targetCount, endsAt: new Date(now.getTime() + mission.durationMinutes * 60_000), idempotencyKey: `mission:${mission.id}:${characterId}:${now.getTime()}` }
    });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId: characterId, type: SectLogType.MISSION, message: `Nhận nhiệm vụ "${mission.title}".` } });
    return participant;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function progressSectMissionObjective(db: Db | Tx, input: { characterId: string; eventType: SectMissionEventType; targetId?: string; locationId?: string | null; itemKey?: string; monsterKey?: string; recipeKey?: string; professionKey?: string; worldObjectKey?: string; amount?: number }) {
  const run = async (tx: Tx) => {
    if (!(tx as unknown as { sectMissionParticipant?: unknown }).sectMissionParticipant) return [];
    const amount = Math.max(1, input.amount ?? 1);
    const active = await tx.sectMissionParticipant.findMany({ where: { characterId: input.characterId, status: SectMissionStatus.ACTIVE }, include: { mission: true } });
    const progressed = [];
    for (const participant of active) {
      const mission = participant.mission;
      if (!mission) continue;
      const objective = objectiveRecord(mission.objective);
      if (objective.eventType !== input.eventType) continue;
      if (objective.locationId && objective.locationId !== input.locationId) continue;
      if (objective.monsterKey && objective.monsterKey !== input.monsterKey) continue;
      if (objective.itemKey && objective.itemKey !== input.itemKey) continue;
      if (objective.recipeKey && objective.recipeKey !== input.recipeKey) continue;
      if (objective.professionKey && objective.professionKey !== input.professionKey) continue;
      if (objective.worldObjectKey && objective.worldObjectKey !== input.worldObjectKey) continue;
      const nextProgress = Math.min(participant.targetCount, participant.progress + amount);
      const nextStatus = nextProgress >= participant.targetCount ? SectMissionStatus.READY_TO_TURN_IN : SectMissionStatus.ACTIVE;
      await tx.sectMissionParticipant.update({ where: { id: participant.id }, data: { progress: nextProgress, status: nextStatus } });
      progressed.push({ id: participant.id, missionTitle: mission.title, progress: nextProgress, targetCount: participant.targetCount, ready: nextStatus === SectMissionStatus.READY_TO_TURN_IN });
    }
    return progressed;
  };
  return "$transaction" in db ? db.$transaction((tx) => run(tx)) : run(db);
}

export async function completeSectMission(db: Db, characterId: string, participantId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const participant = await tx.sectMissionParticipant.findUnique({ where: { id: participantId }, include: { mission: true } });
    if (!participant || participant.characterId !== characterId) throw new SectError("MISSION_NOT_FOUND", "Không tìm thấy nhiệm vụ.");
    if (participant.status === SectMissionStatus.COMPLETED) return { alreadyCompleted: true, reward: participant.reward };
    if (participant.status !== SectMissionStatus.ACTIVE && participant.status !== SectMissionStatus.READY_TO_TURN_IN) throw new SectError("MISSION_CLOSED", "Nhiệm vụ đã đóng.");
    const mission = participant.mission;
    if (!mission) throw new SectError("MISSION_NOT_FOUND", "Không tìm thấy nhiệm vụ.");
    const objective = objectiveRecord(mission.objective);
    const itemKey = typeof objective.itemKey === "string" ? objective.itemKey : null;
    const requiresProgressBeforeTurnIn = objective.requiresProgressBeforeTurnIn === true || objective.eventType === "CRAFT_COMPLETED" || objective.eventType === "INTERACT_WORLD_OBJECT";
    const canTurnInByInventory = !requiresProgressBeforeTurnIn && (mission.type === "COLLECT" || mission.type === "DELIVER" || mission.type === "DONATE") && itemKey
      ? await characterItemQuantityForMission(tx, characterId, itemKey) >= mission.targetCount
      : false;
    if (participant.status === SectMissionStatus.ACTIVE && participant.progress < participant.targetCount && !canTurnInByInventory) throw new SectError("MISSION_NOT_READY", "Mục tiêu nhiệm vụ chưa hoàn thành.");
    const reward = objectiveRecord(mission.reward) as { cultivation?: number; linhThach?: number; contribution?: number; reputation?: number; itemKey?: string; itemQuantity?: number };
    if (mission.type === "COLLECT" || mission.type === "DELIVER" || mission.type === "DONATE") {
      if (itemKey) await consumeCharacterItemForMission(tx, characterId, itemKey, mission.targetCount);
    }
    const updated = await tx.sectMissionParticipant.updateMany({ where: { id: participantId, status: { in: [SectMissionStatus.ACTIVE, SectMissionStatus.READY_TO_TURN_IN] } }, data: { status: SectMissionStatus.COMPLETED, completedAt: now, reward: reward as Prisma.InputJsonValue } });
    if (updated.count !== 1) return { alreadyCompleted: true, reward: participant.reward };
    if ((reward.cultivation ?? 0) > 0) await tx.character.update({ where: { id: characterId }, data: { cultivation: { increment: BigInt(reward.cultivation!) } } });
    if ((reward.linhThach ?? 0) > 0) await creditWallet(tx, characterId, Currency.LINH_THACH, BigInt(reward.linhThach!), WalletTxType.REWARD, "SectMission", participantId, `sect:mission:wallet:${participantId}`);
    if ((reward.contribution ?? 0) > 0) await mutateContribution(tx, participant.sectId, characterId, reward.contribution!, "MISSION", mission.title, "SectMissionParticipant", participantId, `sect:mission:contribution:${participantId}`);
    if ((reward.reputation ?? 0) > 0) await tx.sect.update({ where: { id: participant.sectId }, data: { reputation: { increment: reward.reputation! } } });
    if ("itemKey" in reward && reward.itemKey && reward.itemQuantity) {
      const template = await tx.itemTemplate.findUnique({ where: { key: reward.itemKey } });
      if (template) await tx.itemInstance.create({ data: { ownerId: characterId, templateId: template.id, quantity: reward.itemQuantity } });
    }
    await tx.sectLog.create({ data: { sectId: participant.sectId, actorId: characterId, type: SectLogType.MISSION, message: `Nộp nhiệm vụ "${mission.title}".` } });
    return { alreadyCompleted: false, reward };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function characterItemQuantityForMission(tx: Tx, characterId: string, itemKey: string) {
  const items = await tx.itemInstance.findMany({ where: { ownerId: characterId, template: { key: itemKey }, quantity: { gt: 0 }, equippedSlot: null }, select: { quantity: true } });
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

async function consumeCharacterItemForMission(tx: Tx, characterId: string, itemKey: string, quantity: number) {
  const items = await tx.itemInstance.findMany({ where: { ownerId: characterId, template: { key: itemKey }, quantity: { gt: 0 }, equippedSlot: null }, include: { template: true }, orderBy: { createdAt: "asc" } });
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  if (total < quantity) throw new SectError("MISSION_ITEM_REQUIRED", `Không đủ ${items[0]?.template.name ?? itemKey} để nộp nhiệm vụ.`);
  let remaining = quantity;
  for (const item of items) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, item.quantity);
    if (take === item.quantity) await tx.itemInstance.update({ where: { id: item.id }, data: { ownerId: null, quantity: 0 } });
    else await tx.itemInstance.update({ where: { id: item.id }, data: { quantity: { decrement: take } } });
    remaining -= take;
  }
}

export async function expandSectFacility(db: Db, actorId: string, facilityType: SectFacilityType) {
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, actorId);
    await assertSectPermission(tx, actorId, member.sectId, "MANAGE_BUILDINGS");
    const facility = await ensureFacility(tx, member.sectId, member.sect.rank, facilityType);
    if (facility.currentCapacity >= facility.maxCapacity) throw new SectError("FACILITY_MAXED", "Khu vực này đã đạt giới hạn theo phẩm cấp hiện tại.");
    const cost = sectFacilityConfig.expansionCost[facilityType];
    const updated = await tx.sect.updateMany({ where: { id: member.sectId, treasury: { gte: cost.treasury } }, data: { treasury: { decrement: cost.treasury } } });
    if (updated.count !== 1) throw new SectError("INSUFFICIENT_TREASURY", "Quỹ tông môn không đủ để mở rộng.");
    for (const resource of cost.resources) await consumeSectItem(tx, member.sectId, resource.key, resource.quantity, SectInventoryLogType.EXPANSION_COST, `Mở rộng ${facilityType}`, actorId);
    const next = await tx.sectFacilityExpansion.update({
      where: { id: facility.id },
      data: { currentCapacity: { increment: 1 }, expansionCount: { increment: 1 } }
    });
    if (facilityType === SectFacilityType.FARM) await ensureFarmPlots(tx, member.sectId, next.currentCapacity);
    if (facilityType === SectFacilityType.CAVE) await ensureCaves(tx, member.sectId, member.sect.rank, next.currentCapacity);
    await tx.sectTreasuryTransaction.create({ data: { sectId: member.sectId, characterId: actorId, type: "EXPANSION_COST", currency: Currency.LINH_THACH, amount: -cost.treasury, before: member.sect.treasury, after: member.sect.treasury - cost.treasury, reason: `Mở rộng ${facilityType}` } });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId, type: SectLogType.EXPANSION, message: `Mở rộng ${facilityType}: ${facility.currentCapacity} → ${next.currentCapacity}.` } });
    return next;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function upgradeSectRank(db: Db, actorId: string) {
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, actorId);
    await assertSectPermission(tx, actorId, member.sectId, "UPGRADE_SECT");
    const current = getSectRank(member.sect.rank);
    const next = getNextSectRank(member.sect.rank);
    if (!next || !current.rankUpCost) throw new SectError("SECT_MAX_RANK", "Tông môn đã đạt phẩm cấp cao nhất hiện tại.");
    const memberCount = await tx.sectMember.count({ where: { sectId: member.sectId } });
    if (member.sect.reputation < current.reputationRequired) throw new SectError("INSUFFICIENT_REPUTATION", "Uy Danh chưa đủ để thăng phẩm.");
    if (member.sect.treasury < current.rankUpCost.treasury) throw new SectError("INSUFFICIENT_TREASURY", "Quỹ tông môn chưa đủ để thăng phẩm.");
    if (memberCount < current.rankUpCost.memberCount) throw new SectError("INSUFFICIENT_MEMBERS", "Số thành viên chưa đủ để thăng phẩm.");
    for (const resource of current.rankUpCost.resources) await consumeSectItem(tx, member.sectId, resource.key, resource.quantity, SectInventoryLogType.RANK_COST, `Thăng phẩm ${current.shortLabel} → ${next.shortLabel}`, actorId);
    const updated = await tx.sect.updateMany({
      where: { id: member.sectId, rank: current.rank, treasury: { gte: current.rankUpCost.treasury }, reputation: { gte: current.reputationRequired } },
      data: { rank: next.rank, memberLimit: next.maxMembers, treasury: { decrement: current.rankUpCost.treasury } }
    });
    if (updated.count !== 1) throw new SectError("RANK_UP_CONFLICT", "Điều kiện thăng phẩm đã thay đổi, hãy thử lại.");
    await tx.sectTreasuryTransaction.create({ data: { sectId: member.sectId, characterId: actorId, type: "RANK_COST", currency: Currency.LINH_THACH, amount: -current.rankUpCost.treasury, before: member.sect.treasury, after: member.sect.treasury - current.rankUpCost.treasury, reason: `Thăng phẩm ${current.shortLabel} → ${next.shortLabel}` } });
    for (const facilityType of [SectFacilityType.FARM, SectFacilityType.CAVE, SectFacilityType.MINE, SectFacilityType.STORAGE]) await ensureFacility(tx, member.sectId, next.rank, facilityType);
    await unlockRankLibraryTechniques(tx, member.sectId, next.rank);
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId, type: SectLogType.RANK, message: `${member.sect.name} đã thăng lên ${next.shortLabel}.` } });
    await tx.worldNews.create({ data: { title: `${member.sect.name} thăng phẩm`, body: `${member.sect.name} bước vào hàng ${next.label}, sơn môn mở rộng và khí vận tăng mạnh.`, category: "sect", permanent: true } });
    return { rank: next.rank, label: next.label };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function plantSectCrop(db: Db, characterId: string, plotId: string, cropKey: string, now = new Date()) {
  const crop = cropDefinition(cropKey);
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    assertUnlocked(member.sect.rank, crop.requiredRank, "Linh Điền");
    const plot = await tx.sectFarmPlot.findUnique({ where: { id: plotId } });
    if (!plot || plot.sectId !== member.sectId) throw new SectError("PLOT_NOT_FOUND", "Không tìm thấy ô Linh Điền.");
    if (plot.status !== SectWorkStatus.EMPTY && plot.status !== SectWorkStatus.CLAIMED) throw new SectError("PLOT_BUSY", "Ô đất này đang có cây trồng.");
    const updated = await tx.sectFarmPlot.updateMany({
      where: { id: plotId, sectId: member.sectId, status: { in: [SectWorkStatus.EMPTY, SectWorkStatus.CLAIMED] } },
      data: { planterId: characterId, cropKey, status: SectWorkStatus.ACTIVE, startedAt: now, readyAt: new Date(now.getTime() + crop.durationMinutes * 60_000), harvestedAt: null, reward: Prisma.JsonNull }
    });
    if (updated.count !== 1) throw new SectError("PLOT_BUSY", "Ô đất này đang có cây trồng.");
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId: characterId, type: SectLogType.FARM, message: `Gieo trồng ${crop.name} tại Linh Điền ${plot.plotIndex}.` } });
    return { plotId, crop };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function harvestSectCrop(db: Db, characterId: string, plotId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    const plot = await tx.sectFarmPlot.findUnique({ where: { id: plotId } });
    if (!plot || plot.sectId !== member.sectId || plot.planterId !== characterId || !plot.cropKey) throw new SectError("PLOT_NOT_FOUND", "Không tìm thấy Linh Điền của bạn.");
    if (plot.status === SectWorkStatus.CLAIMED) return { alreadyClaimed: true, reward: plot.reward };
    if (plot.status !== SectWorkStatus.ACTIVE) throw new SectError("PLOT_NOT_READY", "Linh Điền chưa sẵn sàng thu hoạch.");
    if (!plot.readyAt || plot.readyAt > now) throw new SectError("PLOT_NOT_READY", "Linh thảo chưa chín.");
    const crop = cropDefinition(plot.cropKey);
    const preview = previewSectFarmReward(member.sect.rank, plot.cropKey);
    const totalYield = preview.totalYield;
    const split = preview.split;
    const updated = await tx.sectFarmPlot.updateMany({ where: { id: plotId, status: SectWorkStatus.ACTIVE, readyAt: { lte: now } }, data: { status: SectWorkStatus.CLAIMED, harvestedAt: now, reward: { totalYield, split, cropKey: plot.cropKey } } });
    if (updated.count !== 1) return { alreadyClaimed: true, reward: plot.reward };
    const template = await grantItem(tx, characterId, plot.cropKey, split.personal);
    await grantSectItem(tx, member.sectId, characterId, plot.cropKey, split.sect, SectInventoryLogType.FARM_REWARD, `Thu hoạch ${crop.name}`);
    await mutateContribution(tx, member.sectId, characterId, crop.contribution, "FARM_HARVEST", `Thu hoạch ${crop.name}`, "SectFarmPlot", plotId, `sect:farm:${plotId}`);
    await tx.sect.update({ where: { id: member.sectId }, data: { reputation: { increment: crop.reputation } } });
    await progressSectMissionObjective(tx, { characterId, eventType: "FARM_HARVESTED", itemKey: plot.cropKey, amount: split.personal });
    await progressSectMissionObjective(tx, { characterId, eventType: "ITEM_COLLECTED", itemKey: plot.cropKey, amount: split.personal });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId: characterId, type: SectLogType.FARM, message: `Thu hoạch ${totalYield} ${template?.name ?? crop.name}: cá nhân ${split.personal}, kho tông môn ${split.sect}.` } });
    return { alreadyClaimed: false, itemName: template?.name ?? crop.name, totalYield, ...split, contribution: crop.contribution, reputation: crop.reputation };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function startSectMining(db: Db, characterId: string, mineKey: string, now = new Date()) {
  const mine = mineDefinition(mineKey);
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    assertUnlocked(member.sect.rank, mine.requiredRank, "Linh Khoáng");
    const facility = await ensureFacility(tx, member.sectId, member.sect.rank, SectFacilityType.MINE);
    if (facility.currentCapacity <= 0) throw new SectError("MINE_LOCKED", "Tông môn chưa khai phá khoáng mạch.");
    const activeForMember = await tx.sectMineWork.findFirst({ where: { workerId: characterId, status: SectWorkStatus.ACTIVE } });
    if (activeForMember) throw new SectError("ACTIVE_MINE_WORK", "Bạn đang khai thác khoáng mạch.");
    const activeWorkers = await tx.sectMineWork.count({ where: { sectId: member.sectId, mineKey, status: SectWorkStatus.ACTIVE } });
    if (activeWorkers >= mine.workerLimit * facility.currentCapacity) throw new SectError("MINE_FULL", "Khoáng mạch đã đủ người khai thác.");
    const work = await tx.sectMineWork.create({ data: { sectId: member.sectId, workerId: characterId, mineKey, startedAt: now, readyAt: new Date(now.getTime() + mine.durationMinutes * 60_000) } });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId: characterId, type: SectLogType.MINE, message: `Bắt đầu khai thác ${mine.name}.` } });
    return work;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function claimSectMining(db: Db, characterId: string, workId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    const work = await tx.sectMineWork.findUnique({ where: { id: workId } });
    if (!work || work.sectId !== member.sectId || work.workerId !== characterId) throw new SectError("MINE_WORK_NOT_FOUND", "Không tìm thấy lượt khai thác.");
    if (work.status === SectWorkStatus.CLAIMED) return { alreadyClaimed: true, reward: work.reward };
    if (work.status !== SectWorkStatus.ACTIVE || work.readyAt > now) throw new SectError("MINE_NOT_READY", "Khoáng mạch chưa khai thác xong.");
    const mine = mineDefinition(work.mineKey);
    const preview = previewSectMineReward(member.sect.rank, work.mineKey);
    const totalYield = preview.totalYield;
    const split = preview.split;
    const rareRewards = [];
    for (const rare of mine.rareDrops) {
      if (deterministicRollBps(`${work.id}:${rare.key}`) < rare.chanceBps) {
        await grantItem(tx, characterId, rare.key, rare.quantity);
        rareRewards.push({ key: rare.key, quantity: rare.quantity });
      }
    }
    const reward = { totalYield, split, resourceKey: mine.resourceKey, rareRewards };
    const updated = await tx.sectMineWork.updateMany({ where: { id: work.id, status: SectWorkStatus.ACTIVE, readyAt: { lte: now } }, data: { status: SectWorkStatus.CLAIMED, claimedAt: now, reward: reward as Prisma.InputJsonValue } });
    if (updated.count !== 1) return { alreadyClaimed: true, reward: work.reward };
    const template = await grantItem(tx, characterId, mine.resourceKey, split.personal);
    await grantSectItem(tx, member.sectId, characterId, mine.resourceKey, split.sect, SectInventoryLogType.MINE_REWARD, `Khai thác ${mine.name}`);
    await mutateContribution(tx, member.sectId, characterId, mine.contribution, "MINING_COMPLETE", `Khai thác ${mine.name}`, "SectMineWork", work.id, `sect:mine:${work.id}`);
    await tx.sect.update({ where: { id: member.sectId }, data: { reputation: { increment: mine.reputation } } });
    await progressSectMissionObjective(tx, { characterId, eventType: "RESOURCE_MINED", itemKey: mine.resourceKey, amount: split.personal });
    await progressSectMissionObjective(tx, { characterId, eventType: "ITEM_COLLECTED", itemKey: mine.resourceKey, amount: split.personal });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId: characterId, type: SectLogType.MINE, message: `Khai thác ${totalYield} ${template?.name ?? mine.resourceKey}: cá nhân ${split.personal}, kho tông môn ${split.sect}.` } });
    return { alreadyClaimed: false, itemName: template?.name ?? mine.resourceKey, totalYield, ...split, rareRewards, contribution: mine.contribution, reputation: mine.reputation };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function assignSectCave(db: Db, actorId: string, caveId: string, targetCharacterId: string) {
  return db.$transaction(async (tx) => {
    const actor = await assertSectMember(tx, actorId);
    await assertSectPermission(tx, actorId, actor.sectId, "MANAGE_CAVES");
    const [cave, target] = await Promise.all([
      tx.sectCave.findUnique({ where: { id: caveId } }),
      tx.sectMember.findUnique({ where: { characterId: targetCharacterId }, include: { character: { include: { realmStage: { include: { realm: true } } } } } })
    ]);
    if (!cave || cave.sectId !== actor.sectId) throw new SectError("CAVE_NOT_FOUND", "Không tìm thấy Động Phủ.");
    if (!target || target.sectId !== actor.sectId) throw new SectError("TARGET_NOT_IN_SECT", "Người nhận không thuộc tông môn.");
    if (target.character.realmStage.realm.order < cave.requiredRealmOrder) throw new SectError("REALM_REQUIREMENT_NOT_MET", "Cảnh giới chưa đủ để nhận Động Phủ này.");
    if (!sectCaveConfig.allowMultiplePerCharacter) await tx.sectCave.updateMany({ where: { sectId: actor.sectId, assignedCharacterId: targetCharacterId }, data: { assignedCharacterId: null } });
    const updated = await tx.sectCave.updateMany({ where: { id: caveId, sectId: actor.sectId }, data: { assignedCharacterId: targetCharacterId } });
    if (updated.count !== 1) throw new SectError("CAVE_ASSIGN_CONFLICT", "Động Phủ đã thay đổi trạng thái.");
    await tx.sectLog.create({ data: { sectId: actor.sectId, actorId, type: SectLogType.CAVE, message: `Phân ${cave.name} cho ${target.character.name}.` } });
    return { assigned: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function unassignSectCave(db: Db, actorId: string, caveId: string) {
  return db.$transaction(async (tx) => {
    const actor = await assertSectMember(tx, actorId);
    await assertSectPermission(tx, actorId, actor.sectId, "MANAGE_CAVES");
    const cave = await tx.sectCave.findUnique({ where: { id: caveId }, include: { assignedCharacter: true } });
    if (!cave || cave.sectId !== actor.sectId) throw new SectError("CAVE_NOT_FOUND", "Không tìm thấy Động Phủ.");
    await tx.sectCave.update({ where: { id: caveId }, data: { assignedCharacterId: null } });
    await tx.sectLog.create({ data: { sectId: actor.sectId, actorId, type: SectLogType.CAVE, message: `Thu hồi ${cave.name}${cave.assignedCharacter ? ` từ ${cave.assignedCharacter.name}` : ""}.` } });
    return { unassigned: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function startSectCaveCultivation(db: Db, characterId: string, caveId: string, minutes: number, now = new Date()) {
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    const cave = getSectCaveBenefit(member.role, member.sect.rank);
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { spiritualRoot: true, realmStage: { include: { realm: true } } } });
    const energy = currentEnergy(character, now);
    const cost = cultivationEnergyCost(minutes);
    if (energy < cost) throw new SectError("NO_ENERGY", "Không đủ Thể Lực để bế quan.");
    const active = await tx.cultivationActivity.findFirst({ where: { characterId, status: "ACTIVE" } });
    if (active) throw new SectError("ACTIVE_ACTIVITY", "Bạn đang có hoạt động tu luyện.");
    await tx.character.update({ where: { id: characterId }, data: { energyStored: energy - cost, energyUpdatedAt: now } });
    const multiplierBps = character.spiritualRoot.multiplierBps + cave.cultivationBonusBps;
    const activity = await tx.cultivationActivity.create({
      data: {
        characterId,
        startedAt: now,
        endsAt: new Date(now.getTime() + minutes * 60_000),
        baseReward: cultivationBaseReward(minutes),
        multiplierBps,
        metadata: { source: "sect_cave", caveId, caveName: cave.name, caveBonusBps: cave.cultivationBonusBps, role: member.role, sectRank: member.sect.rank }
      }
    });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId: characterId, type: SectLogType.CAVE, message: `Vào ${cave.name} bế quan, linh khí tăng ${Math.round(cave.cultivationBonusBps / 100)}%.` } });
    return activity;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function unlockRankLibraryTechniques(tx: Tx, sectId: string, rank: number) {
  const config = getSectRank(rank);
  const techniques = await tx.technique.findMany({ where: { rarity: { in: config.techniqueRarities as never[] }, realmOrder: { lte: Math.max(0, 5 - rank) } }, take: 8, orderBy: [{ rarity: "asc" }, { name: "asc" }] });
  for (const technique of techniques) {
    await tx.sectLibraryTechnique.upsert({
      where: { sectId_techniqueId: { sectId, techniqueId: technique.id } },
      update: {},
      create: { sectId, techniqueId: technique.id, accessRole: rank <= 4 ? SectRoleName.INNER : SectRoleName.OUTER, requiredRealmOrder: technique.realmOrder, contributionCost: sectLibraryConfig.baseContributionCostByRarity[String(technique.rarity)] ?? 1200 }
    });
  }
}

export async function exchangeSectTechnique(db: Db, characterId: string, libraryId: string) {
  return db.$transaction(async (tx) => {
    const member = await assertSectMember(tx, characterId);
    const entry = await tx.sectLibraryTechnique.findUnique({ where: { id: libraryId }, include: { technique: true } });
    if (!entry || entry.sectId !== member.sectId) throw new SectError("TECHNIQUE_NOT_FOUND", "Công pháp không thuộc Tàng Kinh Các.");
    const roleOrder = sectRoles[member.role].order;
    if (roleOrder > sectRoles[entry.accessRole].order) throw new SectError("SECT_ROLE_REQUIRED", "Chức vụ chưa đủ để lĩnh ngộ công pháp này.");
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { realmStage: { include: { realm: true } }, techniques: true } });
    if (character.realmStage.realm.order < entry.requiredRealmOrder) throw new SectError("REALM_REQUIREMENT_NOT_MET", "Cảnh giới chưa đủ để lĩnh ngộ.");
    if (character.techniques.some((item) => item.techniqueId === entry.techniqueId)) throw new SectError("TECHNIQUE_OWNED", "Bạn đã sở hữu công pháp này.");
    await mutateContribution(tx, member.sectId, characterId, -entry.contributionCost, "LIBRARY_EXCHANGE", `Lĩnh ngộ ${entry.technique.name}`, "SectLibraryTechnique", entry.id, `sect:library:${entry.id}:${characterId}`);
    await tx.characterTechnique.create({ data: { characterId, techniqueId: entry.techniqueId } });
    await tx.sectLog.create({ data: { sectId: member.sectId, actorId: characterId, type: SectLogType.LIBRARY, message: `Lĩnh ngộ ${entry.technique.name} từ Tàng Kinh Các.` } });
    return { techniqueName: entry.technique.name, contributionCost: entry.contributionCost };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

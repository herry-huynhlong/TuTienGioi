import { Prisma, type PrismaClient, ActivityStatus, Currency, WalletTxType, ListingStatus, ItemCategory, RecipeUnlockType } from "@ttg/db";
import { calculateCultivationReward, calculateTrainingGain, cultivationBaseReward, cultivationDurationConfigs, cultivationEnergyCost, currentEnergy, gameDurationToRealMs, isCultivationDurationKey, isTrainingDurationKey, isTrainingType, locationActivityConfigs, parseEncounterTable, simulateCombat, trainingDurationConfigs, trainingStatCap, trainingTypeConfigs, travelDurationSeconds, type CultivationDurationKey, type LocationActivityMode, type TrainingDurationKey, type TrainingTypeKey } from "./rules.js";
import { currentSystemMarketPeriod, getItemEconomy, marketListingMaxQuantity, stockForSystemMarketItem } from "./items.js";
import { getItemUsageDefinition, type ItemEffectSpec } from "./item-effects.js";
import { pickWeighted, seededRng, seedFromString } from "./rng.js";
import { recordOnboardingEvent } from "./onboarding.js";
import { progressQuestEvent } from "./quests.js";
import { professionExpGain, professionRankOrder, professionStationServices, promoteProfessionRank } from "./professions.js";
import { canAccessSectLocation } from "./sect-access.js";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient;

export class GameError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function activityModeFromReward(value: unknown): LocationActivityMode {
  const mode = parseJsonRecord(value).mode;
  return mode === "hunt" || mode === "gather" || mode === "explore" ? mode : "explore";
}

function numberFromRecord(value: Record<string, unknown>, key: string, fallback = 0) {
  const raw = value[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}

async function nextCultivationCap(tx: Tx, character: { realmStage: { requiredCultivation: bigint; realm: { order: number }; order: number } }) {
  const next = await tx.realmStage.findFirst({
    where: {
      OR: [
        { realm: { order: character.realmStage.realm.order }, order: character.realmStage.order + 1 },
        { realm: { order: character.realmStage.realm.order + 1 }, order: 0 }
      ]
    },
    orderBy: [{ realm: { order: "asc" } }, { order: "asc" }]
  });
  return next?.requiredCultivation ?? character.realmStage.requiredCultivation;
}

async function addCultivationClamped(tx: Tx, characterId: string, reward: bigint) {
  const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { realmStage: { include: { realm: true } } } });
  const cap = await nextCultivationCap(tx, character);
  const room = cap > character.cultivation ? cap - character.cultivation : 0n;
  const applied = reward > room ? room : reward;
  if (applied > 0n) await tx.character.update({ where: { id: characterId }, data: { cultivation: { increment: applied } } });
  return { applied, cap, reachedCap: character.cultivation + applied >= cap };
}

function partialCultivationReward(job: { startedAt: Date; endsAt: Date; baseReward: bigint; multiplierBps: number }, now: Date) {
  const totalMs = Math.max(1, job.endsAt.getTime() - job.startedAt.getTime());
  const elapsedMs = Math.max(0, Math.min(now.getTime() - job.startedAt.getTime(), totalMs));
  const planned = calculateCultivationReward(job.baseReward, job.multiplierBps);
  return { reward: (planned * BigInt(elapsedMs)) / BigInt(totalMs), elapsedSeconds: Math.floor(elapsedMs / 1000), planned };
}

async function createHuntSession(tx: Tx, zoneId: string, activityId: string, durationSeconds: number) {
  const zone = await tx.zone.findUniqueOrThrow({ where: { id: zoneId } });
  const monsterTable = parseEncounterTable(zone.monsterTable);
  const checkpoints = [0.2, 0.55, 0.8].map((ratio, index) => {
    const rng = seededRng(seedFromString(`${activityId}:hunt:${index}`));
    const hasCreature = rng() < (index === 0 ? 0.9 : 0.65);
    const monster = hasCreature ? pickWeighted(monsterTable, rng).key : null;
    return { id: `cp-${index + 1}`, atMs: Math.floor(durationSeconds * 1000 * ratio), type: monster ? "creature" : "trace", monster, resolved: false };
  });
  return { durationSeconds, activeElapsedMs: 0, checkpoints, stats: { detected: 0, defeated: 0, skipped: 0 }, log: ["Bạn bắt đầu men theo dấu vết trong khu vực."] };
}

function huntSessionFromReward(value: unknown) {
  const reward = parseJsonRecord(value);
  const session = parseJsonRecord(reward.session);
  return { reward, session };
}

function nextHuntCheckpoint(session: Record<string, unknown>) {
  const elapsed = numberFromRecord(session, "activeElapsedMs");
  const checkpoints = Array.isArray(session.checkpoints) ? session.checkpoints.map(parseJsonRecord) : [];
  return checkpoints.find((checkpoint) => checkpoint.resolved !== true && numberFromRecord(checkpoint, "atMs") > elapsed);
}

function huntEndsAt(now: Date, session: Record<string, unknown>) {
  const elapsed = numberFromRecord(session, "activeElapsedMs");
  const durationMs = numberFromRecord(session, "durationSeconds", 60) * 1000;
  const next = nextHuntCheckpoint(session);
  const targetMs = next ? numberFromRecord(next, "atMs") : durationMs;
  return new Date(now.getTime() + Math.max(0, targetMs - elapsed));
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseIngredientRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => parseJsonRecord(entry)).map((entry) => {
    const itemId = typeof entry.itemId === "string" ? entry.itemId : null;
    const key = typeof entry.key === "string" ? entry.key : null;
    const quantity = typeof entry.quantity === "number" ? Math.floor(entry.quantity) : typeof entry.qty === "number" ? Math.floor(entry.qty) : 0;
    return itemId && quantity > 0 ? { itemId, key, quantity } : null;
  }).filter((row): row is { itemId: string; key: string | null; quantity: number } => Boolean(row));
}

function dropQuantity(row: Record<string, unknown>, rng: () => number) {
  const minQuantity = typeof row.minQuantity === "number" ? Math.max(1, Math.floor(row.minQuantity)) : 1;
  const maxQuantity = typeof row.maxQuantity === "number" ? Math.max(minQuantity, Math.floor(row.maxQuantity)) : minQuantity;
  return minQuantity + Math.floor(rng() * (maxQuantity - minQuantity + 1));
}

async function resolveMonsterLoot(tx: Tx, characterId: string, monster: { key: string; lootTable: unknown }, seed: number | string) {
  const table = Array.isArray(monster.lootTable) ? monster.lootTable : [];
  const rng = seededRng(typeof seed === "number" ? seed : seedFromString(seed));
  const items: Array<{ key: string; name: string; quantity: number }> = [];
  const linhThach = BigInt(8 + Math.floor(rng() * 18));
  for (const row of table) {
    const data = parseJsonRecord(row);
    const key = typeof data.key === "string" ? data.key : null;
    const weight = typeof data.weight === "number" ? data.weight : 100;
    if (!key || rng() * 100 >= weight) continue;
    const template = await tx.itemTemplate.findUnique({ where: { key } });
    if (!template) continue;
    const quantity = dropQuantity(data, rng);
    await grantStackableItem(tx, characterId, template.id, quantity);
    await progressQuestEvent(tx, { characterId, eventType: "ITEM_OBTAINED", itemKey: key, amount: quantity });
    items.push({ key, name: template.name, quantity });
  }
  if (linhThach > 0n) await creditWallet(tx, characterId, Currency.LINH_THACH, linhThach, WalletTxType.REWARD, "Monster", monster.key, `monster-loot:${monster.key}:${seed}`);
  return { linhThach: linhThach.toString(), items };
}

async function addItemToInventory(tx: Tx, characterId: string, templateId: string, quantity: number, options: { quality?: number; enhancement?: number; bound?: boolean; customModifiers?: unknown } = {}) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new GameError("INVALID_QUANTITY", "Số lượng vật phẩm không hợp lệ.");
  const template = await tx.itemTemplate.findUniqueOrThrow({ where: { id: templateId } });
  if (!template.stackable) {
    const created = [];
    for (let i = 0; i < quantity; i += 1) {
      created.push(await tx.itemInstance.create({ data: { ownerId: characterId, templateId, quantity: 1, quality: options.quality ?? 1, enhancement: options.enhancement ?? 0, bound: options.bound ?? false, customModifiers: inputJson(parseJsonRecord(options.customModifiers)) } }));
    }
    return created.at(-1)!;
  }
  const quality = options.quality ?? 1;
  const enhancement = options.enhancement ?? 0;
  const bound = options.bound ?? false;
  const customModifiers = parseJsonRecord(options.customModifiers);
  let remaining = quantity;
  const candidates = await tx.itemInstance.findMany({
    where: {
      ownerId: characterId,
      templateId,
      quality,
      enhancement,
      bound,
      equippedSlot: null,
      durability: null,
      listings: { none: { status: ListingStatus.ACTIVE } }
    },
    orderBy: { createdAt: "asc" }
  });
  let last = null;
  for (const stack of candidates) {
    if (remaining <= 0) break;
    if (JSON.stringify(parseJsonRecord(stack.customModifiers)) !== JSON.stringify(customModifiers)) continue;
    const room = Math.max(0, template.maxStack - stack.quantity);
    if (room <= 0) continue;
    const add = Math.min(room, remaining);
    last = await tx.itemInstance.update({ where: { id: stack.id }, data: { quantity: { increment: add } } });
    remaining -= add;
  }
  while (remaining > 0) {
    const add = Math.min(template.maxStack, remaining);
    last = await tx.itemInstance.create({ data: { ownerId: characterId, templateId, quantity: add, quality, enhancement, bound, customModifiers: inputJson(customModifiers) } });
    remaining -= add;
  }
  return last!;
}

async function removeItemFromInventory(tx: Tx, characterId: string, itemId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new GameError("INVALID_QUANTITY", "Số lượng vật phẩm không hợp lệ.");
  const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: ListingStatus.ACTIVE } } } });
  if (!item || item.ownerId !== characterId || item.quantity <= 0) throw new GameError("ITEM_NOT_FOUND", "Không tìm thấy vật phẩm.");
  if (item.equippedSlot) throw new GameError("ITEM_EQUIPPED", "Vật phẩm đang trang bị.");
  if (item.listings.length > 0) throw new GameError("ITEM_LISTED", "Vật phẩm đang rao bán.");
  if (quantity > item.quantity) throw new GameError("INVALID_QUANTITY", "Không đủ số lượng vật phẩm.");
  if (quantity === item.quantity) {
    await tx.itemInstance.delete({ where: { id: item.id } });
  } else {
    await tx.itemInstance.update({ where: { id: item.id }, data: { quantity: { decrement: quantity } } });
  }
  return item;
}

async function consumeTemplateQuantity(tx: Tx, characterId: string, templateId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new GameError("INVALID_QUANTITY", "Số lượng vật phẩm không hợp lệ.");
  const stacks = await tx.itemInstance.findMany({
    where: {
      ownerId: characterId,
      templateId,
      equippedSlot: null,
      listings: { none: { status: ListingStatus.ACTIVE } }
    },
    orderBy: { createdAt: "asc" }
  });
  const total = stacks.reduce((sum, stack) => sum + stack.quantity, 0);
  if (total < quantity) throw new GameError("MISSING_INGREDIENT", "Không đủ nguyên liệu chế tạo.");
  let remaining = quantity;
  for (const stack of stacks) {
    if (remaining <= 0) break;
    const take = Math.min(stack.quantity, remaining);
    if (take === stack.quantity) await tx.itemInstance.delete({ where: { id: stack.id } });
    else await tx.itemInstance.update({ where: { id: stack.id }, data: { quantity: { decrement: take } } });
    remaining -= take;
  }
}

async function grantStackableItem(tx: Tx, characterId: string, templateId: string, quantity: number, options: { quality?: number; enhancement?: number; bound?: boolean; customModifiers?: unknown } = {}) {
  return addItemToInventory(tx, characterId, templateId, quantity, options);
}

async function progressSectMissionEvent(tx: Tx, input: { characterId: string; eventType: "MONSTER_KILLED" | "ITEM_COLLECTED" | "LOCATION_VISITED" | "RESOURCE_MINED" | "ITEM_DONATED" | "FARM_HARVESTED" | "CRAFT_COMPLETED" | "INTERACT_WORLD_OBJECT"; monsterKey?: string; itemKey?: string; recipeKey?: string; professionKey?: string; worldObjectKey?: string; locationId?: string | null; amount?: number }) {
  const { progressSectMissionObjective } = await import("./sects.js");
  return progressSectMissionObjective(tx, input);
}

async function mutateWallet(tx: Tx, characterId: string, currency: Currency, amount: bigint, type: WalletTxType, referenceType?: string, referenceId?: string, idempotencyKey?: string) {
  if (amount === 0n) throw new GameError("INVALID_AMOUNT", "Số tiền không hợp lệ.");
  const existing = idempotencyKey ? await tx.walletTransaction.findUnique({ where: { characterId_currency_idempotencyKey: { characterId, currency, idempotencyKey } } }) : null;
  if (existing) return existing;
  const field = currency === Currency.LINH_THACH ? "linhThach" : "tienNgoc";
  const before = await tx.character.findUniqueOrThrow({ where: { id: characterId }, select: { linhThach: true, tienNgoc: true } });
  const balanceBefore = before[field];
  const balanceAfter = balanceBefore + amount;
  if (balanceAfter < 0n) throw new GameError("INSUFFICIENT_FUNDS", "Không đủ Linh Thạch.");
  await tx.character.update({ where: { id: characterId }, data: { [field]: balanceAfter } });
  return tx.walletTransaction.create({ data: { characterId, currency, type, amount, balanceBefore, balanceAfter, referenceType: referenceType ?? null, referenceId: referenceId ?? null, idempotencyKey: idempotencyKey ?? null } });
}

function isClient(db: Db | Tx): db is Db {
  return "$transaction" in db;
}

function modifierValue(value: unknown, key: string): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function payloadNumber(effect: ItemEffectSpec, key: string): number {
  const raw = effect.payload[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function effectMessage(effect: ItemEffectSpec, value: number) {
  if (effect.type === "HEAL_HP") return `hồi ${value} Sinh Lực`;
  if (effect.type === "RESTORE_QI") return `hồi ${value} Chân Nguyên`;
  if (effect.type === "RESTORE_ENERGY") return `hồi ${value} Thể Lực`;
  if (effect.type === "GAIN_CULTIVATION") return `nhận ${value} Tu Vi`;
  if (effect.type === "BUFF_STAT") return "kích hoạt hiệu ứng tạm thời";
  return "kích hoạt hiệu ứng";
}

function percentAmount(currentMax: number, percent: number) {
  return Math.max(0, Math.floor((currentMax * percent) / 100));
}

function currentEnergySnapshot(character: { energyStored: number; energyMax: number; energyUpdatedAt: Date }, now: Date) {
  return currentEnergy(character, now);
}

async function refreshCharacterBuff(tx: Tx, characterId: string, sourceId: string, effect: ItemEffectSpec, now: Date) {
  const durationSeconds = payloadNumber(effect, "durationSeconds");
  const value = parseJsonRecord(effect.payload.value);
  const effectType = typeof effect.payload.effectType === "string" ? effect.payload.effectType : "BUFF";
  const duration = durationSeconds > 0 ? durationSeconds : 3600;
  const endsAt = new Date(now.getTime() + duration * 1000);
  await tx.characterBuff.upsert({
    where: { characterId_sourceType_sourceId_effectType: { characterId, sourceType: "ITEM", sourceId, effectType } },
    update: { value: inputJson(value), startedAt: now, endsAt, stackRule: "REFRESH_DURATION" },
    create: { characterId, sourceType: "ITEM", sourceId, effectType, value: inputJson(value), startedAt: now, endsAt, stackRule: "REFRESH_DURATION" }
  });
}

function itemStatDelta(value: unknown, direction: 1 | -1) {
  return {
    attack: modifierValue(value, "attack") * direction,
    defense: modifierValue(value, "defense") * direction,
    speed: modifierValue(value, "speed") * direction,
    spirit: modifierValue(value, "spirit") * direction,
    maxHp: modifierValue(value, "hp") * direction,
    maxQi: modifierValue(value, "qi") * direction
  };
}

async function applyEquipmentDelta(tx: Tx, characterId: string, modifiers: unknown, direction: 1 | -1) {
  const delta = itemStatDelta(modifiers, direction);
  const current = await tx.character.findUniqueOrThrow({ where: { id: characterId }, select: { hp: true, qi: true, maxHp: true, maxQi: true } });
  const nextMaxHp = Math.max(1, current.maxHp + delta.maxHp);
  const nextMaxQi = Math.max(1, current.maxQi + delta.maxQi);
  await tx.character.update({
    where: { id: characterId },
    data: {
      attack: { increment: delta.attack },
      defense: { increment: delta.defense },
      speed: { increment: delta.speed },
      spirit: { increment: delta.spirit },
      maxHp: nextMaxHp,
      hp: Math.min(current.hp, nextMaxHp),
      maxQi: nextMaxQi,
      qi: Math.min(current.qi, nextMaxQi)
    }
  });
}

async function assertAtMarket(tx: Tx, characterId: string) {
  const character = await tx.character.findUnique({ where: { id: characterId }, select: { currentLocation: { select: { services: true } } } });
  if (!Array.isArray(character?.currentLocation?.services) || !character.currentLocation.services.includes("market")) throw new GameError("MARKET_LOCATION_REQUIRED", "Bạn cần tới Vạn Bảo Lâu hoặc địa điểm có giao dịch để mua bán vật phẩm.");
}

async function assertItemRequirements(tx: Tx, characterId: string, template: { bindRules: unknown }) {
  const economy = getItemEconomy(template as never);
  if (economy.requiredRealmOrder === null && economy.requiredSectRank === null) return;
  const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { realmStage: { include: { realm: true } }, sect: true } });
  if (economy.requiredRealmOrder !== null && character.realmStage.realm.order < economy.requiredRealmOrder) throw new GameError("REALM_REQUIREMENT_NOT_MET", "Bạn chưa đủ cảnh giới để mua vật phẩm này.");
  if (economy.requiredSectRank !== null && (!character.sect || character.sect.rank > economy.requiredSectRank)) throw new GameError("SECT_REQUIREMENT_NOT_MET", "Tông môn của bạn chưa đủ phẩm cấp để mua vật phẩm này.");
}

export async function creditWallet(db: Db | Tx, characterId: string, currency: Currency, amount: bigint, type: WalletTxType, referenceType?: string, referenceId?: string, idempotencyKey?: string) {
  if (amount <= 0n) throw new GameError("INVALID_AMOUNT", "Số tiền không hợp lệ.");
  return isClient(db) ? db.$transaction((tx) => mutateWallet(tx, characterId, currency, amount, type, referenceType, referenceId, idempotencyKey)) : mutateWallet(db, characterId, currency, amount, type, referenceType, referenceId, idempotencyKey);
}

export async function debitWallet(db: Db | Tx, characterId: string, currency: Currency, amount: bigint, type: WalletTxType, referenceType?: string, referenceId?: string, idempotencyKey?: string) {
  if (amount <= 0n) throw new GameError("INVALID_AMOUNT", "Số tiền không hợp lệ.");
  return isClient(db) ? db.$transaction((tx) => mutateWallet(tx, characterId, currency, -amount, type, referenceType, referenceId, idempotencyKey)) : mutateWallet(db, characterId, currency, -amount, type, referenceType, referenceId, idempotencyKey);
}

export async function previewTraining(db: Db | Tx, characterId: string, trainingType: TrainingTypeKey, duration: TrainingDurationKey) {
  if (!isTrainingType(trainingType)) throw new GameError("BAD_TRAINING_TYPE", "Loại rèn luyện không hợp lệ.");
  if (!isTrainingDurationKey(duration)) throw new GameError("BAD_DURATION", "Thời gian rèn luyện không hợp lệ.");
  const character = await db.character.findUniqueOrThrow({ where: { id: characterId }, include: { realmStage: { include: { realm: true } }, currentLocation: true } });
  return calculateTrainingPreview(character, trainingType, duration);
}

function trainingLocationModifierBps(character: { currentLocation?: { services?: string[]; kind?: string } | null }, trainingType: TrainingTypeKey) {
  const services = character.currentLocation?.services ?? [];
  const kind = character.currentLocation?.kind;
  if (services.includes("training")) return 11000;
  if (kind === "sect_land" && (trainingType === "SPIRIT" || trainingType === "BODY")) return 10500;
  return 10000;
}

function calculateTrainingPreview(character: { body: number; attack: number; defense: number; speed: number; spirit: number; realmStage: { order: number; realm: { order: number } }; currentLocation?: { services?: string[]; kind?: string; id?: string; name?: string } | null }, trainingType: TrainingTypeKey, duration: TrainingDurationKey) {
  const typeConfig = trainingTypeConfigs[trainingType];
  const durationConfig = trainingDurationConfigs[duration];
  const statBefore = character[typeConfig.statKey];
  const statCap = trainingStatCap(character.realmStage.realm.order, character.realmStage.order);
  const locationModifierBps = trainingLocationModifierBps(character, trainingType);
  const modifierBps = Math.max(0, Math.floor((typeConfig.modifierBps * locationModifierBps) / 10000));
  const finalGain = calculateTrainingGain({ stat: statBefore, statCap, baseGain: durationConfig.baseGain, modifierBps });
  return {
    trainingType,
    duration,
    typeConfig,
    durationConfig,
    statBefore,
    statCap,
    modifierBps,
    finalGain,
    locationModifierBps,
    capped: statBefore >= statCap
  };
}

export async function startTraining(db: Db, characterId: string, trainingType: TrainingTypeKey, duration: TrainingDurationKey, now = new Date()) {
  if (!isTrainingType(trainingType)) throw new GameError("BAD_TRAINING_TYPE", "Loại rèn luyện không hợp lệ.");
  if (!isTrainingDurationKey(duration)) throw new GameError("BAD_DURATION", "Thời gian rèn luyện không hợp lệ.");
  const character = await db.character.findUniqueOrThrow({ where: { id: characterId }, include: { realmStage: { include: { realm: true } }, currentLocation: true } });
  const [activeTraining, activeCultivation, activeExploration, activeTravel] = await Promise.all([
    db.trainingActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.cultivationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.explorationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.travel.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } })
  ]);
  if (activeTraining) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang rèn luyện.");
  if (activeCultivation) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang bế quan.");
  if (activeExploration) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang lịch luyện.");
  if (activeTravel) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang di chuyển.");
  const preview = calculateTrainingPreview(character, trainingType, duration);
  if (preview.finalGain <= 0) throw new GameError("TRAINING_CAP", "Chỉ số này đã đạt giới hạn rèn luyện hiện tại.");
  const energy = currentEnergy(character, now);
  if (energy < preview.durationConfig.energyCost) throw new GameError("NO_ENERGY", "Không đủ Thể Lực để rèn luyện.");
  return db.$transaction(async (tx) => {
    await tx.character.update({ where: { id: characterId }, data: { energyStored: energy - preview.durationConfig.energyCost, energyUpdatedAt: now } });
    const activity = await tx.trainingActivity.create({
      data: {
        characterId,
        trainingType,
        durationKey: duration,
        durationSeconds: preview.durationConfig.durationSeconds,
        startedAt: now,
        endsAt: new Date(now.getTime() + preview.durationConfig.durationSeconds * 1000),
        energyCost: preview.durationConfig.energyCost,
        baseGain: preview.durationConfig.baseGain,
        modifierBps: preview.modifierBps,
        finalGain: preview.finalGain,
        statBefore: preview.statBefore,
        statCap: preview.statCap,
        metadata: {
          label: preview.typeConfig.label,
          durationLabel: preview.durationConfig.label,
          statKey: preview.typeConfig.statKey,
          locationId: character.currentLocation?.id ?? null,
          locationName: character.currentLocation?.name ?? null,
          locationModifierBps: preview.locationModifierBps
        }
      }
    });
    await tx.gameLog.create({ data: { characterId, type: "training", message: `Bắt đầu rèn ${preview.typeConfig.label} trong ${preview.durationConfig.label}, tiêu hao ${preview.durationConfig.energyCost} Thể Lực.` } });
    return activity;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function claimTraining(db: Db, characterId: string, activityId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const activity = await tx.trainingActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.characterId !== characterId) throw new GameError("NOT_FOUND", "Không tìm thấy phiên rèn luyện.");
    if (activity.status === ActivityStatus.CLAIMED) throw new GameError("ALREADY_CLAIMED", "Kết quả rèn luyện đã được nhận.");
    if (activity.endsAt > now) throw new GameError("NOT_READY", "Phiên rèn luyện chưa hoàn thành.");
    const typeConfig = trainingTypeConfigs[activity.trainingType as TrainingTypeKey];
    if (!typeConfig) throw new GameError("BAD_TRAINING_TYPE", "Loại rèn luyện không hợp lệ.");
    const updated = await tx.trainingActivity.updateMany({
      where: { id: activityId, characterId, status: ActivityStatus.ACTIVE, endsAt: { lte: now } },
      data: { status: ActivityStatus.CLAIMED, claimedAt: now }
    });
    if (updated.count !== 1) throw new GameError("ALREADY_CLAIMED", "Kết quả rèn luyện đã được nhận.");
    if (activity.finalGain > 0) {
      await tx.character.update({ where: { id: characterId }, data: { [typeConfig.statKey]: { increment: activity.finalGain } } });
    }
    await tx.gameLog.create({ data: { characterId, type: "training", message: `Hoàn thành rèn ${typeConfig.label}, ${typeConfig.statKey} +${activity.finalGain}.`, metadata: { trainingType: activity.trainingType, duration: activity.durationKey, gain: activity.finalGain } } });
    return { trainingType: activity.trainingType, statKey: typeConfig.statKey, label: typeConfig.label, gain: activity.finalGain };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelTraining(db: Db, characterId: string, activityId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const updated = await tx.trainingActivity.updateMany({
      where: { id: activityId, characterId, status: ActivityStatus.ACTIVE },
      data: { status: ActivityStatus.CANCELLED, claimedAt: now }
    });
    if (updated.count !== 1) throw new GameError("CANNOT_CANCEL", "Không thể dừng phiên rèn luyện này.");
    await tx.gameLog.create({ data: { characterId, type: "training", message: "Bạn đã dừng phiên rèn luyện. Thể Lực đã tiêu hao không hoàn lại." } });
    return { cancelled: true };
  });
}

export async function startCraft(db: Db, characterId: string, recipeId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const recipe = await tx.recipe.findUnique({ where: { id: recipeId }, include: { profession: true, outputTemplate: true } });
    if (!recipe) throw new GameError("RECIPE_NOT_FOUND", "Không tìm thấy công thức.");
    if (recipe.unlockType !== RecipeUnlockType.PROFESSION_RANK) throw new GameError("RECIPE_LOCKED", "Công thức này cần mở khóa đặc biệt.");
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { currentLocation: true } });
    const services = character.currentLocation?.services ?? [];
    const allowedServices = professionStationServices[recipe.station] ?? [];
    if (allowedServices.length > 0 && !allowedServices.some((service) => services.includes(service))) throw new GameError("STATION_REQUIRED", "Bạn cần tới đúng cơ sở nghề nghiệp để chế tạo.");
    const characterProfession = await tx.characterProfession.upsert({
      where: { characterId_professionId: { characterId, professionId: recipe.professionId } },
      update: {},
      create: { characterId, professionId: recipe.professionId, rank: "APPRENTICE", level: 1, experience: 0 }
    });
    if (professionRankOrder(characterProfession.rank) < professionRankOrder(recipe.requiredRank)) throw new GameError("PROFESSION_RANK_REQUIRED", "Bậc nghề nghiệp chưa đủ để dùng công thức này.");
    const activeCraft = await tx.craftJob.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } });
    if (activeCraft) throw new GameError("ACTIVE_CRAFT", "Bạn đang có một việc chế tạo đang chạy.");
    const ingredients = parseIngredientRows(recipe.ingredients);
    if (ingredients.length === 0) throw new GameError("BAD_RECIPE", "Công thức chưa có nguyên liệu hợp lệ.");
    for (const ingredient of ingredients) await consumeTemplateQuantity(tx, characterId, ingredient.itemId, ingredient.quantity);
    if (recipe.fee > 0n) await debitWallet(tx, characterId, Currency.LINH_THACH, recipe.fee, WalletTxType.CRAFT, "Recipe", recipe.id, `craft:fee:${recipe.id}:${characterId}:${now.getTime()}`);
    const craft = await tx.craftJob.create({
      data: {
        characterId,
        recipeId: recipe.id,
        startedAt: now,
        endsAt: new Date(now.getTime() + Math.ceil((recipe.craftMinutes * 60) / 24) * 1000),
        status: ActivityStatus.ACTIVE,
        outputTemplateId: recipe.outputTemplateId,
        outputQuantity: recipe.outputQuantity,
        ingredients: inputJson(ingredients),
        fee: recipe.fee,
        professionExp: recipe.professionExp
      }
    });
    await tx.gameLog.create({ data: { characterId, type: "profession", message: `Bắt đầu ${recipe.name}, tạo ${recipe.outputTemplate.name} x${recipe.outputQuantity}.` } });
    return craft;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function claimCraft(db: Db, characterId: string, craftJobId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const job = await tx.craftJob.findUnique({ where: { id: craftJobId }, include: { recipe: { include: { profession: true, outputTemplate: true } } } });
    if (!job || job.characterId !== characterId) throw new GameError("NOT_FOUND", "Không tìm thấy việc chế tạo.");
    if (job.status === ActivityStatus.CLAIMED) throw new GameError("ALREADY_CLAIMED", "Thành phẩm đã được nhận.");
    if (job.endsAt > now) throw new GameError("NOT_READY", "Việc chế tạo chưa hoàn thành.");
    const updated = await tx.craftJob.updateMany({
      where: { id: craftJobId, characterId, status: ActivityStatus.ACTIVE, endsAt: { lte: now } },
      data: { status: ActivityStatus.CLAIMED, claimedAt: now }
    });
    if (updated.count !== 1) throw new GameError("ALREADY_CLAIMED", "Thành phẩm đã được nhận.");
    const outputTemplateId = job.outputTemplateId ?? job.recipe.outputTemplateId;
    const outputQuantity = job.outputQuantity || job.recipe.outputQuantity || 1;
    await addItemToInventory(tx, characterId, outputTemplateId, outputQuantity);
    const characterProfession = await tx.characterProfession.upsert({
      where: { characterId_professionId: { characterId, professionId: job.recipe.professionId } },
      update: {},
      create: { characterId, professionId: job.recipe.professionId, rank: "APPRENTICE", level: 1, experience: 0 }
    });
    const gainedExp = professionExpGain(job.professionExp || job.recipe.professionExp, characterProfession.rank, job.recipe.requiredRank);
    const totalExperience = characterProfession.experience + gainedExp;
    const nextRank = promoteProfessionRank(characterProfession.rank, totalExperience);
    await tx.characterProfession.update({ where: { id: characterProfession.id }, data: { experience: totalExperience, rank: nextRank, level: professionRankOrder(nextRank) + 1 } });
    await progressSectMissionEvent(tx, { characterId, eventType: "CRAFT_COMPLETED", itemKey: job.recipe.outputTemplate.key, recipeKey: job.recipe.key, professionKey: job.recipe.profession.key, amount: outputQuantity });
    await progressQuestEvent(tx, { characterId, eventType: "ITEM_OBTAINED", itemKey: job.recipe.outputTemplate.key, amount: outputQuantity });
    await tx.gameLog.create({
      data: {
        characterId,
        type: "profession",
        message: `Hoàn thành ${job.recipe.name}, nhận ${job.recipe.outputTemplate.name} x${outputQuantity}, +${gainedExp} EXP ${job.recipe.profession.name}.`,
        metadata: {
          eventType: "CRAFT_COMPLETED",
          professionId: job.recipe.professionId,
          professionKey: job.recipe.profession.key,
          recipeId: job.recipeId,
          recipeKey: job.recipe.key,
          outputItemId: outputTemplateId,
          outputItemKey: job.recipe.outputTemplate.key,
          quantity: outputQuantity,
          craftJobId: job.id,
          completedAt: now.toISOString()
        } as Prisma.InputJsonValue
      }
    });
    return { job, output: job.recipe.outputTemplate, quantity: outputQuantity, gainedExp, rank: nextRank };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function startCultivation(db: Db, characterId: string, duration: CultivationDurationKey, now = new Date()) {
  if (!isCultivationDurationKey(duration)) throw new GameError("BAD_DURATION", "Thời gian tu luyện không hợp lệ.");
  const character = await db.character.findUniqueOrThrow({
    where: { id: characterId },
    include: {
      spiritualRoot: true,
      realmStage: { include: { realm: true } },
      currentLocation: { include: { zone: true } }
    }
  });
  const [activeCultivation, activeExploration, activeTravel, activeTraining] = await Promise.all([
    db.cultivationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.explorationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.travel.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.trainingActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } })
  ]);
  if (activeCultivation) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang có hoạt động tu luyện.");
  if (activeExploration) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang lịch luyện.");
  if (activeTravel) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang di chuyển.");
  if (activeTraining) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang rèn luyện.");
  const energy = currentEnergy(character, now);
  const cost = cultivationEnergyCost(duration);
  if (energy < cost) throw new GameError("NO_ENERGY", "Không đủ Thể Lực.");
  const baseReward = cultivationBaseReward(duration);
  return db.$transaction(async (tx) => {
    const cap = await nextCultivationCap(tx, character);
    if (character.cultivation >= cap) throw new GameError("CULTIVATION_CAP", "Bạn đã chạm bình cảnh. Hãy đột phá để tiếp tục tu luyện.");
    const locationBonusBps = character.currentLocation?.cultivationModifierBps ?? 0;
    const zoneBonusBps = character.currentLocation?.zone.dangerLevel ? Math.min(1200, character.currentLocation.zone.dangerLevel * 100) : 0;
    const multiplierBps = character.spiritualRoot.multiplierBps + locationBonusBps + zoneBonusBps;
    const plannedReward = calculateCultivationReward(baseReward, multiplierBps);
    const room = cap - character.cultivation;
    const plannedMs = gameDurationToRealMs(duration);
    const effectiveReward = plannedReward > room ? room : plannedReward;
    const effectiveMs = plannedReward > 0n && plannedReward > room ? Math.max(1000, Number((BigInt(plannedMs) * room) / plannedReward)) : plannedMs;
    const storedBaseReward = plannedReward > 0n && plannedReward > room ? ((baseReward * effectiveReward) + plannedReward - 1n) / plannedReward : baseReward;
    await tx.character.update({ where: { id: characterId }, data: { energyStored: energy - cost, energyUpdatedAt: now } });
    const activity = await tx.cultivationActivity.create({
      data: {
        characterId,
        startedAt: now,
        endsAt: new Date(now.getTime() + effectiveMs),
        baseReward: storedBaseReward,
        multiplierBps,
        metadata: {
          duration,
          plannedGameDays: cultivationDurationConfigs[duration].gameDays,
          plannedRealMs: plannedMs,
          effectiveRealMs: effectiveMs,
          plannedReward: plannedReward.toString(),
          effectiveReward: effectiveReward.toString(),
          locationId: character.currentLocationId,
          locationName: character.currentLocation?.name ?? null,
          locationBonusBps,
          zoneBonusBps,
          cappedByBottleneck: plannedReward > room
        }
      }
    });
    await recordOnboardingEvent(tx, characterId, "CULTIVATION_STARTED");
    return activity;
  });
}

export async function claimCultivation(db: Db, characterId: string, activityId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const job = await tx.cultivationActivity.findUnique({ where: { id: activityId } });
    if (!job || job.characterId !== characterId) throw new GameError("NOT_FOUND", "Không tìm thấy hoạt động.");
    if (job.status === ActivityStatus.CLAIMED) throw new GameError("ALREADY_CLAIMED", "Phần thưởng đã được nhận.");
    if (job.endsAt > now) throw new GameError("NOT_READY", "Hoạt động này chưa hoàn thành.");
    const reward = calculateCultivationReward(job.baseReward, job.multiplierBps);
    const updated = await tx.cultivationActivity.updateMany({
      where: { id: activityId, characterId, status: ActivityStatus.ACTIVE, endsAt: { lte: now } },
      data: { status: ActivityStatus.CLAIMED, claimedAt: now }
    });
    if (updated.count !== 1) throw new GameError("ALREADY_CLAIMED", "Phần thưởng đã được nhận.");
    const result = await addCultivationClamped(tx, characterId, reward);
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId } });
    await tx.gameLog.create({ data: { characterId, type: "cultivation", message: result.reachedCap ? `Nhận ${result.applied.toString()} Tu vi. Tu vi đã đạt ${result.cap.toString()}/${result.cap.toString()}, bạn đã chạm bình cảnh.` : `Nhận ${result.applied.toString()} Tu vi từ bế quan.` } });
    await tx.worldNews.create({ data: { title: `${character.name} hoàn thành tu luyện`, body: `${character.name} tích lũy thêm ${result.applied.toString()} Tu vi.`, category: "cultivation" } });
    await recordOnboardingEvent(tx, characterId, "CULTIVATION_CLAIMED");
    return { reward: result.applied, cultivation: character.cultivation };
  });
}

export async function cancelCultivation(db: Db, characterId: string, activityId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const job = await tx.cultivationActivity.findUnique({ where: { id: activityId } });
    if (!job || job.characterId !== characterId) throw new GameError("NOT_FOUND", "Không tìm thấy hoạt động.");
    const partial = partialCultivationReward(job, now);
    const updated = await tx.cultivationActivity.updateMany({
      where: { id: activityId, characterId, status: ActivityStatus.ACTIVE },
      data: { status: ActivityStatus.CANCELLED, claimedAt: now }
    });
    if (updated.count !== 1) throw new GameError("CANNOT_CANCEL", "Không thể hủy hoạt động này.");
    const result = await addCultivationClamped(tx, characterId, partial.reward);
    await tx.gameLog.create({ data: { characterId, type: "cultivation", message: result.reachedCap ? `Bạn kết thúc bế quan sau ${partial.elapsedSeconds} giây và nhận ${result.applied.toString()} Tu vi. Tu vi đã đạt ${result.cap.toString()}/${result.cap.toString()}, bạn đã chạm bình cảnh.` : `Bạn kết thúc bế quan sau ${partial.elapsedSeconds} giây và nhận ${result.applied.toString()} Tu vi.` } });
    return { cancelled: true, reward: result.applied };
  });
}

function breakthroughSupportFromItem(template: { key: string; name: string; category: ItemCategory; equipSlot: unknown; baseModifiers: unknown; bindRules: unknown }) {
  const usage = getItemUsageDefinition(template as never);
  if (usage.action !== "BREAKTHROUGH" || usage.runtime !== "CONTEXT_LOCKED") return null;
  const bonus = usage.effects.find((effect) => effect.type === "BREAKTHROUGH_BONUS");
  if (!bonus) return null;
  const bps = Math.max(0, Math.floor(numberFromRecord(bonus.payload, "bps")));
  const failurePenaltyReductionBps = Math.min(9000, Math.max(0, Math.floor(numberFromRecord(bonus.payload, "failurePenaltyReductionBps"))));
  if (bps <= 0 && failurePenaltyReductionBps <= 0) return null;
  return { itemKey: template.key, itemName: template.name, bps, failurePenaltyReductionBps };
}

async function consumeBreakthroughSupport(tx: Tx, characterId: string, itemInstanceId?: string | null) {
  if (!itemInstanceId) return null;
  const item = await tx.itemInstance.findUnique({
    where: { id: itemInstanceId },
    include: { template: true, listings: { where: { status: ListingStatus.ACTIVE }, take: 1 } }
  });
  if (!item || item.ownerId !== characterId) throw new GameError("ITEM_NOT_OWNED", "Bạn không sở hữu vật phẩm hỗ trợ này.");
  if (item.quantity < 1) throw new GameError("ITEM_EMPTY", "Vật phẩm hỗ trợ đã hết.");
  if (item.equippedSlot) throw new GameError("ITEM_EQUIPPED", "Không thể dùng trang bị đang mặc để hỗ trợ đột phá.");
  if (item.listings.length > 0) throw new GameError("ITEM_LISTED", "Vật phẩm đang bày bán không thể dùng để đột phá.");
  await assertItemRequirements(tx, characterId, item.template);
  const support = breakthroughSupportFromItem(item.template);
  if (!support) throw new GameError("ITEM_NOT_BREAKTHROUGH_SUPPORT", "Vật phẩm này không hỗ trợ đột phá.");
  const updated = await tx.itemInstance.updateMany({
    where: { id: item.id, ownerId: characterId, quantity: { gte: 1 }, equippedSlot: null, listings: { none: { status: ListingStatus.ACTIVE } } },
    data: { quantity: { decrement: 1 } }
  });
  if (updated.count !== 1) throw new GameError("ITEM_CONSUME_CONFLICT", "Vật phẩm đã thay đổi, vui lòng thử lại.");
  if (item.quantity <= 1) await tx.itemInstance.deleteMany({ where: { id: item.id, ownerId: characterId, quantity: { lte: 0 } } });
  return support;
}

export async function attemptBreakthrough(db: Db, characterId: string, supportItemInstanceIdOrRng?: string | null | (() => number), maybeRng = Math.random) {
  const supportItemInstanceId = typeof supportItemInstanceIdOrRng === "function" ? null : supportItemInstanceIdOrRng;
  const rng = typeof supportItemInstanceIdOrRng === "function" ? supportItemInstanceIdOrRng : maybeRng;
  return db.$transaction(async (tx) => {
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { realmStage: { include: { realm: true } } } });
    const next = await tx.realmStage.findFirst({
      where: {
        OR: [
          { realm: { order: character.realmStage.realm.order }, order: character.realmStage.order + 1 },
          { realm: { order: character.realmStage.realm.order + 1 }, order: 0 }
        ]
      },
      orderBy: [{ realm: { order: "asc" } }, { order: "asc" }]
    });
    if (!next) throw new GameError("MAX_REALM", "Bạn đã chạm đến cực hạn hiện tại.");
    if (character.cultivation < next.requiredCultivation) throw new GameError("NOT_ENOUGH_CULTIVATION", "Bạn chưa đủ tu vi.");
    const support = await consumeBreakthroughSupport(tx, characterId, supportItemInstanceId);
    const chance = Math.min(9500, character.realmStage.breakthroughChanceBps + character.luck * 30 + character.breakthroughBonusBps + (support?.bps ?? 0));
    if (Math.floor(rng() * 10000) < chance) {
      await tx.character.update({ where: { id: characterId }, data: { realmStageId: next.id, cultivation: 0n, maxHp: next.baseHp, maxQi: next.baseQi, hp: next.baseHp, qi: next.baseQi, lifespan: { increment: next.lifespanBonus }, breakthroughBonusBps: 0 } });
      await tx.worldNews.create({ data: { title: `${character.name} đột phá ${next.name}`, body: `${character.name} bước sang ${next.name}, đạo tâm vang vọng.`, category: "realm", permanent: true } });
      await tx.gameLog.create({ data: { characterId, type: "realm", message: support ? `Dùng ${support.itemName}, đột phá thành công ${next.name}.` : `Đột phá thành công ${next.name}.`, metadata: inputJson({ nextStageId: next.id, chanceBps: chance, support }) } });
      return { success: true, stage: next.name, chance, support };
    }
    const baseLoss = character.cultivation / 20n;
    const loss = support?.failurePenaltyReductionBps ? (baseLoss * BigInt(10000 - support.failurePenaltyReductionBps)) / 10000n : baseLoss;
    await tx.character.update({ where: { id: characterId }, data: { cultivation: { decrement: loss }, hp: Math.max(1, Math.floor(character.hp * 0.7)), breakthroughBonusBps: 0 } });
    await tx.gameLog.create({ data: { characterId, type: "realm", message: support ? `Dùng ${support.itemName}, đột phá thất bại, hao tổn ${loss.toString()} tu vi.` : `Đột phá thất bại, hao tổn ${loss.toString()} tu vi.`, metadata: inputJson({ chanceBps: chance, support, baseLoss: baseLoss.toString(), loss: loss.toString() }) } });
    return { success: false, loss, chance, support };
  });
}

export async function startExploration(db: Db, characterId: string, durationSeconds: number, mode: LocationActivityMode = "explore", now = new Date()) {
  const config = locationActivityConfigs[mode];
  if (!config || durationSeconds !== config.durationSeconds) throw new GameError("BAD_DURATION", "Thời gian hoạt động không hợp lệ.");
  const character = await db.character.findUniqueOrThrow({ where: { id: characterId }, include: { currentLocation: true } });
  const services = character.currentLocation?.services ?? [];
  if (mode === "explore" && !services.includes("explore")) throw new GameError("LOCATION_NOT_EXPLOREABLE", "Địa điểm hiện tại không phù hợp để khám phá.");
  if (mode === "hunt" && !services.includes("pve")) throw new GameError("LOCATION_NOT_HUNTABLE", "Địa điểm hiện tại không phù hợp để săn yêu.");
  if (mode === "gather" && !services.includes("resource")) throw new GameError("LOCATION_NOT_GATHERABLE", "Địa điểm hiện tại không có tài nguyên để thu thập.");
  const zoneId = character.currentLocation?.zoneId ?? character.locationId;
  if (!zoneId) throw new GameError("NO_LOCATION", "Bạn chưa có địa điểm.");
  const [activeExploration, activeCultivation, activeTravel, activeTraining] = await Promise.all([
    db.explorationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.cultivationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.travel.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.trainingActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } })
  ]);
  if (activeExploration) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang thám hiểm.");
  if (activeCultivation) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang bế quan.");
  if (activeTravel) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang di chuyển.");
  if (activeTraining) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang rèn luyện.");
  const energy = currentEnergy(character, now);
  const cost = config.energyCost;
  if (energy < cost) throw new GameError("NO_ENERGY", "Không đủ Thể Lực.");
  return db.$transaction(async (tx) => {
    await tx.character.update({ where: { id: characterId }, data: { energyStored: energy - cost, energyUpdatedAt: now } });
    const provisionalEndsAt = new Date(now.getTime() + durationSeconds * 1000);
    const activity = await tx.explorationActivity.create({ data: { characterId, zoneId, startedAt: now, endsAt: provisionalEndsAt, reward: { mode, locationId: character.currentLocation?.id ?? null } } });
    if (mode === "hunt") {
      const session = await createHuntSession(tx, zoneId, activity.id, durationSeconds);
      await tx.explorationActivity.update({ where: { id: activity.id }, data: { endsAt: huntEndsAt(now, session), reward: { mode, locationId: character.currentLocation?.id ?? null, session } } });
    }
    await recordOnboardingEvent(tx, characterId, "EXPLORATION_STARTED");
    return activity;
  });
}

export async function advanceExplorationActivity(db: Db, characterId: string, activityId: string, now = new Date()) {
  return db.$transaction(async (tx) => advanceExplorationActivityTx(tx, characterId, activityId, now));
}

async function advanceExplorationActivityTx(tx: Tx, characterId: string, activityId: string, now = new Date()) {
  const job = await tx.explorationActivity.findUnique({ where: { id: activityId } });
  if (!job || job.characterId !== characterId || job.status !== ActivityStatus.ACTIVE || job.endsAt > now) return job;
  const mode = activityModeFromReward(job.reward);
  if (mode !== "hunt") {
    const updated = await tx.explorationActivity.updateMany({
      where: { id: activityId, characterId, status: ActivityStatus.ACTIVE, endsAt: { lte: now } },
      data: { status: ActivityStatus.CLAIMED, claimedAt: now, eventKey: mode === "gather" ? "gather-resource" : "explore-result", reward: inputJson({ mode, resolving: true }) }
    });
    if (updated.count !== 1) return job;
    const zone = await tx.zone.findUniqueOrThrow({ where: { id: job.zoneId } });
    const rng = seededRng(seedFromString(`${job.id}:${mode}`));
    const roll = pickWeighted(parseEncounterTable(zone.resourceTable), rng);
    const template = await tx.itemTemplate.findUnique({ where: { key: roll.key } });
    if (!template) throw new GameError("RESOURCE_NOT_FOUND", "Tài nguyên khu vực chưa được cấu hình.");
    await addItemToInventory(tx, characterId, template.id, 1);
    await progressSectMissionEvent(tx, { characterId, eventType: "ITEM_COLLECTED", itemKey: roll.key, amount: 1 });
    await progressQuestEvent(tx, { characterId, eventType: "ITEM_OBTAINED", itemKey: roll.key, amount: 1 });
    await tx.explorationActivity.update({ where: { id: activityId }, data: { reward: inputJson({ mode, item: roll.key, quantity: 1 }) } });
    const verb = mode === "gather" ? "Thu thập" : "Khám phá";
    await tx.gameLog.create({ data: { characterId, type: "exploration", message: `${verb} nhận được ${template.name}.`, metadata: { mode, item: roll.key } } });
    await recordOnboardingEvent(tx, characterId, "EXPLORATION_COMPLETED");
    return job;
  }
  const { reward, session } = huntSessionFromReward(job.reward);
  const durationMs = numberFromRecord(session, "durationSeconds", 60) * 1000;
  const previousElapsed = numberFromRecord(session, "activeElapsedMs");
  const checkpoints = Array.isArray(session.checkpoints) ? session.checkpoints.map(parseJsonRecord) : [];
  const due = checkpoints.find((checkpoint) => checkpoint.resolved !== true && numberFromRecord(checkpoint, "atMs") > previousElapsed && numberFromRecord(checkpoint, "atMs") <= durationMs);
  if (due && typeof due.monster === "string") {
    const nextSession = { ...session, activeElapsedMs: numberFromRecord(due, "atMs"), pausedAt: now.toISOString(), pendingCheckpointId: due.id, log: [...(Array.isArray(session.log) ? session.log : []), "Bạn nghe tiếng động vang lên từ bụi cây phía trước."] };
    await tx.explorationActivity.update({ where: { id: activityId }, data: { status: ActivityStatus.COMPLETED, eventKey: "hunt-encounter", reward: inputJson({ ...reward, session: nextSession, monster: due.monster, pending: true }) } });
    await tx.gameLog.create({ data: { characterId, type: "encounter", message: "Bạn phát hiện một sinh vật trong lúc săn.", metadata: { monster: due.monster } } });
    await recordOnboardingEvent(tx, characterId, "MONSTER_ENCOUNTERED");
    return job;
  }
  const nextElapsed = due ? numberFromRecord(due, "atMs") : durationMs;
  const nextCheckpoints = checkpoints.map((checkpoint) => checkpoint.id === due?.id ? { ...checkpoint, resolved: true, outcome: "trace" } : checkpoint);
  const nextSession = { ...session, activeElapsedMs: nextElapsed, checkpoints: nextCheckpoints, log: [...(Array.isArray(session.log) ? session.log : []), "Dấu vết mờ dần trong lớp lá mục."] };
  if (nextElapsed >= durationMs) {
    await tx.explorationActivity.update({ where: { id: activityId }, data: { status: ActivityStatus.CLAIMED, claimedAt: now, eventKey: "hunt-complete", reward: inputJson({ ...reward, session: nextSession, summary: true }) } });
    await recordOnboardingEvent(tx, characterId, "EXPLORATION_COMPLETED");
    return job;
  }
  await tx.explorationActivity.update({ where: { id: activityId }, data: { startedAt: now, endsAt: huntEndsAt(now, nextSession), reward: inputJson({ ...reward, session: nextSession }) } });
  return job;
}

export async function claimExploration(db: Db, characterId: string, activityId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const job = await tx.explorationActivity.findUnique({ where: { id: activityId } });
    if (!job || job.characterId !== characterId) throw new GameError("NOT_FOUND", "Không tìm thấy chuyến thám hiểm.");
    if (job.status === ActivityStatus.CLAIMED) throw new GameError("ALREADY_CLAIMED", "Phần thưởng đã được nhận.");
    if (job.endsAt > now) throw new GameError("NOT_READY", "Chuyến thám hiểm chưa hoàn thành.");
    const mode = activityModeFromReward(job.reward);
    if (mode === "hunt") {
      await advanceExplorationActivityTx(tx, characterId, activityId, now);
      return { itemName: "Phiên săn" };
    }
    const updated = await tx.explorationActivity.updateMany({
      where: { id: activityId, characterId, status: ActivityStatus.ACTIVE, endsAt: { lte: now } },
      data: {
        status: ActivityStatus.CLAIMED,
        claimedAt: now,
        eventKey: mode === "gather" ? "gather-resource" : "explore-result",
        reward: inputJson({ mode, resolving: true })
      }
    });
    if (updated.count !== 1) throw new GameError("ALREADY_CLAIMED", "Phần thưởng đã được nhận.");
    const zone = await tx.zone.findUniqueOrThrow({ where: { id: job.zoneId } });
    const rng = seededRng(seedFromString(`${job.id}:${mode}`));
    const resourceTable = parseEncounterTable(zone.resourceTable);
    const roll = pickWeighted(resourceTable, rng);
    const template = await tx.itemTemplate.findUnique({ where: { key: roll.key } });
    const nextReward = { mode, item: roll.key, quantity: template ? 1 : 0 };
    await tx.explorationActivity.update({ where: { id: activityId }, data: { reward: inputJson(nextReward) } });
    if (!template) throw new GameError("RESOURCE_NOT_FOUND", "Tài nguyên khu vực chưa được cấu hình.");
    await addItemToInventory(tx, characterId, template.id, 1);
    await progressSectMissionEvent(tx, { characterId, eventType: "ITEM_COLLECTED", itemKey: roll.key, amount: 1 });
    await progressQuestEvent(tx, { characterId, eventType: "ITEM_OBTAINED", itemKey: roll.key, amount: 1 });
    const verb = mode === "gather" ? "Thu thập" : "Khám phá";
    await tx.gameLog.create({ data: { characterId, type: "exploration", message: `${verb} nhận được ${template.name}.`, metadata: { mode, item: roll.key } } });
    await recordOnboardingEvent(tx, characterId, "EXPLORATION_COMPLETED");
    return { itemName: template.name };
  });
}

export async function cancelExploration(db: Db, characterId: string, activityId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const updated = await tx.explorationActivity.updateMany({
      where: { id: activityId, characterId, status: ActivityStatus.ACTIVE },
      data: { status: ActivityStatus.CANCELLED, claimedAt: now }
    });
    if (updated.count !== 1) throw new GameError("CANNOT_CANCEL", "Hoạt động này không thể hủy.");
    await tx.gameLog.create({ data: { characterId, type: "exploration", message: "Bạn đã hủy hoạt động đang diễn ra." } });
    return { cancelled: true };
  });
}

export async function leaveExplorationEncounter(db: Db, characterId: string, activityId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const activity = await tx.explorationActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.characterId !== characterId || activity.status !== ActivityStatus.COMPLETED) throw new GameError("NOT_FOUND", "Không tìm thấy tình huống.");
    const reward = parseJsonRecord(activity.reward);
    if (reward.mode !== "hunt" || typeof reward.monster !== "string") throw new GameError("BAD_ENCOUNTER", "Tình huống không hợp lệ.");
    const session = parseJsonRecord(reward.session);
    if (Object.keys(session).length > 0) {
      const checkpoints = Array.isArray(session.checkpoints) ? session.checkpoints.map(parseJsonRecord) : [];
      const nextCheckpoints = checkpoints.map((checkpoint) => checkpoint.id === session.pendingCheckpointId ? { ...checkpoint, resolved: true, outcome: "skipped" } : checkpoint);
      const stats = parseJsonRecord(session.stats);
      const nextSession = { ...session, pausedAt: null, pendingCheckpointId: null, checkpoints: nextCheckpoints, stats: { ...stats, detected: numberFromRecord(stats, "detected") + 1, skipped: numberFromRecord(stats, "skipped") + 1 }, log: [...(Array.isArray(session.log) ? session.log : []), "Bạn tránh khỏi dấu vết yêu thú và tiếp tục đi săn."] };
      await tx.explorationActivity.update({ where: { id: activityId }, data: { status: ActivityStatus.ACTIVE, startedAt: now, endsAt: huntEndsAt(now, nextSession), reward: inputJson({ ...reward, pending: false, monster: null, session: nextSession }) } });
      await tx.gameLog.create({ data: { characterId, type: "encounter", message: "Bạn bỏ qua dấu vết yêu thú và tiếp tục săn." } });
      return { left: true };
    }
    await tx.explorationActivity.update({ where: { id: activityId }, data: { status: ActivityStatus.CLAIMED, claimedAt: now, reward: inputJson({ ...reward, pending: false, decision: "leave" }) } });
    await tx.gameLog.create({ data: { characterId, type: "encounter", message: "Bạn rút lui khỏi dấu vết yêu thú." } });
    return { left: true };
  });
}

function combatStateFromReward(value: Record<string, unknown>, monsterHp: number) {
  const state = parseJsonRecord(value.combatState);
  return {
    monsterHp: Math.max(0, Math.floor(numberFromRecord(state, "monsterHp", monsterHp))),
    playerShield: Math.max(0, Math.floor(numberFromRecord(state, "playerShield"))),
    playerDefenseBps: Math.floor(numberFromRecord(state, "playerDefenseBps")),
    playerSpeedBps: Math.floor(numberFromRecord(state, "playerSpeedBps")),
    playerStatusResistanceBps: Math.floor(numberFromRecord(state, "playerStatusResistanceBps")),
    enemySpeedBps: Math.floor(numberFromRecord(state, "enemySpeedBps")),
    usedGroups: stringArray(state.usedGroups),
    usedActionKeys: stringArray(state.usedActionKeys),
    log: stringArray(state.log)
  };
}

function modifiedStat(value: number, bps: number) {
  return Math.max(1, Math.floor((value * (10000 + bps)) / 10000));
}

function talismanDamage(effect: ItemEffectSpec, character: { spirit: number }, monster: { defense: number }) {
  const baseDamage = Math.max(0, Math.floor(numberFromRecord(effect.payload, "baseDamage")));
  const scaling = numberFromRecord(effect.payload, "scaling", 1);
  const hitCount = Math.max(1, Math.floor(numberFromRecord(effect.payload, "hitCount", 1)));
  let total = 0;
  for (let i = 0; i < hitCount; i++) {
    const raw = baseDamage + Math.floor(character.spirit * scaling);
    total += Math.max(1, raw - Math.floor(monster.defense * 0.45));
  }
  return { total, hitCount, element: typeof effect.payload.element === "string" ? effect.payload.element : "UNKNOWN" };
}

function applyShieldToHp(virtualRemainingHp: number, maxHp: number) {
  return Math.max(1, Math.min(maxHp, virtualRemainingHp));
}

async function consumeCombatItem(tx: Tx, characterId: string, itemId: string) {
  const updated = await tx.itemInstance.updateMany({
    where: { id: itemId, ownerId: characterId, quantity: { gte: 1 }, equippedSlot: null, listings: { none: { status: ListingStatus.ACTIVE } } },
    data: { quantity: { decrement: 1 } }
  });
  if (updated.count !== 1) throw new GameError("ITEM_CONSUME_CONFLICT", "Vật phẩm đã thay đổi, vui lòng thử lại.");
  await tx.itemInstance.deleteMany({ where: { id: itemId, ownerId: characterId, quantity: { lte: 0 } } });
}

async function findOwnedUtilityItem(tx: Tx, characterId: string, itemId: string, effectType: ItemEffectSpec["type"]) {
  const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: ListingStatus.ACTIVE }, take: 1 } } });
  if (!item || item.ownerId !== characterId) throw new GameError("ITEM_NOT_OWNED", "Bạn không sở hữu vật phẩm này.");
  if (item.quantity < 1) throw new GameError("ITEM_EMPTY", "Vật phẩm đã hết.");
  if (item.equippedSlot) throw new GameError("ITEM_EQUIPPED", "Không thể dùng trang bị đang mặc.");
  if (item.listings.length > 0) throw new GameError("ITEM_LISTED", "Vật phẩm đang bày bán.");
  const usage = getItemUsageDefinition(item.template);
  const effect = usage.effects.find((entry) => entry.type === effectType);
  if (!effect) throw new GameError("ITEM_EFFECT_UNSUPPORTED", "Vật phẩm này không phù hợp với hành động hiện tại.");
  return { item, usage, effect };
}

function effectGrade(effect: ItemEffectSpec) {
  return Math.max(0, Math.floor(numberFromRecord(effect.payload, "grade")));
}

export async function escapeExplorationEncounterWithItem(db: Db, characterId: string, activityId: string, itemId: string, actionKey?: string | null, now = new Date()) {
  return db.$transaction(async (tx) => {
    const activity = await tx.explorationActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.characterId !== characterId || activity.status !== ActivityStatus.COMPLETED) throw new GameError("NOT_FOUND", "Không tìm thấy encounter cần thoát.");
    const reward = parseJsonRecord(activity.reward);
    if (reward.mode !== "hunt" || typeof reward.monster !== "string" || reward.pending !== true) throw new GameError("BAD_ENCOUNTER", "Không có encounter thường để thoát.");
    if (reward.bossLocked === true || reward.questLocked === true || reward.escapeBlocked === true) throw new GameError("ESCAPE_BLOCKED", "Không thể bỏ chạy khỏi trận chiến này.");
    const state = combatStateFromReward(reward, 1);
    if (actionKey && state.usedActionKeys.includes(actionKey)) return { duplicate: true, escaped: true };
    const { item, effect } = await findOwnedUtilityItem(tx, characterId, itemId, "ESCAPE");
    if (effectGrade(effect) < 1) throw new GameError("ITEM_GRADE_TOO_LOW", "Phù này không đủ cấp để thoát encounter.");
    const session = parseJsonRecord(reward.session);
    await consumeCombatItem(tx, characterId, item.id);
    const nextReward = { ...reward, pending: false, monster: null, decision: "escaped", combatState: { ...state, usedActionKeys: actionKey ? [...state.usedActionKeys, actionKey] : state.usedActionKeys, log: [...state.log, `Bạn dùng ${item.template.name} thoát khỏi encounter.`] } };
    if (Object.keys(session).length > 0) {
      const checkpoints = Array.isArray(session.checkpoints) ? session.checkpoints.map(parseJsonRecord) : [];
      const nextCheckpoints = checkpoints.map((checkpoint) => checkpoint.id === session.pendingCheckpointId ? { ...checkpoint, resolved: true, outcome: "escaped" } : checkpoint);
      const stats = parseJsonRecord(session.stats);
      const nextSession = { ...session, pausedAt: null, pendingCheckpointId: null, checkpoints: nextCheckpoints, stats: { ...stats, detected: numberFromRecord(stats, "detected") + 1, skipped: numberFromRecord(stats, "skipped") + 1 }, log: [...(Array.isArray(session.log) ? session.log : []), `Bạn dùng ${item.template.name} độn địa thoát khỏi yêu thú.`] };
      await tx.explorationActivity.update({ where: { id: activityId }, data: { status: ActivityStatus.ACTIVE, startedAt: now, endsAt: huntEndsAt(now, nextSession), reward: inputJson({ ...nextReward, session: nextSession }) } });
    } else {
      await tx.explorationActivity.update({ where: { id: activityId }, data: { status: ActivityStatus.CLAIMED, claimedAt: now, reward: inputJson(nextReward) } });
    }
    await tx.gameLog.create({ data: { characterId, type: "WORLD_ITEM_USED", message: `Dùng ${item.template.name} thoát khỏi encounter.`, metadata: inputJson({ itemId: item.id, effectType: "ESCAPE", locationId: typeof reward.locationId === "string" ? reward.locationId : null, targetId: activityId, result: "ESCAPED", timestamp: now.toISOString() }) } });
    return { escaped: true, itemName: item.template.name };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function teleportWithItem(db: Db, characterId: string, itemId: string, destinationLocationId: string, actionKey?: string | null, now = new Date()) {
  return db.$transaction(async (tx) => {
    const character = await tx.character.findUniqueOrThrow({
      where: { id: characterId },
      include: { currentLocation: { include: { routesFrom: { where: { active: true }, include: { destination: { include: { zone: true } } } } } }, realmStage: { include: { realm: true } } }
    });
    if (!character.currentLocationId || !character.currentLocation) throw new GameError("NO_LOCATION", "Bạn chưa có địa điểm hiện tại.");
    if (destinationLocationId === character.currentLocationId) throw new GameError("CURRENT_LOCATION", "Bạn đang ở địa điểm này.");
    const [activeTravel, activeExploration, activeCultivation, activeTraining] = await Promise.all([
      tx.travel.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
      tx.explorationActivity.findFirst({ where: { characterId, status: { in: [ActivityStatus.ACTIVE, ActivityStatus.COMPLETED] } } }),
      tx.cultivationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
      tx.trainingActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } })
    ]);
    if (activeExploration) throw new GameError("COMBAT_OR_ACTIVITY_ACTIVE", "Không thể dịch chuyển khi đang lịch luyện hoặc gặp encounter.");
    if (activeTravel || activeCultivation || activeTraining) throw new GameError("ACTIVE_ACTIVITY", "Hoàn tất hoạt động hiện tại trước khi dịch chuyển.");
    const route = character.currentLocation.routesFrom.find((entry) => entry.destinationId === destinationLocationId);
    if (!route) throw new GameError("DESTINATION_NOT_DISCOVERED", "Chỉ có thể dịch chuyển tới địa điểm đã biết.");
    if (route.minimumRealmOrder > character.realmStage.realm.order || route.destination.minimumRealmOrder > character.realmStage.realm.order) throw new GameError("DESTINATION_LOCKED", "Địa điểm này vẫn đang bị khóa.");
    const services = route.destination.services ?? [];
    if (!route.destination.active || services.includes("boss") || services.includes("quest_only") || services.includes("sealed")) throw new GameError("DESTINATION_LOCKED", "Không thể dịch chuyển tới địa điểm đang bị khóa.");
    const { item, effect } = await findOwnedUtilityItem(tx, characterId, itemId, "TELEPORT");
    if (effectGrade(effect) < 1) throw new GameError("ITEM_GRADE_TOO_LOW", "Phù dịch chuyển không đủ cấp.");
    await consumeCombatItem(tx, characterId, item.id);
    await tx.character.update({ where: { id: characterId }, data: { currentLocationId: route.destinationId, locationId: route.destination.zoneId } });
    await progressSectMissionEvent(tx, { characterId, eventType: "LOCATION_VISITED", locationId: route.destinationId, amount: 1 });
    await progressQuestEvent(tx, { characterId, eventType: "ENTER_LOCATION", locationId: route.destinationId, amount: 1 });
    await tx.gameLog.create({ data: { characterId, type: "WORLD_ITEM_USED", message: `Dùng ${item.template.name} dịch chuyển tới ${route.destination.name}.`, metadata: inputJson({ itemId: item.id, effectType: "TELEPORT", locationId: character.currentLocationId, destinationId: route.destinationId, result: "TELEPORTED", actionKey, timestamp: now.toISOString() }) } });
    return { teleported: true, destinationName: route.destination.name };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function breakWorldSealWithItem(db: Db, characterId: string, sealId: string, itemId: string, actionKey?: string | null, now = new Date()) {
  return db.$transaction(async (tx) => {
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, select: { currentLocationId: true } });
    const seal = await tx.worldSeal.findUnique({ where: { id: sealId }, include: { location: true } });
    if (!seal) throw new GameError("SEAL_NOT_FOUND", "Không tìm thấy phong ấn.");
    if (seal.locationId !== character.currentLocationId) throw new GameError("WRONG_LOCATION", "Bạn phải đứng trước phong ấn để phá cấm.");
    if (seal.status !== "SEALED") throw new GameError("SEAL_ALREADY_OPEN", "Phong ấn đã được mở.");
    const { item, effect } = await findOwnedUtilityItem(tx, characterId, itemId, "BREAK_SEAL");
    if (effectGrade(effect) < seal.requiredBreakSealGrade) throw new GameError("ITEM_GRADE_TOO_LOW", "Phù không đủ cấp để phá phong ấn này.");
    await consumeCombatItem(tx, characterId, item.id);
    await tx.worldSeal.update({ where: { id: seal.id }, data: { status: "OPEN", unlockedAt: now, unlockedByCharacterId: characterId, metadata: inputJson({ ...(parseJsonRecord(seal.metadata)), actionKey }) } });
    await tx.gameLog.create({ data: { characterId, type: "WORLD_ITEM_USED", message: `Dùng ${item.template.name} phá ${seal.name}.`, metadata: inputJson({ itemId: item.id, effectType: "BREAK_SEAL", locationId: seal.locationId, targetId: seal.id, result: "UNLOCKED", actionKey, timestamp: now.toISOString() }) } });
    return { unlocked: true, sealName: seal.name };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function useExplorationCombatItem(db: Db, characterId: string, activityId: string, itemId: string, targetId?: string | null, actionKey?: string | null) {
  return db.$transaction(async (tx) => {
    const activity = await tx.explorationActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.characterId !== characterId || activity.status !== ActivityStatus.COMPLETED) throw new GameError("NOT_FOUND", "Không tìm thấy tình huống chiến đấu.");
    const pending = parseJsonRecord(activity.reward);
    if (pending.mode !== "hunt" || typeof pending.monster !== "string" || pending.pending !== true) throw new GameError("BAD_ENCOUNTER", "Chưa có combat phù hợp để dùng phù.");
    const [character, monster, item] = await Promise.all([
      tx.character.findUniqueOrThrow({ where: { id: characterId } }),
      tx.monster.findUniqueOrThrow({ where: { key: pending.monster } }),
      tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: ListingStatus.ACTIVE }, take: 1 } } })
    ]);
    if (!item || item.ownerId !== characterId) throw new GameError("ITEM_NOT_OWNED", "Bạn không sở hữu vật phẩm này.");
    if (item.quantity < 1) throw new GameError("ITEM_EMPTY", "Vật phẩm đã hết.");
    if (item.equippedSlot) throw new GameError("ITEM_EQUIPPED", "Không thể dùng trang bị đang mặc.");
    if (item.listings.length > 0) throw new GameError("ITEM_LISTED", "Vật phẩm đang bày bán.");
    const usage = getItemUsageDefinition(item.template);
    if (!usage.combatUsable) throw new GameError("ITEM_NOT_COMBAT_USABLE", "Vật phẩm này không dùng trong chiến đấu hiện tại.");
    const state = combatStateFromReward(pending, monster.hp);
    const key = actionKey || `${activityId}:${item.id}:${state.usedActionKeys.length}`;
    if (state.usedActionKeys.includes(key)) return { duplicate: true, state };
    const cooldownGroups = usage.effects.map((effect) => typeof effect.payload.cooldownGroup === "string" ? effect.payload.cooldownGroup : null).filter((group): group is string => Boolean(group));
    if (cooldownGroups.some((group) => state.usedGroups.includes(group))) throw new GameError("ITEM_COOLDOWN", "Loại phù cao cấp này chỉ dùng một lần trong trận.");
    if (state.monsterHp <= 0) throw new GameError("TARGET_DEAD", "Mục tiêu đã bị đánh bại.");
    if (usage.targetType === "ENEMY" && targetId !== monster.key) throw new GameError("INVALID_TARGET", "Mục tiêu không hợp lệ.");
    if (usage.targetType === "SELF" && targetId && targetId !== characterId) throw new GameError("INVALID_TARGET", "Phù này chỉ dùng lên bản thân.");
    const nextState = { ...state, usedActionKeys: [...state.usedActionKeys, key], log: [...state.log] };
    const messages: string[] = [`${character.name} sử dụng ${item.template.name}.`];
    for (const effect of usage.effects) {
      if (effect.type === "DEAL_DAMAGE") {
        const cooldownGroup = typeof effect.payload.cooldownGroup === "string" ? effect.payload.cooldownGroup : null;
        const damage = talismanDamage(effect, character, monster);
        nextState.monsterHp = Math.max(0, nextState.monsterHp - damage.total);
        if (cooldownGroup) nextState.usedGroups = [...nextState.usedGroups, cooldownGroup];
        messages.push(`Gây ${damage.total} sát thương ${damage.element === "FIRE" ? "Hỏa" : damage.element === "LIGHTNING" ? "Lôi" : damage.element}${damage.hitCount > 1 ? ` (${damage.hitCount} lần cộng dồn)` : ""} lên ${monster.name}.`);
      } else if (effect.type === "APPLY_SHIELD") {
        const hpPercent = numberFromRecord(effect.payload, "hpPercent", 10);
        const spiritScaling = numberFromRecord(effect.payload, "spiritScaling", 2);
        const shield = Math.max(1, Math.floor((character.maxHp * hpPercent) / 100 + character.spirit * spiritScaling));
        nextState.playerShield = Math.max(nextState.playerShield, shield);
        nextState.playerStatusResistanceBps = Math.max(nextState.playerStatusResistanceBps, Math.floor(numberFromRecord(effect.payload, "statusResistanceBps")));
        messages.push(`Nhận ${shield} Hộ Thuẫn.`);
      } else if (effect.type === "BUFF_STAT") {
        const effectType = typeof effect.payload.effectType === "string" ? effect.payload.effectType : "";
        if (effectType === "DEFENSE_BPS") {
          nextState.playerDefenseBps = Math.max(nextState.playerDefenseBps, Math.floor(numberFromRecord(effect.payload, "defenseBps")));
          messages.push("Phòng ngự tăng 25% trong trận này.");
        } else if (effectType === "SPEED_BPS") {
          nextState.playerSpeedBps = Math.max(nextState.playerSpeedBps, Math.floor(numberFromRecord(effect.payload, "speedBps")));
          messages.push("Thân pháp tăng trong trận này.");
        } else if (effectType === "STATUS_RESISTANCE_BPS") {
          nextState.playerStatusResistanceBps = Math.max(nextState.playerStatusResistanceBps, Math.floor(numberFromRecord(effect.payload, "statusResistanceBps")));
          messages.push("Kháng trạng thái tăng trong trận này.");
        }
      } else if (effect.type === "APPLY_DEBUFF") {
        nextState.enemySpeedBps = Math.min(nextState.enemySpeedBps, Math.floor(numberFromRecord(effect.payload, "speedBps")));
        messages.push(`${monster.name} bị giảm 30% Thân Pháp trong trận này.`);
      } else {
        throw new GameError("ITEM_EFFECT_UNSUPPORTED", "Hiệu ứng phù này chưa dùng được trong combat.");
      }
    }
    nextState.log = [...nextState.log, ...messages];
    await consumeCombatItem(tx, characterId, item.id);
    await tx.explorationActivity.update({ where: { id: activityId }, data: { reward: inputJson({ ...pending, combatState: nextState }) } });
    await tx.gameLog.create({ data: { characterId, type: "encounter", message: messages.join(" "), metadata: inputJson({ activityId, itemKey: item.template.key, targetId, combatState: nextState }) } });
    return { itemName: item.template.name, messages, state: nextState };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function attackExplorationEncounter(db: Db, characterId: string, activityId: string, seed = Date.now(), now = new Date()) {
  return db.$transaction(async (tx) => {
    const activity = await tx.explorationActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.characterId !== characterId || activity.status !== ActivityStatus.COMPLETED) throw new GameError("NOT_FOUND", "Không tìm thấy tình huống.");
    const pending = parseJsonRecord(activity.reward);
    if (pending.mode !== "hunt" || typeof pending.monster !== "string" || pending.pending !== true) throw new GameError("BAD_ENCOUNTER", "Tình huống không hợp lệ.");
    const [character, monster] = await Promise.all([
      tx.character.findUniqueOrThrow({ where: { id: characterId } }),
      tx.monster.findUniqueOrThrow({ where: { key: pending.monster } })
    ]);
    const combatState = combatStateFromReward(pending, monster.hp);
    const result = simulateCombat(
      { name: character.name, hp: character.hp + combatState.playerShield, attack: character.attack, defense: modifiedStat(character.defense, combatState.playerDefenseBps), speed: modifiedStat(character.speed, combatState.playerSpeedBps) },
      { name: monster.name, hp: combatState.monsterHp, attack: monster.attack, defense: monster.defense, speed: modifiedStat(monster.speed, combatState.enemySpeedBps) },
      seededRng(seed)
    );
    await tx.character.update({ where: { id: characterId }, data: { hp: result.remainingHp ? applyShieldToHp(result.remainingHp, character.maxHp) : Math.max(1, Math.floor(character.maxHp * 0.25)) } });
    const loot = result.winner === "player" ? await resolveMonsterLoot(tx, characterId, monster, activityId) : { linhThach: "0", items: [] };
    const reward = result.winner === "player" ? { cultivation: 80, linhThach: Number(loot.linhThach), loot } : { cultivation: 10, linhThach: 0, loot };
    if (reward.cultivation) await addCultivationClamped(tx, characterId, BigInt(reward.cultivation));
    await tx.combat.create({ data: { characterId, monsterKey: monster.key, winner: result.winner, log: [...combatState.log, ...result.log], reward: { ...reward, combatState } } });
    if (result.winner === "player") {
      await progressSectMissionEvent(tx, { characterId, eventType: "MONSTER_KILLED", monsterKey: monster.key, locationId: typeof pending.locationId === "string" ? pending.locationId : null, amount: 1 });
      await progressQuestEvent(tx, { characterId, eventType: "MONSTER_KILLED", monsterKey: monster.key, locationId: typeof pending.locationId === "string" ? pending.locationId : null, amount: 1 });
    }
    const session = parseJsonRecord(pending.session);
    if (Object.keys(session).length > 0) {
      const checkpoints = Array.isArray(session.checkpoints) ? session.checkpoints.map(parseJsonRecord) : [];
      const nextCheckpoints = checkpoints.map((checkpoint) => checkpoint.id === session.pendingCheckpointId ? { ...checkpoint, resolved: true, outcome: "attacked" } : checkpoint);
      const stats = parseJsonRecord(session.stats);
      const defeated = result.winner === "player" ? 1 : 0;
      const lootText = Array.isArray(loot.items) && loot.items.length > 0 ? ` và nhận ${loot.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}` : "";
      const nextSession = { ...session, pausedAt: null, pendingCheckpointId: null, checkpoints: nextCheckpoints, stats: { ...stats, detected: numberFromRecord(stats, "detected") + 1, defeated: numberFromRecord(stats, "defeated") + defeated }, log: [...(Array.isArray(session.log) ? session.log : []), result.winner === "player" ? `Bạn đánh bại ${monster.name}${lootText}.` : `${monster.name} làm bạn bị thương, nhưng chuyến săn vẫn tiếp tục.`] };
      await tx.explorationActivity.update({ where: { id: activityId }, data: { status: ActivityStatus.ACTIVE, startedAt: now, endsAt: huntEndsAt(now, nextSession), reward: inputJson({ ...pending, pending: false, monster: null, session: nextSession, combat: { winner: result.winner, reward } }) } });
    } else {
      await tx.explorationActivity.update({ where: { id: activityId }, data: { status: ActivityStatus.CLAIMED, claimedAt: now, reward: inputJson({ ...pending, pending: false, decision: "attack", combat: { winner: result.winner, reward } }) } });
    }
    if (result.winner === "player") await recordOnboardingEvent(tx, characterId, "MONSTER_DEFEATED");
    return { ...result, reward, monsterName: monster.name };
  });
}

export async function startTravel(db: Db, characterId: string, routeId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const character = await tx.character.findUniqueOrThrow({
      where: { id: characterId },
      include: { currentLocation: true, location: true, realmStage: { include: { realm: true } } }
    });
    const [activeTravel, activeCultivation, activeExploration, activeTraining] = await Promise.all([
      tx.travel.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
      tx.cultivationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
      tx.explorationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
      tx.trainingActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } })
    ]);
    if (activeTravel) throw new GameError("ACTIVE_TRAVEL", "Bạn đang di chuyển.");
    if (activeCultivation) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang bế quan.");
    if (activeExploration) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang lịch luyện.");
    if (activeTraining) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang rèn luyện.");
    const route = await tx.route.findUnique({
      where: { id: routeId },
      include: { origin: { include: { zone: true } }, destination: { include: { zone: true } } }
    });
    if (!route || !route.active) throw new GameError("ROUTE_NOT_FOUND", "Tuyến đường không khả dụng.");
    if (route.minimumRealmOrder > character.realmStage.realm.order) throw new GameError("REALM_REQUIREMENT_NOT_MET", "Bạn chưa đủ cảnh giới để đi tuyến này.");
    if (character.currentLocationId) {
      if (character.currentLocationId !== route.originId) throw new GameError("WRONG_ORIGIN", "Bạn không đứng ở điểm xuất phát của tuyến này.");
    } else if (character.locationId !== route.origin.zoneId) {
      throw new GameError("WRONG_ORIGIN", "Bạn không đứng ở điểm xuất phát của tuyến này.");
    }
    const sectAccess = await canAccessSectLocation(tx, characterId, route.destinationId);
    if (!sectAccess.allowed) throw new GameError("SECT_LOCATION_LOCKED", sectAccess.reason ?? "Bạn chưa đủ thân phận để vào khu vực này.");
    if (route.travelCost > 0n) {
      await debitWallet(tx, characterId, Currency.LINH_THACH, route.travelCost, WalletTxType.DEBIT, "Route", route.id, `travel:${route.id}:${characterId}:${now.getTime()}`);
    }
    const travel = await tx.travel.create({
      data: {
        characterId,
        routeId: route.id,
        originId: route.originId,
        destinationId: route.destinationId,
        startedAt: now,
        endsAt: new Date(now.getTime() + travelDurationSeconds(route.travelMinutes) * 1000),
        travelCost: route.travelCost,
        dangerSnapshot: route.dangerLevel,
        securitySnapshot: route.securityLevel,
        encounterSnapshot: route.encounterTable as Prisma.InputJsonValue
      }
    });
    await tx.gameLog.create({ data: { characterId, type: "travel", message: `Bắt đầu di chuyển: ${route.name}.` } });
    await recordOnboardingEvent(tx, characterId, "TRAVEL_STARTED");
    return travel;
  });
}

export async function claimTravel(db: Db, characterId: string, travelId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const travel = await tx.travel.findUnique({ where: { id: travelId }, include: { route: { include: { destination: true } } } });
    if (!travel || travel.characterId !== characterId) throw new GameError("NOT_FOUND", "Không tìm thấy chuyến đi.");
    if (travel.status === ActivityStatus.CLAIMED) throw new GameError("ALREADY_CLAIMED", "Chuyến đi đã được hoàn tất.");
    if (travel.endsAt > now) throw new GameError("NOT_READY", "Bạn chưa tới nơi.");
    const encounterTable = parseEncounterTable(travel.encounterSnapshot);
    const encounter = pickWeighted(encounterTable, seededRng(seedFromString(travel.id)));
    const encounterResult = await resolveTravelEncounter(tx, characterId, encounter.key, travel.dangerSnapshot);
    const updated = await tx.travel.updateMany({
      where: { id: travelId, characterId, status: ActivityStatus.ACTIVE, endsAt: { lte: now } },
      data: { status: ActivityStatus.CLAIMED, claimedAt: now, encounterKey: encounter.key, encounterResult: encounterResult as Prisma.InputJsonValue }
    });
    if (updated.count !== 1) throw new GameError("ALREADY_CLAIMED", "Chuyến đi đã được hoàn tất.");
    await tx.character.update({
      where: { id: characterId },
      data: { currentLocationId: travel.destinationId, locationId: travel.route.destination.zoneId }
    });
    await progressSectMissionEvent(tx, { characterId, eventType: "LOCATION_VISITED", locationId: travel.destinationId, amount: 1 });
    await progressQuestEvent(tx, { characterId, eventType: "ENTER_LOCATION", locationId: travel.destinationId, amount: 1 });
    await tx.gameLog.create({ data: { characterId, type: "travel", message: `Đã tới ${travel.route.destination.name}. ${encounterResult.message}`, metadata: { encounter: encounter.key, result: encounterResult } } });
    await recordOnboardingEvent(tx, characterId, "TRAVEL_COMPLETED");
    return { destinationName: travel.route.destination.name, encounter: encounter.key, result: encounterResult };
  });
}

async function resolveTravelEncounter(tx: Tx, characterId: string, encounterKey: string, dangerLevel: number) {
  if (encounterKey === "resource-cache") {
    const template = await tx.itemTemplate.findFirst({ where: { key: { in: ["thanh-linh-thao", "ngung-lo-thao", "hac-thiet-quang", "yeu-dan-cap-thap"] } }, orderBy: { key: "asc" } });
    if (!template) return { kind: encounterKey, message: "Bạn phát hiện dấu vết tài nguyên nhưng không thu được gì." };
    await addItemToInventory(tx, characterId, template.id, 1);
    await progressQuestEvent(tx, { characterId, eventType: "ITEM_OBTAINED", itemKey: template.key, amount: 1 });
    return { kind: encounterKey, itemTemplateId: template.id, itemName: template.name, quantity: 1, message: `Bạn tìm thấy ${template.name}.` };
  }

  if (encounterKey === "wandering-monster") {
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId } });
    const monster = await tx.monster.findFirst({ orderBy: { hp: "asc" } });
    if (!monster) return { kind: encounterKey, message: "Yêu khí thoáng qua rồi tan biến." };
    const result = simulateCombat(
      { name: character.name, hp: character.hp, attack: character.attack, defense: character.defense, speed: character.speed },
      { name: monster.name, hp: monster.hp + dangerLevel * 8, attack: monster.attack + dangerLevel * 2, defense: monster.defense + dangerLevel, speed: monster.speed },
      seededRng(seedFromString(`${characterId}:${dangerLevel}`))
    );
    const remainingHp = result.remainingHp || Math.max(1, Math.floor(character.maxHp * 0.3));
    const cultivationReward = result.winner === "player" ? BigInt(20 + dangerLevel * 10) : 5n;
    await tx.character.update({ where: { id: characterId }, data: { hp: remainingHp } });
    await addCultivationClamped(tx, characterId, cultivationReward);
    await tx.combat.create({ data: { characterId, monsterKey: monster.key, winner: result.winner, log: result.log, reward: { source: "travel", cultivation: cultivationReward.toString() } } });
    if (result.winner === "player") {
      await progressSectMissionEvent(tx, { characterId, eventType: "MONSTER_KILLED", monsterKey: monster.key, amount: 1 });
      await progressQuestEvent(tx, { characterId, eventType: "MONSTER_KILLED", monsterKey: monster.key, amount: 1 });
    }
    return { kind: encounterKey, monsterKey: monster.key, monsterName: monster.name, winner: result.winner, cultivation: cultivationReward.toString(), message: result.winner === "player" ? `Bạn đánh lui ${monster.name} và nhận ${cultivationReward.toString()} tu vi.` : `${monster.name} cản đường, bạn bị thương nhưng vẫn thoát được.` };
  }

  if (encounterKey === "traveler") {
    await tx.character.update({ where: { id: characterId }, data: { reputation: { increment: 1 } } });
    return { kind: encounterKey, reputation: 1, message: "Bạn gặp một tu sĩ lữ hành và trao đổi tin tức, danh vọng tăng nhẹ." };
  }

  if (encounterKey === "rare-omen") {
    const cultivationReward = BigInt(50 + dangerLevel * 8);
    await addCultivationClamped(tx, characterId, cultivationReward);
    await tx.character.update({ where: { id: characterId }, data: { luck: { increment: 1 } } });
    return { kind: encounterKey, cultivation: cultivationReward.toString(), luck: 1, message: `Một điềm lạ hiện lên trên đường, bạn nhận ${cultivationReward.toString()} tu vi và thêm khí vận.` };
  }

  return { kind: "safe-passage", message: "Chuyến đi bình an, không có biến cố đáng kể." };
}

export async function fightMonster(db: Db, characterId: string, monsterKey: string, seed = Date.now()) {
  return db.$transaction(async (tx) => {
    const [character, monster] = await Promise.all([
      tx.character.findUniqueOrThrow({ where: { id: characterId } }),
      tx.monster.findUniqueOrThrow({ where: { key: monsterKey } })
    ]);
    const result = simulateCombat(
      { name: character.name, hp: character.hp, attack: character.attack, defense: character.defense, speed: character.speed },
      { name: monster.name, hp: monster.hp, attack: monster.attack, defense: monster.defense, speed: monster.speed },
      seededRng(seed)
    );
    await tx.character.update({ where: { id: characterId }, data: { hp: result.remainingHp || Math.max(1, Math.floor(character.maxHp * 0.25)) } });
    const loot = result.winner === "player" ? await resolveMonsterLoot(tx, characterId, monster, `fight:${monsterKey}:${seed}`) : { linhThach: "0", items: [] };
    const reward = result.winner === "player" ? { cultivation: 80, linhThach: Number(loot.linhThach), loot } : { cultivation: 10, linhThach: 0, loot };
    if (reward.cultivation) await addCultivationClamped(tx, characterId, BigInt(reward.cultivation));
    await tx.combat.create({ data: { characterId, monsterKey, winner: result.winner, log: result.log, reward } });
    if (result.winner === "player") {
      await progressSectMissionEvent(tx, { characterId, eventType: "MONSTER_KILLED", monsterKey, amount: 1 });
      await progressQuestEvent(tx, { characterId, eventType: "MONSTER_KILLED", monsterKey, amount: 1 });
    }
    await recordOnboardingEvent(tx, characterId, "MONSTER_ENCOUNTERED");
    if (result.winner === "player") await recordOnboardingEvent(tx, characterId, "MONSTER_DEFEATED");
    return { ...result, reward, monsterName: monster.name };
  });
}

export async function purchaseMarketListing(db: Db, buyerId: string, listingId: string, quantity = 1, idempotencyKey?: string, now = new Date()) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new GameError("INVALID_QUANTITY", "Số lượng không hợp lệ.");
  if (quantity > 99) throw new GameError("INVALID_QUANTITY", "Mỗi lần chỉ mua tối đa 99 vật phẩm.");
  return db.$transaction(async (tx) => {
    await assertAtMarket(tx, buyerId);
    const purchaseKey = idempotencyKey ? `listing-buy:${listingId}:${buyerId}:${quantity}:${idempotencyKey}` : "";
    if (purchaseKey) {
      const existing = await tx.walletTransaction.findUnique({ where: { characterId_currency_idempotencyKey: { characterId: buyerId, currency: Currency.LINH_THACH, idempotencyKey: purchaseKey } } });
      if (existing) return { price: existing.amount < 0n ? -existing.amount : existing.amount, tax: 0n, quantity, repeated: true };
    }
    const listing = await tx.marketListing.findUnique({ where: { id: listingId }, include: { item: { include: { template: true } } } });
    if (!listing || listing.status !== ListingStatus.ACTIVE || listing.expiresAt < now) throw new GameError("LISTING_INACTIVE", "Vật phẩm đã được người khác mua.");
    if (listing.sellerId === buyerId) throw new GameError("SELF_BUY", "Không thể mua vật phẩm của chính mình.");
    if (listing.item.ownerId !== listing.sellerId) throw new GameError("LISTING_INACTIVE", "Vật phẩm không còn thuộc người bán.");
    if (quantity > listing.quantity || quantity > listing.item.quantity) throw new GameError("INVALID_QUANTITY", "Tin rao không còn đủ số lượng.");
    await assertItemRequirements(tx, buyerId, listing.item.template);
    const isFullBuy = quantity === listing.quantity;
    const claimed = await tx.marketListing.updateMany({
      where: { id: listingId, status: ListingStatus.ACTIVE, expiresAt: { gt: now }, quantity: { gte: quantity } },
      data: isFullBuy ? { status: ListingStatus.SOLD } : { quantity: { decrement: quantity } }
    });
    if (claimed.count !== 1) throw new GameError("LISTING_INACTIVE", "Vật phẩm đã được người khác mua.");
    const totalPrice = listing.price * BigInt(quantity);
    const tax = (totalPrice * 500n) / 10000n;
    await debitWallet(tx, buyerId, Currency.LINH_THACH, totalPrice, WalletTxType.MARKET, "MarketListing", listingId, purchaseKey || `buy:${listingId}:${buyerId}:${quantity}:${now.getTime()}`);
    await creditWallet(tx, listing.sellerId, Currency.LINH_THACH, totalPrice - tax, WalletTxType.MARKET, "MarketListing", listingId, `sell:${listingId}:${buyerId}:${quantity}:${idempotencyKey ?? now.getTime()}`);
    if (isFullBuy) {
      await tx.itemInstance.update({ where: { id: listing.itemId }, data: { ownerId: null, quantity: 0 } });
    } else {
      await tx.itemInstance.update({ where: { id: listing.itemId }, data: { quantity: { decrement: quantity } } });
    }
    await addItemToInventory(tx, buyerId, listing.item.templateId, quantity, { quality: listing.item.quality, enhancement: listing.item.enhancement, bound: listing.item.bound, customModifiers: listing.item.customModifiers });
    await progressQuestEvent(tx, { characterId: buyerId, eventType: "ITEM_OBTAINED", itemKey: listing.item.template.key, amount: quantity });
    await tx.marketTransaction.create({ data: { listingId, buyerId, sellerId: listing.sellerId, itemTemplateId: listing.item.templateId, quantity, price: totalPrice, tax } });
    return { price: totalPrice, tax, quantity };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function refreshSystemMarketStock(db: Db, now = new Date()) {
  const periodKey = currentSystemMarketPeriod(now);
  const templates = await db.itemTemplate.findMany({ where: { tradeable: true } });
  const rows = [];
  for (const template of templates) {
    const economy = getItemEconomy(template);
    if (!economy.systemMarketEnabled) continue;
    const stock = stockForSystemMarketItem(template.key, template.rarity, now);
    const price = (economy.systemBasePrice * 10000n) / 10000n;
    rows.push(await db.systemMarketStock.upsert({
      where: { periodKey_templateId: { periodKey, templateId: template.id } },
      update: { price },
      create: { periodKey, templateId: template.id, stock, price }
    }));
  }
  return rows;
}

export async function purchaseSystemMarketItem(db: Db, buyerId: string, stockId: string, quantity = 1, idempotencyKey?: string, now = new Date()) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new GameError("INVALID_QUANTITY", "Số lượng không hợp lệ.");
  if (quantity > 99) throw new GameError("INVALID_QUANTITY", "Mỗi lần chỉ mua tối đa 99 vật phẩm.");
  return db.$transaction(async (tx) => {
    await assertAtMarket(tx, buyerId);
    const purchaseKey = idempotencyKey ? `system-buy:${stockId}:${buyerId}:${quantity}:${idempotencyKey}` : "";
    if (purchaseKey) {
      const existing = await tx.walletTransaction.findUnique({ where: { characterId_currency_idempotencyKey: { characterId: buyerId, currency: Currency.LINH_THACH, idempotencyKey: purchaseKey } } });
      if (existing) {
        const stock = await tx.systemMarketStock.findUnique({ where: { id: stockId }, include: { template: true } });
        return { itemName: stock?.template.name ?? "Vật phẩm", quantity, totalPrice: existing.amount < 0n ? -existing.amount : existing.amount, repeated: true };
      }
    }
    const stock = await tx.systemMarketStock.findUnique({ where: { id: stockId }, include: { template: true } });
    if (!stock || stock.periodKey !== currentSystemMarketPeriod(now) || stock.stock <= 0) throw new GameError("SYSTEM_STOCK_EMPTY", "Vạn Bảo Lâu đã hết vật phẩm này.");
    const economy = getItemEconomy(stock.template);
    if (!economy.systemMarketEnabled) throw new GameError("SYSTEM_STOCK_DISABLED", "Vật phẩm này không bán trực tiếp ở Vạn Bảo Lâu.");
    await assertItemRequirements(tx, buyerId, stock.template);
    if (quantity > stock.stock) throw new GameError("INVALID_QUANTITY", "Vạn Bảo Lâu không còn đủ số lượng.");
    const totalPrice = stock.price * BigInt(quantity);
    const claimed = await tx.systemMarketStock.updateMany({ where: { id: stockId, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } });
    if (claimed.count !== 1) throw new GameError("SYSTEM_STOCK_EMPTY", "Vạn Bảo Lâu đã được mua hết vật phẩm này.");
    await debitWallet(tx, buyerId, Currency.LINH_THACH, totalPrice, WalletTxType.MARKET, "SystemMarketStock", stockId, purchaseKey || `system-buy:${stockId}:${buyerId}:${quantity}:${now.getTime()}`);
    await addItemToInventory(tx, buyerId, stock.templateId, quantity);
    await progressQuestEvent(tx, { characterId: buyerId, eventType: "ITEM_OBTAINED", itemKey: stock.template.key, amount: quantity });
    await tx.marketTransaction.create({ data: { listingId: `system:${stockId}`, buyerId, sellerId: "SYSTEM", itemTemplateId: stock.templateId, quantity, price: totalPrice, tax: 0n } });
    await tx.gameLog.create({ data: { characterId: buyerId, type: "market", message: `Mua ${stock.template.name} x${quantity} từ Vạn Bảo Lâu, trả ${totalPrice.toString()} Linh Thạch.` } });
    return { itemName: stock.template.name, quantity, totalPrice };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createMarketListing(db: Db, sellerId: string, itemId: string, price: bigint, quantity = 1, now = new Date()) {
  if (price <= 0n) throw new GameError("INVALID_PRICE", "Giá bán không hợp lệ.");
  if (price > 999_999_999_999n) throw new GameError("INVALID_PRICE", "Giá bán quá lớn.");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new GameError("INVALID_QUANTITY", "Số lượng không hợp lệ.");
  return db.$transaction(async (tx) => {
    await assertAtMarket(tx, sellerId);
    const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: ListingStatus.ACTIVE } } } });
    if (!item || item.ownerId !== sellerId) throw new GameError("ITEM_NOT_FOUND", "Không tìm thấy vật phẩm.");
    if (quantity > marketListingMaxQuantity(item.quantity)) throw new GameError("INVALID_QUANTITY", "Mỗi lần chỉ được rao tối đa 10 đơn vị.");
    if (quantity > item.quantity) throw new GameError("INVALID_QUANTITY", "Không đủ số lượng vật phẩm.");
    if (item.equippedSlot) throw new GameError("ITEM_EQUIPPED", "Không thể rao bán vật phẩm đang trang bị.");
    if (!item.template.tradeable || item.bound) throw new GameError("ITEM_BOUND", "Vật phẩm này không thể giao dịch.");
    if (item.listings.length > 0) throw new GameError("ALREADY_LISTED", "Vật phẩm này đang được rao bán.");
    let listedItemId = item.id;
    if (quantity < item.quantity) {
      await tx.itemInstance.update({ where: { id: item.id }, data: { quantity: { decrement: quantity } } });
      const listedItem = await tx.itemInstance.create({
        data: {
          ownerId: sellerId,
          templateId: item.templateId,
          quantity,
          quality: item.quality,
          durability: item.durability,
          enhancement: item.enhancement,
          customModifiers: item.customModifiers as Prisma.InputJsonValue,
          bound: item.bound
        }
      });
      listedItemId = listedItem.id;
    }
    const listing = await tx.marketListing.create({
      data: {
        sellerId,
        itemId: listedItemId,
        quantity,
        price,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000)
      }
    });
    await tx.gameLog.create({ data: { characterId: sellerId, type: "market", message: `Rao bán ${item.template.name} với giá ${price.toString()} Linh Thạch.` } });
    return listing;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function sellItemToNpc(db: Db, sellerId: string, itemId: string, quantity = 1, idempotencyKey?: string) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new GameError("INVALID_QUANTITY", "Số lượng không hợp lệ.");
  return db.$transaction(async (tx) => {
    await assertAtMarket(tx, sellerId);
    const saleKey = idempotencyKey ? `npc-sell:${itemId}:${sellerId}:${quantity}:${idempotencyKey}` : "";
    if (saleKey) {
      const existing = await tx.walletTransaction.findUnique({ where: { characterId_currency_idempotencyKey: { characterId: sellerId, currency: Currency.LINH_THACH, idempotencyKey: saleKey } } });
      if (existing) return { total: existing.amount, quantity, itemName: "Vật phẩm", repeated: true };
    }
    const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: ListingStatus.ACTIVE } } } });
    if (!item || item.ownerId !== sellerId) throw new GameError("ITEM_NOT_FOUND", "Không tìm thấy vật phẩm.");
    if (item.equippedSlot) throw new GameError("ITEM_EQUIPPED", "Không thể bán vật phẩm đang trang bị.");
    if (item.listings.length > 0) throw new GameError("ITEM_LISTED", "Không thể bán vật phẩm đang rao.");
    if (quantity > item.quantity) throw new GameError("INVALID_QUANTITY", "Không đủ số lượng vật phẩm.");
    if (item.bound) throw new GameError("ITEM_BOUND", "Vật phẩm này đã khóa.");
    const economy = getItemEconomy(item.template);
    if (!economy.sellableToNpc || economy.npcBuyPrice <= 0n) throw new GameError("ITEM_NOT_SELLABLE", "Vạn Bảo Lâu không thu mua vật phẩm này.");
    const total = economy.npcBuyPrice * BigInt(quantity);
    await removeItemFromInventory(tx, sellerId, item.id, quantity);
    await creditWallet(tx, sellerId, Currency.LINH_THACH, total, WalletTxType.MARKET, "NpcMerchant", item.templateId, saleKey || `npc-sell:${item.id}:${quantity}:${Date.now()}`);
    await tx.gameLog.create({ data: { characterId: sellerId, type: "market", message: `Bán ${item.template.name} x${quantity} cho Vạn Bảo Lâu, nhận ${total.toString()} Linh Thạch.` } });
    return { total, quantity, itemName: item.template.name };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelMarketListing(db: Db, sellerId: string, listingId: string) {
  return db.$transaction(async (tx) => {
    const updated = await tx.marketListing.updateMany({
      where: { id: listingId, sellerId, status: ListingStatus.ACTIVE },
      data: { status: ListingStatus.CANCELLED }
    });
    if (updated.count !== 1) throw new GameError("LISTING_INACTIVE", "Tin rao không còn khả dụng.");
    await tx.gameLog.create({ data: { characterId: sellerId, type: "market", message: "Hủy một tin rao bán." } });
    return { cancelled: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function equipItem(db: Db, characterId: string, itemId: string) {
  return db.$transaction(async (tx) => {
    const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: ListingStatus.ACTIVE } } } });
    if (!item || item.ownerId !== characterId) throw new GameError("ITEM_NOT_FOUND", "Không tìm thấy vật phẩm.");
    if (item.template.category !== ItemCategory.EQUIPMENT || !item.template.equipSlot) throw new GameError("NOT_EQUIPMENT", "Vật phẩm này không thể trang bị.");
    if (item.listings.length > 0) throw new GameError("ITEM_LISTED", "Không thể trang bị vật phẩm đang rao bán.");
    if (item.equippedSlot === item.template.equipSlot) return item;
    const current = await tx.itemInstance.findFirst({
      where: { ownerId: characterId, equippedSlot: item.template.equipSlot },
      include: { template: true }
    });
    if (current) {
      await tx.itemInstance.update({ where: { id: current.id }, data: { equippedSlot: null } });
      await applyEquipmentDelta(tx, characterId, current.template.baseModifiers, -1);
    }
    await tx.itemInstance.update({ where: { id: item.id }, data: { equippedSlot: item.template.equipSlot } });
    await applyEquipmentDelta(tx, characterId, item.template.baseModifiers, 1);
    await tx.gameLog.create({ data: { characterId, type: "inventory", message: `Trang bị ${item.template.name}.` } });
    return item;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function unequipItem(db: Db, characterId: string, itemId: string) {
  return db.$transaction(async (tx) => {
    const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true } });
    if (!item || item.ownerId !== characterId) throw new GameError("ITEM_NOT_FOUND", "Không tìm thấy vật phẩm.");
    if (!item.equippedSlot) throw new GameError("NOT_EQUIPPED", "Vật phẩm này chưa được trang bị.");
    await tx.itemInstance.update({ where: { id: item.id }, data: { equippedSlot: null } });
    await applyEquipmentDelta(tx, characterId, item.template.baseModifiers, -1);
    await tx.gameLog.create({ data: { characterId, type: "inventory", message: `Tháo ${item.template.name}.` } });
    return item;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function consumeItem(db: Db, characterId: string, itemId: string, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new GameError("INVALID_QUANTITY", "Số lượng không hợp lệ.");
  if (quantity > 99) throw new GameError("INVALID_QUANTITY", "Mỗi lần chỉ sử dụng tối đa 99 vật phẩm.");
  return db.$transaction(async (tx) => {
    const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: ListingStatus.ACTIVE } } } });
    if (!item || item.ownerId !== characterId) throw new GameError("ITEM_NOT_FOUND", "Không tìm thấy vật phẩm.");
    if (item.template.category !== ItemCategory.CONSUMABLE) throw new GameError("NOT_CONSUMABLE", "Vật phẩm này không thể sử dụng.");
    if (item.listings.length > 0) throw new GameError("ITEM_LISTED", "Không thể dùng vật phẩm đang rao bán.");
    if (item.quantity <= 0 || quantity > item.quantity) throw new GameError("INVALID_QUANTITY", "Số lượng vật phẩm không hợp lệ.");
    const usage = getItemUsageDefinition(item.template);
    if (!usage.usable || usage.action !== "USE") throw new GameError("ITEM_CONTEXT_REQUIRED", usage.reason ?? "Vật phẩm này cần ngữ cảnh sử dụng khác.");
    if (usage.runtime !== "ACTIVE") throw new GameError("ITEM_CONTEXT_REQUIRED", usage.reason ?? "Vật phẩm này chưa thể dùng trực tiếp.");
    if (usage.effects.some((effect) => effect.type === "BUFF_STAT") && quantity > 1) throw new GameError("INVALID_QUANTITY", "Vật phẩm tạo buff chỉ dùng từng cái một.");
    const now = new Date();
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { realmStage: { include: { realm: true } } } });
    const changes: Prisma.CharacterUpdateInput = {};
    const messages: string[] = [];
    let applied = 0;
    let nextHp = character.hp;
    let nextQi = character.qi;
    let nextEnergy = currentEnergySnapshot(character, now);

    for (const effect of usage.effects) {
      if (effect.type === "HEAL_HP") {
        const amount = payloadNumber(effect, "amount") || percentAmount(character.maxHp, payloadNumber(effect, "percent"));
        const room = Math.max(0, character.maxHp - nextHp);
        const delta = Math.min(room, amount * quantity);
        if (delta > 0) {
          nextHp += delta;
          changes.hp = nextHp;
          messages.push(effectMessage(effect, delta));
          applied += 1;
        }
      } else if (effect.type === "RESTORE_QI") {
        const amount = payloadNumber(effect, "amount") || percentAmount(character.maxQi, payloadNumber(effect, "percent"));
        const room = Math.max(0, character.maxQi - nextQi);
        const delta = Math.min(room, amount * quantity);
        if (delta > 0) {
          nextQi += delta;
          changes.qi = nextQi;
          messages.push(effectMessage(effect, delta));
          applied += 1;
        }
      } else if (effect.type === "RESTORE_ENERGY") {
        const amount = payloadNumber(effect, "amount") || percentAmount(character.energyMax, payloadNumber(effect, "percent"));
        const room = Math.max(0, character.energyMax - nextEnergy);
        const delta = Math.min(room, amount * quantity);
        if (delta > 0) {
          nextEnergy += delta;
          changes.energyStored = nextEnergy;
          changes.energyUpdatedAt = now;
          messages.push(effectMessage(effect, delta));
          applied += 1;
        }
      } else if (effect.type === "GAIN_CULTIVATION") {
        const amount = payloadNumber(effect, "amount");
        const result = amount > 0 ? await addCultivationClamped(tx, characterId, BigInt(amount * quantity)) : { applied: 0n };
        if (result.applied > 0n) {
          messages.push(effectMessage(effect, Number(result.applied)));
          applied += 1;
        }
      } else if (effect.type === "BUFF_STAT") {
        await refreshCharacterBuff(tx, characterId, item.template.key, effect, now);
        messages.push(effectMessage(effect, 0));
        applied += 1;
      } else if (effect.type === "CLEANSE") {
        // Debuff rows are not modeled yet; do not consume cleanse-only items without a real target.
      }
    }
    if (applied === 0) throw new GameError("NO_EFFECT", "Vật phẩm chưa tạo hiệu quả nào, không tiêu hao.");
    const updated = await tx.itemInstance.updateMany({
      where: { id: item.id, ownerId: characterId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } }
    });
    if (updated.count !== 1) throw new GameError("ALREADY_USED", "Vật phẩm đã được sử dụng.");
    await tx.itemInstance.deleteMany({ where: { id: item.id, quantity: { lte: 0 } } });
    if (Object.keys(changes).length > 0) await tx.character.update({ where: { id: characterId }, data: changes });
    const detail = messages.length > 0 ? ` (${messages.join(", ")})` : "";
    await tx.gameLog.create({ data: { characterId, type: "inventory", message: `Sử dụng ${item.template.name} x${quantity}${detail}.`, metadata: inputJson({ itemKey: item.template.key, effects: usage.effects }) } });
    return { itemName: item.template.name, quantity, effects: messages };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

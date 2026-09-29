import { Prisma, type PrismaClient, ActivityStatus, Currency, WalletTxType, ListingStatus, ItemCategory } from "@ttg/db";
import { calculateCultivationReward, cultivationBaseReward, cultivationDurationConfigs, cultivationEnergyCost, currentEnergy, gameDurationToRealMs, isCultivationDurationKey, locationActivityConfigs, parseEncounterTable, simulateCombat, travelDurationSeconds, type CultivationDurationKey, type LocationActivityMode } from "./rules.js";
import { currentSystemMarketPeriod, getItemEconomy, marketListingMaxQuantity, stockForSystemMarketItem } from "./items.js";
import { pickWeighted, seededRng, seedFromString } from "./rng.js";
import { recordOnboardingEvent } from "./onboarding.js";
import { progressQuestEvent } from "./quests.js";

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

function inputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
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

async function grantStackableItem(tx: Tx, characterId: string, templateId: string, quantity: number, options: { quality?: number; enhancement?: number; bound?: boolean; customModifiers?: unknown } = {}) {
  return addItemToInventory(tx, characterId, templateId, quantity, options);
}

async function progressSectMissionEvent(tx: Tx, input: { characterId: string; eventType: "MONSTER_KILLED" | "ITEM_COLLECTED" | "LOCATION_VISITED" | "RESOURCE_MINED" | "ITEM_DONATED" | "FARM_HARVESTED"; monsterKey?: string; itemKey?: string; locationId?: string | null; amount?: number }) {
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
  const [activeCultivation, activeExploration, activeTravel] = await Promise.all([
    db.cultivationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.explorationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.travel.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } })
  ]);
  if (activeCultivation) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang có hoạt động tu luyện.");
  if (activeExploration) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang lịch luyện.");
  if (activeTravel) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang di chuyển.");
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

export async function attemptBreakthrough(db: Db, characterId: string, rng = Math.random) {
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
    const chance = Math.min(9500, character.realmStage.breakthroughChanceBps + character.luck * 30 + character.breakthroughBonusBps);
    if (Math.floor(rng() * 10000) < chance) {
      await tx.character.update({ where: { id: characterId }, data: { realmStageId: next.id, cultivation: 0n, maxHp: next.baseHp, maxQi: next.baseQi, hp: next.baseHp, qi: next.baseQi, lifespan: { increment: next.lifespanBonus }, breakthroughBonusBps: 0 } });
      await tx.worldNews.create({ data: { title: `${character.name} đột phá ${next.name}`, body: `${character.name} bước sang ${next.name}, đạo tâm vang vọng.`, category: "realm", permanent: true } });
      return { success: true, stage: next.name };
    }
    const loss = character.cultivation / 20n;
    await tx.character.update({ where: { id: characterId }, data: { cultivation: { decrement: loss }, hp: Math.max(1, Math.floor(character.hp * 0.7)), breakthroughBonusBps: 0 } });
    await tx.gameLog.create({ data: { characterId, type: "realm", message: `Đột phá thất bại, hao tổn ${loss.toString()} tu vi.` } });
    return { success: false, loss };
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
  const [activeExploration, activeCultivation, activeTravel] = await Promise.all([
    db.explorationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.cultivationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.travel.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } })
  ]);
  if (activeExploration) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang thám hiểm.");
  if (activeCultivation) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang bế quan.");
  if (activeTravel) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang di chuyển.");
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
    const result = simulateCombat(
      { name: character.name, hp: character.hp, attack: character.attack, defense: character.defense, speed: character.speed },
      { name: monster.name, hp: monster.hp, attack: monster.attack, defense: monster.defense, speed: monster.speed },
      seededRng(seed)
    );
    await tx.character.update({ where: { id: characterId }, data: { hp: result.remainingHp || Math.max(1, Math.floor(character.maxHp * 0.25)) } });
    const loot = result.winner === "player" ? await resolveMonsterLoot(tx, characterId, monster, activityId) : { linhThach: "0", items: [] };
    const reward = result.winner === "player" ? { cultivation: 80, linhThach: Number(loot.linhThach), loot } : { cultivation: 10, linhThach: 0, loot };
    if (reward.cultivation) await addCultivationClamped(tx, characterId, BigInt(reward.cultivation));
    await tx.combat.create({ data: { characterId, monsterKey: monster.key, winner: result.winner, log: result.log, reward } });
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
    const [activeTravel, activeCultivation, activeExploration] = await Promise.all([
      tx.travel.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
      tx.cultivationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
      tx.explorationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } })
    ]);
    if (activeTravel) throw new GameError("ACTIVE_TRAVEL", "Bạn đang di chuyển.");
    if (activeCultivation) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang bế quan.");
    if (activeExploration) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang lịch luyện.");
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
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId } });
    const hpRestore = modifierValue(item.template.baseModifiers, "hpRestore");
    const qiRestore = modifierValue(item.template.baseModifiers, "qiRestore");
    const cultivation = modifierValue(item.template.baseModifiers, "cultivation");
    const breakthroughBps = modifierValue(item.template.baseModifiers, "breakthroughBps");
    const updated = await tx.itemInstance.updateMany({
      where: { id: item.id, ownerId: characterId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } }
    });
    if (updated.count !== 1) throw new GameError("ALREADY_USED", "Vật phẩm đã được sử dụng.");
    await tx.itemInstance.deleteMany({ where: { id: item.id, quantity: { lte: 0 } } });
    const data: Prisma.CharacterUpdateInput = {
      hp: Math.min(character.maxHp, character.hp + hpRestore * quantity),
      qi: Math.min(character.maxQi, character.qi + qiRestore * quantity),
      ...(breakthroughBps > 0 ? { breakthroughBonusBps: { increment: breakthroughBps * quantity } } : {})
    };
    await tx.character.update({
      where: { id: characterId },
      data
    });
    if (cultivation > 0) await addCultivationClamped(tx, characterId, BigInt(cultivation * quantity));
    await tx.gameLog.create({ data: { characterId, type: "inventory", message: `Sử dụng ${item.template.name} x${quantity}.` } });
    return { itemName: item.template.name, quantity };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

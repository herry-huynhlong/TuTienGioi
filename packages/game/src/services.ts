import { Prisma, type PrismaClient, ActivityStatus, Currency, WalletTxType, ListingStatus, ItemCategory } from "@ttg/db";
import { calculateCultivationReward, currentEnergy, explorationEnergyCost, parseEncounterTable, simulateCombat } from "./rules.js";
import { pickWeighted, seededRng, seedFromString } from "./rng.js";
import { recordOnboardingEvent } from "./onboarding.js";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient;

export class GameError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
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

export async function creditWallet(db: Db | Tx, characterId: string, currency: Currency, amount: bigint, type: WalletTxType, referenceType?: string, referenceId?: string, idempotencyKey?: string) {
  if (amount <= 0n) throw new GameError("INVALID_AMOUNT", "Số tiền không hợp lệ.");
  return isClient(db) ? db.$transaction((tx) => mutateWallet(tx, characterId, currency, amount, type, referenceType, referenceId, idempotencyKey)) : mutateWallet(db, characterId, currency, amount, type, referenceType, referenceId, idempotencyKey);
}

export async function debitWallet(db: Db | Tx, characterId: string, currency: Currency, amount: bigint, type: WalletTxType, referenceType?: string, referenceId?: string, idempotencyKey?: string) {
  if (amount <= 0n) throw new GameError("INVALID_AMOUNT", "Số tiền không hợp lệ.");
  return isClient(db) ? db.$transaction((tx) => mutateWallet(tx, characterId, currency, -amount, type, referenceType, referenceId, idempotencyKey)) : mutateWallet(db, characterId, currency, -amount, type, referenceType, referenceId, idempotencyKey);
}

export async function startCultivation(db: Db, characterId: string, minutes: number, now = new Date()) {
  const allowed = new Set([10, 30, 60, 240, 480]);
  if (!allowed.has(minutes)) throw new GameError("BAD_DURATION", "Thời gian tu luyện không hợp lệ.");
  const character = await db.character.findUniqueOrThrow({ where: { id: characterId }, include: { spiritualRoot: true } });
  const [activeCultivation, activeExploration, activeTravel] = await Promise.all([
    db.cultivationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.explorationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } }),
    db.travel.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } })
  ]);
  if (activeCultivation) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang có hoạt động tu luyện.");
  if (activeExploration) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang lịch luyện.");
  if (activeTravel) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang di chuyển.");
  const energy = currentEnergy(character, now);
  const cost = Math.max(1, Math.ceil(minutes / 30));
  if (energy < cost) throw new GameError("NO_ENERGY", "Không đủ Thể Lực.");
  const baseReward = BigInt(minutes * 10);
  return db.$transaction(async (tx) => {
    await tx.character.update({ where: { id: characterId }, data: { energyStored: energy - cost, energyUpdatedAt: now } });
    const activity = await tx.cultivationActivity.create({
      data: { characterId, startedAt: now, endsAt: new Date(now.getTime() + minutes * 60_000), baseReward, multiplierBps: character.spiritualRoot.multiplierBps }
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
    const character = await tx.character.update({ where: { id: characterId }, data: { cultivation: { increment: reward } }, include: { realmStage: { include: { realm: true } } } });
    await tx.gameLog.create({ data: { characterId, type: "cultivation", message: `Nhận ${reward.toString()} tu vi từ bế quan.` } });
    await tx.worldNews.create({ data: { title: `${character.name} hoàn thành tu luyện`, body: `${character.name} tích lũy thêm ${reward.toString()} tu vi.`, category: "cultivation" } });
    await recordOnboardingEvent(tx, characterId, "CULTIVATION_CLAIMED");
    return { reward, cultivation: character.cultivation };
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
    const chance = Math.min(9500, character.realmStage.breakthroughChanceBps + character.luck * 30);
    if (Math.floor(rng() * 10000) < chance) {
      await tx.character.update({ where: { id: characterId }, data: { realmStageId: next.id, maxHp: next.baseHp, maxQi: next.baseQi, hp: next.baseHp, qi: next.baseQi, lifespan: { increment: next.lifespanBonus } } });
      await tx.worldNews.create({ data: { title: `${character.name} đột phá ${next.name}`, body: `${character.name} bước sang ${next.name}, đạo tâm vang vọng.`, category: "realm", permanent: true } });
      return { success: true, stage: next.name };
    }
    const loss = character.cultivation / 20n;
    await tx.character.update({ where: { id: characterId }, data: { cultivation: { decrement: loss }, hp: Math.max(1, Math.floor(character.hp * 0.7)) } });
    await tx.gameLog.create({ data: { characterId, type: "realm", message: `Đột phá thất bại, hao tổn ${loss.toString()} tu vi.` } });
    return { success: false, loss };
  });
}

export async function startExploration(db: Db, characterId: string, minutes: number, now = new Date()) {
  if (![10, 30, 60].includes(minutes)) throw new GameError("BAD_DURATION", "Thời gian thám hiểm không hợp lệ.");
  const character = await db.character.findUniqueOrThrow({ where: { id: characterId }, include: { currentLocation: true } });
  const services = character.currentLocation?.services ?? [];
  if (!services.includes("explore") && !services.includes("pve")) {
    throw new GameError("LOCATION_NOT_EXPLOREABLE", "Địa điểm hiện tại không phù hợp để lịch luyện.");
  }
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
  const cost = explorationEnergyCost(minutes);
  if (energy < cost) throw new GameError("NO_ENERGY", "Không đủ Thể Lực.");
  return db.$transaction(async (tx) => {
    await tx.character.update({ where: { id: characterId }, data: { energyStored: energy - cost, energyUpdatedAt: now } });
    const activity = await tx.explorationActivity.create({ data: { characterId, zoneId, endsAt: new Date(now.getTime() + minutes * 60_000) } });
    await recordOnboardingEvent(tx, characterId, "EXPLORATION_STARTED");
    return activity;
  });
}

export async function claimExploration(db: Db, characterId: string, activityId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const job = await tx.explorationActivity.findUnique({ where: { id: activityId } });
    if (!job || job.characterId !== characterId) throw new GameError("NOT_FOUND", "Không tìm thấy chuyến thám hiểm.");
    if (job.status === ActivityStatus.CLAIMED) throw new GameError("ALREADY_CLAIMED", "Phần thưởng đã được nhận.");
    if (job.endsAt > now) throw new GameError("NOT_READY", "Chuyến thám hiểm chưa hoàn thành.");
    const resources = [{ key: "linh-thao", weight: 55 }, { key: "hac-thiet-quang", weight: 30 }, { key: "yeu-dan", weight: 15 }, { key: "monster-sign", weight: 20 }];
    const roll = pickWeighted(resources, seededRng(seedFromString(job.id)));
    const isMonsterEncounter = roll.key === "monster-sign";
    const template = isMonsterEncounter ? null : await tx.itemTemplate.findUniqueOrThrow({ where: { key: roll.key } });
    const updated = await tx.explorationActivity.updateMany({
      where: { id: activityId, characterId, status: ActivityStatus.ACTIVE, endsAt: { lte: now } },
      data: { status: ActivityStatus.CLAIMED, claimedAt: now, eventKey: isMonsterEncounter ? "monster-sign" : "found-resource", reward: isMonsterEncounter ? { encounter: "monster-sign" } : { item: roll.key, quantity: 1 } }
    });
    if (updated.count !== 1) throw new GameError("ALREADY_CLAIMED", "Phần thưởng đã được nhận.");
    if (isMonsterEncounter) {
      await tx.gameLog.create({ data: { characterId, type: "encounter", message: "Bạn phát hiện dấu vết yêu thú trong lúc lịch luyện.", metadata: { encounter: "monster-sign" } } });
      await recordOnboardingEvent(tx, characterId, "MONSTER_ENCOUNTERED");
      await recordOnboardingEvent(tx, characterId, "EXPLORATION_COMPLETED");
      return { itemName: "Dấu vết yêu thú" };
    }
    await tx.itemInstance.create({ data: { ownerId: characterId, templateId: template!.id, quantity: 1 } });
    await tx.gameLog.create({ data: { characterId, type: "exploration", message: `Thám hiểm nhận được ${template!.name}.` } });
    await recordOnboardingEvent(tx, characterId, "EXPLORATION_COMPLETED");
    return { itemName: template!.name };
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
        endsAt: new Date(now.getTime() + route.travelMinutes * 60_000),
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
    await tx.gameLog.create({ data: { characterId, type: "travel", message: `Đã tới ${travel.route.destination.name}. ${encounterResult.message}`, metadata: { encounter: encounter.key, result: encounterResult } } });
    await recordOnboardingEvent(tx, characterId, "TRAVEL_COMPLETED");
    return { destinationName: travel.route.destination.name, encounter: encounter.key, result: encounterResult };
  });
}

async function resolveTravelEncounter(tx: Tx, characterId: string, encounterKey: string, dangerLevel: number) {
  if (encounterKey === "resource-cache") {
    const template = await tx.itemTemplate.findFirst({ where: { key: { in: ["linh-thao", "hac-thiet-quang", "yeu-dan"] } }, orderBy: { key: "asc" } });
    if (!template) return { kind: encounterKey, message: "Bạn phát hiện dấu vết tài nguyên nhưng không thu được gì." };
    await tx.itemInstance.create({ data: { ownerId: characterId, templateId: template.id, quantity: 1 } });
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
    await tx.character.update({ where: { id: characterId }, data: { hp: remainingHp, cultivation: { increment: cultivationReward } } });
    await tx.combat.create({ data: { characterId, monsterKey: monster.key, winner: result.winner, log: result.log, reward: { source: "travel", cultivation: cultivationReward.toString() } } });
    return { kind: encounterKey, monsterKey: monster.key, monsterName: monster.name, winner: result.winner, cultivation: cultivationReward.toString(), message: result.winner === "player" ? `Bạn đánh lui ${monster.name} và nhận ${cultivationReward.toString()} tu vi.` : `${monster.name} cản đường, bạn bị thương nhưng vẫn thoát được.` };
  }

  if (encounterKey === "traveler") {
    await tx.character.update({ where: { id: characterId }, data: { reputation: { increment: 1 } } });
    return { kind: encounterKey, reputation: 1, message: "Bạn gặp một tu sĩ lữ hành và trao đổi tin tức, danh vọng tăng nhẹ." };
  }

  if (encounterKey === "rare-omen") {
    const cultivationReward = BigInt(50 + dangerLevel * 8);
    await tx.character.update({ where: { id: characterId }, data: { cultivation: { increment: cultivationReward }, luck: { increment: 1 } } });
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
    const reward = result.winner === "player" ? { cultivation: 80, linhThach: 30 } : { cultivation: 10, linhThach: 0 };
    if (reward.cultivation) await tx.character.update({ where: { id: characterId }, data: { cultivation: { increment: BigInt(reward.cultivation) } } });
    if (reward.linhThach) await creditWallet(tx, characterId, Currency.LINH_THACH, BigInt(reward.linhThach), WalletTxType.REWARD, "Monster", monsterKey);
    await tx.combat.create({ data: { characterId, monsterKey, winner: result.winner, log: result.log, reward } });
    await recordOnboardingEvent(tx, characterId, "MONSTER_ENCOUNTERED");
    if (result.winner === "player") await recordOnboardingEvent(tx, characterId, "MONSTER_DEFEATED");
    return { ...result, reward, monsterName: monster.name };
  });
}

export async function purchaseMarketListing(db: Db, buyerId: string, listingId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const listing = await tx.marketListing.findUnique({ where: { id: listingId }, include: { item: true } });
    if (!listing || listing.status !== ListingStatus.ACTIVE || listing.expiresAt < now) throw new GameError("LISTING_INACTIVE", "Vật phẩm đã được người khác mua.");
    if (listing.sellerId === buyerId) throw new GameError("SELF_BUY", "Không thể mua vật phẩm của chính mình.");
    if (listing.item.ownerId !== listing.sellerId) throw new GameError("LISTING_INACTIVE", "Vật phẩm không còn thuộc người bán.");
    const claimed = await tx.marketListing.updateMany({
      where: { id: listingId, status: ListingStatus.ACTIVE, expiresAt: { gt: now } },
      data: { status: ListingStatus.SOLD }
    });
    if (claimed.count !== 1) throw new GameError("LISTING_INACTIVE", "Vật phẩm đã được người khác mua.");
    const tax = (listing.price * 500n) / 10000n;
    await debitWallet(tx, buyerId, Currency.LINH_THACH, listing.price, WalletTxType.MARKET, "MarketListing", listingId, `buy:${listingId}`);
    await creditWallet(tx, listing.sellerId, Currency.LINH_THACH, listing.price - tax, WalletTxType.MARKET, "MarketListing", listingId, `sell:${listingId}`);
    await tx.itemInstance.update({ where: { id: listing.itemId }, data: { ownerId: buyerId } });
    await tx.marketTransaction.create({ data: { listingId, buyerId, sellerId: listing.sellerId, itemTemplateId: listing.item.templateId, quantity: listing.quantity, price: listing.price, tax } });
    return { price: listing.price, tax };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createMarketListing(db: Db, sellerId: string, itemId: string, price: bigint, now = new Date()) {
  if (price <= 0n) throw new GameError("INVALID_PRICE", "Giá bán không hợp lệ.");
  if (price > 999_999_999_999n) throw new GameError("INVALID_PRICE", "Giá bán quá lớn.");
  return db.$transaction(async (tx) => {
    const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: ListingStatus.ACTIVE } } } });
    if (!item || item.ownerId !== sellerId) throw new GameError("ITEM_NOT_FOUND", "Không tìm thấy vật phẩm.");
    if (item.equippedSlot) throw new GameError("ITEM_EQUIPPED", "Không thể rao bán vật phẩm đang trang bị.");
    if (!item.template.tradeable || item.bound) throw new GameError("ITEM_BOUND", "Vật phẩm này không thể giao dịch.");
    if (item.listings.length > 0) throw new GameError("ALREADY_LISTED", "Vật phẩm này đang được rao bán.");
    const listing = await tx.marketListing.create({
      data: {
        sellerId,
        itemId: item.id,
        quantity: item.quantity,
        price,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000)
      }
    });
    await tx.gameLog.create({ data: { characterId: sellerId, type: "market", message: `Rao bán ${item.template.name} với giá ${price.toString()} Linh Thạch.` } });
    return listing;
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

export async function consumeItem(db: Db, characterId: string, itemId: string) {
  return db.$transaction(async (tx) => {
    const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: ListingStatus.ACTIVE } } } });
    if (!item || item.ownerId !== characterId) throw new GameError("ITEM_NOT_FOUND", "Không tìm thấy vật phẩm.");
    if (item.template.category !== ItemCategory.CONSUMABLE) throw new GameError("NOT_CONSUMABLE", "Vật phẩm này không thể sử dụng.");
    if (item.listings.length > 0) throw new GameError("ITEM_LISTED", "Không thể dùng vật phẩm đang rao bán.");
    if (item.quantity <= 0) throw new GameError("INVALID_QUANTITY", "Số lượng vật phẩm không hợp lệ.");
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId } });
    const hpRestore = modifierValue(item.template.baseModifiers, "hpRestore");
    const qiRestore = modifierValue(item.template.baseModifiers, "qiRestore");
    const cultivation = modifierValue(item.template.baseModifiers, "cultivation");
    const updated = await tx.itemInstance.updateMany({
      where: { id: item.id, ownerId: characterId, quantity: { gt: 0 } },
      data: { quantity: { decrement: 1 } }
    });
    if (updated.count !== 1) throw new GameError("ALREADY_USED", "Vật phẩm đã được sử dụng.");
    await tx.itemInstance.deleteMany({ where: { id: item.id, quantity: { lte: 0 } } });
    const data: Prisma.CharacterUpdateInput = {
      hp: Math.min(character.maxHp, character.hp + hpRestore),
      qi: Math.min(character.maxQi, character.qi + qiRestore)
    };
    if (cultivation > 0) data.cultivation = { increment: BigInt(cultivation) };
    await tx.character.update({
      where: { id: characterId },
      data
    });
    await tx.gameLog.create({ data: { characterId, type: "inventory", message: `Sử dụng ${item.template.name}.` } });
    return { itemName: item.template.name };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

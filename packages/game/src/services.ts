import { Prisma, type PrismaClient, ActivityStatus, Currency, WalletTxType, ListingStatus } from "@ttg/db";
import { calculateCultivationReward, currentEnergy, parseEncounterTable, simulateCombat } from "./rules.js";
import { pickWeighted, seededRng, seedFromString } from "./rng.js";

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
  const active = await db.cultivationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } });
  if (active) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang có hoạt động tu luyện.");
  const energy = currentEnergy(character, now);
  const cost = Math.max(1, Math.ceil(minutes / 30));
  if (energy < cost) throw new GameError("NO_ENERGY", "Không đủ Thể Lực.");
  const baseReward = BigInt(minutes * 10);
  return db.$transaction(async (tx) => {
    await tx.character.update({ where: { id: characterId }, data: { energyStored: energy - cost, energyUpdatedAt: now } });
    return tx.cultivationActivity.create({
      data: { characterId, startedAt: now, endsAt: new Date(now.getTime() + minutes * 60_000), baseReward, multiplierBps: character.spiritualRoot.multiplierBps }
    });
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
  const character = await db.character.findUniqueOrThrow({ where: { id: characterId } });
  if (!character.locationId) throw new GameError("NO_LOCATION", "Bạn chưa có địa điểm.");
  const active = await db.explorationActivity.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } });
  if (active) throw new GameError("ACTIVE_ACTIVITY", "Bạn đang thám hiểm.");
  return db.explorationActivity.create({ data: { characterId, zoneId: character.locationId, endsAt: new Date(now.getTime() + minutes * 60_000) } });
}

export async function claimExploration(db: Db, characterId: string, activityId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const job = await tx.explorationActivity.findUnique({ where: { id: activityId } });
    if (!job || job.characterId !== characterId) throw new GameError("NOT_FOUND", "Không tìm thấy chuyến thám hiểm.");
    if (job.status === ActivityStatus.CLAIMED) throw new GameError("ALREADY_CLAIMED", "Phần thưởng đã được nhận.");
    if (job.endsAt > now) throw new GameError("NOT_READY", "Chuyến thám hiểm chưa hoàn thành.");
    const resources = [{ key: "linh-thao", weight: 55 }, { key: "hac-thiet-quang", weight: 30 }, { key: "yeu-dan", weight: 15 }];
    const roll = pickWeighted(resources, seededRng(seedFromString(job.id)));
    const template = await tx.itemTemplate.findUniqueOrThrow({ where: { key: roll.key } });
    const updated = await tx.explorationActivity.updateMany({
      where: { id: activityId, characterId, status: ActivityStatus.ACTIVE, endsAt: { lte: now } },
      data: { status: ActivityStatus.CLAIMED, claimedAt: now, eventKey: "found-resource", reward: { item: roll.key, quantity: 1 } }
    });
    if (updated.count !== 1) throw new GameError("ALREADY_CLAIMED", "Phần thưởng đã được nhận.");
    await tx.itemInstance.create({ data: { ownerId: characterId, templateId: template.id, quantity: 1 } });
    await tx.gameLog.create({ data: { characterId, type: "exploration", message: `Thám hiểm nhận được ${template.name}.` } });
    return { itemName: template.name };
  });
}

export async function startTravel(db: Db, characterId: string, routeId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const character = await tx.character.findUniqueOrThrow({
      where: { id: characterId },
      include: { currentLocation: true, location: true, realmStage: { include: { realm: true } } }
    });
    const activeTravel = await tx.travel.findFirst({ where: { characterId, status: ActivityStatus.ACTIVE } });
    if (activeTravel) throw new GameError("ACTIVE_TRAVEL", "Bạn đang di chuyển.");
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
    return { ...result, reward, monsterName: monster.name };
  });
}

export async function purchaseMarketListing(db: Db, buyerId: string, listingId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const listing = await tx.marketListing.findUnique({ where: { id: listingId }, include: { item: true } });
    if (!listing || listing.status !== ListingStatus.ACTIVE || listing.expiresAt < now) throw new GameError("LISTING_INACTIVE", "Vật phẩm đã được người khác mua.");
    if (listing.sellerId === buyerId) throw new GameError("SELF_BUY", "Không thể mua vật phẩm của chính mình.");
    const tax = (listing.price * 500n) / 10000n;
    await debitWallet(tx, buyerId, Currency.LINH_THACH, listing.price, WalletTxType.MARKET, "MarketListing", listingId, `buy:${listingId}`);
    await creditWallet(tx, listing.sellerId, Currency.LINH_THACH, listing.price - tax, WalletTxType.MARKET, "MarketListing", listingId, `sell:${listingId}`);
    await tx.marketListing.update({ where: { id: listingId }, data: { status: ListingStatus.SOLD } });
    await tx.itemInstance.update({ where: { id: listing.itemId }, data: { ownerId: buyerId } });
    await tx.marketTransaction.create({ data: { listingId, buyerId, sellerId: listing.sellerId, itemTemplateId: listing.item.templateId, quantity: listing.quantity, price: listing.price, tax } });
    return { price: listing.price, tax };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

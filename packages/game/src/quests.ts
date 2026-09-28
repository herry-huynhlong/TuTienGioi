import { Currency, Prisma, QuestObjectiveType, QuestStatus, QuestTriggerType, WalletTxType, type PrismaClient } from "@ttg/db";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient;

export class QuestError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

type QuestEventType = "TALK_TO_NPC" | "ENTER_LOCATION" | "MONSTER_KILLED" | "ITEM_OBTAINED" | "JOIN_SECT" | "REALM_REACHED" | "VISIT_SECT_PAGE";

type QuestEventInput = {
  characterId: string;
  eventType: QuestEventType;
  npcKey?: string;
  npcId?: string;
  locationId?: string | null;
  locationKey?: string;
  monsterKey?: string;
  itemKey?: string;
  realmOrder?: number;
  amount?: number;
};

type QuestReward = {
  cultivation?: number;
  linhThach?: number;
  tienNgoc?: number;
  items?: Array<{ key: string; quantity?: number }>;
  flags?: string[];
  unlocks?: string[];
};

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rewardFromJson(value: unknown): QuestReward {
  const data = jsonRecord(value);
  const items = Array.isArray(data.items)
    ? data.items.map(jsonRecord).flatMap((item) => typeof item.key === "string" ? [{ key: item.key, quantity: typeof item.quantity === "number" ? item.quantity : 1 }] : [])
    : [];
  return {
    ...(typeof data.cultivation === "number" ? { cultivation: data.cultivation } : {}),
    ...(typeof data.linhThach === "number" ? { linhThach: data.linhThach } : {}),
    ...(typeof data.tienNgoc === "number" ? { tienNgoc: data.tienNgoc } : {}),
    items,
    flags: Array.isArray(data.flags) ? data.flags.filter((flag): flag is string => typeof flag === "string") : [],
    unlocks: Array.isArray(data.unlocks) ? data.unlocks.filter((flag): flag is string => typeof flag === "string") : []
  };
}

function objectiveTarget(template: { objective: unknown }) {
  return jsonRecord(template.objective);
}

function eventMatches(template: { objectiveType: QuestObjectiveType; objective: unknown }, input: QuestEventInput, locationKey?: string | null) {
  const objective = objectiveTarget(template);
  const targetKey = typeof objective.targetKey === "string" ? objective.targetKey : undefined;
  const targetId = typeof objective.targetId === "string" ? objective.targetId : undefined;
  if (template.objectiveType === QuestObjectiveType.TALK_TO_NPC) return input.eventType === "TALK_TO_NPC" && Boolean((targetKey && input.npcKey === targetKey) || (targetId && input.npcId === targetId));
  if (template.objectiveType === QuestObjectiveType.VISIT_LOCATION) return input.eventType === "ENTER_LOCATION" && Boolean((targetKey && (input.locationKey === targetKey || locationKey === targetKey)) || (targetId && input.locationId === targetId));
  if (template.objectiveType === QuestObjectiveType.KILL_MONSTER) return input.eventType === "MONSTER_KILLED" && (!targetKey || input.monsterKey === targetKey);
  if (template.objectiveType === QuestObjectiveType.COLLECT_ITEM) return input.eventType === "ITEM_OBTAINED" && (!targetKey || input.itemKey === targetKey);
  if (template.objectiveType === QuestObjectiveType.JOIN_SECT) return input.eventType === "JOIN_SECT";
  if (template.objectiveType === QuestObjectiveType.REACH_REALM) return input.eventType === "REALM_REACHED" && (typeof objective.realmOrder !== "number" || (input.realmOrder ?? -1) >= objective.realmOrder);
  if (template.objectiveType === QuestObjectiveType.VISIT_SECT_PAGE) return input.eventType === "VISIT_SECT_PAGE";
  return false;
}

function questReadyStatus(template: { objective: unknown }) {
  const objective = objectiveTarget(template);
  return objective.requireTurnIn === false ? QuestStatus.COMPLETED : QuestStatus.READY_TO_TURN_IN;
}

async function applyQuestReward(tx: Tx, characterId: string, quest: { id: string; template: { key: string; title: string; reward: unknown; flagsOnComplete: string[] } }) {
  const reward = rewardFromJson(quest.template.reward);
  if (reward.cultivation && reward.cultivation > 0) {
    await tx.character.update({ where: { id: characterId }, data: { cultivation: { increment: BigInt(reward.cultivation) } } });
  }
  if (reward.linhThach && reward.linhThach > 0) {
    await creditQuestWallet(tx, characterId, Currency.LINH_THACH, BigInt(reward.linhThach), quest);
  }
  if (reward.tienNgoc && reward.tienNgoc > 0) {
    await creditQuestWallet(tx, characterId, Currency.TIEN_NGOC, BigInt(reward.tienNgoc), quest);
  }
  for (const item of reward.items ?? []) {
    const template = await tx.itemTemplate.findUnique({ where: { key: item.key } });
    if (!template) continue;
    await tx.itemInstance.create({ data: { ownerId: characterId, templateId: template.id, quantity: Math.max(1, item.quantity ?? 1) } });
  }
  for (const flag of [...quest.template.flagsOnComplete, ...(reward.flags ?? []), ...(reward.unlocks ?? [])]) {
    await tx.characterQuestFlag.upsert({
      where: { characterId_key: { characterId, key: flag } },
      update: { value: { source: quest.template.key } },
      create: { characterId, key: flag, value: { source: quest.template.key } }
    });
  }
  await tx.gameLog.create({ data: { characterId, type: "quest", message: `Hoàn thành nhiệm vụ: ${quest.template.title}.`, metadata: { questKey: quest.template.key, reward: quest.template.reward } as Prisma.InputJsonValue } });
}

async function creditQuestWallet(tx: Tx, characterId: string, currency: Currency, amount: bigint, quest: { id: string; template: { key: string } }) {
  const field = currency === Currency.LINH_THACH ? "linhThach" : "tienNgoc";
  const before = await tx.character.findUniqueOrThrow({ where: { id: characterId }, select: { linhThach: true, tienNgoc: true } });
  const balanceBefore = before[field];
  const balanceAfter = balanceBefore + amount;
  await tx.character.update({ where: { id: characterId }, data: { [field]: balanceAfter } });
  await tx.walletTransaction.create({
    data: {
      characterId,
      currency,
      type: WalletTxType.REWARD,
      amount,
      balanceBefore,
      balanceAfter,
      referenceType: "Quest",
      referenceId: quest.template.key,
      idempotencyKey: `quest:${quest.id}:${currency.toLowerCase()}`
    }
  });
}

async function completeQuestNow(tx: Tx, questId: string, characterId: string, now: Date) {
  const quest = await tx.characterQuest.findUniqueOrThrow({ where: { id: questId }, include: { template: true } });
  if (quest.status === QuestStatus.COMPLETED) return quest;
  await applyQuestReward(tx, characterId, quest);
  return tx.characterQuest.update({ where: { id: questId }, data: { status: QuestStatus.COMPLETED, progress: quest.targetCount, completedAt: now } });
}

async function locationKeyForEvent(tx: Tx, input: QuestEventInput) {
  if (input.locationKey) return input.locationKey;
  if (!input.locationId) return null;
  const location = await tx.location.findUnique({ where: { id: input.locationId }, select: { key: true } });
  return location?.key ?? null;
}

export async function getAvailableQuestTemplates(tx: Tx, characterId: string, startNpcId?: string) {
  const existing = await tx.characterQuest.findMany({ where: { characterId }, include: { template: true } });
  const completed = new Set(existing.filter((quest) => quest.status === QuestStatus.COMPLETED).map((quest) => quest.template.key));
  const taken = new Set(existing.map((quest) => quest.templateId));
  const templates = await tx.questTemplate.findMany({
    where: { active: true, ...(startNpcId ? { startNpcId } : {}) },
    orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }]
  });
  return templates.filter((template) => {
    if (!template.repeatable && taken.has(template.id)) return false;
    if (template.prerequisiteKey && !completed.has(template.prerequisiteKey)) return false;
    return true;
  });
}

export async function acceptQuest(db: Db, characterId: string, templateIdOrKey: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const template = await tx.questTemplate.findFirst({ where: { OR: [{ id: templateIdOrKey }, { key: templateIdOrKey }], active: true } });
    if (!template) throw new QuestError("QUEST_NOT_FOUND", "Nhiệm vụ không tồn tại.");
    const available = await getAvailableQuestTemplates(tx, characterId, template.startNpcId ?? undefined);
    if (!available.some((entry) => entry.id === template.id)) throw new QuestError("QUEST_LOCKED", "Nhiệm vụ này chưa thể nhận.");
    const quest = await tx.characterQuest.upsert({
      where: { characterId_templateId: { characterId, templateId: template.id } },
      update: {},
      create: { characterId, templateId: template.id, progress: 0, targetCount: template.targetCount, startedAt: now }
    });
    await tx.gameLog.create({ data: { characterId, type: "quest", message: `Nhận nhiệm vụ: ${template.title}.`, metadata: { questKey: template.key } } });
    return quest;
  });
}

export async function progressQuestEvent(db: Db | Tx, input: QuestEventInput, now = new Date()) {
  const runner = async (tx: Tx) => {
    const amount = Math.max(1, input.amount ?? 1);
    const locationKey = await locationKeyForEvent(tx, input);
    const active = await tx.characterQuest.findMany({
      where: { characterId: input.characterId, status: QuestStatus.ACTIVE },
      include: { template: true }
    });
    const changed = [];
    for (const quest of active) {
      if (!eventMatches(quest.template, input, locationKey)) continue;
      const progress = Math.min(quest.targetCount, quest.progress + amount);
      const nextStatus = progress >= quest.targetCount ? questReadyStatus(quest.template) : QuestStatus.ACTIVE;
      const updated = await tx.characterQuest.update({ where: { id: quest.id }, data: { progress, status: nextStatus, readyAt: nextStatus === QuestStatus.READY_TO_TURN_IN ? now : quest.readyAt } });
      if (nextStatus === QuestStatus.COMPLETED) {
        await applyQuestReward(tx, input.characterId, quest);
        await tx.characterQuest.update({ where: { id: quest.id }, data: { completedAt: now } });
      }
      changed.push(updated);
    }
    return changed;
  };
  return "$transaction" in db ? db.$transaction(runner) : runner(db);
}

export async function talkToNpc(db: Db, characterId: string, npcKey: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const npc = await tx.npc.findUnique({ where: { key: npcKey }, include: { location: true, dialogueSet: { include: { nodes: { include: { choices: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } } } } });
    if (!npc || !npc.active) throw new QuestError("NPC_NOT_FOUND", "Không tìm thấy NPC.");
    await progressQuestEvent(tx, { characterId, eventType: "TALK_TO_NPC", npcId: npc.id, npcKey }, now);
    const available = await getAvailableQuestTemplates(tx, characterId, npc.id);
    const quests = await tx.characterQuest.findMany({
      where: { characterId, template: { OR: [{ startNpcId: npc.id }, { turnInNpcId: npc.id }] } },
      include: { template: true },
      orderBy: { updatedAt: "desc" }
    });
    return { npc, available, quests };
  });
}

export async function completeQuest(db: Db, characterId: string, questId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const quest = await tx.characterQuest.findUnique({ where: { id: questId }, include: { template: true } });
    if (!quest || quest.characterId !== characterId) throw new QuestError("QUEST_NOT_FOUND", "Không tìm thấy nhiệm vụ.");
    if (quest.status !== QuestStatus.READY_TO_TURN_IN) throw new QuestError("QUEST_NOT_READY", "Nhiệm vụ chưa thể nộp.");
    return completeQuestNow(tx, quest.id, characterId, now);
  });
}

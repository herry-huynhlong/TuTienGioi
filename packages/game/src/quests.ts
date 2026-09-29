import { Currency, Prisma, QuestObjectiveType, QuestStatus, QuestTriggerType, WalletTxType, type PrismaClient } from "@ttg/db";
import { addItemToInventory } from "./inventory.js";

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

type DialogueProfile = {
  first?: string;
  repeat?: string;
  moved?: string;
  helped?: string;
  activeQuest?: string;
  readyQuest?: string;
  locked?: string;
  friendly?: string;
};

type QuestWithTemplate = {
  id: string;
  status: QuestStatus;
  progress: number;
  targetCount: number;
  template: {
    key: string;
    title: string;
    description: string;
    objectiveType: QuestObjectiveType;
    reward: unknown;
    flagsOnComplete: string[];
  };
};

export type NpcInteractionDialogue = {
  speaker: string;
  text: string;
  state: "first" | "repeat" | "moved" | "helped" | "activeQuest" | "readyQuest" | "friendly" | "locked";
  choices: Array<{ id: string; label: string; action: string | null; nextNodeKey: string | null }>;
};

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
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
    flags: stringArray(data.flags),
    unlocks: stringArray(data.unlocks)
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

export function npcRelationshipState(score: number) {
  if (score >= 60) return "Thân hữu";
  if (score >= 30) return "Thiện cảm";
  if (score >= 10) return "Quen biết";
  return "Xa lạ";
}

export function npcDialogueState(context: { previouslyMet: boolean; movedSinceLastMeeting: boolean; helped: boolean; relationshipScore: number; activeQuestCount: number; readyQuestCount: number; availableQuestCount: number }): NpcInteractionDialogue["state"] {
  if (context.readyQuestCount > 0) return "readyQuest";
  if (context.activeQuestCount > 0) return "activeQuest";
  if (context.helped) return "helped";
  if (context.movedSinceLastMeeting) return "moved";
  if (context.relationshipScore >= 30) return "friendly";
  if (context.previouslyMet) return "repeat";
  return context.availableQuestCount > 0 ? "first" : "locked";
}

function dialogueProfile(npc: { metadata: unknown; description: string }): DialogueProfile {
  const metadata = jsonRecord(npc.metadata);
  return jsonRecord(metadata.dialogueProfile) as DialogueProfile;
}

function movementProfile(npc: { metadata: unknown }) {
  return jsonRecord(jsonRecord(npc.metadata).movementProfile);
}

function firstString(...values: Array<unknown>) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function choice(id: string, label: string, action: string | null = null, nextNodeKey: string | null = null) {
  return { id, label, action, nextNodeKey };
}

async function ensureNpcWorldState(tx: Tx, npc: { id: string; locationId: string; spawnMode: string; metadata: unknown }) {
  const profile = movementProfile(npc);
  const route = Array.isArray(profile.route) ? profile.route : [];
  const schedule = jsonRecord(profile.schedule);
  const movementType = firstString(profile.type, String(npc.spawnMode).toLowerCase()) ?? "fixed";
  return tx.npcWorldState.upsert({
    where: { npcId: npc.id },
    update: {},
    create: {
      npcId: npc.id,
      currentLocationId: npc.locationId,
      movementType,
      route: route as Prisma.InputJsonValue,
      schedule: schedule as Prisma.InputJsonValue,
      state: {}
    }
  });
}

async function resolveNpcLocation(tx: Tx, npc: { id: string; locationId: string; spawnMode: string; metadata: unknown }) {
  const state = await ensureNpcWorldState(tx, npc);
  const location = await tx.location.findUniqueOrThrow({ where: { id: state.currentLocationId }, include: { zone: { include: { region: true } } } });
  return { state, location };
}

async function touchPlayerNpcState(tx: Tx, characterId: string, npcId: string, locationId: string, now: Date) {
  const previous = await tx.playerNpcState.findUnique({ where: { characterId_npcId: { characterId, npcId } } });
  const nextScore = previous ? previous.relationshipScore : 0;
  const state = await tx.playerNpcState.upsert({
    where: { characterId_npcId: { characterId, npcId } },
    update: {
      lastMetAt: now,
      timesMet: { increment: 1 },
      lastLocationMetId: locationId,
      relationshipState: npcRelationshipState(nextScore)
    },
    create: {
      characterId,
      npcId,
      firstMetAt: now,
      lastMetAt: now,
      timesMet: 1,
      lastLocationMetId: locationId,
      relationshipState: npcRelationshipState(0)
    }
  });
  return { previous, state };
}

async function playerQuestFlags(tx: Tx, characterId: string) {
  const flags = await tx.characterQuestFlag.findMany({ where: { characterId }, select: { key: true } });
  return new Set(flags.map((flag) => flag.key));
}

async function templateAvailableByConditions(tx: Tx, template: { objective: unknown; prerequisiteKey: string | null }, context: { characterId: string; flags: Set<string>; relationshipScore: number }) {
  const objective = objectiveTarget(template);
  const requiredFlags = stringArray(objective.requiredFlags);
  if (requiredFlags.some((flag) => !context.flags.has(flag))) return false;
  if (typeof objective.requiredRelationship === "number" && context.relationshipScore < objective.requiredRelationship) return false;
  if (typeof objective.requiredRealm === "number") {
    const character = await tx.character.findUnique({ where: { id: context.characterId }, select: { realmStage: { select: { realm: { select: { order: true } } } } } });
    if (!character || character.realmStage.realm.order < objective.requiredRealm) return false;
  }
  return true;
}

export async function getAvailableQuestTemplates(tx: Tx, characterId: string, startNpcId?: string) {
  const [existing, flags, npcState] = await Promise.all([
    tx.characterQuest.findMany({ where: { characterId }, include: { template: true } }),
    playerQuestFlags(tx, characterId),
    startNpcId ? tx.playerNpcState.findUnique({ where: { characterId_npcId: { characterId, npcId: startNpcId } } }) : null
  ]);
  const completed = new Set(existing.filter((quest) => quest.status === QuestStatus.COMPLETED).map((quest) => quest.template.key));
  const taken = new Set(existing.map((quest) => quest.templateId));
  const templates = await tx.questTemplate.findMany({
    where: { active: true, ...(startNpcId ? { startNpcId } : {}) },
    orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }]
  });
  const result = [];
  for (const template of templates) {
    if (!template.repeatable && taken.has(template.id)) continue;
    if (template.prerequisiteKey && !completed.has(template.prerequisiteKey)) continue;
    if (!(await templateAvailableByConditions(tx, template, { characterId, flags, relationshipScore: npcState?.relationshipScore ?? 0 }))) continue;
    result.push(template);
  }
  return result;
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
    await addItemToInventory(tx, characterId, template.id, Math.max(1, item.quantity ?? 1));
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

async function applyNpcQuestEffects(tx: Tx, characterId: string, quest: { template: { key: string; reward: unknown; turnInNpcId: string | null } }, now: Date) {
  if (!quest.template.turnInNpcId) return;
  const reward = jsonRecord(quest.template.reward);
  const npcEffect = jsonRecord(reward.npc);
  const relationshipDelta = typeof npcEffect.relationshipScore === "number" ? npcEffect.relationshipScore : 8;
  const state = await tx.playerNpcState.upsert({
    where: { characterId_npcId: { characterId, npcId: quest.template.turnInNpcId } },
    update: {
      relationshipScore: { increment: relationshipDelta },
      relationshipState: npcRelationshipState(relationshipDelta),
      flags: { helped: true, [`completed:${quest.template.key}`]: true } as Prisma.InputJsonValue
    },
    create: {
      characterId,
      npcId: quest.template.turnInNpcId,
      firstMetAt: now,
      lastMetAt: now,
      timesMet: 1,
      relationshipScore: relationshipDelta,
      relationshipState: npcRelationshipState(relationshipDelta),
      flags: { helped: true, [`completed:${quest.template.key}`]: true } as Prisma.InputJsonValue
    }
  });
  await tx.playerNpcState.update({ where: { id: state.id }, data: { relationshipState: npcRelationshipState(state.relationshipScore) } });

  const moveTo = firstString(npcEffect.moveToLocationKey, npcEffect.moveTo);
  if (moveTo) {
    const location = await tx.location.findUnique({ where: { key: moveTo } });
    if (location) await moveNpc(tx, quest.template.turnInNpcId, location.id, firstString(npcEffect.movementType) ?? "questDriven", { questKey: quest.template.key }, now);
  }
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
  await applyNpcQuestEffects(tx, characterId, quest, now);
  return tx.characterQuest.update({ where: { id: questId }, data: { status: QuestStatus.COMPLETED, progress: quest.targetCount, completedAt: now } });
}

async function locationKeyForEvent(tx: Tx, input: QuestEventInput) {
  if (input.locationKey) return input.locationKey;
  if (!input.locationId) return null;
  const location = await tx.location.findUnique({ where: { id: input.locationId }, select: { key: true } });
  return location?.key ?? null;
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
      create: { characterId, templateId: template.id, progress: 0, targetCount: template.targetCount, startedAt: now, state: { acceptedFromNpcId: template.startNpcId } }
    });
    if (template.startNpcId) {
      await tx.playerNpcState.upsert({
        where: { characterId_npcId: { characterId, npcId: template.startNpcId } },
        update: { questState: { [`active:${template.key}`]: true } as Prisma.InputJsonValue },
        create: { characterId, npcId: template.startNpcId, firstMetAt: now, lastMetAt: now, timesMet: 1, questState: { [`active:${template.key}`]: true } as Prisma.InputJsonValue }
      });
    }
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
        await applyNpcQuestEffects(tx, input.characterId, quest, now);
        await tx.characterQuest.update({ where: { id: quest.id }, data: { completedAt: now } });
      }
      changed.push(updated);
    }
    return changed;
  };
  return "$transaction" in db ? db.$transaction(runner) : runner(db);
}

function chooseDialogue(npc: { name: string; description: string; metadata: unknown }, context: { previous: { timesMet: number; lastLocationMetId: string | null; relationshipScore: number; flags: unknown } | null; locationId: string; activeQuests: QuestWithTemplate[]; readyQuests: QuestWithTemplate[]; availableCount: number }) {
  const profile = dialogueProfile(npc);
  const flags = jsonRecord(context.previous?.flags);
  const helped = flags.helped === true || Object.keys(flags).some((key) => key.startsWith("completed:"));
  const moved = Boolean(context.previous && context.previous.timesMet > 0 && context.previous.lastLocationMetId && context.previous.lastLocationMetId !== context.locationId);
  const state = npcDialogueState({
    previouslyMet: Boolean(context.previous),
    movedSinceLastMeeting: moved,
    helped,
    relationshipScore: context.previous?.relationshipScore ?? 0,
    activeQuestCount: context.activeQuests.length,
    readyQuestCount: context.readyQuests.length,
    availableQuestCount: context.availableCount
  });
  const text = firstString(
    state === "readyQuest" ? profile.readyQuest : undefined,
    state === "activeQuest" ? profile.activeQuest : undefined,
    state === "helped" ? profile.helped : undefined,
    state === "moved" ? profile.moved : undefined,
    state === "friendly" ? profile.friendly : undefined,
    state === "repeat" ? profile.repeat : undefined,
    state === "first" ? profile.first : undefined,
    profile.locked,
    npc.description
  )!;
  const choices = [
    ...(context.readyQuests.length ? [choice("turn-in", "Nộp nhiệm vụ", "TURN_IN")] : []),
    ...(context.availableCount ? [choice("accept-quest", "Nhận nhiệm vụ", "QUEST")] : []),
    ...(context.activeQuests.length ? [choice("ask-progress", "Hỏi lại mục tiêu", "QUEST_STATUS")] : []),
    choice("ask-place", "Hỏi về nơi này", "LORE"),
    choice("leave", "Rời đi", null)
  ];
  return { speaker: npc.name, text, state, choices };
}

export async function talkToNpc(db: Db, characterId: string, npcKey: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const npc = await tx.npc.findUnique({ where: { key: npcKey }, include: { location: true, dialogueSet: { include: { nodes: { include: { choices: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } } } } });
    if (!npc || !npc.active) throw new QuestError("NPC_NOT_FOUND", "Không tìm thấy NPC.");
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, select: { currentLocationId: true } });
    const resolved = await resolveNpcLocation(tx, npc);
    if (character.currentLocationId && character.currentLocationId !== resolved.location.id) throw new QuestError("NPC_NOT_HERE", "NPC này hiện không ở địa điểm của bạn.");
    const previous = await tx.playerNpcState.findUnique({ where: { characterId_npcId: { characterId, npcId: npc.id } } });
    await progressQuestEvent(tx, { characterId, eventType: "TALK_TO_NPC", npcId: npc.id, npcKey }, now);
    const available = await getAvailableQuestTemplates(tx, characterId, npc.id);
    const quests = await tx.characterQuest.findMany({
      where: { characterId, template: { OR: [{ startNpcId: npc.id }, { turnInNpcId: npc.id }] } },
      include: { template: true },
      orderBy: { updatedAt: "desc" }
    });
    const activeQuests = quests.filter((quest) => quest.status === QuestStatus.ACTIVE);
    const readyQuests = quests.filter((quest) => quest.status === QuestStatus.READY_TO_TURN_IN);
    const dialogue = chooseDialogue(npc, { previous, locationId: resolved.location.id, activeQuests, readyQuests, availableCount: available.length });
    const touched = await touchPlayerNpcState(tx, characterId, npc.id, resolved.location.id, now);
    await tx.playerNpcState.update({ where: { id: touched.state.id }, data: { lastDialogueNode: dialogue.state } });
    return { npc, currentLocation: resolved.location, worldState: resolved.state, playerNpcState: touched.state, dialogue, available, quests };
  });
}

export async function completeQuest(db: Db, characterId: string, questId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const quest = await tx.characterQuest.findUnique({ where: { id: questId }, include: { template: true } });
    if (!quest || quest.characterId !== characterId) throw new QuestError("QUEST_NOT_FOUND", "Không tìm thấy nhiệm vụ.");
    if (quest.status !== QuestStatus.READY_TO_TURN_IN) throw new QuestError("QUEST_NOT_READY", "Nhiệm vụ chưa thể nộp.");
    return completeQuestNow(tx, quest.id, characterId, now);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function moveNpc(db: Db | Tx, npcId: string, locationId: string, movementType = "eventDriven", state: Record<string, unknown> = {}, now = new Date()) {
  const runner = async (tx: Tx) => tx.npcWorldState.upsert({
    where: { npcId },
    update: { currentLocationId: locationId, movementType, state: state as Prisma.InputJsonValue, movedAt: now },
    create: { npcId, currentLocationId: locationId, movementType, state: state as Prisma.InputJsonValue, route: [], schedule: {}, movedAt: now }
  });
  return "$transaction" in db ? db.$transaction(runner) : runner(db);
}

export async function getNpcsAtLocation(db: Db, characterId: string, locationId: string) {
  return db.$transaction(async (tx) => {
    const worldRows = await tx.npcWorldState.findMany({
      where: { currentLocationId: locationId, npc: { active: true } },
      include: { npc: { include: { questStarts: true, questTurnIns: true } } },
      orderBy: { npc: { name: "asc" } }
    });
    const withWorld = new Set(worldRows.map((row) => row.npcId));
    const staticRows = await tx.npc.findMany({
      where: { active: true, locationId, id: { notIn: [...withWorld] } },
      include: { questStarts: true, questTurnIns: true },
      orderBy: { name: "asc" }
    });
    const states = await tx.playerNpcState.findMany({ where: { characterId, npcId: { in: [...worldRows.map((row) => row.npcId), ...staticRows.map((npc) => npc.id)] } } });
    const stateByNpc = new Map(states.map((state) => [state.npcId, state]));
    return [
      ...worldRows.map((row) => ({ ...row.npc, worldState: row, playerState: stateByNpc.get(row.npcId) ?? null })),
      ...staticRows.map((npc) => ({ ...npc, worldState: null, playerState: stateByNpc.get(npc.id) ?? null }))
    ];
  });
}

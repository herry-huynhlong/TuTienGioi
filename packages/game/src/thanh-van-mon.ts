import { Currency, EquipmentSlot, ItemCategory, Prisma, QuestStatus, Rarity, SectLogType, SectRoleName, WalletTxType, type PrismaClient } from "@ttg/db";
import { addItemToInventory } from "./inventory.js";
import { creditWallet } from "./services.js";
import { innerRequirementForRootQuality, getThanhVanRuntimeState, THANH_VAN_TAG, type ThanhVanMembershipState } from "./sect-access.js";
import { progressQuestEvent } from "./quests.js";
import { changeSectContribution } from "./sect-contribution.js";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient;

export class ThanhVanError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const spiritualRootFlag = "thanh_van_spiritual_root_revealed";
const highTalentFlag = "thanh_van_high_talent_noticed";
const elderInterestFlag = "thanh_van_elder_interest";
const outerJoinedFlag = "joined_thanh_van_outer";
const innerRequestedFlag = "thanh_van_inner_exam_requested";
const innerPassedFlag = "thanh_van_inner_exam_passed";

export function thanhVanRoleLabel(state: ThanhVanMembershipState) {
  return {
    OUTSIDER: "Người ngoài",
    APPLICANT: "Ứng viên nhập môn",
    OUTER_DISCIPLE: "Ngoại Môn Đệ Tử",
    INNER_DISCIPLE: "Nội Môn Đệ Tử",
    TRUE_DISCIPLE: "Chân Truyền Đệ Tử"
  }[state];
}

function rootReaction(root: { name: string; quality: string; elements: string[]; multiplierBps: number }) {
  const elementText = root.elements.length ? root.elements.join(", ") : "không rõ hệ";
  const speed = `${Math.round(root.multiplierBps / 100)}%`;
  if (root.quality.includes("Cực") || root.quality.includes("Biến")) return `Trắc Linh Ngọc sáng rực. ${root.name} (${elementText}) là tư chất hiếm, tốc độ tu luyện khoảng ${speed}. Trưởng lão đã chú ý tới ngươi.`;
  if (root.quality.includes("Thượng")) return `${root.name} (${elementText}) thuộc hàng tốt, tốc độ tu luyện khoảng ${speed}. Chỉ cần giữ căn cơ vững, Nội Môn không xa.`;
  if (root.quality.includes("Trung")) return `${root.name} (${elementText}) ổn định, tốc độ tu luyện khoảng ${speed}. Hãy dùng nhiệm vụ và đan dược để bù tích lũy.`;
  return `${root.name} (${elementText}) không nổi bật, tốc độ tu luyện khoảng ${speed}. Thanh Vân Môn không chặn đường, nhưng ngươi cần nhiều công lao hơn.`;
}

async function upsertFlag(tx: Tx, characterId: string, key: string, value: Prisma.InputJsonValue = {}) {
  return tx.characterQuestFlag.upsert({
    where: { characterId_key: { characterId, key } },
    update: { value },
    create: { characterId, key, value }
  });
}

async function ensureItemTemplate(tx: Tx, input: { key: string; name: string; category: ItemCategory; rarity: Rarity; description: string; stackable?: boolean; maxStack?: number; tradeable?: boolean; equipSlot?: EquipmentSlot | null; baseModifiers?: Prisma.InputJsonValue; bindRules?: Prisma.InputJsonValue }) {
  return tx.itemTemplate.upsert({
    where: { key: input.key },
    update: {
      name: input.name,
      category: input.category,
      rarity: input.rarity,
      description: input.description,
      stackable: input.stackable ?? false,
      maxStack: input.maxStack ?? 1,
      tradeable: input.tradeable ?? false,
      equipSlot: input.equipSlot ?? null,
      baseModifiers: input.baseModifiers ?? {},
      bindRules: input.bindRules ?? {}
    },
    create: {
      key: input.key,
      name: input.name,
      category: input.category,
      rarity: input.rarity,
      description: input.description,
      stackable: input.stackable ?? false,
      maxStack: input.maxStack ?? 1,
      tradeable: input.tradeable ?? false,
      equipSlot: input.equipSlot ?? null,
      baseModifiers: input.baseModifiers ?? {},
      bindRules: input.bindRules ?? {}
    }
  });
}

async function ensureThanhVanStarterItems(tx: Tx) {
  await ensureItemTemplate(tx, {
    key: "thanh-van-dan-khi-quyet",
    name: "Thanh Vân Dẫn Khí Quyết",
    category: ItemCategory.TECHNIQUE,
    rarity: Rarity.HA,
    description: "Bản nhập môn ghi cách dẫn khí ổn định của Thanh Vân Môn. Dùng làm pháp quyết căn bản cho ngoại môn.",
    tradeable: false,
    baseModifiers: { cultivationModifierBps: 250 },
    bindRules: { itemType: "manual", school: "Thanh Vân Môn", role: "OUTER" }
  });
  await ensureItemTemplate(tx, {
    key: "thanh-van-noi-mon-dao-bao",
    name: "Thanh Vân Nội Môn Đạo Bào",
    category: ItemCategory.EQUIPMENT,
    rarity: Rarity.TRUNG,
    description: "Đạo bào nội môn thêu vân văn hộ thân, tượng trưng cho thân phận đã qua khảo hạch.",
    tradeable: false,
    equipSlot: EquipmentSlot.ARMOR,
    baseModifiers: { defense: 8, maxHp: 24 },
    bindRules: { itemType: "robe", school: "Thanh Vân Môn", role: "INNER" }
  });
  await ensureItemTemplate(tx, {
    key: "thanh-van-chan-truyen-dao-bao",
    name: "Thanh Vân Chân Truyền Đạo Bào",
    category: ItemCategory.EQUIPMENT,
    rarity: Rarity.THUONG,
    description: "Đạo bào Chân Truyền thêu thanh vân lôi văn, chỉ ban cho đệ tử đã được sư phụ bảo chứng và vượt qua khảo hạch đại điện.",
    tradeable: false,
    equipSlot: EquipmentSlot.ARMOR,
    baseModifiers: { defense: 16, maxHp: 48, qiRegenBps: 150 },
    bindRules: { itemType: "robe", school: "Thanh Vân Môn", role: "TRUE_DISCIPLE" }
  });
}

async function grantItemByKey(tx: Tx, characterId: string, key: string, quantity: number) {
  const template = await tx.itemTemplate.findUnique({ where: { key } });
  if (!template) throw new ThanhVanError("ITEM_TEMPLATE_NOT_FOUND", `Thiếu vật phẩm: ${key}.`);
  await addItemToInventory(tx, characterId, template.id, quantity);
  return template;
}

async function mutateContribution(tx: Tx, sectId: string, characterId: string, amount: number, reason: string, idempotencyKey: string) {
  try {
    return await changeSectContribution(tx, { sectId, characterId, delta: amount, sourceType: "THANH_VAN_RUNTIME", reason, sourceId: reason, idempotencyKey });
  } catch (error) {
    if (error instanceof Error) throw new ThanhVanError("CONTRIBUTION_CHANGE_FAILED", error.message);
    throw error;
  }
}

export async function revealThanhVanSpiritualRoot(db: Db, characterId: string) {
  return db.$transaction(async (tx) => {
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { spiritualRoot: true } });
    const npc = await tx.npc.findUnique({ where: { key: "tan-hoai-ngoc" } });
    if (npc) {
      await tx.playerNpcState.upsert({
        where: { characterId_npcId: { characterId, npcId: npc.id } },
        update: { relationshipScore: { increment: 5 }, flags: { spiritualRootTested: true } },
        create: { characterId, npcId: npc.id, firstMetAt: new Date(), lastMetAt: new Date(), timesMet: 1, relationshipScore: 5, relationshipState: "Quen biết", flags: { spiritualRootTested: true } }
      });
    }
    const payload = { root: character.spiritualRoot.name, quality: character.spiritualRoot.quality, multiplierBps: character.spiritualRoot.multiplierBps, testedAt: new Date().toISOString() };
    await upsertFlag(tx, characterId, spiritualRootFlag, payload);
    const isHighTalent = character.spiritualRoot.quality.includes("Cực") || character.spiritualRoot.quality.includes("Biến") || character.spiritualRoot.quality.includes("Thượng");
    if (isHighTalent) await upsertFlag(tx, characterId, highTalentFlag, { source: spiritualRootFlag });
    if (isHighTalent || character.spiritualRoot.elements.some((element) => element === "Kim" || element === "Hỏa")) await upsertFlag(tx, characterId, elderInterestFlag, { source: spiritualRootFlag });
    await tx.characterQuest.updateMany({
      where: { characterId, status: QuestStatus.ACTIVE, template: { key: "nhap-thanh-van-3" } },
      data: { progress: 1, status: QuestStatus.READY_TO_TURN_IN, readyAt: new Date() }
    });
    return { root: character.spiritualRoot, message: rootReaction(character.spiritualRoot) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function completeThanhVanAdmission(db: Db, characterId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const sect = await tx.sect.findUniqueOrThrow({ where: { tag: THANH_VAN_TAG } });
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { sectMember: true } });
    if (character.sectMember?.sectId === sect.id) return { alreadyJoined: true, role: character.sectMember.role };
    if (character.sectId && character.sectId !== sect.id) throw new ThanhVanError("IN_OTHER_SECT", "Bạn đã thuộc tông môn khác.");
    const exam = await tx.characterQuest.findFirst({
      where: { characterId, template: { key: "nhap-thanh-van-4" }, status: QuestStatus.COMPLETED },
      select: { id: true }
    });
    if (!exam) throw new ThanhVanError("ENTRY_EXAM_REQUIRED", "Bạn cần hoàn thành khảo hạch nhập môn trước khi nhận lệnh bài.");
    await ensureThanhVanStarterItems(tx);
    await tx.character.update({ where: { id: characterId }, data: { sectId: sect.id } });
    await tx.sectMember.create({ data: { sectId: sect.id, characterId, role: SectRoleName.OUTER } });
    await creditWallet(tx, characterId, Currency.LINH_THACH, 500n, WalletTxType.REWARD, "ThanhVanAdmission", characterId, `thanh-van:admission:${characterId}:linh-thach`);
    for (const item of [{ key: "tu-linh-dan", quantity: 3 }, { key: "hoi-khi-dan", quantity: 2 }, { key: "thanh-van-dao-bao", quantity: 1 }, { key: "thanh-van-dan-khi-quyet", quantity: 1 }]) {
      await grantItemByKey(tx, characterId, item.key, item.quantity);
    }
    await mutateContribution(tx, sect.id, characterId, 100, "Nhập môn Thanh Vân", `thanh-van:admission:${characterId}:contribution`);
    await upsertFlag(tx, characterId, outerJoinedFlag, { joinedAt: now.toISOString(), role: "OUTER" });
    await progressQuestEvent(tx, { characterId, eventType: "JOIN_SECT", amount: 1 });
    await tx.sectLog.create({ data: { sectId: sect.id, actorId: characterId, type: SectLogType.MEMBER, message: `${character.name} nhận Ngoại Môn Lệnh, chính thức nhập Thanh Vân Môn.` } });
    return { alreadyJoined: false, role: SectRoleName.OUTER };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function allowanceForState(state: ThanhVanMembershipState) {
  if (state === "TRUE_DISCIPLE") return { linhThach: 800, items: [{ key: "tu-linh-dan", quantity: 3 }, { key: "ngung-khi-dan", quantity: 2 }], contribution: 20 };
  if (state === "INNER_DISCIPLE") return { linhThach: 300, items: [{ key: "tu-linh-dan", quantity: 2 }, { key: "ngung-khi-dan", quantity: 1 }], contribution: 10 };
  return { linhThach: 100, items: [{ key: "tu-linh-dan", quantity: 1 }], contribution: 5 };
}

export async function claimThanhVanAllowance(db: Db, characterId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const runtime = await getThanhVanRuntimeState(tx, characterId);
    if (!runtime.sect || !runtime.isThanhVanMember || runtime.state === "OUTSIDER" || runtime.state === "APPLICANT") throw new ThanhVanError("NOT_DISCIPLE", "Chỉ đệ tử Thanh Vân Môn mới được nhận bổng lộc.");
    const cycle = now.toISOString().slice(0, 10);
    const flagKey = `thanh_van_allowance:${cycle}`;
    const claimed = await tx.characterQuestFlag.findUnique({ where: { characterId_key: { characterId, key: flagKey } } });
    if (claimed) return { alreadyClaimed: true, cycle };
    await ensureThanhVanStarterItems(tx);
    const allowance = allowanceForState(runtime.state);
    await creditWallet(tx, characterId, Currency.LINH_THACH, BigInt(allowance.linhThach), WalletTxType.REWARD, "ThanhVanAllowance", cycle, `thanh-van:allowance:${characterId}:${cycle}:linh-thach`);
    for (const item of allowance.items) await grantItemByKey(tx, characterId, item.key, item.quantity);
    await mutateContribution(tx, runtime.sect.id, characterId, allowance.contribution, "Điểm danh nhận bổng lộc", `thanh-van:allowance:${characterId}:${cycle}:contribution`);
    await upsertFlag(tx, characterId, flagKey, { claimedAt: now.toISOString(), state: runtime.state, allowance });
    await tx.notification.create({ data: { characterId, title: "Bổng lộc Thanh Vân", body: `Bạn nhận ${allowance.linhThach} Linh Thạch và vật phẩm bổng lộc.` } });
    return { alreadyClaimed: false, cycle, allowance };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getThanhVanProgression(db: Db, characterId: string, now = new Date()) {
  const runtime = await getThanhVanRuntimeState(db, characterId);
  const flags = await db.characterQuestFlag.findMany({ where: { characterId, key: { in: [spiritualRootFlag, highTalentFlag, elderInterestFlag, innerRequestedFlag, innerPassedFlag, `thanh_van_allowance:${now.toISOString().slice(0, 10)}`] } } });
  const flagSet = new Set(flags.map((flag) => flag.key));
  const contribution = runtime.character?.sectMember?.contribution ?? 0;
  const rootQuality = runtime.character?.spiritualRoot.quality ?? "";
  const requirement = innerRequirementForRootQuality(rootQuality);
  const realmOk = Boolean(runtime.character && (runtime.character.realmStage.realm.order > requirement.realmOrder || (runtime.character.realmStage.realm.order === requirement.realmOrder && runtime.character.realmStage.order >= requirement.stageOrder)));
  const contributionOk = contribution >= requirement.contribution;
  const completedExamMissions = await db.sectMissionParticipant.count({
    where: { characterId, status: "COMPLETED", missionKey: { in: ["diet-xich-nhan-lang", "dieu-tra-hau-son"] } }
  });
  return {
    sect: runtime.sect,
    state: runtime.state,
    stateLabel: thanhVanRoleLabel(runtime.state),
    contribution,
    spiritualRootRevealed: flagSet.has(spiritualRootFlag),
    highTalentNoticed: flagSet.has(highTalentFlag),
    elderInterest: flagSet.has(elderInterestFlag),
    allowanceClaimedToday: flagSet.has(`thanh_van_allowance:${now.toISOString().slice(0, 10)}`),
    innerExamRequested: flagSet.has(innerRequestedFlag),
    innerExamPassed: flagSet.has(innerPassedFlag),
    innerRequirement: {
      ...requirement,
      realmOk,
      contributionOk,
      missionOk: completedExamMissions > 0,
      completedExamMissions
    }
  };
}

export async function requestThanhVanInnerExam(db: Db, characterId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const runtime = await getThanhVanRuntimeState(tx, characterId);
    if (!runtime.sect || !runtime.isThanhVanMember || runtime.state !== "OUTER_DISCIPLE") throw new ThanhVanError("OUTER_REQUIRED", "Chỉ Ngoại Môn Đệ Tử mới cần xin khảo hạch Nội Môn.");
    const requirement = innerRequirementForRootQuality(runtime.character?.spiritualRoot.quality);
    const contribution = runtime.character?.sectMember?.contribution ?? 0;
    const realmOk = Boolean(runtime.character && (runtime.character.realmStage.realm.order > requirement.realmOrder || (runtime.character.realmStage.realm.order === requirement.realmOrder && runtime.character.realmStage.order >= requirement.stageOrder)));
    if (!realmOk) throw new ThanhVanError("REALM_REQUIRED", `Cảnh giới chưa đủ. Yêu cầu ${requirement.label}.`);
    if (contribution < requirement.contribution) throw new ThanhVanError("CONTRIBUTION_REQUIRED", `Cống hiến chưa đủ. Yêu cầu ${requirement.contribution}.`);
    await upsertFlag(tx, characterId, innerRequestedFlag, { requestedAt: now.toISOString(), requirement });
    await tx.sectLog.create({ data: { sectId: runtime.sect.id, actorId: characterId, type: SectLogType.MEMBER, message: "Đăng ký Nội Môn Khảo Hạch." } });
    return { requested: true, requirement };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function completeThanhVanInnerExam(db: Db, characterId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const runtime = await getThanhVanRuntimeState(tx, characterId);
    if (!runtime.sect || !runtime.isThanhVanMember) throw new ThanhVanError("NOT_DISCIPLE", "Bạn chưa thuộc Thanh Vân Môn.");
    if (runtime.state === "INNER_DISCIPLE" || runtime.state === "TRUE_DISCIPLE") return { alreadyPromoted: true };
    if (runtime.state !== "OUTER_DISCIPLE") throw new ThanhVanError("OUTER_REQUIRED", "Bạn chưa phải Ngoại Môn Đệ Tử.");
    const requested = await tx.characterQuestFlag.findUnique({ where: { characterId_key: { characterId, key: innerRequestedFlag } } });
    if (!requested) throw new ThanhVanError("EXAM_NOT_REQUESTED", "Bạn chưa đăng ký Nội Môn Khảo Hạch.");
    const requirement = innerRequirementForRootQuality(runtime.character?.spiritualRoot.quality);
    const contribution = runtime.character?.sectMember?.contribution ?? 0;
    const realmOk = Boolean(runtime.character && (runtime.character.realmStage.realm.order > requirement.realmOrder || (runtime.character.realmStage.realm.order === requirement.realmOrder && runtime.character.realmStage.order >= requirement.stageOrder)));
    if (!realmOk || contribution < requirement.contribution) throw new ThanhVanError("REQUIREMENT_NOT_MET", `Điều kiện Nội Môn chưa đủ: ${requirement.label}.`);
    const completedExamMissions = await tx.sectMissionParticipant.count({ where: { characterId, status: "COMPLETED", missionKey: { in: ["diet-xich-nhan-lang", "dieu-tra-hau-son"] } } });
    if (completedExamMissions < 1) throw new ThanhVanError("MISSION_REQUIRED", "Cần hoàn thành ít nhất một nhiệm vụ khảo hạch chiến đấu hoặc điều tra Hậu Sơn.");
    await ensureThanhVanStarterItems(tx);
    await tx.sectMember.update({ where: { characterId }, data: { role: SectRoleName.INNER } });
    await mutateContribution(tx, runtime.sect.id, characterId, -requirement.contribution, "Nộp lệ phí Nội Môn Khảo Hạch", `thanh-van:inner:${characterId}:cost`);
    await mutateContribution(tx, runtime.sect.id, characterId, 200, "Thưởng thông qua Nội Môn Khảo Hạch", `thanh-van:inner:${characterId}:reward`);
    await creditWallet(tx, characterId, Currency.LINH_THACH, 1000n, WalletTxType.REWARD, "ThanhVanInnerExam", characterId, `thanh-van:inner:${characterId}:linh-thach`);
    await grantItemByKey(tx, characterId, "ngung-khi-dan", 3);
    await grantItemByKey(tx, characterId, "thanh-van-noi-mon-dao-bao", 1);
    await upsertFlag(tx, characterId, innerPassedFlag, { promotedAt: now.toISOString() });
    await tx.sectLog.create({ data: { sectId: runtime.sect.id, actorId: characterId, type: SectLogType.MEMBER, message: "Thông qua Nội Môn Khảo Hạch, thăng làm Nội Môn Đệ Tử." } });
    await tx.notification.create({ data: { characterId, title: "Thăng Nội Môn", body: "Bạn đã trở thành Nội Môn Đệ Tử Thanh Vân Môn." } });
    return { alreadyPromoted: false, role: SectRoleName.INNER };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

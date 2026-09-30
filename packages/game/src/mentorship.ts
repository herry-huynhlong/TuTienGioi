import {
  Currency,
  EquipmentSlot,
  ItemCategory,
  Prisma,
  Rarity,
  SectLogType,
  SectMentorshipStatus,
  SectMentorshipType,
  SectMissionStatus,
  SectRoleName,
  WalletTxType,
  type PrismaClient
} from "@ttg/db";
import { addItemToInventory } from "./inventory.js";
import { creditWallet } from "./services.js";
import { THANH_VAN_TAG, roleToThanhVanState } from "./sect-access.js";
import { changeSectContribution } from "./sect-contribution.js";
import { hasSectPermission } from "./sects.js";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export class MentorshipError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type MentorInterestLevel = "NONE" | "NOTICED" | "INTERESTED" | "INVITE_READY";

export type MentorConfig = {
  key: string;
  name: string;
  title: string;
  type: SectMentorshipType;
  maxActive: number;
  preferredRoots?: string[];
  preferredElements?: string[];
  contributionWeight: number;
  realmWeight: number;
  missionWeight: number;
  professionKey?: string;
  quest: {
    key: string;
    title: string;
    description: string;
    check: "combat_mission" | "foundation_training" | "technique" | "alchemy_craft" | "forging_craft" | "formation_interaction" | "law_trial" | "library_study";
  };
};

export type MentorCandidateInput = {
  membershipState: ReturnType<typeof roleToThanhVanState>;
  spiritualRootQuality?: string | null;
  spiritualRootName?: string | null;
  spiritualRootElements?: string[] | null;
  realmOrder: number;
  stageOrder: number;
  contribution: number;
  completedSectMissionKeys?: string[];
  completedCraftProfessionKeys?: string[];
  worldObjectKeys?: string[];
  learnedTechniqueCount?: number;
  trainingCompletedCount?: number;
  karma?: number;
};

export const mentorConfigs: MentorConfig[] = [
  { key: "ta-thanh-huyen", name: "Tạ Thanh Huyền", title: "Tông Chủ", type: SectMentorshipType.SECT_MASTER_DISCIPLE, maxActive: 2, preferredRoots: ["Cực", "Biến Dị", "Thượng"], preferredElements: ["Phong", "Lôi", "Kiếm"], contributionWeight: 1, realmWeight: 2, missionWeight: 2, quest: { key: "phong-loi-van-tam", title: "Phong Lôi Vấn Tâm", description: "Giữ đạo tâm trước uy áp Phong Lôi tại Đại Điện, cần căn cơ vững và một lần lập công ở Hậu Sơn.", check: "combat_mission" } },
  { key: "mac-van-son", name: "Mạc Vân Sơn", title: "Đại Trưởng Lão", type: SectMentorshipType.ELDER_DISCIPLE, maxActive: 3, contributionWeight: 3, realmWeight: 2, missionWeight: 1, quest: { key: "can-co-hon-thien-phu", title: "Căn Cơ Quan Trọng Hơn Thiên Phú", description: "Hoàn thành rèn luyện căn cơ và tích lũy công lao ổn định để chứng minh đường dài.", check: "foundation_training" } },
  { key: "co-truong-phong", name: "Cố Trường Phong", title: "Kiếm Đạo Trưởng Lão", type: SectMentorshipType.ELDER_DISCIPLE, maxActive: 4, preferredElements: ["Kim", "Phong"], contributionWeight: 1, realmWeight: 2, missionWeight: 3, quest: { key: "mot-kiem-mot-tam", title: "Một Kiếm Một Tâm", description: "Dùng kiếm ý hoặc nhiệm vụ chiến đấu chứng minh tâm không loạn.", check: "combat_mission" } },
  { key: "han-thiet-son", name: "Hàn Thiết Sơn", title: "Chấp Pháp Trưởng Lão", type: SectMentorshipType.ELDER_DISCIPLE, maxActive: 4, contributionWeight: 2, realmWeight: 2, missionWeight: 2, quest: { key: "chap-phap-thi-luyen", title: "Chấp Pháp Thí Luyện", description: "Hoàn tất nhiệm vụ tuần tra/điều tra và giữ nghiệp lực không lệch tà.", check: "law_trial" } },
  { key: "te-mac", name: "Tề Mặc", title: "Tàng Kinh Trưởng Lão", type: SectMentorshipType.ELDER_DISCIPLE, maxActive: 5, preferredElements: ["Mộc", "Thủy"], contributionWeight: 2, realmWeight: 1, missionWeight: 2, quest: { key: "tang-kinh-van-dao", title: "Tàng Kinh Vấn Đạo", description: "Lĩnh ngộ ít nhất một công pháp và chứng minh hiểu biết căn bản.", check: "library_study" } },
  { key: "duoc-vo-tran", name: "Dược Vô Trần", title: "Đan Đường Trưởng Lão", type: SectMentorshipType.ELDER_DISCIPLE, maxActive: 4, preferredElements: ["Mộc", "Hỏa"], contributionWeight: 1, realmWeight: 1, missionWeight: 3, professionKey: "alchemy", quest: { key: "dan-hoa-thu-tam", title: "Đan Hỏa Thử Tâm", description: "Tự tay luyện thành đan dược để chứng minh tâm hỏa ổn định.", check: "alchemy_craft" } },
  { key: "au-duong-thiet", name: "Âu Dương Thiết", title: "Khí Đường Trưởng Lão", type: SectMentorshipType.ELDER_DISCIPLE, maxActive: 4, preferredElements: ["Kim", "Hỏa"], contributionWeight: 1, realmWeight: 1, missionWeight: 3, professionKey: "forging", quest: { key: "bach-luyen-thanh-khi", title: "Bách Luyện Thành Khí", description: "Tự tay luyện thành pháp khí hoặc trang bị để chứng minh hỏa hậu.", check: "forging_craft" } },
  { key: "lac-tinh-ha", name: "Lạc Tinh Hà", title: "Trận Đường Trưởng Lão", type: SectMentorshipType.ELDER_DISCIPLE, maxActive: 4, preferredElements: ["Thổ", "Phong"], contributionWeight: 1, realmWeight: 1, missionWeight: 3, professionKey: "formation", quest: { key: "nhap-tran", title: "Nhập Trận", description: "Tự mình kiểm tra trận kỳ trong Trận Đường và đọc được biến hóa linh văn.", check: "formation_interaction" } }
];

const mentorByKey = new Map(mentorConfigs.map((config) => [config.key, config]));

export function trueDiscipleRequirementForRootQuality(quality?: string | null) {
  const normalized = quality ?? "";
  if (normalized.includes("Cực") || normalized.includes("Biến")) return { realmOrder: 1, stageOrder: 0, contribution: 2500, label: "Trúc Cơ tầng 1 · 2.500 cống hiến" };
  if (normalized.includes("Thượng")) return { realmOrder: 1, stageOrder: 1, contribution: 3000, label: "Trúc Cơ tầng 2 · 3.000 cống hiến" };
  if (normalized.includes("Trung")) return { realmOrder: 1, stageOrder: 2, contribution: 3500, label: "Trúc Cơ tầng 3 · 3.500 cống hiến" };
  return { realmOrder: 1, stageOrder: 3, contribution: 4000, label: "Trúc Cơ tầng 4 · 4.000 cống hiến" };
}

function levelFromScore(score: number, state: ReturnType<typeof roleToThanhVanState>): MentorInterestLevel {
  if (state === "OUTSIDER" || state === "APPLICANT" || state === "OUTER_DISCIPLE") return score >= 50 ? "NOTICED" : "NONE";
  if (score >= 92) return "INVITE_READY";
  if (score >= 70) return "INTERESTED";
  if (score >= 45) return "NOTICED";
  return "NONE";
}

export function calculateMentorInterest(config: MentorConfig, character: MentorCandidateInput) {
  let score = 0;
  const reasons: string[] = [];
  if (character.membershipState === "INNER_DISCIPLE" || character.membershipState === "TRUE_DISCIPLE") {
    score += 30;
    reasons.push("Đã là Nội Môn.");
  }
  const requirement = trueDiscipleRequirementForRootQuality(character.spiritualRootQuality);
  if (character.realmOrder > requirement.realmOrder || (character.realmOrder === requirement.realmOrder && character.stageOrder >= requirement.stageOrder)) {
    score += 18 * config.realmWeight;
    reasons.push("Cảnh giới đạt ngưỡng quan sát.");
  } else if (character.realmOrder >= 1) {
    score += 10 * config.realmWeight;
    reasons.push("Đã đặt nền Trúc Cơ.");
  }
  if (character.contribution >= requirement.contribution) {
    score += 14 * config.contributionWeight;
    reasons.push("Công lao đủ dày.");
  } else if (character.contribution >= Math.floor(requirement.contribution * 0.65)) {
    score += 8 * config.contributionWeight;
    reasons.push("Công lao đang tích lũy tốt.");
  }
  const quality = character.spiritualRootQuality ?? "";
  if (config.preferredRoots?.some((item) => quality.includes(item))) {
    score += 8;
    reasons.push("Tư chất hợp mắt sư trưởng.");
  }
  const elements = character.spiritualRootElements ?? [];
  if (config.preferredElements?.some((element) => elements.includes(element))) {
    score += 8;
    reasons.push("Linh căn hợp đạo thống.");
  }
  if (questEvidenceMet(config.quest.check, character)) {
    score += 12 * config.missionWeight;
    reasons.push("Đã có hành động hợp khảo hạch.");
  }
  if (config.professionKey && character.completedCraftProfessionKeys?.includes(config.professionKey)) {
    score += 16;
    reasons.push("Có dấu vết nghề nghiệp phù hợp.");
  }
  return { score, level: levelFromScore(score, character.membershipState), reasons };
}

function questEvidenceMet(check: MentorConfig["quest"]["check"], character: MentorCandidateInput) {
  const missions = character.completedSectMissionKeys ?? [];
  if (check === "combat_mission") return missions.includes("diet-xich-nhan-lang") || missions.includes("dieu-tra-hau-son");
  if (check === "foundation_training") return (character.trainingCompletedCount ?? 0) > 0 || character.contribution >= trueDiscipleRequirementForRootQuality(character.spiritualRootQuality).contribution;
  if (check === "technique" || check === "library_study") return (character.learnedTechniqueCount ?? 0) > 0;
  if (check === "alchemy_craft") return character.completedCraftProfessionKeys?.includes("alchemy") ?? false;
  if (check === "forging_craft") return character.completedCraftProfessionKeys?.includes("forging") ?? false;
  if (check === "formation_interaction") return character.worldObjectKeys?.includes("formation-training-node") ?? false;
  if (check === "law_trial") return ((character.karma ?? 0) >= 0 && (missions.includes("dieu-tra-hau-son") || missions.includes("diet-xich-nhan-lang")));
  return false;
}

function hasRealm(requirement: { realmOrder: number; stageOrder: number }, character: { realmStage: { order: number; realm: { order: number } } }) {
  return character.realmStage.realm.order > requirement.realmOrder || (character.realmStage.realm.order === requirement.realmOrder && character.realmStage.order >= requirement.stageOrder);
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function buildCandidateInput(db: Db | Tx, characterId: string): Promise<MentorCandidateInput & { sectId: string; characterName: string }> {
  const character = await db.character.findUniqueOrThrow({
    where: { id: characterId },
    include: {
      spiritualRoot: true,
      realmStage: { include: { realm: true } },
      sectMember: true,
      techniques: { select: { id: true } }
    }
  });
  if (!character.sectId || !character.sectMember) throw new MentorshipError("NOT_IN_SECT", "Bạn chưa thuộc tông môn.");
  const [completedMissions, logs, trainingCompleted] = await Promise.all([
    db.sectMissionParticipant.findMany({ where: { characterId, status: SectMissionStatus.COMPLETED }, select: { missionKey: true } }),
    db.gameLog.findMany({ where: { characterId, type: { in: ["profession", "world_interaction"] } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.trainingActivity.count({ where: { characterId, status: "COMPLETED" } })
  ]);
  const completedCraftProfessionKeys: string[] = [];
  const worldObjectKeys: string[] = [];
  for (const log of logs) {
    const metadata = jsonRecord(log.metadata);
    if (metadata.eventType === "CRAFT_COMPLETED" && typeof metadata.professionKey === "string") completedCraftProfessionKeys.push(metadata.professionKey);
    if (metadata.eventType === "INTERACT_WORLD_OBJECT" && typeof metadata.objectKey === "string") worldObjectKeys.push(metadata.objectKey);
  }
  return {
    sectId: character.sectId,
    characterName: character.name,
    membershipState: roleToThanhVanState(character.sectMember.role),
    spiritualRootQuality: character.spiritualRoot.quality,
    spiritualRootName: character.spiritualRoot.name,
    spiritualRootElements: character.spiritualRoot.elements,
    realmOrder: character.realmStage.realm.order,
    stageOrder: character.realmStage.order,
    contribution: character.sectMember.contribution,
    completedSectMissionKeys: completedMissions.map((item) => item.missionKey),
    completedCraftProfessionKeys,
    worldObjectKeys,
    learnedTechniqueCount: character.techniques.length,
    trainingCompletedCount: trainingCompleted,
    karma: character.karma
  };
}

async function masterCharacterForConfig(db: Db | Tx, config: MentorConfig) {
  const npc = await db.npc.findUnique({ where: { key: config.key }, select: { id: true, metadata: true } });
  const characterId = jsonRecord(npc?.metadata).characterId;
  if (typeof characterId !== "string") return null;
  return db.character.findUnique({ where: { id: characterId }, include: { sectMember: true } });
}

async function activeCountForMaster(db: Db | Tx, masterCharacterId: string) {
  return db.sectMentorship.count({ where: { masterCharacterId, status: SectMentorshipStatus.ACTIVE } });
}

export async function evaluateThanhVanMentorInvites(db: Db, characterId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const sect = await tx.sect.findUnique({ where: { tag: THANH_VAN_TAG }, select: { id: true } });
    if (!sect) return [];
    const candidate = await buildCandidateInput(tx, characterId);
    if (candidate.sectId !== sect.id || candidate.membershipState !== "INNER_DISCIPLE") return [];
    const active = await tx.sectMentorship.findFirst({ where: { discipleCharacterId: characterId, status: SectMentorshipStatus.ACTIVE } });
    if (active) return [];
    const created = [];
    for (const config of mentorConfigs) {
      const interest = calculateMentorInterest(config, candidate);
      if (interest.level !== "INVITE_READY") continue;
      const master = await masterCharacterForConfig(tx, config);
      if (!master || master.id === characterId) continue;
      const masterRole = master.sectMember?.role;
      if (masterRole !== SectRoleName.LEADER && masterRole !== SectRoleName.ELDER) continue;
      const count = await activeCountForMaster(tx, master.id);
      if (count >= config.maxActive) continue;
      const existing = await tx.sectMentorship.findFirst({ where: { masterCharacterId: master.id, discipleCharacterId: characterId, status: { in: [SectMentorshipStatus.INVITED, SectMentorshipStatus.ACTIVE] } } });
      if (existing) continue;
      const invite = await tx.sectMentorship.create({
        data: {
          sectId: sect.id,
          masterCharacterId: master.id,
          discipleCharacterId: characterId,
          type: config.type,
          status: SectMentorshipStatus.INVITED,
          invitationReason: interest.reasons.join(" "),
          metadata: { mentorKey: config.key, interestLevel: interest.level, questKey: config.quest.key, createdBy: "runtime", createdAt: now.toISOString() } as Prisma.InputJsonValue
        }
      });
      await tx.sectLog.create({ data: { sectId: sect.id, actorId: characterId, type: SectLogType.MENTOR_INVITED, message: `${config.name} gửi lời thu ${candidate.characterName} làm đệ tử.`, metadata: { mentorKey: config.key, mentorshipId: invite.id } } });
      created.push(invite);
    }
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function acceptMentorInvitation(db: Db, characterId: string, invitationId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const invite = await tx.sectMentorship.findUnique({ where: { id: invitationId }, include: { masterCharacter: true, discipleCharacter: true } });
    if (!invite || invite.discipleCharacterId !== characterId || invite.status !== SectMentorshipStatus.INVITED) throw new MentorshipError("INVITE_NOT_FOUND", "Không tìm thấy lời mời sư đồ hợp lệ.");
    const active = await tx.sectMentorship.findFirst({ where: { discipleCharacterId: characterId, status: SectMentorshipStatus.ACTIVE } });
    if (active) throw new MentorshipError("HAS_ACTIVE_MASTER", "Bạn đã có sư phụ.");
    const config = mentorConfigs.find((item) => item.type === invite.type && item.name === invite.masterCharacter.name) ?? mentorConfigs.find((item) => item.name === invite.masterCharacter.name);
    const maxActive = config?.maxActive ?? 3;
    const count = await activeCountForMaster(tx, invite.masterCharacterId);
    if (count >= maxActive) throw new MentorshipError("MENTOR_FULL", "Sư trưởng này đã đủ đệ tử.");
    await tx.sectMentorship.update({ where: { id: invite.id }, data: { status: SectMentorshipStatus.ACTIVE, acceptedAt: now } });
    await tx.sectMentorship.updateMany({ where: { discipleCharacterId: characterId, status: SectMentorshipStatus.INVITED, id: { not: invite.id } }, data: { status: SectMentorshipStatus.REJECTED, rejectedAt: now } });
    await tx.sectLog.create({ data: { sectId: invite.sectId, actorId: characterId, type: SectLogType.MENTOR_INVITE_ACCEPTED, message: `${invite.discipleCharacter.name} bái ${invite.masterCharacter.name} làm sư phụ.`, metadata: { mentorshipId: invite.id } } });
    await tx.notification.create({ data: { characterId, title: "Đã bái sư", body: `${invite.masterCharacter.name} chính thức trở thành sư phụ của bạn.` } });
    return { accepted: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function rejectMentorInvitation(db: Db, characterId: string, invitationId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const invite = await tx.sectMentorship.findUnique({ where: { id: invitationId }, include: { masterCharacter: true } });
    if (!invite || invite.discipleCharacterId !== characterId || invite.status !== SectMentorshipStatus.INVITED) throw new MentorshipError("INVITE_NOT_FOUND", "Không tìm thấy lời mời sư đồ hợp lệ.");
    await tx.sectMentorship.update({ where: { id: invite.id }, data: { status: SectMentorshipStatus.REJECTED, rejectedAt: now } });
    await tx.sectLog.create({ data: { sectId: invite.sectId, actorId: characterId, type: SectLogType.MENTOR_INVITE_REJECTED, message: `Từ chối lời mời bái sư của ${invite.masterCharacter.name}.`, metadata: { mentorshipId: invite.id } } });
    return { rejected: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function activeMentorship(tx: Db | Tx, characterId: string) {
  return tx.sectMentorship.findFirst({
    where: { discipleCharacterId: characterId, status: SectMentorshipStatus.ACTIVE },
    include: { masterCharacter: true, sect: true }
  });
}

async function upsertFlag(tx: Tx, characterId: string, key: string, value: Prisma.InputJsonValue) {
  return tx.characterQuestFlag.upsert({
    where: { characterId_key: { characterId, key } },
    update: { value },
    create: { characterId, key, value }
  });
}

function mentorQuestFlag(mentorshipId: string) {
  return `mentor_quest_completed:${mentorshipId}`;
}

function examFlag(step: "recommended" | "reviewed" | "promoted") {
  return `true_disciple_exam:${step}`;
}

function configForMentorship(mentorship: { masterCharacter: { name: string }; metadata: Prisma.JsonValue | null }) {
  const key = jsonRecord(mentorship.metadata).mentorKey;
  return (typeof key === "string" ? mentorByKey.get(key) : null) ?? mentorConfigs.find((item) => item.name === mentorship.masterCharacter.name);
}

export async function completeMentorQuest(db: Db, characterId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const mentorship = await activeMentorship(tx, characterId);
    if (!mentorship) throw new MentorshipError("NO_ACTIVE_MASTER", "Bạn chưa có sư phụ để nhận khảo hạch.");
    const existing = await tx.characterQuestFlag.findUnique({ where: { characterId_key: { characterId, key: mentorQuestFlag(mentorship.id) } } });
    if (existing) return { alreadyCompleted: true };
    const config = configForMentorship(mentorship);
    if (!config) throw new MentorshipError("MENTOR_CONFIG_MISSING", "Chưa tìm thấy khảo hạch của sư phụ này.");
    const candidate = await buildCandidateInput(tx, characterId);
    if (!questEvidenceMet(config.quest.check, candidate)) throw new MentorshipError("MENTOR_QUEST_NOT_READY", "Bạn chưa đủ dấu mốc hành động để hoàn thành khảo hạch sư môn.");
    await upsertFlag(tx, characterId, mentorQuestFlag(mentorship.id), { mentorshipId: mentorship.id, mentorKey: config.key, questKey: config.quest.key, completedAt: now.toISOString() });
    await tx.sectLog.create({ data: { sectId: mentorship.sectId, actorId: characterId, type: SectLogType.MENTOR_QUEST_COMPLETED, message: `Hoàn thành khảo hạch "${config.quest.title}" của ${config.name}.`, metadata: { mentorshipId: mentorship.id, mentorKey: config.key, questKey: config.quest.key } } });
    await tx.notification.create({ data: { characterId, title: "Khảo hạch sư môn", body: `Bạn đã hoàn thành ${config.quest.title}.` } });
    return { alreadyCompleted: false, quest: config.quest };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function requestTrueDiscipleExam(db: Db, characterId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const mentorship = await activeMentorship(tx, characterId);
    if (!mentorship) throw new MentorshipError("NO_ACTIVE_MASTER", "Cần có sư phụ đang nhận trước khi xin Chân Truyền.");
    const quest = await tx.characterQuestFlag.findUnique({ where: { characterId_key: { characterId, key: mentorQuestFlag(mentorship.id) } } });
    if (!quest) throw new MentorshipError("MENTOR_QUEST_REQUIRED", "Cần hoàn thành khảo hạch sư môn trước.");
    const candidate = await buildCandidateInput(tx, characterId);
    const requirement = trueDiscipleRequirementForRootQuality(candidate.spiritualRootQuality);
    if (candidate.membershipState !== "INNER_DISCIPLE") throw new MentorshipError("INNER_REQUIRED", "Chỉ Nội Môn Đệ Tử mới đi Chân Truyền.");
    if (candidate.realmOrder < requirement.realmOrder || (candidate.realmOrder === requirement.realmOrder && candidate.stageOrder < requirement.stageOrder)) throw new MentorshipError("REALM_REQUIRED", `Cảnh giới chưa đủ. Yêu cầu ${requirement.label}.`);
    if (candidate.contribution < requirement.contribution) throw new MentorshipError("CONTRIBUTION_REQUIRED", `Cống hiến chưa đủ. Yêu cầu ${requirement.contribution.toLocaleString("vi-VN")}.`);
    await upsertFlag(tx, characterId, examFlag("recommended"), { mentorshipId: mentorship.id, recommendedBy: mentorship.masterCharacterId, requestedAt: now.toISOString(), requirement });
    return { requested: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reviewTrueDiscipleExam(db: Db, characterId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const recommended = await tx.characterQuestFlag.findUnique({ where: { characterId_key: { characterId, key: examFlag("recommended") } } });
    if (!recommended) throw new MentorshipError("RECOMMENDATION_REQUIRED", "Chưa có sư phụ bảo chứng.");
    await upsertFlag(tx, characterId, examFlag("reviewed"), { reviewedAt: now.toISOString(), reviewer: "mac-van-son" });
    return { reviewed: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function ensureTrueDiscipleRewardTemplate(tx: Tx) {
  return tx.itemTemplate.upsert({
    where: { key: "thanh-van-chan-truyen-dao-bao" },
    update: {
      name: "Thanh Vân Chân Truyền Đạo Bào",
      category: ItemCategory.EQUIPMENT,
      rarity: Rarity.THUONG,
      description: "Đạo bào Chân Truyền thêu thanh vân lôi văn, chỉ ban cho đệ tử được sư phụ bảo chứng.",
      stackable: false,
      maxStack: 1,
      tradeable: false,
      equipSlot: EquipmentSlot.ARMOR,
      baseModifiers: { defense: 16, maxHp: 48, qiRegenBps: 150 },
      bindRules: { itemType: "robe", school: "Thanh Vân Môn", role: "TRUE_DISCIPLE" }
    },
    create: {
      key: "thanh-van-chan-truyen-dao-bao",
      name: "Thanh Vân Chân Truyền Đạo Bào",
      category: ItemCategory.EQUIPMENT,
      rarity: Rarity.THUONG,
      description: "Đạo bào Chân Truyền thêu thanh vân lôi văn, chỉ ban cho đệ tử được sư phụ bảo chứng.",
      stackable: false,
      maxStack: 1,
      tradeable: false,
      equipSlot: EquipmentSlot.ARMOR,
      baseModifiers: { defense: 16, maxHp: 48, qiRegenBps: 150 },
      bindRules: { itemType: "robe", school: "Thanh Vân Môn", role: "TRUE_DISCIPLE" }
    }
  });
}

export async function completeTrueDisciplePromotion(db: Db, characterId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const membership = await tx.sectMember.findUnique({ where: { characterId }, include: { sect: true, character: { include: { realmStage: { include: { realm: true } }, spiritualRoot: true } } } });
    if (!membership || membership.sect.tag !== THANH_VAN_TAG) throw new MentorshipError("NOT_THANH_VAN", "Bạn chưa thuộc Thanh Vân Môn.");
    if (membership.role === SectRoleName.TRUE_DISCIPLE) return { alreadyPromoted: true };
    if (hasSectPermission(membership.role, "VIEW_ADMIN")) throw new MentorshipError("MANAGEMENT_ROLE", "Chức vụ quản lý không dùng luồng Chân Truyền của người chơi.");
    const mentorship = await activeMentorship(tx, characterId);
    if (!mentorship) throw new MentorshipError("NO_ACTIVE_MASTER", "Cần có sư phụ đang nhận.");
    const [recommended, reviewed, mentorQuest] = await Promise.all([
      tx.characterQuestFlag.findUnique({ where: { characterId_key: { characterId, key: examFlag("recommended") } } }),
      tx.characterQuestFlag.findUnique({ where: { characterId_key: { characterId, key: examFlag("reviewed") } } }),
      tx.characterQuestFlag.findUnique({ where: { characterId_key: { characterId, key: mentorQuestFlag(mentorship.id) } } })
    ]);
    if (!recommended || !reviewed || !mentorQuest) throw new MentorshipError("EXAM_STEPS_REQUIRED", "Cần đủ bảo chứng, xét duyệt và khảo hạch sư môn.");
    const requirement = trueDiscipleRequirementForRootQuality(membership.character.spiritualRoot.quality);
    if (!hasRealm(requirement, membership.character)) throw new MentorshipError("REALM_REQUIRED", `Cảnh giới chưa đủ. Yêu cầu ${requirement.label}.`);
    if (membership.contribution < requirement.contribution) throw new MentorshipError("CONTRIBUTION_REQUIRED", `Cống hiến chưa đủ. Yêu cầu ${requirement.contribution.toLocaleString("vi-VN")}.`);
    const completedFinalTrial = await tx.sectMissionParticipant.count({ where: { characterId, status: SectMissionStatus.COMPLETED, missionKey: { in: ["dieu-tra-hau-son", "diet-xich-nhan-lang", "kiem-tra-tran-ky"] } } });
    if (completedFinalTrial < 1) throw new MentorshipError("FINAL_TRIAL_REQUIRED", "Cần hoàn thành ít nhất một khảo hạch cuối: Hậu Sơn, Yêu Lang hoặc Trận Kỳ.");
    const reward = await ensureTrueDiscipleRewardTemplate(tx);
    await tx.sectMember.update({ where: { characterId }, data: { role: SectRoleName.TRUE_DISCIPLE } });
    await creditWallet(tx, characterId, Currency.LINH_THACH, 3000n, WalletTxType.REWARD, "TrueDiscipleExam", characterId, `true-disciple:${characterId}:linh-thach`);
    await addItemToInventory(tx, characterId, reward.id, 1, { bound: true });
    await changeSectContribution(tx, { sectId: membership.sectId, characterId, delta: 500, sourceType: "TRUE_DISCIPLE_PROMOTION", reason: "Thưởng thăng Chân Truyền", sourceId: mentorship.id, idempotencyKey: `true-disciple:${characterId}:contribution` });
    await upsertFlag(tx, characterId, examFlag("promoted"), { mentorshipId: mentorship.id, promotedAt: now.toISOString() });
    await tx.sectLog.create({ data: { sectId: membership.sectId, actorId: characterId, type: SectLogType.TRUE_DISCIPLE_PROMOTED, message: `${membership.character.name} vượt khảo hạch, thăng làm Chân Truyền Đệ Tử.`, metadata: { mentorshipId: mentorship.id, masterCharacterId: mentorship.masterCharacterId } } });
    await tx.notification.create({ data: { characterId, title: "Chân Truyền Đệ Tử", body: "Bạn đã trở thành Chân Truyền Đệ Tử Thanh Vân Môn." } });
    return { alreadyPromoted: false, role: SectRoleName.TRUE_DISCIPLE };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getThanhVanMentorshipProgression(db: Db, characterId: string) {
  await evaluateThanhVanMentorInvites(db, characterId);
  const candidate = await buildCandidateInput(db, characterId).catch(() => null);
  if (!candidate) return null;
  const [active, invites, flags] = await Promise.all([
    db.sectMentorship.findFirst({ where: { discipleCharacterId: characterId, status: SectMentorshipStatus.ACTIVE }, include: { masterCharacter: true } }),
    db.sectMentorship.findMany({ where: { discipleCharacterId: characterId, status: SectMentorshipStatus.INVITED }, include: { masterCharacter: true }, orderBy: { createdAt: "asc" } }),
    db.characterQuestFlag.findMany({ where: { characterId, key: { startsWith: "true_disciple_exam:" } } })
  ]);
  const activeConfig = active ? configForMentorship(active) : null;
  const mentorQuestCompleted = active ? Boolean(await db.characterQuestFlag.findUnique({ where: { characterId_key: { characterId, key: mentorQuestFlag(active.id) } } })) : false;
  const requirement = trueDiscipleRequirementForRootQuality(candidate.spiritualRootQuality);
  const realmOk = candidate.realmOrder > requirement.realmOrder || (candidate.realmOrder === requirement.realmOrder && candidate.stageOrder >= requirement.stageOrder);
  const contributionOk = candidate.contribution >= requirement.contribution;
  const flagSet = new Set(flags.map((flag) => flag.key));
  const finalTrialOk = (candidate.completedSectMissionKeys ?? []).some((key) => ["dieu-tra-hau-son", "diet-xich-nhan-lang", "kiem-tra-tran-ky"].includes(key));
  const candidates = mentorConfigs.map((config) => {
    const interest = calculateMentorInterest(config, candidate);
    return {
      key: config.key,
      name: config.name,
      title: config.title,
      quest: config.quest,
      level: interest.level,
      reasons: interest.reasons,
      evidenceMet: questEvidenceMet(config.quest.check, candidate)
    };
  });
  return {
    requirement: { ...requirement, realmOk, contributionOk },
    activeMentor: active ? { id: active.id, name: active.masterCharacter.name, type: active.type, quest: activeConfig?.quest, questCompleted: mentorQuestCompleted } : null,
    invites: invites.map((invite) => ({ id: invite.id, name: invite.masterCharacter.name, type: invite.type, reason: invite.invitationReason })),
    exam: {
      recommended: flagSet.has(examFlag("recommended")),
      reviewed: flagSet.has(examFlag("reviewed")),
      promoted: flagSet.has(examFlag("promoted")),
      finalTrialOk
    },
    mentorCandidates: candidates
  };
}

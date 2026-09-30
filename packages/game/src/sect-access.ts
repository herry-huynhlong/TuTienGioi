import { QuestStatus, SectRoleName, type Prisma, type PrismaClient } from "@ttg/db";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

export const THANH_VAN_TAG = "TVM";
export const THANH_VAN_ADMISSION_PREFIX = "nhap-thanh-van-";

export type ThanhVanMembershipState = "OUTSIDER" | "APPLICANT" | "OUTER_DISCIPLE" | "INNER_DISCIPLE" | "TRUE_DISCIPLE";

const stateRank: Record<ThanhVanMembershipState, number> = {
  OUTSIDER: 0,
  APPLICANT: 1,
  OUTER_DISCIPLE: 2,
  INNER_DISCIPLE: 3,
  TRUE_DISCIPLE: 4
};

export const thanhVanLocationAccess: Record<string, ThanhVanMembershipState> = {
  "thanh-van-son-mon": "OUTSIDER",
  "thanh-van-giam-linh-dai": "APPLICANT",
  "thanh-van-ngoai-mon": "APPLICANT",
  "thanh-van-nhiem-vu-duong": "OUTER_DISCIPLE",
  "thanh-van-dien-vo-truong": "OUTER_DISCIPLE",
  "thanh-van-linh-dien": "OUTER_DISCIPLE",
  "thanh-van-tang-kinh-cac": "OUTER_DISCIPLE",
  "thanh-van-dong-phu-khu": "OUTER_DISCIPLE",
  "thanh-van-noi-mon": "INNER_DISCIPLE",
  "thanh-van-dan-duong": "INNER_DISCIPLE",
  "thanh-van-khi-duong": "INNER_DISCIPLE",
  "thanh-van-tran-duong": "INNER_DISCIPLE",
  "thanh-van-linh-khoang": "INNER_DISCIPLE",
  "thanh-van-hau-son": "INNER_DISCIPLE",
  "thanh-van-dai-dien": "TRUE_DISCIPLE"
};

export function roleToThanhVanState(role?: SectRoleName | null): ThanhVanMembershipState {
  if (!role) return "OUTSIDER";
  if (role === SectRoleName.OUTER) return "OUTER_DISCIPLE";
  if (role === SectRoleName.TRUE_DISCIPLE || role === SectRoleName.LEADER || role === SectRoleName.VICE_LEADER) return "TRUE_DISCIPLE";
  return "INNER_DISCIPLE";
}

export function thanhVanStateLabel(state: ThanhVanMembershipState) {
  return {
    OUTSIDER: "Người ngoài",
    APPLICANT: "Ứng viên nhập môn",
    OUTER_DISCIPLE: "Ngoại Môn Đệ Tử",
    INNER_DISCIPLE: "Nội Môn Đệ Tử",
    TRUE_DISCIPLE: "Chân Truyền Đệ Tử"
  }[state];
}

export function canAccessThanhVanLocationByState(state: ThanhVanMembershipState, locationKey: string) {
  const required = thanhVanLocationAccess[locationKey];
  if (!required) return { allowed: true, required: null };
  return { allowed: stateRank[state] >= stateRank[required], required };
}

export function innerRequirementForRootQuality(quality?: string | null) {
  const normalized = quality ?? "";
  if (normalized.includes("Cực") || normalized.includes("Biến")) return { realmOrder: 0, stageOrder: 4, contribution: 120, label: "Luyện Khí tầng 5 · 120 cống hiến" };
  if (normalized.includes("Thượng")) return { realmOrder: 0, stageOrder: 5, contribution: 180, label: "Luyện Khí tầng 6 · 180 cống hiến" };
  if (normalized.includes("Trung")) return { realmOrder: 0, stageOrder: 6, contribution: 240, label: "Luyện Khí tầng 7 · 240 cống hiến" };
  return { realmOrder: 0, stageOrder: 7, contribution: 320, label: "Luyện Khí tầng 8 · 320 cống hiến" };
}

export async function getThanhVanRuntimeState(db: Db, characterId: string) {
  const [sect, character, activeAdmission, pendingApplication] = await Promise.all([
    db.sect.findUnique({ where: { tag: THANH_VAN_TAG }, select: { id: true, name: true, tag: true } }),
    db.character.findUnique({
      where: { id: characterId },
      select: {
        id: true,
        sectId: true,
        realmStage: { select: { order: true, realm: { select: { order: true, name: true } }, name: true } },
        spiritualRoot: { select: { name: true, quality: true, multiplierBps: true, elements: true } },
        sectMember: { select: { role: true, contribution: true, weeklyContribution: true } }
      }
    }),
    db.characterQuest.findFirst({
      where: {
        characterId,
        status: { in: [QuestStatus.ACTIVE, QuestStatus.READY_TO_TURN_IN] },
        template: { key: { startsWith: THANH_VAN_ADMISSION_PREFIX } }
      },
      select: { id: true }
    }),
    db.sectApplication.findFirst({
      where: { characterId, status: "PENDING", sect: { tag: THANH_VAN_TAG } },
      select: { id: true }
    })
  ]);
  if (!sect || !character) return { sect, character, state: "OUTSIDER" as ThanhVanMembershipState, isThanhVanMember: false };
  const memberState = character.sectId === sect.id ? roleToThanhVanState(character.sectMember?.role) : null;
  const state: ThanhVanMembershipState = memberState ?? (activeAdmission || pendingApplication ? "APPLICANT" : "OUTSIDER");
  return { sect, character, state, isThanhVanMember: character.sectId === sect.id };
}

export async function canAccessSectLocation(db: Db, characterId: string, locationIdOrKey: string) {
  const location = await db.location.findFirst({ where: { OR: [{ id: locationIdOrKey }, { key: locationIdOrKey }] }, select: { id: true, key: true, name: true } });
  if (!location) return { allowed: false, reason: "Không tìm thấy địa điểm.", location: null, required: null, state: "OUTSIDER" as ThanhVanMembershipState };
  const required = thanhVanLocationAccess[location.key];
  if (!required) return { allowed: true, location, required: null, state: "OUTSIDER" as ThanhVanMembershipState };
  const runtime = await getThanhVanRuntimeState(db, characterId);
  const access = canAccessThanhVanLocationByState(runtime.state, location.key);
  return {
    allowed: access.allowed,
    location,
    required,
    state: runtime.state,
    reason: access.allowed ? null : `${location.name} yêu cầu ${thanhVanStateLabel(required)}. Hiện tại bạn là ${thanhVanStateLabel(runtime.state)}.`
  };
}

import { type PrismaClient } from "@ttg/db";

type Db = PrismaClient;
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
type Data = Db | Tx;

export type OnboardingEvent =
  | "VIEW_CHARACTER"
  | "CULTIVATION_STARTED"
  | "CULTIVATION_CLAIMED"
  | "VIEW_WORLD"
  | "TRAVEL_STARTED"
  | "TRAVEL_COMPLETED"
  | "EXPLORATION_STARTED"
  | "EXPLORATION_COMPLETED"
  | "MONSTER_ENCOUNTERED"
  | "MONSTER_DEFEATED"
  | "VIEW_MARKET";

type Objective = {
  key: string;
  label: string;
  event: OnboardingEvent;
  href: string;
  cta: string;
};

type Chapter = {
  key: string;
  title: string;
  summary: string;
  objectives: Objective[];
};

export const ONBOARDING_KEY = "main";

export const onboardingChapters: Chapter[] = [
  {
    key: "nhap-the",
    title: "Nhập Thế",
    summary: "Hiểu nhân vật của mình trước khi bước ra giang hồ.",
    objectives: [{ key: "view-character", label: "Mở trang Nhân Vật", event: "VIEW_CHARACTER", href: "/game/character", cta: "Xem Nhân Vật" }]
  },
  {
    key: "dan-khi-nhap-the",
    title: "Dẫn Khí Nhập Thể",
    summary: "Bắt đầu bế quan và nhận tu vi đầu tiên.",
    objectives: [
      { key: "start-cultivation", label: "Bắt đầu một lần tu luyện", event: "CULTIVATION_STARTED", href: "/game", cta: "Đi Tu Luyện" },
      { key: "claim-cultivation", label: "Nhận tu vi sau khi hoàn thành", event: "CULTIVATION_CLAIMED", href: "/game", cta: "Nhận Tu Vi" }
    ]
  },
  {
    key: "roi-thanh-van-thanh",
    title: "Rời Thanh Vân Thành",
    summary: "Mở thế giới và bắt đầu một chuyến di chuyển hợp lệ.",
    objectives: [
      { key: "view-world", label: "Mở trang Thế Giới", event: "VIEW_WORLD", href: "/game/world", cta: "Xem Thế Giới" },
      { key: "start-travel", label: "Bắt đầu di chuyển tới địa điểm khác", event: "TRAVEL_STARTED", href: "/game/world", cta: "Chọn Tuyến Đường" }
    ]
  },
  {
    key: "lan-dau-lich-luyen",
    title: "Lần Đầu Lịch Luyện",
    summary: "Hoàn tất một lượt thám hiểm để nhận tài nguyên hoặc biến cố.",
    objectives: [
      { key: "finish-travel", label: "Hoàn tất chuyến đi", event: "TRAVEL_COMPLETED", href: "/game/world", cta: "Hoàn Tất Di Chuyển" },
      { key: "start-exploration", label: "Bắt đầu thám hiểm tại vị trí hiện tại", event: "EXPLORATION_STARTED", href: "/game/world", cta: "Bắt Đầu Lịch Luyện" },
      { key: "finish-exploration", label: "Nhận kết quả thám hiểm", event: "EXPLORATION_COMPLETED", href: "/game/world", cta: "Nhận Kết Quả" }
    ]
  },
  {
    key: "yeu-thu-xuat-hien",
    title: "Yêu Thú Xuất Hiện",
    summary: "Gặp và đánh bại yêu thú thông qua lịch luyện hoặc biến cố.",
    objectives: [
      { key: "monster-encountered", label: "Gặp một yêu thú trong hoạt động thật", event: "MONSTER_ENCOUNTERED", href: "/game/world", cta: "Tiếp Tục Lịch Luyện" },
      { key: "monster-defeated", label: "Đánh bại yêu thú đầu tiên", event: "MONSTER_DEFEATED", href: "/game/bestiary", cta: "Xem Đồ Giám" }
    ]
  },
  {
    key: "tro-ve-thanh",
    title: "Trở Về Thành",
    summary: "Quay lại thành, kiểm tra chợ và chuẩn bị vòng chơi tiếp theo.",
    objectives: [{ key: "view-market", label: "Mở Chợ để hiểu vòng kinh tế", event: "VIEW_MARKET", href: "/game/market", cta: "Xem Chợ" }]
  }
];

const allObjectiveKeys = onboardingChapters.flatMap((chapter) => chapter.objectives.map((objective) => objective.key));

function parseCompleted(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function objectivesForEvent(event: OnboardingEvent) {
  return onboardingChapters.flatMap((chapter) => chapter.objectives).filter((objective) => objective.event === event);
}

export async function ensureOnboardingProgress(db: Data, characterId: string) {
  return db.onboardingProgress.upsert({
    where: { characterId_key: { characterId, key: ONBOARDING_KEY } },
    update: {},
    create: { characterId, key: ONBOARDING_KEY, completedObjectives: [] }
  });
}

export async function recordOnboardingEvent(db: Data, characterId: string, event: OnboardingEvent) {
  const objectives = objectivesForEvent(event);
  if (objectives.length === 0) return ensureOnboardingProgress(db, characterId);
  const progress = await ensureOnboardingProgress(db, characterId);
  if (progress.status === "COMPLETED") return progress;
  const completed = unique([...parseCompleted(progress.completedObjectives), ...objectives.map((objective) => objective.key)]);
  const isCompleted = allObjectiveKeys.every((key) => completed.includes(key));
  return db.onboardingProgress.update({
    where: { characterId_key: { characterId, key: ONBOARDING_KEY } },
    data: {
      completedObjectives: completed,
      status: isCompleted ? "COMPLETED" : "ACTIVE",
      completedAt: isCompleted ? new Date() : null
    }
  });
}

export async function getOnboardingState(db: Data, characterId: string) {
  const progress = await ensureOnboardingProgress(db, characterId);
  const completed = parseCompleted(progress.completedObjectives);
  const currentChapter = onboardingChapters.find((chapter) => chapter.objectives.some((objective) => !completed.includes(objective.key))) ?? onboardingChapters.at(-1)!;
  const nextObjective = currentChapter.objectives.find((objective) => !completed.includes(objective.key)) ?? currentChapter.objectives.at(-1)!;
  return {
    key: progress.key,
    status: progress.status,
    completedCount: completed.length,
    totalCount: allObjectiveKeys.length,
    currentChapter: {
      key: currentChapter.key,
      title: currentChapter.title,
      summary: currentChapter.summary,
      objectives: currentChapter.objectives.map((objective) => ({ ...objective, completed: completed.includes(objective.key) }))
    },
    nextObjective
  };
}

export async function getFeatureUnlockState(db: Data, characterId: string) {
  const state = await getOnboardingState(db, characterId);
  const completed = new Set(state.currentChapter.objectives.filter((objective) => objective.completed).map((objective) => objective.key));
  const progress = await ensureOnboardingProgress(db, characterId);
  const allCompleted = new Set(parseCompleted(progress.completedObjectives));
  const has = (key: string) => allCompleted.has(key) || completed.has(key);
  return {
    cultivation: { unlocked: true, reason: "Đã mở từ đầu." },
    character: { unlocked: true, reason: "Đã mở từ đầu." },
    world: { unlocked: has("view-character"), reason: "Mở Nhân Vật trong Dẫn Đạo để xem Thế Giới." },
    exploration: { unlocked: has("start-travel"), reason: "Bắt đầu một chuyến di chuyển để mở Lịch Luyện." },
    bestiary: { unlocked: has("finish-exploration") || has("monster-encountered"), reason: "Hoàn thành một lần Lịch Luyện để mở Yêu Thú Đồ Giám." },
    market: { unlocked: has("finish-exploration"), reason: "Hoàn thành Lần Đầu Lịch Luyện để mở Chợ." },
    auction: { unlocked: false, reason: "Đạt cảnh giới cao hơn và hoàn thiện kinh tế Chợ để mở Đấu Giá." },
    profession: { unlocked: false, reason: "Gặp Bách Nghệ Chấp Sự trong work unit nghề nghiệp sau." },
    secretRealm: { unlocked: false, reason: "Hoàn thành Lần Đầu Lịch Luyện và gặp cơ duyên bí cảnh." },
    sect: { unlocked: has("claim-cultivation"), reason: "Nhận tu vi đầu tiên để bắt đầu tìm hiểu Tông Môn." }
  };
}

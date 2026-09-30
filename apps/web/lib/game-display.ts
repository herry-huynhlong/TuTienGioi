import { formatLocationKind, formatSecurity, formatService } from "@/lib/format";
import { getGameTime } from "@ttg/game";

const sectRoleLabels: Record<string, string> = {
  LEADER: "Tông Chủ",
  VICE_LEADER: "Phó Tông Chủ",
  ELDER: "Trưởng Lão",
  OFFICER: "Chấp Sự",
  TRUE: "Chân Truyền Đệ Tử",
  TRUE_DISCIPLE: "Chân Truyền Đệ Tử",
  INNER: "Nội Môn Đệ Tử",
  INNER_DISCIPLE: "Nội Môn Đệ Tử",
  OUTER: "Ngoại Môn Đệ Tử",
  OUTER_DISCIPLE: "Ngoại Môn Đệ Tử",
  APPLICANT: "Người xin nhập môn",
  OUTSIDER: "Người ngoài"
};

const questStateLabels: Record<string, string> = {
  ACTIVE: "Đang làm",
  READY_TO_TURN_IN: "Có thể nộp",
  COMPLETED: "Đã hoàn thành",
  FAILED: "Đã lỡ"
};

const eventTypeLabels: Record<string, string> = {
  realm: "Đột phá",
  sect: "Tông môn",
  world: "Thiên tượng",
  event: "Biến cố",
  system: "Thiên đạo"
};

const questTypeLabels: Record<string, string> = {
  MAIN: "Chính tuyến",
  SIDE: "Phụ tuyến",
  NPC: "Nhân vật",
  SECT: "Tông môn",
  WORLD: "Thế giới",
  EVENT: "Sự kiện"
};

const questObjectiveLabels: Record<string, string> = {
  TALK_TO_NPC: "Trò chuyện",
  VISIT_LOCATION: "Tới địa điểm",
  KILL_MONSTER: "Săn yêu",
  COLLECT_ITEM: "Thu thập",
  VISIT_SECT_PAGE: "Tìm hiểu tông môn"
};

export function formatSectRole(value: string | null | undefined) {
  return value ? sectRoleLabels[value] ?? "Đệ tử" : "Tán tu";
}

export function formatRealm(realm?: { name: string } | null, stage?: { name: string } | null) {
  return [realm?.name, stage?.name].filter(Boolean).join(" ") || "Chưa nhập cảnh";
}

export function formatAptitude(root?: { name: string; multiplierBps: number } | null) {
  return root ? `${root.name} · +${Math.max(0, Math.round((root.multiplierBps - 10000) / 100))}%` : "Chưa trắc linh";
}

export function formatQuestState(value: string | null | undefined) {
  return value ? questStateLabels[value] ?? "Đang theo dõi" : "Chưa nhận";
}

export function formatQuestType(value: string | null | undefined) {
  return value ? questTypeLabels[value] ?? "Nhiệm vụ" : "Nhiệm vụ";
}

export function formatQuestObjective(value: string | null | undefined) {
  return value ? questObjectiveLabels[value] ?? "Mục tiêu" : "Mục tiêu";
}

export function formatEventType(value: string | null | undefined) {
  return value ? eventTypeLabels[value] ?? "Sự kiện" : "Sự kiện";
}

export function formatCurrency(amount: bigint | number | string, unit = "Linh Thạch") {
  const value = typeof amount === "bigint" ? amount.toString() : String(amount);
  return `${Number(value).toLocaleString("vi-VN")} ${unit}`;
}

export function formatGameDate(date: Date) {
  const time = getGameTime(date);
  return `${time.eraName} năm ${time.year} · Ngày ${time.day} tháng ${time.month} · ${time.hourName}`;
}

export function formatRelationshipForDialogue(timesMet: number, score = 0) {
  if (score >= 40) return "Bạn hữu tới rồi.";
  if (timesMet > 0) return "Lại gặp đạo hữu.";
  return "Đạo hữu là...";
}

export function isHeavenBoardCategory(category: string | null | undefined) {
  return category === "realm" || category === "sect" || category === "world" || category === "event";
}

export function dedupeHeavenBoard<T extends { title: string; category: string; createdAt: Date }>(entries: T[], limit = 7) {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const entry of entries) {
    if (!isHeavenBoardCategory(entry.category)) continue;
    const key = `${entry.category}:${entry.title.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(entry);
    if (output.length >= limit) break;
  }
  return output;
}

export { formatLocationKind, formatSecurity, formatService };

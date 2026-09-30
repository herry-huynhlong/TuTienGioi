import { Currency, Prisma, QuestObjectiveType, QuestStatus, QuestTriggerType, WalletTxType, type PrismaClient } from "@ttg/db";
import { addItemToInventory } from "./inventory.js";
import { changeSectContribution } from "./sect-contribution.js";

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
  contribution?: number;
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

type DialogueActionType =
  | "DIALOGUE"
  | "NAVIGATE"
  | "ACCEPT_QUEST"
  | "COMPLETE_QUEST"
  | "OPEN_SHOP"
  | "OPEN_AUCTION"
  | "OPEN_PROFESSION"
  | "OPEN_SECT"
  | "OPEN_INVENTORY"
  | "OPEN_QUEST_BOARD"
  | "OPEN_TRAINING"
  | "LEAVE";

type DialogueActionPayload = {
  route?: string;
  nodeKey?: string;
  questKey?: string;
  questId?: string;
  filter?: string;
  reason?: string;
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
  choices: Array<{ id: string; label: string; action: DialogueActionType; nextNodeKey: string | null; payload: DialogueActionPayload; disabled?: boolean; hint?: string }>;
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
    ...(typeof data.contribution === "number" ? { contribution: data.contribution } : {}),
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

function choice(id: string, label: string, action: DialogueActionType = "DIALOGUE", nextNodeKey: string | null = null, payload: DialogueActionPayload = {}, disabled = false, hint?: string) {
  return { id, label, action, nextNodeKey, payload, disabled, hint };
}

const npcDialogueNodes: Record<string, Record<string, { text: string; choices: ReturnType<typeof choice>[] }>> = {
  "luc-minh": {
    cultivation: {
      text: "Tu Vi viên mãn mới có thể nghĩ tới đột phá. Đừng chỉ chăm chăm tăng cảnh giới; căn cơ và thân thể cũng rất quan trọng.",
      choices: [choice("go-cultivation", "Đi tới Tu Luyện", "NAVIGATE", null, { route: "/game" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    inventory: {
      text: "Đan dược, pháp khí, linh tài ngươi nhặt được đều nằm trong Túi Đồ. Có thứ dùng trực tiếp, có thứ phải trang bị hoặc mang đi luyện chế.",
      choices: [choice("open-inventory", "Mở Túi Đồ", "OPEN_INVENTORY", null, { route: "/game/inventory" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    market: {
      text: "Nếu thiếu vật tư cơ bản, tới Chợ Linh Bảo tìm Vạn Bảo Lâu. Nhưng đồ thực sự quý thì nên để ý Đấu Giá hoặc tự luyện.",
      choices: [choice("open-market", "Đi tới Chợ", "OPEN_SHOP", null, { route: "/game/market" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    quests: {
      text: "Nhiệm vụ là cách nhanh nhất để làm quen thế giới này. Làm việc cho người khác đôi khi cũng mở ra những mối quan hệ về sau.",
      choices: [choice("open-quests", "Xem Nhiệm Vụ", "OPEN_QUEST_BOARD", null, { route: "/game/quests" }), choice("back", "Quay lại", "DIALOGUE")]
    }
  },
  "thanh-van-su-gia": {
    thanhvan: {
      text: "Thanh Vân truyền thừa đã nhiều năm, môn nhân đông đảo. Ngoại môn, nội môn, các phong đều có quy củ riêng.",
      choices: [choice("sect", "Đến Sơn Môn", "OPEN_SECT", null, { route: "/game/sect" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    join: {
      text: "Muốn bước sâu vào sơn môn, trước hết phải có căn cơ ổn định và biết quy củ. Cứ tới sơn môn xem điều kiện hiện tại của mình.",
      choices: [choice("sect", "Xem Tông Môn", "OPEN_SECT", null, { route: "/game/sect" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    rules: {
      text: "Trong sơn môn, danh phận đi cùng trách nhiệm. Nhận bổng lộc thì phải góp công; muốn tiến xa thì phải có thực lực lẫn tín nhiệm.",
      choices: [choice("sect", "Tìm hiểu Tông Môn", "OPEN_SECT", null, { route: "/game/sect" }), choice("back", "Quay lại", "DIALOGUE")]
    }
  },
  "van-bao-lau-quan-su": {
    about: {
      text: "Vạn Bảo Lâu thu mua và bán đủ loại vật tư tu hành thông thường. Những thứ thực sự hiếm có lại không phải lúc nào cũng đặt trên quầy. Có khi phải chờ người mang tới bán, có khi lại xuất hiện ở Đấu Giá.",
      choices: [choice("shop", "Xem hàng hóa", "OPEN_SHOP", null, { route: "/game/market" }), choice("auction", "Hỏi về Đấu Giá", "DIALOGUE", "auction"), choice("back", "Quay lại", "DIALOGUE")]
    },
    auction: {
      text: "Đồ quý khó định giá thường không bán trực tiếp. Nếu đạo hữu có kỳ vật, cũng có thể đưa lên đấu giá. Có người cần, giá tự nhiên sẽ cao hơn bán thẳng cho cửa hàng.",
      choices: [choice("go-auction", "Đi tới Đấu Giá", "OPEN_AUCTION", null, { route: "/game/auction" }), choice("shop", "Xem hàng hóa", "OPEN_SHOP", null, { route: "/game/market" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    rare: {
      text: "Thứ càng quý càng ít khi nằm yên trên quầy. Đan dược cao cấp, pháp khí tốt, trận bàn hiếm... phần nhiều phải do tu sĩ tự luyện chế hoặc trao đổi với nhau.",
      choices: [choice("profession", "Tìm hiểu Nghề Nghiệp", "OPEN_PROFESSION", null, { route: "/game/profession" }), choice("auction", "Đi tới Đấu Giá", "OPEN_AUCTION", null, { route: "/game/auction" }), choice("back", "Quay lại", "DIALOGUE")]
    }
  },
  "duoc-nong": {
    herbs: {
      text: "Thanh Linh Thảo mọc khá nhiều ở nơi linh khí ẩm. Hồi Khí Thảo lại thích bóng râm. Còn những loại quý hơn, phải dựa vào duyên phận.",
      choices: [choice("profession", "Tìm hiểu nghề dược", "OPEN_PROFESSION", null, { route: "/game/profession" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    gather: {
      text: "Người không hiểu dược tính mà nhổ linh thảo bừa bãi, mười phần thường hỏng mất bảy tám. Sau này nếu muốn học Linh Thực hay Dược Sư, trước hết phải nhận biết được những thứ dưới chân.",
      choices: [choice("profession", "Đi tới Nghề Nghiệp", "OPEN_PROFESSION", null, { route: "/game/profession" }), choice("back", "Quay lại", "DIALOGUE")]
    }
  },
  "tu-si-bi-thuong": {
    wound: {
      text: "Không nguy đến tính mạng, nhưng nếu đám Yêu Lang vẫn quanh quẩn gần đây, ta e khó rời khỏi nơi này.",
      choices: [choice("help", "Ta có thể giúp gì?", "DIALOGUE", "help"), choice("leave", "Rời đi", "LEAVE", null, { route: "/game/location" })]
    },
    help: {
      text: "Đạo hữu nếu chịu ra tay, xin giúp ta xử lý ba con Yêu Lang quanh Thanh Trúc Lâm. Khi nguy hiểm được giải quyết, ta nhất định có hậu tạ.",
      choices: [choice("accept", "Nhận lời", "ACCEPT_QUEST", null, { questKey: "san-yeu-dau-tien" }), choice("back", "Để ta suy nghĩ", "DIALOGUE")]
    },
    where: {
      text: "Chúng thường lảng vảng ở rìa rừng, nơi trúc thưa và có mùi máu cũ. Nếu nghe tiếng lá khô động liên tục, hãy chuẩn bị trước.",
      choices: [choice("back", "Ta sẽ tiếp tục", "DIALOGUE"), choice("leave", "Rời đi", "LEAVE", null, { route: "/game/location" })]
    }
  },
  "du-phuong-dao-nhan": {
    travel: {
      text: "Ta không có nơi cố định. Nơi nào có chuyện thú vị thì tới, khi duyên hết lại đi.",
      choices: [choice("back", "Quay lại", "DIALOGUE")]
    },
    cultivation: {
      text: "Tu vi chỉ là một phần. Căn cơ không vững, thân thể không đủ, tâm cảnh không ổn thì cảnh giới càng cao lại càng dễ gặp họa.",
      choices: [choice("training", "Tới Rèn Luyện", "OPEN_TRAINING", null, { route: "/game/training" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    fate: {
      text: "Thứ gọi là cơ duyên đôi khi không nằm trong bí cảnh. Một người ngươi từng giúp, một con đường ngươi từng bỏ qua... nhiều năm sau đều có thể trở thành nhân quả.",
      choices: [choice("back", "Ghi nhớ lời này", "DIALOGUE")]
    }
  },
  "ngoai-mon-chap-su": {
    rules: {
      text: "Đã vào ngoại môn thì phải biết quy củ. Nhiệm vụ, bổng lộc, chỗ ở và việc khảo hạch đều do các chấp sự phụ trách.",
      choices: [choice("sect", "Xem Tông Môn", "OPEN_SECT", null, { route: "/game/sect" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    promotion: {
      text: "Muốn thăng tiến phải có tu vi, công lao và không phạm giới luật. Cảnh giới chỉ là một phần, cống hiến mới khiến sơn môn nhớ tên ngươi.",
      choices: [choice("sect", "Xem điều kiện Tông Môn", "OPEN_SECT", null, { route: "/game/sect" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    stipend: {
      text: "Bổng lộc ngoại môn không nhiều, nhưng đủ giúp người mới đứng vững. Muốn nhiều hơn thì nhận việc ở Nhiệm Vụ Đường.",
      choices: [choice("quests", "Tới Nhiệm Vụ Đường", "OPEN_QUEST_BOARD", null, { route: "/game/quests" }), choice("back", "Quay lại", "DIALOGUE")]
    }
  },
  "nhiem-vu-chap-su": {
    contribution: {
      text: "Hoàn thành việc tông môn sẽ được ghi công. Cống hiến có thể dùng để đổi tài nguyên, công pháp hoặc tư cách tiến vào một số nơi.",
      choices: [choice("sect", "Xem Tông Môn", "OPEN_SECT", null, { route: "/game/sect" }), choice("back", "Quay lại", "DIALOGUE")]
    }
  },
  "duoc-vo-tran": {
    alchemy: {
      text: "Đan dược mua ngoài chợ không tính. Ta muốn xem chính tay ngươi có luyện được hay không. Tự luyện đủ Tụ Khí Đan rồi mang thành phẩm tới Đan Đường nộp lại.",
      choices: [choice("profession", "Tới Nghề Nghiệp", "OPEN_PROFESSION", null, { route: "/game/profession" }), choice("inventory", "Xem Túi Đồ", "OPEN_INVENTORY", null, { route: "/game/inventory" }), choice("back", "Quay lại", "DIALOGUE")]
    }
  },
  "lac-tinh-ha": {
    formation: {
      text: "Phía đông Trận Đường có một bộ trận kỳ dùng cho đệ tử luyện tập. Ngươi tới đó kiểm tra linh văn trên bốn lá trận kỳ. Nếu có chỗ nào linh lực không đều, ghi lại rồi quay về báo ta.",
      choices: [choice("location", "Tới Trận Đường", "NAVIGATE", null, { route: "/game/location" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    report: {
      text: "Đã xem xong? Nếu lá trận kỳ phía bắc yếu hơn ba lá còn lại thì báo đúng, đừng chỉ nhìn bề ngoài trận văn.",
      choices: [choice("back", "Ta sẽ báo lại khi nộp nhiệm vụ", "DIALOGUE")]
    }
  },
  "truyen-cong-truong-lao": {
    insight: {
      text: "Có được bí tịch chỉ là bước đầu. Muốn biến chữ trên giấy thành năng lực của bản thân, còn phải lĩnh ngộ.",
      choices: [choice("manuals", "Xem công pháp đang có", "OPEN_INVENTORY", null, { route: "/game/inventory?filter=MANUAL", filter: "MANUAL" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    suitable: {
      text: "Công pháp hợp người mới phải ổn định khí tức trước, sau đó mới bàn tới uy lực. Học quá tạp khi căn cơ còn mỏng chỉ khiến linh lực phân tán.",
      choices: [choice("manuals", "Mở Túi Đồ phần Công Pháp", "OPEN_INVENTORY", null, { route: "/game/inventory?filter=MANUAL", filter: "MANUAL" }), choice("back", "Quay lại", "DIALOGUE")]
    },
    consult: {
      text: "Tạm thời hãy rèn hơi thở và hiểu công pháp mình đang có. Khi căn cơ dày hơn, lão phu sẽ nói tới những pháp môn sâu hơn.",
      choices: [choice("training", "Tới Rèn Luyện", "OPEN_TRAINING", null, { route: "/game/training" }), choice("back", "Quay lại", "DIALOGUE")]
    }
  }
};

function rootChoices(npcKey: string, context: { activeQuests: QuestWithTemplate[]; readyQuests: QuestWithTemplate[]; available: Array<{ key: string; title: string }> }) {
  const ready = context.readyQuests.map((quest) => choice(`turn-in:${quest.id}`, `Nộp: ${quest.template.title}`, "COMPLETE_QUEST", null, { questId: quest.id }));
  const available = context.available.map((quest) => choice(`accept:${quest.key}`, `Nhận: ${quest.title}`, "ACCEPT_QUEST", null, { questKey: quest.key }));
  const active = context.activeQuests.length ? [choice("progress", "Hỏi lại mục tiêu", "DIALOGUE", "where")] : [];
  const byNpc: Record<string, ReturnType<typeof choice>[]> = {
    "luc-minh": [choice("cultivation", "Hỏi về Tu Luyện", "DIALOGUE", "cultivation"), choice("inventory", "Hỏi về Túi Đồ", "DIALOGUE", "inventory"), choice("market", "Hỏi về Chợ", "DIALOGUE", "market"), choice("quests", "Hỏi về Nhiệm Vụ", "DIALOGUE", "quests")],
    "thanh-van-su-gia": [choice("thanhvan", "Hỏi về Thanh Vân", "DIALOGUE", "thanhvan"), choice("join", "Hỏi về gia nhập tông môn", "DIALOGUE", "join"), choice("rules", "Hỏi về quy củ", "DIALOGUE", "rules")],
    "van-bao-lau-quan-su": [choice("shop", "Xem hàng hóa", "OPEN_SHOP", null, { route: "/game/market" }), choice("about", "Hỏi về Vạn Bảo Lâu", "DIALOGUE", "about"), choice("rare", "Hỏi về vật phẩm quý", "DIALOGUE", "rare")],
    "duoc-nong": [choice("herbs", "Hỏi về linh thảo", "DIALOGUE", "herbs"), choice("gather", "Hỏi về hái dược", "DIALOGUE", "gather")],
    "tu-si-bi-thuong": [choice("wound", "Ngươi bị thương thế nào?", "DIALOGUE", "wound"), choice("help", "Ta có thể giúp gì?", "DIALOGUE", "help")],
    "du-phuong-dao-nhan": [choice("travel", "Đạo trưởng đi đâu?", "DIALOGUE", "travel"), choice("cultivation", "Hỏi về con đường tu hành", "DIALOGUE", "cultivation"), choice("fate", "Hỏi về cơ duyên", "DIALOGUE", "fate")],
    "ngoai-mon-chap-su": [choice("rules", "Xem quy củ Ngoại Môn", "DIALOGUE", "rules"), choice("promotion", "Hỏi về thăng tiến", "DIALOGUE", "promotion"), choice("quests", "Hỏi về nhiệm vụ", "OPEN_QUEST_BOARD", null, { route: "/game/quests" }), choice("stipend", "Hỏi về bổng lộc", "DIALOGUE", "stipend")],
    "nhiem-vu-chap-su": [choice("board", "Xem nhiệm vụ khả dụng", "OPEN_QUEST_BOARD", null, { route: "/game/quests" }), choice("contribution", "Hỏi về điểm cống hiến", "DIALOGUE", "contribution")],
    "duoc-vo-tran": [choice("alchemy", "Hỏi về Luyện Tụ Khí Đan", "DIALOGUE", "alchemy"), choice("profession", "Mở Nghề Nghiệp", "OPEN_PROFESSION", null, { route: "/game/profession" })],
    "lac-tinh-ha": [choice("formation", "Hỏi về trận kỳ", "DIALOGUE", "formation"), choice("report", "Hỏi cách báo cáo", "DIALOGUE", "report")],
    "truyen-cong-truong-lao": [choice("manuals", "Xem công pháp đang có", "OPEN_INVENTORY", null, { route: "/game/inventory?filter=MANUAL", filter: "MANUAL" }), choice("insight", "Hỏi về lĩnh ngộ", "DIALOGUE", "insight"), choice("suitable", "Hỏi về công pháp thích hợp", "DIALOGUE", "suitable"), choice("consult", "Thỉnh giáo", "DIALOGUE", "consult")]
  };
  return [...ready, ...available, ...active, ...(byNpc[npcKey] ?? []), choice("leave", "Rời đi", "LEAVE", null, { route: "/game/location" })];
}

export function npcWorldDialoguePreview(npcKey: string) {
  return {
    choices: rootChoices(npcKey, { activeQuests: [], readyQuests: [], available: [] }),
    nodes: npcDialogueNodes[npcKey] ?? {}
  };
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
  if (reward.contribution && reward.contribution !== 0) {
    const member = await tx.sectMember.findUnique({ where: { characterId } });
    if (member) {
      await changeSectContribution(tx, { sectId: member.sectId, characterId, delta: reward.contribution, sourceType: "QUEST_REWARD", reason: quest.template.title, sourceId: quest.template.key, idempotencyKey: `quest:${quest.id}:contribution` });
    }
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

function chooseDialogue(npc: { key: string; name: string; description: string; metadata: unknown }, context: { previous: { timesMet: number; lastLocationMetId: string | null; relationshipScore: number; flags: unknown } | null; locationId: string; activeQuests: QuestWithTemplate[]; readyQuests: QuestWithTemplate[]; available: Array<{ key: string; title: string }>; nodeKey?: string }) {
  const profile = dialogueProfile(npc);
  const requestedNode = context.nodeKey ? npcDialogueNodes[npc.key]?.[context.nodeKey] : null;
  if (requestedNode) {
    return { speaker: npc.name, text: requestedNode.text, state: "repeat" as const, choices: requestedNode.choices };
  }
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
    availableQuestCount: context.available.length
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
  const choices = rootChoices(npc.key, { activeQuests: context.activeQuests, readyQuests: context.readyQuests, available: context.available });
  return { speaker: npc.name, text, state, choices };
}

export async function talkToNpc(db: Db, characterId: string, npcKey: string, nodeKey?: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const npc = await tx.npc.findUnique({ where: { key: npcKey }, include: { location: true, dialogueSet: { include: { nodes: { include: { choices: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } } } } } });
    if (!npc || !npc.active) throw new QuestError("NPC_NOT_FOUND", "Không tìm thấy nhân vật.");
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, select: { currentLocationId: true } });
    const resolved = await resolveNpcLocation(tx, npc);
    if (character.currentLocationId && character.currentLocationId !== resolved.location.id) throw new QuestError("NPC_NOT_HERE", "Nhân vật này hiện không ở địa điểm của bạn.");
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
    const dialogue = chooseDialogue(npc, { previous, locationId: resolved.location.id, activeQuests, readyQuests, available, ...(nodeKey ? { nodeKey } : {}) });
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

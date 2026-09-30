import { Prisma, SectMissionStatus, SectRoleName, type PrismaClient } from "@ttg/db";
import { progressSectMissionObjective } from "./sects.js";
import { roleToThanhVanState } from "./sect-access.js";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient;

export class WorldInteractionError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type WorldInteractionNode = {
  key: string;
  name: string;
  locationKey: string;
  type: "FORMATION_NODE" | "INVESTIGATION" | "RESOURCE_NODE" | "MECHANISM";
  interactionType: "INSPECT_FORMATION" | "INSPECT" | "HARVEST" | "ACTIVATE";
  requiredSectRole?: "APPLICANT" | "OUTER_DISCIPLE" | "INNER_DISCIPLE" | "TRUE_DISCIPLE";
  description: string;
  actionLabel: string;
  resultText: string;
};

const stateOrder = { OUTSIDER: 0, APPLICANT: 1, OUTER_DISCIPLE: 2, INNER_DISCIPLE: 3, TRUE_DISCIPLE: 4 };

export const worldInteractionNodes: WorldInteractionNode[] = [
  {
    key: "formation-training-node",
    name: "Trận Kỳ Thử Nghiệm",
    locationKey: "thanh-van-tran-duong",
    type: "FORMATION_NODE",
    interactionType: "INSPECT_FORMATION",
    requiredSectRole: "INNER_DISCIPLE",
    description: "Mấy lá trận kỳ cắm quanh trận bàn, linh văn trên bề mặt đang phát sáng nhè nhẹ.",
    actionLabel: "Kiểm tra linh văn",
    resultText: "Ba lá trận kỳ vận chuyển bình thường. Lá phía bắc có linh lực dao động yếu hơn những lá còn lại."
  }
];

function nodeByKey(key: string) {
  const node = worldInteractionNodes.find((entry) => entry.key === key);
  if (!node) throw new WorldInteractionError("WORLD_OBJECT_NOT_FOUND", "Không tìm thấy đối tượng tương tác.");
  return node;
}

function objectiveRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function activeMatchingParticipant(tx: Tx, characterId: string, node: WorldInteractionNode, locationId: string) {
  const participants = await tx.sectMissionParticipant.findMany({
    where: { characterId, status: SectMissionStatus.ACTIVE },
    include: { mission: true }
  });
  return participants.find((participant) => {
    const objective = objectiveRecord(participant.mission?.objective);
    return objective.eventType === "INTERACT_WORLD_OBJECT" && objective.worldObjectKey === node.key && (!objective.locationId || objective.locationId === locationId);
  });
}

export async function getWorldInteractionsForLocation(db: Db, characterId: string, locationId: string) {
  const [location, member] = await Promise.all([
    db.location.findUnique({ where: { id: locationId }, select: { id: true, key: true } }),
    db.sectMember.findUnique({ where: { characterId }, select: { role: true } })
  ]);
  if (!location) return [];
  const state = roleToThanhVanState(member?.role);
  const nodes = worldInteractionNodes.filter((node) => node.locationKey === location.key && (!node.requiredSectRole || stateOrder[state] >= stateOrder[node.requiredSectRole]));
  const participants = await db.sectMissionParticipant.findMany({
    where: { characterId, status: { in: [SectMissionStatus.ACTIVE, SectMissionStatus.READY_TO_TURN_IN] } },
    include: { mission: true }
  });
  return nodes.map((node) => {
    const participant = participants.find((entry) => {
      const objective = objectiveRecord(entry.mission?.objective);
      return objective.eventType === "INTERACT_WORLD_OBJECT" && objective.worldObjectKey === node.key;
    });
    return { ...node, missionParticipant: participant ? { id: participant.id, progress: participant.progress, targetCount: participant.targetCount, status: participant.status, title: participant.mission?.title ?? "" } : null };
  });
}

export async function interactWorldObject(db: Db, characterId: string, objectKey: string, actionKey = "", now = new Date()) {
  return db.$transaction(async (tx) => {
    const node = nodeByKey(objectKey);
    const character = await tx.character.findUniqueOrThrow({ where: { id: characterId }, include: { currentLocation: true, sectMember: true } });
    if (!character.currentLocation || character.currentLocation.key !== node.locationKey) throw new WorldInteractionError("WRONG_LOCATION", "Bạn không đứng đúng vị trí để tương tác.");
    const state = roleToThanhVanState(character.sectMember?.role);
    if (node.requiredSectRole && stateOrder[state] < stateOrder[node.requiredSectRole]) throw new WorldInteractionError("ROLE_REQUIRED", "Thân phận hiện tại chưa đủ để thao tác đối tượng này.");
    const participant = await activeMatchingParticipant(tx, characterId, node, character.currentLocation.id);
    if (!participant) throw new WorldInteractionError("MISSION_REQUIRED", "Bạn chưa có nhiệm vụ phù hợp với tương tác này.");
    if (participant.progress >= participant.targetCount) return { alreadyDone: true, node, resultText: node.resultText };
    const progress = await progressSectMissionObjective(tx, { characterId, eventType: "INTERACT_WORLD_OBJECT", worldObjectKey: node.key, locationId: character.currentLocation.id, amount: 1 });
    await tx.gameLog.create({
      data: {
        characterId,
        type: "world_interaction",
        message: `WORLD_OBJECT_INTERACTED ${node.name}.`,
        metadata: { eventType: "INTERACT_WORLD_OBJECT", objectKey: node.key, actionKey, missionParticipantId: participant.id, resultText: node.resultText, interactedAt: now.toISOString() } as Prisma.InputJsonValue
      }
    });
    return { alreadyDone: false, node, resultText: node.resultText, progress };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

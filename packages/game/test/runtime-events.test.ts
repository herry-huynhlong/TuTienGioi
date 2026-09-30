import { describe, expect, it } from "vitest";
import { SectMissionStatus } from "@ttg/db";
import { changeSectContribution } from "../src/sect-contribution.js";
import { progressSectMissionObjective } from "../src/sects.js";

function fakeMissionTx(objective: Record<string, unknown>) {
  const participant = {
    id: "participant_1",
    characterId: "char_1",
    status: SectMissionStatus.ACTIVE as SectMissionStatus,
    progress: 0,
    targetCount: 2,
    mission: { id: "mission_1", title: "Runtime mission", objective }
  };
  const updates: unknown[] = [];
  return {
    participant,
    updates,
    tx: {
      sectMissionParticipant: {
        findMany: async () => [participant],
        update: async ({ data }: { data: { progress: number; status: SectMissionStatus } }) => {
          participant.progress = data.progress;
          participant.status = data.status;
          updates.push(data);
          return participant;
        }
      }
    }
  };
}

function fakeContributionTx(contribution = 50) {
  const member = { id: "member_1", sectId: "sect_1", characterId: "char_1", contribution, weeklyContribution: 0 };
  const ledger: unknown[] = [];
  return {
    member,
    ledger,
    tx: {
      sectContributionTransaction: {
        findUnique: async () => null,
        create: async ({ data }: { data: unknown }) => {
          ledger.push(data);
          return data;
        }
      },
      sectMember: {
        findUnique: async () => member,
        update: async ({ data }: { data: { contribution: number; weeklyContribution?: { increment: number } } }) => {
          member.contribution = data.contribution;
          if (data.weeklyContribution) member.weeklyContribution += data.weeklyContribution.increment;
          return member;
        }
      },
      gameLog: {
        create: async () => ({})
      }
    }
  };
}

describe("runtime event mission tracking", () => {
  it("counts only matching craft recipe completions", async () => {
    const { tx, participant } = fakeMissionTx({ eventType: "CRAFT_COMPLETED", recipeKey: "recipe-tu-khi-dan", itemKey: "tu-khi-dan" });
    await progressSectMissionObjective(tx as never, { characterId: "char_1", eventType: "CRAFT_COMPLETED", recipeKey: "recipe-hoi-khi-dan", itemKey: "hoi-khi-dan", amount: 1 });
    expect(participant.progress).toBe(0);
    await progressSectMissionObjective(tx as never, { characterId: "char_1", eventType: "CRAFT_COMPLETED", recipeKey: "recipe-tu-khi-dan", itemKey: "tu-khi-dan", amount: 2 });
    expect(participant.progress).toBe(2);
    expect(participant.status).toBe(SectMissionStatus.READY_TO_TURN_IN);
  });

  it("counts only matching world object interactions", async () => {
    const { tx, participant } = fakeMissionTx({ eventType: "INTERACT_WORLD_OBJECT", worldObjectKey: "formation-training-node", locationId: "loc_tran_duong" });
    participant.targetCount = 1;
    await progressSectMissionObjective(tx as never, { characterId: "char_1", eventType: "INTERACT_WORLD_OBJECT", worldObjectKey: "wrong-node", locationId: "loc_tran_duong" });
    expect(participant.progress).toBe(0);
    await progressSectMissionObjective(tx as never, { characterId: "char_1", eventType: "INTERACT_WORLD_OBJECT", worldObjectKey: "formation-training-node", locationId: "loc_tran_duong" });
    expect(participant.progress).toBe(1);
    expect(participant.status).toBe(SectMissionStatus.READY_TO_TURN_IN);
  });
});

describe("sect contribution ledger", () => {
  it("changes contribution through one ledger service", async () => {
    const { tx, member, ledger } = fakeContributionTx(50);
    await changeSectContribution(tx as never, { sectId: "sect_1", characterId: "char_1", delta: 30, sourceType: "QUEST_REWARD", sourceId: "mission_1", reason: "Mission reward", idempotencyKey: "k1" });
    expect(member.contribution).toBe(80);
    expect(member.weeklyContribution).toBe(30);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ amount: 30, before: 50, after: 80, type: "QUEST_REWARD" });
  });

  it("rejects spending below zero", async () => {
    const { tx, member, ledger } = fakeContributionTx(20);
    await expect(changeSectContribution(tx as never, { sectId: "sect_1", characterId: "char_1", delta: -30, sourceType: "PROMOTION", reason: "Promotion cost" })).rejects.toThrow("Không đủ điểm cống hiến");
    expect(member.contribution).toBe(20);
    expect(ledger).toHaveLength(0);
  });
});

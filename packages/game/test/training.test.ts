import { describe, expect, it } from "vitest";
import { ActivityStatus } from "@ttg/db";
import { calculateTrainingGain, trainingDurationConfigs, trainingTypes } from "../src/rules.js";
import { claimTraining, startTraining } from "../src/services.js";

function txDb<Tx extends object>(tx: Tx) {
  return { $transaction: async <T>(callback: (innerTx: Tx) => Promise<T>) => callback(tx) };
}

function baseCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: "char_1",
    body: 10,
    attack: 15,
    defense: 8,
    speed: 10,
    spirit: 40,
    energyStored: 30,
    energyMax: 30,
    energyUpdatedAt: new Date("2026-01-01T00:00:00Z"),
    realmStage: { order: 0, realm: { order: 0 } },
    currentLocation: { id: "loc_1", name: "Luyện Võ Trường", kind: "district", services: ["training"] },
    ...overrides
  };
}

function startDb(character = baseCharacter(), active: Record<string, unknown> = {}) {
  const state = { character: { ...character }, created: null as null | Record<string, unknown>, logged: false };
  const db = {
    character: { findUniqueOrThrow: async () => state.character },
    trainingActivity: { findFirst: async () => active.training ?? null },
    cultivationActivity: { findFirst: async () => active.cultivation ?? null },
    explorationActivity: { findFirst: async () => active.exploration ?? null },
    travel: { findFirst: async () => active.travel ?? null },
    $transaction: async <T>(callback: (tx: any) => Promise<T>) => callback({
      character: {
        update: async ({ data }: { data: { energyStored?: number; energyUpdatedAt?: Date } }) => {
          if (typeof data.energyStored === "number") state.character.energyStored = data.energyStored;
          if (data.energyUpdatedAt) state.character.energyUpdatedAt = data.energyUpdatedAt;
          return state.character;
        }
      },
      trainingActivity: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          state.created = data;
          return { id: "train_1", ...data };
        }
      },
      gameLog: { create: async () => { state.logged = true; } }
    })
  };
  return { db, state };
}

describe("training system", () => {
  it("defines the five supported training types", () => {
    expect(trainingTypes).toEqual(["BODY", "ATTACK", "DEFENSE", "SPEED", "SPIRIT"]);
  });

  it("starts a training session and spends server-side energy", async () => {
    const { db, state } = startDb();
    const activity = await startTraining(db as never, "char_1", "BODY", "medium", new Date("2026-01-01T00:00:00Z"));
    expect(state.character.energyStored).toBe(25);
    expect(state.created?.trainingType).toBe("BODY");
    expect(state.created?.energyCost).toBe(trainingDurationConfigs.medium.energyCost);
    expect(Number(state.created?.finalGain)).toBeGreaterThan(0);
    expect(activity.id).toBe("train_1");
    expect(state.logged).toBe(true);
  });

  it("blocks invalid type, invalid duration, active training, and low energy", async () => {
    await expect(startTraining(startDb().db as never, "char_1", "BAD" as never, "short")).rejects.toMatchObject({ code: "BAD_TRAINING_TYPE" });
    await expect(startTraining(startDb().db as never, "char_1", "BODY", "bad" as never)).rejects.toMatchObject({ code: "BAD_DURATION" });
    await expect(startTraining(startDb(baseCharacter(), { training: { id: "active" } }).db as never, "char_1", "BODY", "short")).rejects.toMatchObject({ code: "ACTIVE_ACTIVITY" });
    await expect(startTraining(startDb(baseCharacter({ energyStored: 0 })).db as never, "char_1", "BODY", "short", new Date("2026-01-01T00:00:00Z"))).rejects.toMatchObject({ code: "NO_ENERGY" });
  });

  it("blocks training when the stat reaches its realm cap", async () => {
    await expect(startTraining(startDb(baseCharacter({ body: 60 })).db as never, "char_1", "BODY", "short")).rejects.toMatchObject({ code: "TRAINING_CAP" });
    expect(calculateTrainingGain({ stat: 60, statCap: 60, baseGain: 10, modifierBps: 10000 })).toBe(0);
  });

  it("does not claim before completion", async () => {
    const tx = {
      trainingActivity: {
        findUnique: async () => ({ id: "train_1", characterId: "char_1", status: ActivityStatus.ACTIVE, endsAt: new Date("2026-01-01T00:10:00Z") })
      }
    };
    await expect(claimTraining(txDb(tx) as never, "char_1", "train_1", new Date("2026-01-01T00:00:00Z"))).rejects.toMatchObject({ code: "NOT_READY" });
  });

  it("claims a completed session once and increments the trained stat", async () => {
    let attack = 15;
    const tx = {
      trainingActivity: {
        findUnique: async () => ({ id: "train_1", characterId: "char_1", trainingType: "ATTACK", durationKey: "short", status: ActivityStatus.ACTIVE, endsAt: new Date("2026-01-01T00:00:00Z"), finalGain: 2 }),
        updateMany: async () => ({ count: 1 })
      },
      character: {
        update: async ({ data }: { data: { attack: { increment: number } } }) => {
          attack += data.attack.increment;
          return {};
        }
      },
      gameLog: { create: async () => undefined }
    };
    const result = await claimTraining(txDb(tx) as never, "char_1", "train_1", new Date("2026-01-01T00:01:00Z"));
    expect(result).toMatchObject({ statKey: "attack", gain: 2 });
    expect(attack).toBe(17);
  });

  it("does not apply gain when the conditional claim update loses the race", async () => {
    let updated = false;
    const tx = {
      trainingActivity: {
        findUnique: async () => ({ id: "train_1", characterId: "char_1", trainingType: "BODY", durationKey: "short", status: ActivityStatus.ACTIVE, endsAt: new Date("2026-01-01T00:00:00Z"), finalGain: 2 }),
        updateMany: async () => ({ count: 0 })
      },
      character: { update: async () => { updated = true; } },
      gameLog: { create: async () => undefined }
    };
    await expect(claimTraining(txDb(tx) as never, "char_1", "train_1", new Date("2026-01-01T00:01:00Z"))).rejects.toMatchObject({ code: "ALREADY_CLAIMED" });
    expect(updated).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { ActivityStatus } from "@ttg/db";
import { cancelCultivation, claimCultivation, claimExploration } from "../src/services.js";
import { getFeatureUnlockState } from "../src/onboarding.js";

function fakeDb<Tx extends object>(tx: Tx) {
  return {
    $transaction: async <T>(callback: (innerTx: Tx) => Promise<T>) => callback(tx)
  };
}

describe("claim services", () => {
  it("does not grant cultivation when the conditional claim update loses the race", async () => {
    let characterUpdated = false;
    let logCreated = false;
    const tx = {
      cultivationActivity: {
        findUnique: async () => ({
          id: "cult_1",
          characterId: "char_1",
          status: ActivityStatus.ACTIVE,
          endsAt: new Date("2026-01-01T00:00:00Z"),
          baseReward: 100n,
          multiplierBps: 10000
        }),
        updateMany: async () => ({ count: 0 })
      },
      character: {
        update: async () => {
          characterUpdated = true;
          return { name: "Dao Test", cultivation: 100n };
        }
      },
      gameLog: {
        create: async () => {
          logCreated = true;
        }
      },
      worldNews: {
        create: async () => undefined
      }
    };

    await expect(claimCultivation(fakeDb(tx) as never, "char_1", "cult_1", new Date("2026-01-01T00:01:00Z"))).rejects.toMatchObject({
      code: "ALREADY_CLAIMED"
    });
    expect(characterUpdated).toBe(false);
    expect(logCreated).toBe(false);
  });

  it("does not create exploration rewards when the conditional claim update loses the race", async () => {
    let itemCreated = false;
    let logCreated = false;
    const tx = {
      explorationActivity: {
        findUnique: async () => ({
          id: "explore_1",
          characterId: "char_1",
          status: ActivityStatus.ACTIVE,
          endsAt: new Date("2026-01-01T00:00:00Z")
        }),
        updateMany: async () => ({ count: 0 })
      },
      itemTemplate: {
        findUniqueOrThrow: async () => ({ id: "item_1", key: "thanh-linh-thao", name: "Thanh Linh Thảo" })
      },
      itemInstance: {
        create: async () => {
          itemCreated = true;
        }
      },
      gameLog: {
        create: async () => {
          logCreated = true;
        }
      }
    };

    await expect(claimExploration(fakeDb(tx) as never, "char_1", "explore_1", new Date("2026-01-01T00:01:00Z"))).rejects.toMatchObject({
      code: "ALREADY_CLAIMED"
    });
    expect(itemCreated).toBe(false);
    expect(logCreated).toBe(false);
  });

  it("records the first cultivation claim when an active cultivation is stopped with accumulated reward", async () => {
    const now = new Date("2026-01-01T00:15:00Z");
    const job = {
      id: "cult_1",
      characterId: "char_1",
      status: ActivityStatus.ACTIVE,
      startedAt: new Date("2026-01-01T00:00:00Z"),
      lastProcessedAt: new Date("2026-01-01T00:00:00Z"),
      endsAt: new Date("2026-01-02T00:00:00Z"),
      baseReward: 120n,
      multiplierBps: 10000,
      accumulatedReward: 0n,
      metadata: {}
    };
    const character = {
      id: "char_1",
      name: "Dao Test",
      cultivation: 0n,
      realmStage: {
        requiredCultivation: 0n,
        order: 1,
        realm: { order: 1 }
      }
    };
    let progress = {
      key: "main",
      status: "ACTIVE",
      completedObjectives: [] as string[],
      rewardClaimed: false
    };
    let onboardingExists = false;
    const tx = {
      cultivationActivity: {
        findFirst: async () => job.status === ActivityStatus.ACTIVE ? job : null,
        findUnique: async () => job,
        update: async ({ data }: { data: any }) => {
          job.lastProcessedAt = data.lastProcessedAt ?? job.lastProcessedAt;
          job.accumulatedReward += data.accumulatedReward?.increment ?? 0n;
          if (data.status) job.status = data.status;
          return job;
        },
        updateMany: async ({ where, data }: { where: any; data: any }) => {
          if (where.id === job.id && where.characterId === job.characterId && where.status === job.status) {
            job.status = data.status;
            return { count: 1 };
          }
          return { count: 0 };
        }
      },
      character: {
        findUniqueOrThrow: async () => character,
        update: async ({ data }: { data: any }) => {
          character.cultivation += data.cultivation?.increment ?? 0n;
          return character;
        }
      },
      realmStage: {
        findFirst: async () => ({ requiredCultivation: 1000n })
      },
      gameLog: {
        create: async () => undefined
      },
      onboardingProgress: {
        upsert: async ({ create }: { create: typeof progress }) => {
          if (!onboardingExists) {
            progress = { ...progress, ...create };
            onboardingExists = true;
          }
          return progress;
        },
        update: async ({ data }: { data: Partial<typeof progress> }) => {
          progress = { ...progress, ...data };
          return progress;
        }
      }
    };

    const result = await cancelCultivation(fakeDb(tx) as never, "char_1", "cult_1", now);
    const unlocks = await getFeatureUnlockState(tx as never, "char_1");

    expect(result.reward).toBeGreaterThan(0n);
    expect(character.cultivation).toBe(result.reward);
    expect(progress.completedObjectives).toContain("claim-cultivation");
    expect(unlocks.sect.unlocked).toBe(true);
  });

  it("unlocks auction and profession only from Luyen Khi stage 1", async () => {
    const progress = { key: "main", status: "ACTIVE", completedObjectives: ["finish-exploration"] as string[] };
    const dbForRealm = (realmOrder: number, stageOrder: number) => ({
      onboardingProgress: {
        upsert: async () => progress
      },
      character: {
        findUniqueOrThrow: async () => ({
          realmStage: {
            order: stageOrder,
            realm: { order: realmOrder }
          }
        })
      }
    });

    const mortal = await getFeatureUnlockState(dbForRealm(0, 0) as never, "char_1");
    const luyenKhi1 = await getFeatureUnlockState(dbForRealm(1, 0) as never, "char_1");

    expect(mortal.auction).toEqual({ unlocked: false, reason: "Đạt Luyện Khí tầng 1 để mở Đấu Giá." });
    expect(mortal.profession).toEqual({ unlocked: false, reason: "Đạt Luyện Khí tầng 1 để mở Nghề Nghiệp." });
    expect(luyenKhi1.auction.unlocked).toBe(true);
    expect(luyenKhi1.profession.unlocked).toBe(true);
  });
});

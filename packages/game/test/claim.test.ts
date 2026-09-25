import { describe, expect, it } from "vitest";
import { ActivityStatus } from "@ttg/db";
import { claimCultivation, claimExploration } from "../src/services.js";

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
});

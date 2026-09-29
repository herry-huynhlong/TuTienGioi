import { describe, expect, it } from "vitest";
import { ActivityStatus, RecipeUnlockType } from "@ttg/db";
import { claimCraft, startCraft } from "../src/services.js";
import { professionExpGain, promoteProfessionRank } from "../src/professions.js";

function txDb<Tx extends object>(tx: Tx) {
  return { $transaction: async <T>(callback: (innerTx: Tx) => Promise<T>) => callback(tx) };
}

const recipe = {
  id: "recipe_1",
  name: "Luyện Tụ Khí Đan",
  professionId: "prof_alchemy",
  requiredRank: "ADEPT",
  unlockType: RecipeUnlockType.PROFESSION_RANK,
  station: "ALCHEMY_FURNACE",
  ingredients: [{ itemId: "item_herb", key: "thanh-linh-thao", quantity: 2 }],
  fee: 80n,
  craftMinutes: 10,
  outputTemplateId: "item_pill",
  outputQuantity: 1,
  professionExp: 60,
  profession: { id: "prof_alchemy", key: "alchemy", name: "Luyện Đan" },
  outputTemplate: { id: "item_pill", key: "tu-khi-dan", name: "Tụ Khí Đan" }
};

describe("profession crafting", () => {
  it("applies profession exp diminishing and promotion thresholds", () => {
    expect(professionExpGain(100, "ADEPT", "APPRENTICE")).toBe(40);
    expect(professionExpGain(100, "MASTER", "APPRENTICE")).toBe(0);
    expect(promoteProfessionRank("APPRENTICE", 1000)).toBe("ADEPT");
    expect(promoteProfessionRank("ADEPT", 3000)).toBe("EXPERT");
  });

  it("rejects crafting when profession rank is too low", async () => {
    const tx = {
      recipe: { findUnique: async () => recipe },
      character: { findUniqueOrThrow: async () => ({ id: "char_1", currentLocation: { services: ["alchemy"] } }) },
      characterProfession: { upsert: async () => ({ id: "cp_1", rank: "APPRENTICE", experience: 0 }) }
    };
    await expect(startCraft(txDb(tx) as never, "char_1", "recipe_1")).rejects.toMatchObject({ code: "PROFESSION_RANK_REQUIRED" });
  });

  it("creates a craft job after consuming ingredients and fee", async () => {
    const state = { deleted: false, debited: false, created: null as null | Record<string, unknown> };
    const tx = {
      recipe: { findUnique: async () => ({ ...recipe, requiredRank: "APPRENTICE" }) },
      character: {
        findUniqueOrThrow: async () => ({ id: "char_1", currentLocation: { services: ["alchemy"] }, linhThach: 1000n }),
        update: async () => { state.debited = true; return {}; }
      },
      walletTransaction: { findUnique: async () => null, create: async () => ({}) },
      characterProfession: { upsert: async () => ({ id: "cp_1", rank: "APPRENTICE", experience: 0 }) },
      craftJob: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          state.created = data;
          return { id: "craft_1", ...data };
        }
      },
      itemInstance: {
        findMany: async () => [{ id: "stack_1", quantity: 2 }],
        delete: async () => { state.deleted = true; }
      },
      gameLog: { create: async () => ({}) }
    };
    await startCraft(txDb(tx) as never, "char_1", "recipe_1", new Date("2026-01-01T00:00:00Z"));
    expect(state.deleted).toBe(true);
    expect(state.debited).toBe(true);
    expect(state.created?.outputTemplateId).toBe("item_pill");
  });

  it("claims once, grants output, and increases profession exp", async () => {
    let itemCreated = false;
    let professionUpdated = null as null | Record<string, unknown>;
    const tx = {
      craftJob: {
        findUnique: async () => ({
          id: "craft_1",
          characterId: "char_1",
          status: ActivityStatus.ACTIVE,
          endsAt: new Date("2026-01-01T00:00:00Z"),
          outputTemplateId: "item_pill",
          outputQuantity: 1,
          professionExp: 60,
          recipe: { ...recipe, requiredRank: "APPRENTICE" }
        }),
        updateMany: async () => ({ count: 1 })
      },
      itemTemplate: { findUniqueOrThrow: async () => ({ id: "item_pill", stackable: true, maxStack: 99 }) },
      itemInstance: {
        findMany: async () => [],
        create: async () => { itemCreated = true; return {}; }
      },
      characterProfession: {
        upsert: async () => ({ id: "cp_1", rank: "APPRENTICE", experience: 960 }),
        update: async ({ data }: { data: Record<string, unknown> }) => { professionUpdated = data; return {}; }
      },
      characterQuest: { findMany: async () => [] },
      gameLog: { create: async () => ({}) }
    };
    const result = await claimCraft(txDb(tx) as never, "char_1", "craft_1", new Date("2026-01-01T00:01:00Z"));
    expect(itemCreated).toBe(true);
    expect(result.rank).toBe("ADEPT");
    expect(professionUpdated).toMatchObject({ experience: 1020, rank: "ADEPT", level: 2 });
  });
});

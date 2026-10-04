import { describe, expect, it } from "vitest";
import { ActivityStatus, RecipeUnlockType } from "@ttg/db";
import { claimCraft, startCraft } from "../src/services.js";
import { calculateCraftSuccessChance, professionExpGain, promoteProfessionRank } from "../src/professions.js";

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

const unlockedCharacter = { realmStage: { order: 0, realm: { order: 1 } } };

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
      character: { findUniqueOrThrow: async () => ({ id: "char_1", currentLocation: { services: ["alchemy"] }, ...unlockedCharacter }) },
      characterProfession: { upsert: async () => ({ id: "cp_1", rank: "APPRENTICE", experience: 0 }) }
    };
    await expect(startCraft(txDb(tx) as never, "char_1", "recipe_1")).rejects.toMatchObject({ code: "PROFESSION_RANK_REQUIRED" });
  });

  it("creates a craft job after consuming ingredients and fee", async () => {
    const state = { deleted: false, debited: false, created: null as null | Record<string, unknown> };
    const tx = {
      recipe: { findUnique: async () => ({ ...recipe, requiredRank: "APPRENTICE" }) },
      character: {
        findUniqueOrThrow: async () => ({ id: "char_1", currentLocation: { services: ["alchemy"] }, linhThach: 1000n, ...unlockedCharacter }),
        update: async () => { state.debited = true; return {}; }
      },
      walletTransaction: { findUnique: async () => null, create: async () => ({}) },
      characterProfession: { upsert: async () => ({ id: "cp_1", rank: "APPRENTICE", experience: 0 }) },
      craftRecipeMastery: { findUnique: async () => null },
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
    expect(state.created?.successChanceBps).toBe(1500);
  });

  it("claims once, grants output, and increases profession exp", async () => {
    let itemCreated = false;
    let professionUpdated = null as null | Record<string, unknown>;
    let outcome = null as null | string;
    let masteryUpdated = null as null | Record<string, unknown>;
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
          successChanceBps: 10000,
          recipe: { ...recipe, requiredRank: "APPRENTICE" }
        }),
        updateMany: async () => ({ count: 1 }),
        update: async ({ data }: { data: { outcome: string } }) => { outcome = data.outcome; return {}; }
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
      craftRecipeMastery: {
        findUnique: async () => null,
        upsert: async ({ create }: { create: Record<string, unknown> }) => { masteryUpdated = create; return {}; }
      },
      characterQuest: { findMany: async () => [] },
      gameLog: { create: async () => ({}) }
    };
    const result = await claimCraft(txDb(tx) as never, "char_1", "craft_1", new Date("2026-01-01T00:01:00Z"), () => 0);
    expect(itemCreated).toBe(true);
    expect(outcome).toBe("SUCCESS");
    expect(result.rank).toBe("ADEPT");
    expect(professionUpdated).toMatchObject({ experience: 1020, rank: "ADEPT", level: 2 });
    expect(masteryUpdated).toMatchObject({ attempts: 1, successes: 1, failures: 0, masteryExp: 10 });
  });

  it("fails server-side without granting output but still gives partial exp and mastery", async () => {
    let itemCreated = false;
    let professionUpdated = null as null | Record<string, unknown>;
    let outcome = null as null | string;
    let masteryUpdated = null as null | Record<string, unknown>;
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
          successChanceBps: 1,
          recipe: { ...recipe, requiredRank: "APPRENTICE" }
        }),
        updateMany: async () => ({ count: 1 }),
        update: async ({ data }: { data: { outcome: string } }) => { outcome = data.outcome; return {}; }
      },
      itemTemplate: { findUniqueOrThrow: async () => ({ id: "item_pill", stackable: true, maxStack: 99 }) },
      itemInstance: {
        findMany: async () => [],
        create: async () => { itemCreated = true; return {}; }
      },
      characterProfession: {
        upsert: async () => ({ id: "cp_1", rank: "APPRENTICE", experience: 0 }),
        update: async ({ data }: { data: Record<string, unknown> }) => { professionUpdated = data; return {}; }
      },
      craftRecipeMastery: {
        findUnique: async () => null,
        upsert: async ({ create }: { create: Record<string, unknown> }) => { masteryUpdated = create; return {}; }
      },
      gameLog: { create: async () => ({}) }
    };
    const result = await claimCraft(txDb(tx) as never, "char_1", "craft_1", new Date("2026-01-01T00:01:00Z"), () => 0.99);
    expect(itemCreated).toBe(false);
    expect(outcome).toBe("FAILURE");
    expect(result.success).toBe(false);
    expect(result.quantity).toBe(0);
    expect(professionUpdated).toMatchObject({ experience: 24, rank: "APPRENTICE", level: 1 });
    expect(masteryUpdated).toMatchObject({ attempts: 1, successes: 0, failures: 1, masteryExp: 5 });
  });

  it("calculates success chance from rank, mastery, facility, and difficulty", () => {
    const low = calculateCraftSuccessChance({ professionRank: "APPRENTICE", recipeRank: "APPRENTICE", masteryExp: 0, facilityGrade: "LOW" });
    const mastered = calculateCraftSuccessChance({ professionRank: "APPRENTICE", recipeRank: "APPRENTICE", masteryExp: 300, facilityGrade: "LOW" });
    const betterFacility = calculateCraftSuccessChance({ professionRank: "APPRENTICE", recipeRank: "APPRENTICE", masteryExp: 0, facilityGrade: "HIGH" });
    const higherRank = calculateCraftSuccessChance({ professionRank: "EXPERT", recipeRank: "APPRENTICE", masteryExp: 0, facilityGrade: "LOW" });
    const trivial = calculateCraftSuccessChance({ professionRank: "MASTER", recipeRank: "APPRENTICE", masteryExp: 300, facilityGrade: "HIGH" });
    expect(low.finalBps).toBeLessThan(2500);
    expect(mastered.finalBps).toBeGreaterThan(low.finalBps);
    expect(betterFacility.finalBps).toBeGreaterThan(low.finalBps);
    expect(higherRank.finalBps).toBeGreaterThan(low.finalBps);
    expect(trivial.finalBps).toBe(10000);
  });
});

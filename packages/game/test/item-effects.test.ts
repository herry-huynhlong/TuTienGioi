import { describe, expect, it } from "vitest";
import { ItemCategory, Rarity } from "@ttg/db";
import { consumeItem, GameError, getItemUsageDefinition } from "../src/index.js";

function txDb<Tx extends object>(tx: Tx) {
  return { $transaction: async <T>(callback: (innerTx: Tx) => Promise<T>) => callback(tx) };
}

function template(overrides: Record<string, unknown>) {
  return {
    id: "tpl_1",
    key: "tu-khi-dan",
    name: "Tụ Khí Đan",
    category: ItemCategory.CONSUMABLE,
    rarity: Rarity.HA,
    description: "",
    stackable: true,
    maxStack: 999,
    tradeable: true,
    equipSlot: null,
    baseModifiers: {},
    bindRules: { subType: "Đan Dược", usage: "Dùng trực tiếp." },
    ...overrides
  };
}

function character(overrides: Record<string, unknown> = {}) {
  return {
    id: "char_1",
    hp: 40,
    maxHp: 100,
    qi: 20,
    maxQi: 100,
    energyStored: 10,
    energyMax: 30,
    energyUpdatedAt: new Date("2026-01-01T00:00:00Z"),
    cultivation: 80n,
    realmStage: { requiredCultivation: 0n, order: 0, realm: { order: 0 } },
    ...overrides
  };
}

function fakeConsumeTx({ tpl, char }: { tpl: ReturnType<typeof template>; char: ReturnType<typeof character> }) {
  const state = { itemQuantity: 2, characterUpdates: [] as Record<string, unknown>[], buffs: [] as Record<string, unknown>[], logs: [] as Record<string, unknown>[] };
  const tx = {
    itemInstance: {
      findUnique: async () => ({ id: "item_1", ownerId: "char_1", quantity: state.itemQuantity, template: tpl, templateId: tpl.id, listings: [] }),
      updateMany: async ({ data }: { data: { quantity: { decrement: number } } }) => {
        state.itemQuantity -= data.quantity.decrement;
        return { count: 1 };
      },
      deleteMany: async () => ({ count: state.itemQuantity <= 0 ? 1 : 0 })
    },
    character: {
      findUniqueOrThrow: async (args?: { include?: unknown }) => args?.include ? char : { ...char, cultivation: char.cultivation },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.characterUpdates.push(data);
        Object.assign(char, data);
        return char;
      }
    },
    realmStage: {
      findFirst: async () => ({ requiredCultivation: 100n })
    },
    characterBuff: {
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const row = state.buffs[0] ? { ...state.buffs[0], ...update } : create;
        state.buffs[0] = row;
        return row;
      }
    },
    gameLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.logs.push(data);
        return data;
      }
    }
  };
  return { tx, state };
}

describe("item effect engine", () => {
  it("marks equipment, direct pills, and context locked formations with distinct actions", () => {
    expect(getItemUsageDefinition(template({ baseModifiers: { cultivation: 40 } })).action).toBe("USE");
    expect(getItemUsageDefinition(template({ category: ItemCategory.EQUIPMENT, equipSlot: "WEAPON", bindRules: { subType: "Kiếm" } })).action).toBe("EQUIP");
    const formation = getItemUsageDefinition(template({ key: "tu-linh-tran", bindRules: { subType: "Trận Bàn" }, baseModifiers: { cultivationBps: 300 } }));
    expect(formation.action).toBe("DEPLOY");
    expect(formation.runtime).toBe("CONTEXT_LOCKED");
  });

  it("adds cultivation through the generic consume flow and clamps at next stage", async () => {
    const fake = fakeConsumeTx({ tpl: template({ baseModifiers: { cultivation: 40 } }), char: character() });
    await consumeItem(txDb(fake.tx) as never, "char_1", "item_1", 1);
    expect(fake.state.itemQuantity).toBe(1);
    expect(fake.state.characterUpdates).toContainEqual({ cultivation: { increment: 20n } });
  });

  it("does not consume a restore item when the resource is already full", async () => {
    const fake = fakeConsumeTx({ tpl: template({ key: "hoi-khi-dan", baseModifiers: { qiRestorePct: 25 } }), char: character({ qi: 100 }) });
    await expect(consumeItem(txDb(fake.tx) as never, "char_1", "item_1", 1)).rejects.toMatchObject({ code: "NO_EFFECT" });
    expect(fake.state.itemQuantity).toBe(2);
  });

  it("does not consume cleanse-only pills while no debuff model exists", async () => {
    const fake = fakeConsumeTx({ tpl: template({ key: "thanh-tam-dan", baseModifiers: { cleanseMental: true } }), char: character() });
    await expect(consumeItem(txDb(fake.tx) as never, "char_1", "item_1", 1)).rejects.toBeInstanceOf(GameError);
    expect(fake.state.itemQuantity).toBe(2);
  });

  it("creates a refreshable timed buff for buff pills", async () => {
    const fake = fakeConsumeTx({ tpl: template({ key: "tu-than-dan", baseModifiers: { spiritBps: 1000 } }), char: character() });
    await consumeItem(txDb(fake.tx) as never, "char_1", "item_1", 1);
    expect(fake.state.itemQuantity).toBe(1);
    expect(fake.state.buffs[0]).toMatchObject({ characterId: "char_1", sourceType: "ITEM", sourceId: "tu-than-dan", effectType: "SPIRIT_BPS", stackRule: "REFRESH_DURATION" });
  });
});

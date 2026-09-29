import { describe, expect, it } from "vitest";
import { ItemCategory, Rarity } from "@ttg/db";
import { attemptBreakthrough, breakWorldSealWithItem, consumeItem, escapeExplorationEncounterWithItem, GameError, getItemUsageDefinition, teleportWithItem, useExplorationCombatItem } from "../src/index.js";

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

function fakeBreakthroughTx({ tpl, ownerId = "char_1", quantity = 1, baseChance = 1000, cultivation = 1000n }: { tpl: ReturnType<typeof template>; ownerId?: string | null; quantity?: number; baseChance?: number; cultivation?: bigint }) {
  const char = character({
    cultivation,
    luck: 0,
    breakthroughBonusBps: 0,
    hp: 100,
    maxHp: 100,
    realmStage: {
      id: "stage_1",
      name: "Sơ Kỳ",
      requiredCultivation: 0n,
      order: 0,
      breakthroughChanceBps: baseChance,
      realm: { order: 0, name: "Luyện Khí" }
    }
  });
  const state = {
    itemQuantity: quantity,
    deleted: false,
    characterUpdates: [] as Record<string, unknown>[],
    logs: [] as Record<string, unknown>[],
    news: [] as Record<string, unknown>[]
  };
  const tx = {
    itemInstance: {
      findUnique: async () => ({ id: "support_1", ownerId, quantity: state.itemQuantity, equippedSlot: null, template: tpl, listings: [] }),
      updateMany: async ({ data }: { data: { quantity: { decrement: number } } }) => {
        if (ownerId !== "char_1" || state.itemQuantity < 1) return { count: 0 };
        state.itemQuantity -= data.quantity.decrement;
        return { count: 1 };
      },
      deleteMany: async () => {
        state.deleted = state.itemQuantity <= 0;
        return { count: state.deleted ? 1 : 0 };
      }
    },
    character: {
      findUniqueOrThrow: async () => char,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.characterUpdates.push(data);
        if (typeof data.hp === "number") char.hp = data.hp;
        if ("cultivation" in data && typeof data.cultivation === "object" && data.cultivation && "decrement" in data.cultivation) {
          char.cultivation -= data.cultivation.decrement as bigint;
        }
        return char;
      }
    },
    realmStage: {
      findFirst: async () => ({ id: "stage_2", name: "Trung Kỳ", requiredCultivation: 1000n, baseHp: 120, baseQi: 90, lifespanBonus: 10 })
    },
    worldNews: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.news.push(data);
        return data;
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

function fakeCombatItemTx({ tpl, reward = { mode: "hunt", monster: "yeu-lang", pending: true }, quantity = 2 }: { tpl: ReturnType<typeof template>; reward?: Record<string, unknown>; quantity?: number }) {
  const state = {
    itemQuantity: quantity,
    reward,
    logs: [] as Record<string, unknown>[]
  };
  const tx = {
    explorationActivity: {
      findUnique: async () => ({ id: "act_1", characterId: "char_1", status: "COMPLETED", reward: state.reward }),
      update: async ({ data }: { data: { reward: unknown } }) => {
        state.reward = data.reward as Record<string, unknown>;
        return { id: "act_1", reward: state.reward };
      }
    },
    character: {
      findUniqueOrThrow: async () => ({ id: "char_1", name: "Thiên Đạo Quân Sư", hp: 100, maxHp: 100, attack: 20, defense: 10, speed: 10, spirit: 20 })
    },
    monster: {
      findUniqueOrThrow: async () => ({ key: "yeu-lang", name: "Yêu Lang", hp: 120, attack: 12, defense: 10, speed: 9 })
    },
    itemInstance: {
      findUnique: async () => ({ id: "item_1", ownerId: "char_1", quantity: state.itemQuantity, equippedSlot: null, template: tpl, listings: [] }),
      updateMany: async ({ data }: { data: { quantity: { decrement: number } } }) => {
        if (state.itemQuantity < 1) return { count: 0 };
        state.itemQuantity -= data.quantity.decrement;
        return { count: 1 };
      },
      deleteMany: async () => ({ count: state.itemQuantity <= 0 ? 1 : 0 })
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

function fakeWorldUtilityTx({ tpl, quantity = 2, sealStatus = "SEALED", currentLocationId = "loc_1" }: { tpl: ReturnType<typeof template>; quantity?: number; sealStatus?: string; currentLocationId?: string | null }) {
  const state = {
    itemQuantity: quantity,
    activity: { id: "act_1", characterId: "char_1", status: "COMPLETED", reward: { mode: "hunt", monster: "yeu-lang", pending: true, session: {} } as Record<string, unknown> },
    characterLocationId: currentLocationId,
    sealStatus,
    logs: [] as Record<string, unknown>[]
  };
  const route = {
    id: "route_1",
    destinationId: "loc_2",
    minimumRealmOrder: 0,
    destination: { id: "loc_2", name: "Thanh Trúc Lâm", kind: "forest", active: true, services: ["explore"], minimumRealmOrder: 0, zoneId: "zone_2", zone: { id: "zone_2" } }
  };
  const tx = {
    explorationActivity: {
      findUnique: async () => state.activity,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.activity = { ...state.activity, ...data } as typeof state.activity;
        return state.activity;
      },
      findFirst: async () => null
    },
    itemInstance: {
      findUnique: async () => ({ id: "item_1", ownerId: "char_1", quantity: state.itemQuantity, equippedSlot: null, template: tpl, listings: [] }),
      updateMany: async ({ data }: { data: { quantity: { decrement: number } } }) => {
        if (state.itemQuantity < 1) return { count: 0 };
        state.itemQuantity -= data.quantity.decrement;
        return { count: 1 };
      },
      deleteMany: async () => ({ count: state.itemQuantity <= 0 ? 1 : 0 })
    },
    character: {
      findUniqueOrThrow: async (args?: { include?: unknown; select?: unknown }) => args?.select ? { currentLocationId: state.characterLocationId } : {
        id: "char_1",
        currentLocationId: state.characterLocationId,
        currentLocation: { id: "loc_1", routesFrom: [route] },
        realmStage: { realm: { order: 0 } }
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (typeof data.currentLocationId === "string") state.characterLocationId = data.currentLocationId;
        return { id: "char_1", ...data };
      }
    },
    travel: { findFirst: async () => null },
    cultivationActivity: { findFirst: async () => null },
    trainingActivity: { findFirst: async () => null },
    sectMissionParticipant: { findMany: async () => [] },
    characterQuest: { findMany: async () => [] },
    location: { findUnique: async () => ({ key: "thanh-truc-lam" }) },
    worldSeal: {
      findUnique: async () => ({ id: "seal_1", locationId: "loc_1", name: "Phong Ấn Cổ", requiredBreakSealGrade: 1, status: state.sealStatus, metadata: {}, location: { id: "loc_1" } }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        state.sealStatus = String(data.status);
        return { id: "seal_1", ...data };
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

  it("uses one breakthrough support item and adds its chance bonus", async () => {
    const fake = fakeBreakthroughTx({ tpl: template({ key: "truc-co-dan-ha", name: "Trúc Cơ Đan", baseModifiers: { breakthroughBps: 400 } }), quantity: 2 });
    const result = await attemptBreakthrough(txDb(fake.tx) as never, "char_1", "support_1", () => 0.99);
    expect(result).toMatchObject({ success: false, chance: 1400, support: { itemKey: "truc-co-dan-ha", bps: 400 } });
    expect(fake.state.itemQuantity).toBe(1);
    expect(fake.state.logs[0]?.metadata).toMatchObject({ chanceBps: 1400, support: { itemName: "Trúc Cơ Đan" } });
  });

  it("rejects breakthrough support items not owned by the character", async () => {
    const fake = fakeBreakthroughTx({ tpl: template({ baseModifiers: { breakthroughBps: 400 } }), ownerId: "char_2" });
    await expect(attemptBreakthrough(txDb(fake.tx) as never, "char_1", "support_1", () => 0.99)).rejects.toMatchObject({ code: "ITEM_NOT_OWNED" });
    expect(fake.state.itemQuantity).toBe(1);
  });

  it("lets fate pills reduce breakthrough failure cultivation loss", async () => {
    const fake = fakeBreakthroughTx({ tpl: template({ key: "doat-thien-dan", name: "Đoạt Thiên Đan", baseModifiers: { fateGrade: 1 } }), baseChance: 0 });
    const result = await attemptBreakthrough(txDb(fake.tx) as never, "char_1", "support_1", () => 0.99);
    expect(result).toMatchObject({ success: false, chance: 3000, loss: 25n, support: { failurePenaltyReductionBps: 5000 } });
    expect(fake.state.characterUpdates[0]).toMatchObject({ cultivation: { decrement: 25n } });
  });

  it("uses fire talismans in a pending combat encounter and consumes one item", async () => {
    const fake = fakeCombatItemTx({ tpl: template({ key: "hoa-cau-phu", name: "Hỏa Cầu Phù", baseModifiers: { fireDamage: 30 }, bindRules: { subType: "Phù Lục" } }) });
    const result = await useExplorationCombatItem(txDb(fake.tx) as never, "char_1", "act_1", "item_1", "yeu-lang", "action-1");
    expect(result.duplicate).not.toBe(true);
    expect(result.state.monsterHp).toBe(40);
    expect(fake.state.itemQuantity).toBe(1);
    expect(result.messages?.join(" ")).toContain("sát thương Hỏa");
  });

  it("rejects invalid combat item targets without consuming", async () => {
    const fake = fakeCombatItemTx({ tpl: template({ key: "hoa-cau-phu", name: "Hỏa Cầu Phù", baseModifiers: { fireDamage: 30 }, bindRules: { subType: "Phù Lục" } }) });
    await expect(useExplorationCombatItem(txDb(fake.tx) as never, "char_1", "act_1", "item_1", "wrong-target", "action-1")).rejects.toMatchObject({ code: "INVALID_TARGET" });
    expect(fake.state.itemQuantity).toBe(2);
  });

  it("makes stronger fire talismans deal more damage than basic fire talismans", async () => {
    const basic = getItemUsageDefinition(template({ key: "hoa-cau-phu", bindRules: { subType: "Phù Lục" }, baseModifiers: { fireDamage: 30 } }));
    const burst = getItemUsageDefinition(template({ key: "bao-viem-phu", bindRules: { subType: "Phù Lục" }, baseModifiers: { fireDamage: 90 } }));
    expect(burst.effects[0]?.payload.baseDamage).toBeGreaterThan(basic.effects[0]?.payload.baseDamage as number);
  });

  it("stores shield and speed debuff in combat state", async () => {
    const shield = fakeCombatItemTx({ tpl: template({ key: "ho-than-phu", name: "Hộ Thân Phù", baseModifiers: { shield: 40 }, bindRules: { subType: "Phù Lục" } }) });
    const shieldResult = await useExplorationCombatItem(txDb(shield.tx) as never, "char_1", "act_1", "item_1", "", "shield-1");
    expect(shieldResult.state.playerShield).toBe(50);

    const debuff = fakeCombatItemTx({ tpl: template({ key: "phong-cam-phu", name: "Phong Cấm Phù", baseModifiers: { bindBps: 1000 }, bindRules: { subType: "Phù Lục" } }) });
    const debuffResult = await useExplorationCombatItem(txDb(debuff.tx) as never, "char_1", "act_1", "item_1", "yeu-lang", "bind-1");
    expect(debuffResult.state.enemySpeedBps).toBe(-3000);
  });

  it("prevents duplicated combat item submissions and high tier group reuse", async () => {
    const tpl = template({ key: "thai-hu-loi-phu", name: "Thái Hư Lôi Phù", baseModifiers: { lightningDamage: 1200 }, bindRules: { subType: "Phù Lục" } });
    const duplicate = fakeCombatItemTx({ tpl });
    await useExplorationCombatItem(txDb(duplicate.tx) as never, "char_1", "act_1", "item_1", "yeu-lang", "same-action");
    const second = await useExplorationCombatItem(txDb(duplicate.tx) as never, "char_1", "act_1", "item_1", "yeu-lang", "same-action");
    expect(second).toMatchObject({ duplicate: true });
    expect(duplicate.state.itemQuantity).toBe(1);

    const reuse = fakeCombatItemTx({ tpl });
    await useExplorationCombatItem(txDb(reuse.tx) as never, "char_1", "act_1", "item_1", "yeu-lang", "a1");
    await expect(useExplorationCombatItem(txDb(reuse.tx) as never, "char_1", "act_1", "item_1", "yeu-lang", "a2")).rejects.toMatchObject({ code: "ITEM_COOLDOWN" });
    expect(reuse.state.itemQuantity).toBe(1);
  });

  it("uses Don Dia Phu to escape a normal encounter without combat reward", async () => {
    const fake = fakeWorldUtilityTx({ tpl: template({ key: "don-dia-phu", name: "Độn Địa Phù", baseModifiers: { escapeGrade: 1 }, bindRules: { subType: "Phù Lục" } }) });
    await escapeExplorationEncounterWithItem(txDb(fake.tx) as never, "char_1", "act_1", "item_1", "escape-1");
    expect(fake.state.itemQuantity).toBe(1);
    expect(fake.state.activity.reward).toMatchObject({ pending: false, decision: "escaped" });
    expect(fake.state.activity.reward).not.toHaveProperty("combat");
  });

  it("does not consume Don Dia Phu when encounter escape is blocked", async () => {
    const fake = fakeWorldUtilityTx({ tpl: template({ key: "don-dia-phu", name: "Độn Địa Phù", baseModifiers: { escapeGrade: 1 }, bindRules: { subType: "Phù Lục" } }) });
    fake.state.activity.reward = { mode: "hunt", monster: "yeu-lang", pending: true, bossLocked: true, session: {} };
    await expect(escapeExplorationEncounterWithItem(txDb(fake.tx) as never, "char_1", "act_1", "item_1", "escape-1")).rejects.toMatchObject({ code: "ESCAPE_BLOCKED" });
    expect(fake.state.itemQuantity).toBe(2);
  });

  it("teleports only to known valid destinations and consumes one item", async () => {
    const fake = fakeWorldUtilityTx({ tpl: template({ key: "can-khon-na-di-phu", name: "Càn Khôn Na Di Phù", baseModifiers: { teleportGrade: 1 }, bindRules: { subType: "Phù Lục" } }) });
    await teleportWithItem(txDb(fake.tx) as never, "char_1", "item_1", "loc_2", "teleport-1");
    expect(fake.state.characterLocationId).toBe("loc_2");
    expect(fake.state.itemQuantity).toBe(1);

    const blocked = fakeWorldUtilityTx({ tpl: template({ key: "can-khon-na-di-phu", baseModifiers: { teleportGrade: 1 }, bindRules: { subType: "Phù Lục" } }) });
    await expect(teleportWithItem(txDb(blocked.tx) as never, "char_1", "item_1", "unknown", "teleport-2")).rejects.toMatchObject({ code: "DESTINATION_NOT_DISCOVERED" });
    expect(blocked.state.itemQuantity).toBe(2);
  });

  it("breaks a matching world seal and rejects low grade or opened seals without consuming", async () => {
    const good = fakeWorldUtilityTx({ tpl: template({ key: "pha-cam-phu", name: "Phá Cấm Phù", baseModifiers: { breakSealGrade: 1 }, bindRules: { subType: "Phù Lục" } }) });
    await breakWorldSealWithItem(txDb(good.tx) as never, "char_1", "seal_1", "item_1", "seal-1");
    expect(good.state.sealStatus).toBe("OPEN");
    expect(good.state.itemQuantity).toBe(1);

    const low = fakeWorldUtilityTx({ tpl: template({ key: "pha-cam-phu", baseModifiers: { breakSealGrade: 0 }, bindRules: { subType: "Phù Lục" } }) });
    await expect(breakWorldSealWithItem(txDb(low.tx) as never, "char_1", "seal_1", "item_1", "seal-2")).rejects.toMatchObject({ code: "ITEM_EFFECT_UNSUPPORTED" });
    expect(low.state.itemQuantity).toBe(2);

    const open = fakeWorldUtilityTx({ tpl: template({ key: "pha-cam-phu", baseModifiers: { breakSealGrade: 1 }, bindRules: { subType: "Phù Lục" } }), sealStatus: "OPEN" });
    await expect(breakWorldSealWithItem(txDb(open.tx) as never, "char_1", "seal_1", "item_1", "seal-3")).rejects.toMatchObject({ code: "SEAL_ALREADY_OPEN" });
    expect(open.state.itemQuantity).toBe(2);
  });
});

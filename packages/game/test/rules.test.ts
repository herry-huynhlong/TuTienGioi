import { describe, expect, it } from "vitest";
import { ENERGY_REGEN_BPS_PER_GAME_DAY, HP_REGEN_BPS_PER_GAME_DAY, REAL_MS_PER_GAME_DAY, calculateCultivationReward, continuousCultivationReward, currentEnergy, getGameTime, passiveRegenAmount, parseEncounterTable, simulateCombat } from "../src/rules.js";
import { seededRng, seedFromString } from "../src/rng.js";

describe("core rules", () => {
  it("calculates timestamp energy without cron ticks", () => {
    const energy = currentEnergy({ energyStored: 3, energyMax: 10, energyUpdatedAt: new Date("2026-01-01T00:00:00Z") } as never, new Date("2026-01-01T00:31:00Z"), 10);
    expect(energy).toBe(6);
  });

  it("calculates cultivation reward from snapshot multiplier", () => {
    expect(calculateCultivationReward(1000n, 12500)).toBe(1250n);
  });

  it("maps 15 real minutes to one game day", () => {
    const start = getGameTime(new Date("2026-01-01T00:00:00.000Z"));
    const next = getGameTime(new Date("2026-01-01T00:15:00.000Z"));

    expect(REAL_MS_PER_GAME_DAY).toBe(15 * 60_000);
    expect(start.day).toBe(1);
    expect(next.day).toBe(2);
  });

  it("uses the twelve earthly branches by two-game-hour windows", () => {
    expect(getGameTime(new Date("2026-01-01T00:00:00.000Z")).hourName).toBe("Giờ Tý");
    expect(getGameTime(new Date("2026-01-01T00:01:15.000Z")).hourName).toBe("Giờ Sửu");
    expect(getGameTime(new Date("2026-01-01T00:13:45.000Z")).hourName).toBe("Giờ Hợi");
  });

  it("calculates partial-day passive regeneration with remainder", () => {
    expect(passiveRegenAmount(120, HP_REGEN_BPS_PER_GAME_DAY, REAL_MS_PER_GAME_DAY).amount).toBe(18);
    const half = passiveRegenAmount(30, ENERGY_REGEN_BPS_PER_GAME_DAY, REAL_MS_PER_GAME_DAY / 2);
    expect(half.amount).toBe(3);
    expect(half.remainder).toBe(7500);
    expect(passiveRegenAmount(30, ENERGY_REGEN_BPS_PER_GAME_DAY, REAL_MS_PER_GAME_DAY / 2, half.remainder).amount).toBe(4);
  });

  it("calculates continuous cultivation against elapsed real time", () => {
    expect(continuousCultivationReward(120n, 10000, REAL_MS_PER_GAME_DAY)).toBe(120n);
    expect(continuousCultivationReward(120n, 15000, REAL_MS_PER_GAME_DAY / 2)).toBe(90n);
  });

  it("simulates combat deterministically with seeded rng", () => {
    const a = simulateCombat({ name: "A", hp: 120, attack: 22, defense: 8, speed: 12 }, { name: "B", hp: 90, attack: 15, defense: 6, speed: 8 }, seededRng(42));
    const b = simulateCombat({ name: "A", hp: 120, attack: 22, defense: 8, speed: 12 }, { name: "B", hp: 90, attack: 15, defense: 6, speed: 8 }, seededRng(42));
    expect(a).toEqual(b);
    expect(a.winner).toBe("player");
  });

  it("parses encounter tables safely", () => {
    expect(parseEncounterTable([{ key: "safe-passage", weight: 10 }, { key: "bad", weight: 0 }, null])).toEqual([{ key: "safe-passage", weight: 10 }]);
    expect(parseEncounterTable(null)).toEqual([{ key: "safe-passage", weight: 1 }]);
  });

  it("derives stable numeric seeds from non-hex ids", () => {
    expect(seedFromString("cm_fake_non_hex_id")).toBe(seedFromString("cm_fake_non_hex_id"));
    expect(seedFromString("cm_fake_non_hex_id")).not.toBe(seedFromString("other"));
  });
});

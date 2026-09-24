import { describe, expect, it } from "vitest";
import { calculateCultivationReward, currentEnergy, parseEncounterTable, simulateCombat } from "../src/rules.js";
import { seededRng, seedFromString } from "../src/rng.js";
describe("core rules", () => {
    it("calculates timestamp energy without cron ticks", () => {
        const energy = currentEnergy({ energyStored: 3, energyMax: 10, energyUpdatedAt: new Date("2026-01-01T00:00:00Z") }, new Date("2026-01-01T00:31:00Z"), 10);
        expect(energy).toBe(6);
    });
    it("calculates cultivation reward from snapshot multiplier", () => {
        expect(calculateCultivationReward(1000n, 12500)).toBe(1250n);
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

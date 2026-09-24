import type { Character, RealmStage, SpiritualRoot } from "@ttg/db";
export type DerivedStats = {
    hp: number;
    qi: number;
    attack: number;
    defense: number;
    speed: number;
    cultivationBps: number;
};
export declare function currentEnergy(character: Pick<Character, "energyStored" | "energyMax" | "energyUpdatedAt">, now?: Date, regenMinutes?: number): number;
export declare function calculateCultivationReward(baseReward: bigint, multiplierBps: number): bigint;
export declare function calculateCharacterStats(character: Pick<Character, "body" | "attack" | "defense" | "speed">, stage: Pick<RealmStage, "baseHp" | "baseQi" | "baseAttack" | "baseDefense" | "baseSpeed">, root: Pick<SpiritualRoot, "multiplierBps">, equipmentModifiers?: Array<Record<string, number>>): DerivedStats;
export type Fighter = {
    name: string;
    hp: number;
    attack: number;
    defense: number;
    speed: number;
};
export type WeightedEncounter = {
    key: string;
    weight: number;
};
export declare function parseEncounterTable(value: unknown): WeightedEncounter[];
export declare function simulateCombat(player: Fighter, enemy: Fighter, rng: () => number, maxTurns?: number): {
    winner: string;
    log: string[];
    remainingHp: number;
};

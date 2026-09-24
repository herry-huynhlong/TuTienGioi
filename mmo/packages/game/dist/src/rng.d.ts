export type Rng = () => number;
export declare function seededRng(seed: number): Rng;
export declare function seedFromString(value: string): number;
export declare function pickWeighted<T extends {
    weight: number;
}>(rows: T[], rng: Rng): T;

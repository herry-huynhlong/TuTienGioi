import { Prisma, type PrismaClient, Currency, WalletTxType } from "@ttg/db";
type Tx = Prisma.TransactionClient;
type Db = PrismaClient;
export declare class GameError extends Error {
    code: string;
    constructor(code: string, message: string);
}
export declare function creditWallet(db: Db | Tx, characterId: string, currency: Currency, amount: bigint, type: WalletTxType, referenceType?: string, referenceId?: string, idempotencyKey?: string): Promise<{
    id: string;
    createdAt: Date;
    characterId: string;
    currency: import("@ttg/db").$Enums.Currency;
    type: import("@ttg/db").$Enums.WalletTxType;
    amount: bigint;
    balanceBefore: bigint;
    balanceAfter: bigint;
    referenceType: string | null;
    referenceId: string | null;
    metadata: Prisma.JsonValue | null;
    idempotencyKey: string | null;
}>;
export declare function debitWallet(db: Db | Tx, characterId: string, currency: Currency, amount: bigint, type: WalletTxType, referenceType?: string, referenceId?: string, idempotencyKey?: string): Promise<{
    id: string;
    createdAt: Date;
    characterId: string;
    currency: import("@ttg/db").$Enums.Currency;
    type: import("@ttg/db").$Enums.WalletTxType;
    amount: bigint;
    balanceBefore: bigint;
    balanceAfter: bigint;
    referenceType: string | null;
    referenceId: string | null;
    metadata: Prisma.JsonValue | null;
    idempotencyKey: string | null;
}>;
export declare function startCultivation(db: Db, characterId: string, minutes: number, now?: Date): Promise<{
    id: string;
    multiplierBps: number;
    characterId: string;
    metadata: Prisma.JsonValue | null;
    startedAt: Date;
    endsAt: Date;
    status: import("@ttg/db").$Enums.ActivityStatus;
    baseReward: bigint;
    claimedAt: Date | null;
}>;
export declare function claimCultivation(db: Db, characterId: string, activityId: string, now?: Date): Promise<{
    reward: bigint;
    cultivation: bigint;
}>;
export declare function attemptBreakthrough(db: Db, characterId: string, rng?: () => number): Promise<{
    success: boolean;
    stage: string;
    loss?: never;
} | {
    success: boolean;
    loss: bigint;
    stage?: never;
}>;
export declare function startExploration(db: Db, characterId: string, minutes: number, now?: Date): Promise<{
    id: string;
    characterId: string;
    startedAt: Date;
    endsAt: Date;
    status: import("@ttg/db").$Enums.ActivityStatus;
    claimedAt: Date | null;
    reward: Prisma.JsonValue | null;
    zoneId: string;
    eventKey: string | null;
}>;
export declare function claimExploration(db: Db, characterId: string, activityId: string, now?: Date): Promise<{
    itemName: string;
}>;
export declare function startTravel(db: Db, characterId: string, routeId: string, now?: Date): Promise<{
    id: string;
    characterId: string;
    startedAt: Date;
    endsAt: Date;
    status: import("@ttg/db").$Enums.ActivityStatus;
    claimedAt: Date | null;
    originId: string;
    destinationId: string;
    travelCost: bigint;
    dangerSnapshot: number;
    securitySnapshot: import("@ttg/db").$Enums.RouteSecurityLevel;
    encounterSnapshot: Prisma.JsonValue;
    encounterKey: string | null;
    encounterResult: Prisma.JsonValue | null;
    routeId: string;
}>;
export declare function claimTravel(db: Db, characterId: string, travelId: string, now?: Date): Promise<{
    destinationName: string;
    encounter: string;
    result: {
        kind: string;
        message: string;
        itemTemplateId?: never;
        itemName?: never;
        quantity?: never;
        monsterKey?: never;
        monsterName?: never;
        winner?: never;
        cultivation?: never;
        reputation?: never;
        luck?: never;
    } | {
        kind: string;
        itemTemplateId: string;
        itemName: string;
        quantity: number;
        message: string;
        monsterKey?: never;
        monsterName?: never;
        winner?: never;
        cultivation?: never;
        reputation?: never;
        luck?: never;
    } | {
        kind: string;
        monsterKey: string;
        monsterName: string;
        winner: string;
        cultivation: string;
        message: string;
        itemTemplateId?: never;
        itemName?: never;
        quantity?: never;
        reputation?: never;
        luck?: never;
    } | {
        kind: string;
        reputation: number;
        message: string;
        itemTemplateId?: never;
        itemName?: never;
        quantity?: never;
        monsterKey?: never;
        monsterName?: never;
        winner?: never;
        cultivation?: never;
        luck?: never;
    } | {
        kind: string;
        cultivation: string;
        luck: number;
        message: string;
        itemTemplateId?: never;
        itemName?: never;
        quantity?: never;
        monsterKey?: never;
        monsterName?: never;
        winner?: never;
        reputation?: never;
    };
}>;
export declare function fightMonster(db: Db, characterId: string, monsterKey: string, seed?: number): Promise<{
    reward: {
        cultivation: number;
        linhThach: number;
    };
    monsterName: string;
    winner: string;
    log: string[];
    remainingHp: number;
}>;
export declare function purchaseMarketListing(db: Db, buyerId: string, listingId: string, now?: Date): Promise<{
    price: bigint;
    tax: bigint;
}>;
export {};

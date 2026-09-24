import { describe, expect, it } from "vitest";
import { Currency, WalletTxType } from "@ttg/db";
import { creditWallet, debitWallet } from "../src/services.js";
function fakeWalletDb(initialLinhThach, initialTienNgoc = 0n) {
    const character = { id: "char_1", linhThach: initialLinhThach, tienNgoc: initialTienNgoc };
    const rows = new Map();
    const tx = {
        character: {
            findUniqueOrThrow: async () => ({ linhThach: character.linhThach, tienNgoc: character.tienNgoc }),
            update: async ({ data }) => {
                if (typeof data.linhThach === "bigint")
                    character.linhThach = data.linhThach;
                if (typeof data.tienNgoc === "bigint")
                    character.tienNgoc = data.tienNgoc;
                return character;
            }
        },
        walletTransaction: {
            findUnique: async ({ where }) => {
                const key = `${where.characterId_currency_idempotencyKey.characterId}:${where.characterId_currency_idempotencyKey.currency}:${where.characterId_currency_idempotencyKey.idempotencyKey}`;
                return rows.get(key) ?? null;
            },
            create: async ({ data }) => {
                const row = { ...data, idempotencyKey: data.idempotencyKey ?? null };
                if (row.idempotencyKey)
                    rows.set(`${row.characterId}:${row.currency}:${row.idempotencyKey}`, row);
                return row;
            }
        }
    };
    return {
        character,
        rows,
        db: {
            $transaction: async (callback) => callback(tx)
        }
    };
}
describe("wallet services", () => {
    it("writes ledger rows and updates balances through credit/debit helpers", async () => {
        const fake = fakeWalletDb(100n);
        const debit = await debitWallet(fake.db, "char_1", Currency.LINH_THACH, 40n, WalletTxType.SECT, "Sect", "sect_1", "sect:create:char_1");
        expect(debit.amount).toBe(-40n);
        expect(debit.balanceBefore).toBe(100n);
        expect(debit.balanceAfter).toBe(60n);
        expect(fake.character.linhThach).toBe(60n);
        const credit = await creditWallet(fake.db, "char_1", Currency.LINH_THACH, 25n, WalletTxType.REWARD, "Monster", "wolf");
        expect(credit.amount).toBe(25n);
        expect(credit.balanceBefore).toBe(60n);
        expect(credit.balanceAfter).toBe(85n);
        expect(fake.character.linhThach).toBe(85n);
    });
    it("rejects debits that would make the wallet negative", async () => {
        const fake = fakeWalletDb(10n);
        await expect(debitWallet(fake.db, "char_1", Currency.LINH_THACH, 11n, WalletTxType.SECT)).rejects.toMatchObject({
            code: "INSUFFICIENT_FUNDS"
        });
        expect(fake.character.linhThach).toBe(10n);
    });
    it("does not apply the same idempotency key twice", async () => {
        const fake = fakeWalletDb(100n);
        await debitWallet(fake.db, "char_1", Currency.LINH_THACH, 30n, WalletTxType.SECT, "Sect", "sect_1", "same-key");
        const repeated = await debitWallet(fake.db, "char_1", Currency.LINH_THACH, 30n, WalletTxType.SECT, "Sect", "sect_1", "same-key");
        expect(repeated.balanceAfter).toBe(70n);
        expect(fake.character.linhThach).toBe(70n);
        expect(fake.rows.size).toBe(1);
    });
});

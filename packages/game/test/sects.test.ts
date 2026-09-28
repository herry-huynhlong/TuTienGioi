import { describe, expect, it } from "vitest";
import { Currency, SectRoleName, WalletTxType } from "@ttg/db";
import { depositSectCurrency, withdrawSectCurrency } from "../src/sects.js";

function fakeSectDb(role: SectRoleName, characterBalance = 10_000n, treasury = 1_000n) {
  const state = {
    character: { id: "char_1", linhThach: characterBalance, tienNgoc: 0n },
    sect: { id: "sect_1", treasury, reputation: 0 },
    member: { id: "member_1", sectId: "sect_1", characterId: "char_1", role, contribution: 0, weeklyContribution: 0 }
  };
  const rows = {
    wallet: [] as unknown[],
    treasury: [] as unknown[],
    contribution: [] as unknown[],
    logs: [] as unknown[]
  };
  const tx = {
    character: {
      findUniqueOrThrow: async () => ({ linhThach: state.character.linhThach, tienNgoc: state.character.tienNgoc }),
      update: async ({ data }: { data: { linhThach?: bigint; tienNgoc?: bigint } }) => {
        if (typeof data.linhThach === "bigint") state.character.linhThach = data.linhThach;
        if (typeof data.tienNgoc === "bigint") state.character.tienNgoc = data.tienNgoc;
        return state.character;
      }
    },
    walletTransaction: {
      findUnique: async () => null,
      create: async ({ data }: { data: unknown }) => {
        rows.wallet.push(data);
        return data;
      }
    },
    sectMember: {
      findUnique: async () => ({ ...state.member, sect: state.sect }),
      findUniqueOrThrow: async () => state.member,
      update: async ({ data }: { data: { contribution: number; weeklyContribution?: { increment: number } } }) => {
        state.member.contribution = data.contribution;
        if (data.weeklyContribution) state.member.weeklyContribution += data.weeklyContribution.increment;
        return state.member;
      }
    },
    sect: {
      update: async ({ data }: { data: { treasury?: bigint; reputation?: { increment: number } } }) => {
        if (typeof data.treasury === "bigint") state.sect.treasury = data.treasury;
        if (data.reputation) state.sect.reputation += data.reputation.increment;
        return state.sect;
      },
      updateMany: async ({ where, data }: { where: { treasury: { gte: bigint } }; data: { treasury: { decrement: bigint } } }) => {
        if (state.sect.treasury < where.treasury.gte) return { count: 0 };
        state.sect.treasury -= data.treasury.decrement;
        return { count: 1 };
      }
    },
    sectTreasuryTransaction: {
      create: async ({ data }: { data: unknown }) => {
        rows.treasury.push(data);
        return { id: `treasury_${rows.treasury.length}`, ...(data as object) };
      }
    },
    sectContributionTransaction: {
      findUnique: async () => null,
      create: async ({ data }: { data: unknown }) => {
        rows.contribution.push(data);
        return data;
      }
    },
    sectLog: {
      create: async ({ data }: { data: unknown }) => {
        rows.logs.push(data);
        return data;
      }
    }
  };
  return {
    state,
    rows,
    db: {
      $transaction: async <T>(callback: (inner: typeof tx) => Promise<T>) => callback(tx)
    }
  };
}

describe("sect economy services", () => {
  it("deposits sect currency atomically and writes ledgers", async () => {
    const fake = fakeSectDb(SectRoleName.OUTER);

    const result = await depositSectCurrency(fake.db as never, "char_1", 1_000n);

    expect(result.treasury).toBe(2_000n);
    expect(result.contribution).toBe(10);
    expect(fake.state.character.linhThach).toBe(9_000n);
    expect(fake.state.member.contribution).toBe(10);
    expect(fake.rows.wallet).toHaveLength(1);
    expect(fake.rows.treasury).toHaveLength(1);
    expect(fake.rows.contribution).toHaveLength(1);
  });

  it("withdraws sect currency only for permitted roles", async () => {
    const leader = fakeSectDb(SectRoleName.LEADER, 0n, 1_000n);

    await withdrawSectCurrency(leader.db as never, "char_1", 400n);

    expect(leader.state.sect.treasury).toBe(600n);
    expect(leader.state.character.linhThach).toBe(400n);

    const outer = fakeSectDb(SectRoleName.OUTER, 0n, 1_000n);
    await expect(withdrawSectCurrency(outer.db as never, "char_1", 400n)).rejects.toMatchObject({ code: "SECT_FORBIDDEN" });
  });

  it("rejects treasury withdrawal when balance is insufficient", async () => {
    const fake = fakeSectDb(SectRoleName.LEADER, 0n, 100n);

    await expect(withdrawSectCurrency(fake.db as never, "char_1", 101n)).rejects.toMatchObject({ code: "INSUFFICIENT_TREASURY" });
    expect(fake.state.sect.treasury).toBe(100n);
  });
});

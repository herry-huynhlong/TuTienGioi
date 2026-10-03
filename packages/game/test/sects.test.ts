import { describe, expect, it } from "vitest";
import { Currency, SectRoleName, WalletTxType } from "@ttg/db";
import { calculateSectMissionReward, getSectCaveBenefit, getSectItemContributionPrice, getSectRank, previewSectFarmReward, previewSectMineReward, sectFacilityConfig, sectMineConfig, depositSectCurrency, exchangeSectAppearanceTalisman, withdrawSectCurrency } from "../src/sects.js";

function fakeSectDb(role: SectRoleName, characterBalance = 10_000n, treasury = 1_000n, contribution = 0) {
  const state = {
    character: { id: "char_1", linhThach: characterBalance, tienNgoc: 0n },
    sect: { id: "sect_1", tag: "TVM", name: "Thanh Vân Môn", treasury, reputation: 0 },
    member: { id: "member_1", sectId: "sect_1", characterId: "char_1", role, contribution, weeklyContribution: 0 },
    item: null as null | { id: string; quantity: number }
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
    itemTemplate: {
      findUnique: async () => ({ id: "template_1", key: "dich-dung-phu", name: "Dịch Dung Phù", category: "CONSUMABLE", rarity: "TRUNG", tradeable: false, baseModifiers: { appearanceChange: true }, bindRules: { sectContributionPrice: 400 } })
    },
    itemInstance: {
      findFirst: async () => state.item,
      update: async ({ data }: { data: { quantity: { increment: number } } }) => {
        if (state.item) state.item.quantity += data.quantity.increment;
        return state.item;
      },
      create: async ({ data }: { data: { quantity: number } }) => {
        state.item = { id: "item_1", quantity: data.quantity };
        return state.item;
      }
    },
    gameLog: { create: async ({ data }: { data: unknown }) => data },
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

  it("keeps rank config as the source of sect capacity unlocks", () => {
    expect(getSectRank(5).capacities.farm).toBeGreaterThanOrEqual(sectFacilityConfig.defaults.FARM);
    expect(getSectRank(4).capacities.mine).toBeGreaterThan(getSectRank(5).capacities.mine);
    expect(getSectRank(3).maxMembers).toBeGreaterThan(getSectRank(4).maxMembers);
  });

  it("calculates farm reward split and rejects locked crops in backend", () => {
    const reward = previewSectFarmReward(5, "thanh-linh-thao");

    expect(reward.totalYield).toBe(10);
    expect(reward.split).toEqual({ personal: 7, sect: 3 });
    expect(reward.contribution).toBeGreaterThan(0);
    expect(() => previewSectFarmReward(5, "hoa-linh-chi")).toThrowError(/chưa mở/);
  });

  it("calculates mine reward split from backend config", () => {
    const reward = previewSectMineReward(4, "han-thiet-mach");

    expect(reward.totalYield).toBe(22);
    expect(reward.split).toEqual({ personal: 8, sect: 14 });
    expect(reward.reputation).toBeGreaterThan(0);
  });

  it("keeps auction-grade materials wired to high rank mine rare drops", () => {
    const rareKeys = Object.values(sectMineConfig.mines).flatMap((mine) => mine.rareDrops.map((drop) => drop.key));

    expect(rareKeys).toContain("huyen-tinh");
    expect(rareKeys).toContain("dia-mach-linh-tinh");
    expect(rareKeys).toContain("xich-viem-tinh-kim");
  });

  it("scales generated mission rewards by difficulty and world danger", () => {
    const easy = calculateSectMissionReward({ difficulty: 1, locationDanger: 1, targetStrength: 0, sectRank: 5 });
    const hard = calculateSectMissionReward({ difficulty: 4, locationDanger: 6, targetStrength: 3, sectRank: 3 });

    expect(hard.cultivation).toBeGreaterThan(easy.cultivation);
    expect(hard.contribution).toBeGreaterThan(easy.contribution);
    expect(hard.reputation).toBeGreaterThan(easy.reputation);
  });

  it("adds real rare item rewards to five star sect missions", () => {
    const reward = calculateSectMissionReward({ difficulty: 5, locationDanger: 6, targetStrength: 3, sectRank: 2, missionType: "HUNT", rewardSeed: "boss-five-star" });

    expect(reward.itemQuantity).toBe(1);
    expect(["tu-linh-ngoc", "yeu-dan-nhi-giai"]).toContain(reward.itemKey);
  });

  it("derives cave benefits from officer roles and excludes inner/outer disciples", () => {
    const outer = getSectCaveBenefit(SectRoleName.OUTER, 5);
    const leader = getSectCaveBenefit(SectRoleName.LEADER, 5);
    const elderHighRank = getSectCaveBenefit(SectRoleName.ELDER, 2);

    expect(outer).toBeNull();
    expect(leader?.level).toBe(1);
    expect(leader?.maxSlots).toBe(1);
    expect(elderHighRank?.level).toBe(3);
    expect(elderHighRank?.cultivationBonusBps).toBeGreaterThan(0);
  });

  it("prices sect storage exchange from backend item economy", () => {
    const materialPrice = getSectItemContributionPrice({ category: "MATERIAL", rarity: "HA", bindRules: { systemBasePrice: 40 }, baseModifiers: {} });
    const equipmentPrice = getSectItemContributionPrice({ category: "EQUIPMENT", rarity: "TRUNG", bindRules: { systemBasePrice: 200 }, baseModifiers: { attack: 5 } });

    expect(materialPrice).toBeGreaterThan(0);
    expect(equipmentPrice).toBeGreaterThan(materialPrice);
  });

  it("exchanges Dịch Dung Phù for Thanh Vân contribution", async () => {
    const fake = fakeSectDb(SectRoleName.OUTER, 0n, 0n, 500);

    const result = await exchangeSectAppearanceTalisman(fake.db as never, "char_1", "once");

    expect(result.contributionCost).toBe(400);
    expect(fake.state.member.contribution).toBe(100);
    expect(fake.state.item?.quantity).toBe(1);
    expect(fake.rows.contribution).toHaveLength(1);
  });

  it("rejects Dịch Dung Phù exchange when contribution is insufficient", async () => {
    const fake = fakeSectDb(SectRoleName.OUTER, 0n, 0n, 399);

    await expect(exchangeSectAppearanceTalisman(fake.db as never, "char_1", "short")).rejects.toMatchObject({ code: "INSUFFICIENT_CONTRIBUTION" });
    expect(fake.state.member.contribution).toBe(399);
    expect(fake.state.item).toBeNull();
  });
});

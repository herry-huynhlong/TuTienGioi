import { describe, expect, it } from "vitest";
import { auctionPriceForRound, canAuctionItem, getItemEconomy } from "../src/index.js";

describe("turn based auction rules", () => {
  it("uses a fixed +30% step from the starting price", () => {
    const start = 100000n;
    expect([0, 1, 2, 3, 4].map((round) => auctionPriceForRound(start, round))).toEqual([100000n, 130000n, 160000n, 190000n, 220000n]);
  });

  it("requires premium auction class for equipment but not for eligible materials", () => {
    const standardEquipment = {
      category: "EQUIPMENT",
      rarity: "THUONG",
      tradeable: true,
      equipSlot: "WEAPON",
      itemFamily: null,
      baseModifiers: { attack: 10 },
      bindRules: { auctionEligible: true, auctionClass: "STANDARD" }
    };
    const premiumEquipment = { ...standardEquipment, bindRules: { auctionEligible: true, auctionClass: "PREMIUM" } };
    const rareMaterial = {
      category: "MATERIAL",
      rarity: "THUONG",
      tradeable: true,
      itemFamily: null,
      baseModifiers: {},
      bindRules: { auctionEligible: true, auctionClass: "STANDARD" }
    };

    expect(canAuctionItem(standardEquipment)).toBe(false);
    expect(canAuctionItem(premiumEquipment)).toBe(true);
    expect(canAuctionItem(rareMaterial)).toBe(true);
    expect(getItemEconomy(premiumEquipment).auctionClass).toBe("PREMIUM");
  });
});

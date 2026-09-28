import { describe, expect, it } from "vitest";
import { getItemEconomy, itemStackKey, progressionItemCatalog, stockForSystemMarketItem } from "../src/items.js";

describe("item progression economy", () => {
  it("defines the 30 baseline progression items by grade", () => {
    expect(progressionItemCatalog).toHaveLength(30);
    expect(progressionItemCatalog.filter((item) => item.rarity === "HA")).toHaveLength(10);
    expect(progressionItemCatalog.filter((item) => item.rarity === "TRUNG")).toHaveLength(10);
    expect(progressionItemCatalog.filter((item) => item.rarity === "THUONG")).toHaveLength(10);
  });

  it("keeps Truc Co Dan as one item family across independent grades", () => {
    const variants = progressionItemCatalog.filter((item) => item.itemFamily === "truc-co-dan");
    expect(variants.map((item) => item.key).sort()).toEqual(["truc-co-dan-ha", "truc-co-dan-thuong", "truc-co-dan-trung"]);
    expect(variants.map((item) => item.rarity).sort()).toEqual(["HA", "THUONG", "TRUNG"]);
  });

  it("enables system market stock only for low and mid grade baseline items", () => {
    expect(progressionItemCatalog.filter((item) => item.rarity === "HA").every((item) => item.systemMarketEnabled)).toBe(true);
    expect(progressionItemCatalog.filter((item) => item.rarity === "TRUNG").every((item) => item.systemMarketEnabled)).toBe(true);
    expect(progressionItemCatalog.filter((item) => item.rarity === "THUONG").every((item) => !item.systemMarketEnabled)).toBe(true);
    expect(stockForSystemMarketItem("thanh-linh-thao", "HA", new Date("2026-09-28T00:00:00Z"))).toBeGreaterThanOrEqual(20);
    expect(stockForSystemMarketItem("huyen-tinh", "THUONG", new Date("2026-09-28T00:00:00Z"))).toBe(0);
  });

  it("prices sect exchange above donation value to avoid obvious arbitrage", () => {
    for (const item of progressionItemCatalog) {
      const economy = getItemEconomy({
        category: item.category,
        rarity: item.rarity,
        tradeable: true,
        itemFamily: item.itemFamily ?? null,
        baseModifiers: item.baseModifiers ?? {},
        bindRules: {
          systemBasePrice: item.basePrice,
          sectContributionPrice: item.sectContributionPrice,
          donationContributionValue: Math.floor(item.sectContributionPrice * 0.4),
          systemMarketEnabled: item.systemMarketEnabled
        }
      });
      expect(economy.donationContributionValue).toBeLessThan(economy.sectContributionPrice);
      expect(economy.npcBuyPrice).toBeLessThanOrEqual(economy.systemBasePrice);
    }
  });

  it("stacks compatible items but separates different grades/templates", () => {
    const base = { quality: 1, enhancement: 0, bound: false, durability: null, equippedSlot: null, customModifiers: {} };
    expect(itemStackKey({ ...base, templateId: "truc-co-dan-ha" })).toBe(itemStackKey({ ...base, templateId: "truc-co-dan-ha" }));
    expect(itemStackKey({ ...base, templateId: "truc-co-dan-ha" })).not.toBe(itemStackKey({ ...base, templateId: "truc-co-dan-trung" }));
    expect(itemStackKey({ ...base, templateId: "hac-thiet-quang", bound: true })).not.toBe(itemStackKey({ ...base, templateId: "hac-thiet-quang", bound: false }));
  });
});

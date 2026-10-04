import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getItemEconomy, itemSpecificVisualKeys, itemStackKey, itemVisualKey, progressionItemCatalog, stockForSystemMarketItem } from "../src/items.js";

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

  it("maps baseline progression items to dedicated visual assets", () => {
    const keys = progressionItemCatalog.map((item) => item.key);
    const movedVisualKeys: Record<string, string> = {
      "thanh-linh-thao": "herb/thanh-linh-thao",
      "huyen-thiet": "ore/huyen-thiet",
      "yeu-dan-nhat-giai": "monster-core/yeu-dan-nhat-giai",
      "yeu-dan-nhi-giai": "monster-core/yeu-dan-nhi-giai",
      "linh-moc": "wood/linh-moc",
      "yeu-thu-bi": "beast/yeu-thu-bi"
    };
    expect(new Set(keys).size).toBe(30);
    for (const item of progressionItemCatalog) {
      const visualKey = itemVisualKey(item);
      expect(visualKey).toBe(movedVisualKeys[item.key] ?? item.key);
      expect(existsSync(resolve(process.cwd(), "../../apps/web/public/items", `${visualKey}.webp`)), `${item.key}:${visualKey}`).toBe(true);
    }
    expect(itemVisualKey(progressionItemCatalog.find((item) => item.key === "duong-the-dan")!)).toBe("duong-the-dan");
  });

  it("keeps a project asset for every specific item visual key including Linh Thach", () => {
    expect(itemSpecificVisualKeys).toContain("linh-thach");
    for (const visualKey of itemSpecificVisualKeys) {
      expect(existsSync(resolve(process.cwd(), "../../apps/web/public/items", `${visualKey}.webp`)), visualKey).toBe(true);
    }
  });

  it("uses distinct fallback art for profession material concepts", () => {
    const cases = [
      ["powder", "default-powder"],
      ["paper", "default-paper"],
      ["root", "default-root"],
      ["flag", "default-flag"],
      ["water", "default-water"],
      ["gem", "default-crystal"],
      ["core", "default-monster-core"],
      ["spirit", "default-spirit"],
      ["wood", "default-wood"],
      ["flower", "default-flower"],
      ["mushroom", "default-mushroom"],
      ["leaf", "default-leaf"]
    ] as const;
    for (const [icon, visualKey] of cases) {
      expect(itemVisualKey({ category: "MATERIAL", icon })).toBe(visualKey);
      expect(existsSync(resolve(process.cwd(), "../../apps/web/public/items", `${visualKey}.webp`)), visualKey).toBe(true);
    }
    for (const visualKey of [
      "material/chu-sa",
      "talisman/hoang-phu-chi",
      "herb/huyet-sam",
      "herb/cuong-than-thao",
      "ore/hac-thiet",
      "formation/ha-pham-tran-ky",
      "formation/trung-pham-tran-ky",
      "formation/huyen-pham-tran-ky",
      "formation/thien-pham-tran-ky",
      "formation/tien-pham-tran-ky",
      "water/linh-tuyen-thuy",
      "talisman/linh-phu-chi",
      "talisman/huyen-phu-chi",
      "talisman/thien-phu-chi",
      "talisman/tien-phu-chi",
      "monster-core/yeu-dan-nhat-giai",
      "monster-core/yeu-dan-nhi-giai",
      "wood/linh-moc",
      "beast/yeu-thu-bi",
      "herb/thanh-linh-thao",
      "ore/huyen-thiet"
    ]) {
      expect(existsSync(resolve(process.cwd(), "../../apps/web/public/items", `${visualKey}.webp`)), visualKey).toBe(true);
    }
  });

  it("keeps baseline rare materials out of direct sale but stocks shop-grade rarities", () => {
    expect(progressionItemCatalog.filter((item) => item.rarity === "HA").every((item) => item.systemMarketEnabled)).toBe(true);
    expect(progressionItemCatalog.filter((item) => item.rarity === "TRUNG").every((item) => item.systemMarketEnabled)).toBe(true);
    expect(progressionItemCatalog.filter((item) => item.rarity === "THUONG").every((item) => !item.systemMarketEnabled)).toBe(true);
    expect(stockForSystemMarketItem("thanh-linh-thao", "HA", new Date("2026-09-28T00:00:00Z"))).toBeGreaterThanOrEqual(20);
    expect(stockForSystemMarketItem("tu-dien-kiem", "THUONG", new Date("2026-09-28T00:00:00Z"))).toBeGreaterThanOrEqual(3);
    expect(stockForSystemMarketItem("tu-dien-kiem", "THUONG", new Date("2026-09-28T00:00:00Z"))).toBeLessThanOrEqual(12);
    expect(stockForSystemMarketItem("thien-cuong-kiem", "CUC", new Date("2026-09-28T00:00:00Z"))).toBe(0);
  });

  it("documents real gameplay sources for every auction progression item", () => {
    const auctionItems = progressionItemCatalog.filter((item) => item.auctionEligible);

    expect(auctionItems).toHaveLength(9);
    for (const item of auctionItems) {
      expect(item.sources.length, item.key).toBeGreaterThan(0);
      expect(item.sources.join(" "), item.key).not.toMatch(/Đấu Giá sau này|Reward hiếm|Bí cảnh$/);
      const economy = getItemEconomy({
        category: item.category,
        rarity: item.rarity,
        tradeable: true,
        itemFamily: item.itemFamily ?? null,
        baseModifiers: item.baseModifiers ?? {},
        bindRules: { sources: item.sources, auctionEligible: true }
      });
      expect(economy.sources, item.key).toEqual(item.sources);
    }
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

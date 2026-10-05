import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getItemEconomy, itemSpecificVisualKeyByItemKey, itemSpecificVisualKeys, itemStackKey, itemVisualKey, progressionItemCatalog, stockForSystemMarketItem } from "../src/items.js";

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
    expect(new Set(keys).size).toBe(30);
    for (const item of progressionItemCatalog) {
      const visualKey = itemVisualKey(item);
      expect(visualKey).toBe(itemSpecificVisualKeyByItemKey[item.key] ?? item.key);
      expect(existsSync(resolve(process.cwd(), "../../apps/web/public/items", `${visualKey}.webp`)), `${item.key}:${visualKey}`).toBe(true);
    }
    expect(itemVisualKey(progressionItemCatalog.find((item) => item.key === "duong-the-dan")!)).toBe("pill/duong-the-dan");
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
      "material/hoa-linh-phan",
      "material/phong-linh-phan",
      "material/hoa-tinh-phan",
      "material/kim-linh-phan",
      "material/thanh-tam-moc-phan",
      "material/loi-tinh-phan",
      "material/khong-minh-phan",
      "material/chu-sa-tinh",
      "material/chu-sa-cuc-pham",
      "material/pha-cam-thach-phan",
      "talisman/hoang-phu-chi",
      "talisman/linh-phu-chi",
      "talisman/huyen-phu-chi",
      "talisman/thien-phu-chi",
      "crystal/dao-van-tinh-hoa",
      "crystal/khong-minh-thach",
      "crystal/hoa-tinh-thach",
      "crystal/khong-gian-tinh-thach",
      "crystal/linh-tinh",
      "herb/huyet-sam",
      "herb/cuong-than-thao",
      "ore/hac-thiet",
      "formation/ha-pham-tran-ky",
      "formation/trung-pham-tran-ky",
      "formation/huyen-pham-tran-ky",
      "formation/thien-pham-tran-ky",
      "formation/tien-pham-tran-ky",
      "water/linh-tuyen-thuy",
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

  it("resolves existing profession ingredient art before falling back", () => {
    const cases = [
      ["hac-thiet", "ore", "ore/hac-thiet"],
      ["hoang-phu-chi", "paper", "talisman/hoang-phu-chi"],
      ["linh-phu-chi", "paper", "talisman/linh-phu-chi"],
      ["huyen-phu-chi", "paper", "talisman/huyen-phu-chi"],
      ["thien-phu-chi", "paper", "talisman/thien-phu-chi"],
      ["dao-van-tinh-hoa", "crystal", "crystal/dao-van-tinh-hoa"],
      ["khong-minh-thach", "crystal", "crystal/khong-minh-thach"],
      ["hoa-tinh-thach", "crystal", "crystal/hoa-tinh-thach"],
      ["khong-gian-tinh-thach", "crystal", "crystal/khong-gian-tinh-thach"],
      ["linh-tinh", "crystal", "crystal/linh-tinh"]
    ] as const;

    for (const [key, icon, visualKey] of cases) {
      expect(itemVisualKey({ key, category: "MATERIAL", icon })).toBe(visualKey);
      expect(existsSync(resolve(process.cwd(), "../../apps/web/public/items", `${visualKey}.webp`)), visualKey).toBe(true);
    }
  });

  it("maps every explicit visual override to a real non-fallback asset", () => {
    for (const [key, visualKey] of Object.entries(itemSpecificVisualKeyByItemKey)) {
      expect(visualKey, key).not.toMatch(/^default-/);
      expect(itemVisualKey({ key, category: "MATERIAL", icon: "crystal" }), key).toBe(visualKey);
      expect(existsSync(resolve(process.cwd(), "../../apps/web/public/items", `${visualKey}.webp`)), `${key}:${visualKey}`).toBe(true);
    }
  });

  it("keeps market-facing items with existing art off fallback visuals", () => {
    const cases = [
      "linh-tuyen-thuy",
      "huyet-sam",
      "cuong-than-thao",
      "linh-tuyen-tinh-hoa",
      "tay-tuy-linh-dich",
      "thanh-phong-kiem",
      "hac-thiet-giap",
      "tu-linh-boi",
      "xich-viem-kiem",
      "thanh-linh-giap",
      "truy-phong-ngoa",
      "phong-linh-thach",
      "tu-dien-kiem",
      "huyen-giap",
      "tu-linh-gioi",
      "tho-linh-tinh",
      "sinh-menh-tinh-hoa",
      "ha-pham-tran-ky",
      "trung-pham-tran-ky",
      "nguyen-linh-thach",
      "huyen-pham-tran-ky",
      "kim-linh-tinh",
      "moc-linh-tinh",
      "thuy-linh-tinh",
      "hoa-linh-tinh",
      "thien-pham-tran-ky",
      "thien-linh-tinh",
      "dia-mach-tinh-hoa",
      "tien-phu-chi"
    ];

    for (const key of cases) {
      const visualKey = itemVisualKey({ key, category: "MATERIAL", icon: "crystal" });
      expect(visualKey, key).not.toMatch(/^default-/);
      expect(existsSync(resolve(process.cwd(), "../../apps/web/public/items", `${visualKey}.webp`)), `${key}:${visualKey}`).toBe(true);
    }
  });

  it("keeps common powder materials on distinct market art", () => {
    const powderVisualKeys = [
      "material/chu-sa",
      "material/hoa-linh-phan",
      "material/phong-linh-phan",
      "material/hoa-tinh-phan",
      "material/kim-linh-phan",
      "material/thanh-tam-moc-phan",
      "material/loi-tinh-phan",
      "material/khong-minh-phan",
      "material/chu-sa-tinh",
      "material/chu-sa-cuc-pham",
      "material/pha-cam-thach-phan"
    ];
    const hashes = powderVisualKeys.map((visualKey) => {
      const file = resolve(process.cwd(), "../../apps/web/public/items", `${visualKey}.webp`);
      expect(existsSync(file), visualKey).toBe(true);
      return createHash("sha256").update(readFileSync(file)).digest("hex");
    });
    expect(new Set(hashes).size).toBe(powderVisualKeys.length);
    expect(itemVisualKey({ key: "hoa-linh-phan", category: "MATERIAL", icon: "powder" })).toBe("material/hoa-linh-phan");
    expect(itemVisualKey({ key: "phong-linh-phan", category: "MATERIAL", icon: "powder" })).toBe("material/phong-linh-phan");
    expect(itemVisualKey({ key: "hoa-tinh-phan", category: "MATERIAL", icon: "powder" })).toBe("material/hoa-tinh-phan");
  });

  it("keeps high-traffic fallback visual families distinct", () => {
    const fallbackVisualKeys = [
      "default-flower",
      "default-mushroom",
      "default-leaf",
      "default-crystal",
      "default-artifact",
      "default-ore",
      "default-stone",
      "default-paper",
      "default-ink"
    ];
    const hashes = fallbackVisualKeys.map((visualKey) => {
      const file = resolve(process.cwd(), "../../apps/web/public/items", `${visualKey}.webp`);
      expect(existsSync(file), visualKey).toBe(true);
      return createHash("sha256").update(readFileSync(file)).digest("hex");
    });
    expect(new Set(hashes).size).toBe(fallbackVisualKeys.length);
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

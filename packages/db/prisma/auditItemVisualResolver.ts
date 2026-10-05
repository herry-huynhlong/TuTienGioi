import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { itemSpecificVisualKeyByItemKey, itemVisualKey, progressionItemCatalog } from "../../game/src/items.ts";
import { coreProfessionRecipes } from "./professionSeedData";

type CatalogItem = {
  key: string;
  name: string;
  category: string;
  icon: string;
  marketFacing: boolean;
};

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const itemRoot = join(repoRoot, "apps/web/public/items");
const assetsByKey = new Map<string, string[]>();

function walkAssets(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAssets(path);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".webp")) continue;
    const key = basename(entry.name, ".webp");
    if (key.startsWith("default-") || key.includes("original-")) continue;
    const visualKey = relative(itemRoot, path).replace(/\\/g, "/").replace(/\.webp$/, "");
    const current = assetsByKey.get(key) ?? [];
    current.push(visualKey);
    assetsByKey.set(key, current);
  }
}

function buildCatalog() {
  const catalog = new Map<string, CatalogItem>();
  for (const item of progressionItemCatalog) {
    catalog.set(item.key, {
      key: item.key,
      name: item.name,
      category: item.category,
      icon: item.icon,
      marketFacing: Boolean(item.systemMarketEnabled || item.auctionEligible)
    });
  }

  for (const recipe of coreProfessionRecipes) {
    const outputMarketFacing = recipe.rank === "APPRENTICE" || recipe.rank === "ADEPT" || recipe.rank === "EXPERT";
    catalog.set(recipe.outputKey, {
      key: recipe.outputKey,
      name: recipe.outputName,
      category: recipe.category,
      icon: recipe.icon,
      marketFacing: outputMarketFacing
    });

    for (const ingredient of recipe.ingredients) {
      const existing = catalog.get(ingredient.key);
      catalog.set(ingredient.key, {
        key: ingredient.key,
        name: ingredient.name,
        category: "MATERIAL",
        icon: ingredient.icon ?? "material",
        marketFacing: Boolean(existing?.marketFacing || recipe.rank !== "GRANDMASTER")
      });
    }
  }

  return [...catalog.values()];
}

function summarize(scope: CatalogItem[]) {
  const fallback = scope.filter((item) => itemVisualKey(item).startsWith("default-"));
  const fallbackByKey = new Map<string, number>();
  for (const item of fallback) {
    const visualKey = itemVisualKey(item);
    fallbackByKey.set(visualKey, (fallbackByKey.get(visualKey) ?? 0) + 1);
  }

  return {
    fallback,
    defaultCrystal: scope.filter((item) => itemVisualKey(item) === "default-crystal"),
    defaultPaper: scope.filter((item) => itemVisualKey(item) === "default-paper"),
    assetExistsButFallback: fallback.filter((item) => assetsByKey.has(item.key)),
    fallbackByKey: Object.fromEntries([...fallbackByKey.entries()].sort((a, b) => b[1] - a[1]))
  };
}

walkAssets(itemRoot);
const catalog = buildCatalog();
const marketCatalog = catalog.filter((item) => item.marketFacing);
const all = summarize(catalog);
const market = summarize(marketCatalog);
const missingExplicit = Object.entries(itemSpecificVisualKeyByItemKey).filter(([, visualKey]) => !existsSync(join(itemRoot, `${visualKey}.webp`)));

console.log(JSON.stringify({
  catalog: catalog.length,
  market: marketCatalog.length,
  fallbackAll: all.fallback.length,
  fallbackMarket: market.fallback.length,
  defaultCrystalAll: all.defaultCrystal.length,
  defaultCrystalMarket: market.defaultCrystal.length,
  defaultPaperAll: all.defaultPaper.length,
  defaultPaperMarket: market.defaultPaper.length,
  assetExistsButFallbackAll: all.assetExistsButFallback.map((item) => item.key),
  assetExistsButFallbackMarket: market.assetExistsButFallback.map((item) => item.key),
  missingExplicit,
  explicitMappings: Object.keys(itemSpecificVisualKeyByItemKey).length,
  fallbackByKeyAll: all.fallbackByKey,
  fallbackByKeyMarket: market.fallbackByKey
}, null, 2));

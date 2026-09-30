import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { professionItemVisualPrompts } from "./itemVisualPrompts";

type FolderStats = {
  total: number;
  real: number;
  fallback: number;
};

const repoRoot = resolve(process.cwd(), "../..");
const coreUiAssets = {
  "linh-thach": "apps/web/public/items/linh-thach.webp",
  "talisman/dich-dung-phu": "apps/web/public/items/talisman/dich-dung-phu.webp"
} as const;
const byFolder = new Map<string, FolderStats>();
const missing: Array<{ itemCode: string; itemName: string; targetFile: string; fallbackKey: string }> = [];

for (const entry of professionItemVisualPrompts) {
  const folder = entry.visualKey.split("/")[0] ?? "unknown";
  const stats = byFolder.get(folder) ?? { total: 0, real: 0, fallback: 0 };
  const hasRealAsset = existsSync(resolve(repoRoot, entry.targetFile));

  stats.total += 1;
  if (hasRealAsset) {
    stats.real += 1;
  } else {
    stats.fallback += 1;
    missing.push({
      itemCode: entry.itemCode,
      itemName: entry.itemName,
      targetFile: entry.targetFile,
      fallbackKey: entry.fallbackKey
    });
  }
  byFolder.set(folder, stats);
}

const total = professionItemVisualPrompts.length;
const real = Array.from(byFolder.values()).reduce((sum, stats) => sum + stats.real, 0);
const fallback = total - real;

console.log(JSON.stringify({
  total,
  real,
  fallback,
  coveragePercent: total ? Number(((real / total) * 100).toFixed(2)) : 0,
  byFolder: Object.fromEntries([...byFolder.entries()].sort(([a], [b]) => a.localeCompare(b))),
  coreUiAssets: Object.fromEntries(
    Object.entries(coreUiAssets).map(([key, targetFile]) => [key, existsSync(resolve(repoRoot, targetFile)) ? "real" : "missing"])
  ),
  missing
}, null, 2));

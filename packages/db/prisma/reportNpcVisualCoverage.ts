import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(process.cwd(), "../..");
const seedPath = resolve(repoRoot, "packages/db/prisma/seed.ts");
const npcAssetDir = resolve(repoRoot, "apps/web/public/npc");
const seedSource = readFileSync(seedPath, "utf8");

const npcDataBlock = seedSource.match(/const npcData = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
const npcProfileBlock = seedSource.match(/const npcProfiles = \{([\s\S]*?)\n  \} as const;/)?.[1] ?? "";

const npcs = [...npcDataBlock.matchAll(/^\s*\["([^"]+)",\s*"([^"]+)"/gm)].map((match) => ({
  key: match[1],
  name: match[2]
}));

const profileVisuals = new Map<string, string>();
for (const match of npcProfileBlock.matchAll(/"([^"]+)":\s*\{[\s\S]*?visualKey:\s*"([^"]+)"/g)) {
  profileVisuals.set(match[1], match[2]);
}

const assetFiles = existsSync(npcAssetDir)
  ? readdirSync(npcAssetDir).filter((file) => file.endsWith(".webp")).sort()
  : [];
const mappedAssets = new Set<string>();
const fallback: Array<{ key: string; name: string; reason: string; visualKey?: string; targetFile?: string }> = [];
const real: Array<{ key: string; name: string; visualKey: string; targetFile: string }> = [];
const missingAsset: Array<{ key: string; name: string; visualKey: string; targetFile: string }> = [];

for (const npc of npcs) {
  const visualKey = profileVisuals.get(npc.key);
  if (!visualKey) {
    fallback.push({ ...npc, reason: "missing visualKey" });
    continue;
  }

  const targetFile = `apps/web/public/npc/${visualKey}.webp`;
  mappedAssets.add(`${visualKey}.webp`);
  if (existsSync(resolve(repoRoot, targetFile))) {
    real.push({ ...npc, visualKey, targetFile });
  } else {
    missingAsset.push({ ...npc, visualKey, targetFile });
    fallback.push({ ...npc, visualKey, targetFile, reason: "asset file missing" });
  }
}

const unmappedAssets = assetFiles
  .filter((file) => !mappedAssets.has(file))
  .map((file) => `apps/web/public/npc/${file}`);
const locationPage = readFileSync(resolve(repoRoot, "apps/web/app/game/location/page.tsx"), "utf8");
const npcDetailPage = readFileSync(resolve(repoRoot, "apps/web/app/game/npc/[key]/page.tsx"), "utf8");

console.log(JSON.stringify({
  total: npcs.length,
  real: real.length,
  fallback: fallback.length,
  coveragePercent: npcs.length ? Number(((real.length / npcs.length) * 100).toFixed(2)) : 0,
  realPortraits: real,
  fallbackNpcs: fallback,
  missingAsset,
  unmappedAssets,
  renderChecks: {
    npcCardUsesNpcDataImage: locationPage.includes("npc.avatarUrl ?? npc.portraitUrl"),
    npcDetailUsesNpcDataImage: npcDetailPage.includes("data.npc.avatarUrl ?? data.npc.portraitUrl"),
    dialogueUsesNpcDataAvatar: npcDetailPage.includes("dialogue-avatar") && npcDetailPage.includes("npcImage ? <img")
  }
}, null, 2));

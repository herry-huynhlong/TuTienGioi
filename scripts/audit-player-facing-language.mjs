import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = [
  "apps/web/app/game",
  "apps/web/components",
  "apps/web/lib"
];

const allowFiles = new Set([
  "apps/web/lib/game-display.ts",
  "apps/web/lib/forms.ts",
  "apps/web/lib/admin-actions.ts"
]);

const forbiddenText = [
  /\bNPC\b/,
  /\bOUTSIDER\b/,
  /\bAPPLICANT\b/,
  /\bINNER_DISCIPLE\b/,
  /\bTRUE_DISCIPLE\b/,
  /\bHIGH_TALENT_NOTICED\b/,
  /\bMERCHANT\b/,
  /\bSERVICE\b/,
  /\bUNKNOWN\b/,
  /\/@\{/,
  /relationshipState/,
  /timesMet/,
  /firstMet/,
  /lastMet/,
  /encounter thường/i
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    return /\.(tsx|ts)$/.test(name) ? [path] : [];
  });
}

const findings = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const normalized = relative(process.cwd(), file).replaceAll("\\", "/");
    if (allowFiles.has(normalized)) continue;
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (const pattern of forbiddenText) {
      lines.forEach((line, index) => {
        if (pattern.test(line)) findings.push(`${normalized}:${index + 1}: ${pattern} :: ${line.trim()}`);
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Player-facing language audit failed:");
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Player-facing language audit passed.");

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(process.cwd(), "../..");
const publicRoot = resolve(repoRoot, "apps/web/public");

const characterAppearances = [
  ["male-01", "Thanh Y Kiếm Tu"],
  ["male-02", "Huyền Bào Chiến Tu"],
  ["male-03", "Bạch Y Kiếm Tu"],
  ["male-04", "Xích Y Hỏa Tu"],
  ["male-05", "Thanh Huyền Đạo Nhân"],
  ["female-01", "Thanh Y Linh Tu"],
  ["female-02", "Bạch Y Băng Tu"],
  ["female-03", "Xích Y Hỏa Tu"],
  ["female-04", "Tử Y Pháp Tu"],
  ["female-05", "Mộc Y Dược Sư"]
].map(([key, label]) => ({ key, label, image: `/characters/default/${key}.webp` }));

function webpSize(path: string) {
  const buffer = readFileSync(path);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunk === "VP8 ") {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

const rows = characterAppearances.map((appearance) => {
  const relativePath = appearance.image.replace(/^\//, "");
  const path = resolve(publicRoot, relativePath);
  const found = existsSync(path);
  const size = found ? webpSize(path) : null;
  return {
    key: appearance.key,
    label: appearance.label,
    path: appearance.image,
    found,
    width: size?.width ?? null,
    height: size?.height ?? null,
    portraitRatio: size ? size.height > size.width : false
  };
});

const missing = rows.filter((row) => !row.found);
const invalid = rows.filter((row) => row.found && (!row.width || !row.height || !row.portraitRatio));

console.log(JSON.stringify({
  expected: characterAppearances.length,
  found: rows.filter((row) => row.found).length,
  missing: missing.map((row) => row.key),
  invalid: invalid.map((row) => row.key),
  rows
}, null, 2));

if (missing.length || invalid.length) process.exitCode = 1;

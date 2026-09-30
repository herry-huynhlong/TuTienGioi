import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(process.cwd(), "../..");
const seedPath = resolve(repoRoot, "packages/db/prisma/seed.ts");
const npcDir = resolve(repoRoot, "apps/web/public/npc");
const source = readFileSync(seedPath, "utf8");

const requiredNpcKeys = [
  "ta-thanh-huyen",
  "mac-van-son",
  "co-truong-phong",
  "han-thiet-son",
  "te-mac",
  "duoc-vo-tran",
  "au-duong-thiet",
  "lac-tinh-ha",
  "tan-hoai-ngoc",
  "chu-thanh",
  "phung-ky",
  "lang-tieu",
  "bach-ngung-suong",
  "hua-viem",
  "moc-thanh"
];

const requiredLocationKeys = [
  "thanh-van-son-mon",
  "thanh-van-ngoai-mon",
  "thanh-van-noi-mon",
  "thanh-van-dai-dien",
  "thanh-van-tang-kinh-cac",
  "thanh-van-dan-duong",
  "thanh-van-khi-duong",
  "thanh-van-tran-duong",
  "thanh-van-nhiem-vu-duong",
  "thanh-van-giam-linh-dai",
  "thanh-van-linh-dien",
  "thanh-van-linh-khoang",
  "thanh-van-dien-vo-truong",
  "thanh-van-dong-phu-khu",
  "thanh-van-hau-son"
];

const requiredQuestKeys = [
  "nhap-thanh-van-1",
  "nhap-thanh-van-2",
  "nhap-thanh-van-3",
  "nhap-thanh-van-4",
  "nhap-thanh-van-5"
];

const requiredMissionKeys = [
  "thu-thap-thanh-linh-thao",
  "diet-xich-nhan-lang",
  "nop-hac-thiet",
  "luyen-tu-khi-dan",
  "kiem-tra-tran-ky",
  "dieu-tra-hau-son"
];

const requiredMentorshipSeeds = [
  "seed-ta-thanh-huyen-lang-tieu",
  "seed-co-truong-phong-bach-ngung-suong"
];

const failures: string[] = [];

function assertSourceIncludes(value: string, label: string) {
  if (!source.includes(value)) failures.push(`${label}: missing ${value}`);
}

assertSourceIncludes("rank: 3", "sect rank");
assertSourceIncludes("Tạ Thanh Huyền", "leader");
assertSourceIncludes("Hóa Thần", "leader realm");
assertSourceIncludes("Phong Lôi Song Linh Căn", "leader spiritual root");
assertSourceIncludes("innerRequirements", "inner disciple requirements");
assertSourceIncludes("trueDiscipleRule", "true disciple rules");
assertSourceIncludes("leaderTrueDisciple", "leader true-disciple rules");
assertSourceIncludes("allowance", "allowance config");
assertSourceIncludes("portraitUrl: `/npc/${member.key}.webp`", "portrait mapping");
assertSourceIncludes("SectMentorshipStatus.ACTIVE", "active mentorship seed");

for (const key of requiredNpcKeys) {
  assertSourceIncludes(`key: "${key}"`, "personnel");
  if (!existsSync(resolve(npcDir, `${key}.webp`))) failures.push(`portrait file missing: apps/web/public/npc/${key}.webp`);
}

for (const key of requiredLocationKeys) {
  assertSourceIncludes(`"${key}"`, "location");
}

for (const key of requiredQuestKeys) {
  assertSourceIncludes(`"${key}"`, "entry quest");
}

for (const key of requiredMissionKeys) {
  assertSourceIncludes(`key: "${key}"`, "sect mission");
}

for (const key of requiredMentorshipSeeds) {
  assertSourceIncludes(`id: "${key}"`, "mentorship seed");
}

const summary = {
  sect: "Thanh Vân Môn",
  rank: "Tam Phẩm",
  personnel: requiredNpcKeys.length,
  locations: requiredLocationKeys.length,
  entryQuests: requiredQuestKeys.length,
  missions: requiredMissionKeys.length,
  mentorships: requiredMentorshipSeeds.length,
  portraitFiles: requiredNpcKeys.filter((key) => existsSync(resolve(npcDir, `${key}.webp`))).length,
  failures
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}

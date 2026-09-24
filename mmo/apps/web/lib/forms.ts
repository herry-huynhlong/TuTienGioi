"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Currency, prisma, WalletTxType } from "@ttg/db";
import { createSession, destroySession, getUser, hashPassword, verifyPassword } from "./auth";
import { attemptBreakthrough, claimCultivation, claimExploration, claimTravel, debitWallet, fightMonster, startCultivation, startExploration, startTravel } from "@ttg/game";

const credentials = z.object({
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8)
});

export async function registerAction(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/?error=register");
  const firstStage = await prisma.realmStage.findFirstOrThrow({ orderBy: [{ realm: { order: "asc" } }, { order: "asc" }] });
  const roots = await prisma.spiritualRoot.findMany();
  const root = roots[Math.floor(Math.random() * roots.length)]!;
  const zone = await prisma.zone.findUniqueOrThrow({ where: { key: "thanh-van-thanh" } });
  const location = await prisma.location.findUnique({ where: { key: "thanh-van-dong-thanh" } });
  try {
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        character: {
          create: {
            name: parsed.data.username,
            realmStageId: firstStage.id,
            spiritualRootId: root.id,
            locationId: zone.id,
            currentLocationId: location?.id ?? null,
            talents: {
              create: (await prisma.talent.findMany({ take: 3, orderBy: { key: "asc" } })).slice(0, 2).map((talent) => ({ talentId: talent.id }))
            }
          }
        }
      }
    });
    await createSession(user.id);
  } catch {
    redirect("/?error=exists");
  }
  redirect("/game");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(user.passwordHash, password))) redirect("/?error=login");
  await createSession(user.id);
  redirect("/game");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

async function characterId() {
  const user = await getUser();
  if (!user?.character) throw new Error("UNAUTHORIZED");
  return user.character.id;
}

export async function cultivateAction(formData: FormData) {
  await startCultivation(prisma, await characterId(), Number(formData.get("minutes")));
  redirect("/game");
}

export async function claimCultivationAction(formData: FormData) {
  await claimCultivation(prisma, await characterId(), String(formData.get("id")));
  redirect("/game");
}

export async function breakthroughAction() {
  await attemptBreakthrough(prisma, await characterId());
  redirect("/game");
}

export async function exploreAction(formData: FormData) {
  await startExploration(prisma, await characterId(), Number(formData.get("minutes")));
  redirect("/game/world");
}

export async function claimExploreAction(formData: FormData) {
  await claimExploration(prisma, await characterId(), String(formData.get("id")));
  redirect("/game/world");
}

export async function startTravelAction(formData: FormData) {
  await startTravel(prisma, await characterId(), String(formData.get("routeId")));
  redirect("/game/world");
}

export async function claimTravelAction(formData: FormData) {
  await claimTravel(prisma, await characterId(), String(formData.get("id")));
  redirect("/game/world");
}

export async function fightAction(formData: FormData) {
  await fightMonster(prisma, await characterId(), String(formData.get("monster")));
  redirect("/game/world");
}

export async function createSectAction(formData: FormData) {
  const cid = await characterId();
  const name = String(formData.get("name") ?? "").trim();
  const tag = String(formData.get("tag") ?? "").trim().toUpperCase();
  if (name.length < 3 || tag.length < 2) return;
  await prisma.$transaction(async (tx) => {
    const character = await tx.character.findUniqueOrThrow({ where: { id: cid } });
    if (character.sectId) return;
    if (character.linhThach < 5000n) return;
    const sect = await tx.sect.create({ data: { name, tag, description: "Một tông môn mới đang viết lịch sử.", leaderId: cid } });
    await debitWallet(tx, cid, Currency.LINH_THACH, 5000n, WalletTxType.SECT, "Sect", sect.id, `sect:create:${cid}`);
    await tx.character.update({ where: { id: cid }, data: { sectId: sect.id } });
    await tx.sectMember.create({ data: { sectId: sect.id, characterId: cid, role: "LEADER" } });
    await tx.sectBuilding.create({ data: { sectId: sect.id, key: "main-hall", name: "Tông Môn Đại Điện", bonus: { memberLimit: 30 } } });
    await tx.worldNews.create({ data: { title: `${name} thành lập`, body: `${character.name} dựng cờ ${tag}, khai sinh một thế lực mới.`, category: "sect", permanent: true } });
  });
  redirect("/game/sect");
}

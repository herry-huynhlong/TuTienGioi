"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, SectAlignment, SectFacilityType } from "@ttg/db";
import { createSession, destroySession, getUser, hashPassword, verifyPassword } from "./auth";
import { acceptSectMission, applyToSect, approveSectApplication, assignSectCave, attackExplorationEncounter, attemptBreakthrough, cancelCultivation, cancelExploration, cancelMarketListing, cancelSectApplication, claimCultivation, claimExploration, claimSectMining, claimTravel, completeSectMission, consumeItem, createMarketListing, createSect, depositSectCurrency, depositSectItem, ensureOnboardingProgress, equipItem, exchangeSectTechnique, expandSectFacility, GameError, harvestSectCrop, leaveExplorationEncounter, plantSectCrop, purchaseMarketListing, purchaseSystemMarketItem, rejectSectApplication, SectError, sellItemToNpc, startCultivation, startExploration, startSectCaveCultivation, startSectMining, startTravel, unassignSectCave, unequipItem, upgradeSectRank, withdrawSectCurrency, withdrawSectItem } from "@ttg/game";

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
      },
      include: { character: true }
    });
    if (user.character) await ensureOnboardingProgress(prisma, user.character.id);
  } catch {
    redirect("/?error=exists");
  }
  redirect(`/?registered=1&email=${encodeURIComponent(parsed.data.email)}#join`);
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

function redirectGameError(error: unknown, path: string): never {
  if (error instanceof GameError || error instanceof SectError) redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message)}`);
  throw error;
}

export async function cultivateAction(formData: FormData) {
  try {
    await startCultivation(prisma, await characterId(), Number(formData.get("minutes")));
  } catch (error) {
    redirectGameError(error, "/game");
  }
  redirect("/game");
}

export async function claimCultivationAction(formData: FormData) {
  try {
    await claimCultivation(prisma, await characterId(), String(formData.get("id")));
  } catch (error) {
    redirectGameError(error, "/game");
  }
  redirect("/game");
}

export async function cancelCultivationAction(formData: FormData) {
  try {
    await cancelCultivation(prisma, await characterId(), String(formData.get("id")));
  } catch (error) {
    redirectGameError(error, "/game");
  }
  redirect("/game");
}

export async function breakthroughAction() {
  try {
    await attemptBreakthrough(prisma, await characterId());
  } catch (error) {
    redirectGameError(error, "/game");
  }
  redirect("/game");
}

export async function exploreAction(formData: FormData) {
  try {
    const rawMode = String(formData.get("mode") ?? "explore");
    const mode = rawMode === "hunt" || rawMode === "gather" ? rawMode : "explore";
    await startExploration(prisma, await characterId(), Number(formData.get("durationSeconds")), mode);
  } catch (error) {
    redirectGameError(error, "/game/location");
  }
  redirect("/game/location");
}

export async function claimExploreAction(formData: FormData) {
  try {
    await claimExploration(prisma, await characterId(), String(formData.get("id")));
  } catch (error) {
    redirectGameError(error, "/game/location");
  }
  redirect("/game/location");
}

export async function cancelExploreAction(formData: FormData) {
  try {
    await cancelExploration(prisma, await characterId(), String(formData.get("id")));
  } catch (error) {
    redirectGameError(error, "/game/location");
  }
  redirect("/game/location");
}

export async function attackEncounterAction(formData: FormData) {
  try {
    await attackExplorationEncounter(prisma, await characterId(), String(formData.get("id")));
  } catch (error) {
    redirectGameError(error, "/game/location");
  }
  redirect("/game/location");
}

export async function leaveEncounterAction(formData: FormData) {
  try {
    await leaveExplorationEncounter(prisma, await characterId(), String(formData.get("id")));
  } catch (error) {
    redirectGameError(error, "/game/location");
  }
  redirect("/game/location");
}

export async function startTravelAction(formData: FormData) {
  try {
    await startTravel(prisma, await characterId(), String(formData.get("routeId")));
  } catch (error) {
    redirectGameError(error, "/game/world");
  }
  redirect("/game/world");
}

export async function claimTravelAction(formData: FormData) {
  try {
    await claimTravel(prisma, await characterId(), String(formData.get("id")));
  } catch (error) {
    redirectGameError(error, "/game/world");
  }
  redirect("/game/location");
}

export async function createSectAction(formData: FormData) {
  let sectId = "";
  try {
    const sect = await createSect(prisma, await characterId(), {
      name: String(formData.get("name") ?? ""),
      tag: String(formData.get("tag") ?? ""),
      description: String(formData.get("description") ?? ""),
      emblem: String(formData.get("emblem") ?? "yin-yang"),
      alignment: String(formData.get("alignment")) in SectAlignment ? (String(formData.get("alignment")) as SectAlignment) : SectAlignment.NEUTRAL
    });
    sectId = sect.id;
  } catch (error) {
    redirectGameError(error, "/game/sect?tab=create");
  }
  redirect(`/game/sect/${sectId}?created=1`);
}

export async function applyToSectAction(formData: FormData) {
  try {
    await applyToSect(prisma, await characterId(), String(formData.get("sectId")), String(formData.get("message") ?? ""));
  } catch (error) {
    redirectGameError(error, `/game/sect?sect=${encodeURIComponent(String(formData.get("sectId") ?? ""))}`);
  }
  redirect(`/game/sect?sect=${encodeURIComponent(String(formData.get("sectId") ?? ""))}&applied=1`);
}

export async function cancelSectApplicationAction(formData: FormData) {
  try {
    await cancelSectApplication(prisma, await characterId(), String(formData.get("applicationId")));
  } catch (error) {
    redirectGameError(error, "/game/sect");
  }
  redirect("/game/sect");
}

export async function approveSectApplicationAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await approveSectApplication(prisma, await characterId(), String(formData.get("applicationId")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=admin`);
  }
  redirect(`/game/sect/${sectId}?tab=admin`);
}

export async function rejectSectApplicationAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await rejectSectApplication(prisma, await characterId(), String(formData.get("applicationId")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=admin`);
  }
  redirect(`/game/sect/${sectId}?tab=admin`);
}

function positiveBigIntField(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!/^\d+$/.test(raw)) throw new SectError("INVALID_AMOUNT", "Số lượng không hợp lệ.");
  return BigInt(raw);
}

function positiveIntField(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!/^\d+$/.test(raw)) throw new SectError("INVALID_AMOUNT", "Số lượng không hợp lệ.");
  return Number(raw);
}

export async function depositSectCurrencyAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await depositSectCurrency(prisma, await characterId(), positiveBigIntField(formData, "amount"), String(formData.get("reason") ?? "Cống hiến quỹ tông môn"));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=storage`);
  }
  redirect(`/game/sect/${sectId}?tab=storage&ok=deposit`);
}

export async function withdrawSectCurrencyAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await withdrawSectCurrency(prisma, await characterId(), positiveBigIntField(formData, "amount"), String(formData.get("reason") ?? "Rút quỹ tông môn"));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=storage`);
  }
  redirect(`/game/sect/${sectId}?tab=storage&ok=withdraw`);
}

export async function depositSectItemAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await depositSectItem(prisma, await characterId(), String(formData.get("itemId")), positiveIntField(formData, "quantity"));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=storage`);
  }
  redirect(`/game/sect/${sectId}?tab=storage&ok=item-deposit`);
}

export async function withdrawSectItemAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await withdrawSectItem(prisma, await characterId(), String(formData.get("storageId")), positiveIntField(formData, "quantity"));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=storage`);
  }
  redirect(`/game/sect/${sectId}?tab=storage&ok=item-withdraw`);
}

export async function acceptSectMissionAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await acceptSectMission(prisma, await characterId(), String(formData.get("missionKey")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=missions`);
  }
  redirect(`/game/sect/${sectId}?tab=missions`);
}

export async function completeSectMissionAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await completeSectMission(prisma, await characterId(), String(formData.get("participantId")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=missions`);
  }
  redirect(`/game/sect/${sectId}?tab=missions&ok=mission`);
}

function sectFacilityField(formData: FormData) {
  const value = String(formData.get("facilityType") ?? "");
  if (!(value in SectFacilityType)) throw new SectError("INVALID_FACILITY", "Khu vực Sơn Môn không hợp lệ.");
  return value as SectFacilityType;
}

export async function expandSectFacilityAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await expandSectFacility(prisma, await characterId(), sectFacilityField(formData));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=domain`);
  }
  redirect(`/game/sect/${sectId}?tab=domain&ok=expand`);
}

export async function upgradeSectRankAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await upgradeSectRank(prisma, await characterId());
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=domain`);
  }
  redirect(`/game/sect/${sectId}?tab=domain&ok=rank`);
}

export async function plantSectCropAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await plantSectCrop(prisma, await characterId(), String(formData.get("plotId")), String(formData.get("cropKey")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=farm`);
  }
  redirect(`/game/sect/${sectId}?tab=farm&ok=plant`);
}

export async function harvestSectCropAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await harvestSectCrop(prisma, await characterId(), String(formData.get("plotId")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=farm`);
  }
  redirect(`/game/sect/${sectId}?tab=farm&ok=harvest`);
}

export async function startSectMiningAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await startSectMining(prisma, await characterId(), String(formData.get("mineKey")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=mine`);
  }
  redirect(`/game/sect/${sectId}?tab=mine&ok=mine`);
}

export async function claimSectMiningAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await claimSectMining(prisma, await characterId(), String(formData.get("workId")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=mine`);
  }
  redirect(`/game/sect/${sectId}?tab=mine&ok=mine-claim`);
}

export async function assignSectCaveAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await assignSectCave(prisma, await characterId(), String(formData.get("caveId")), String(formData.get("targetCharacterId")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=caves`);
  }
  redirect(`/game/sect/${sectId}?tab=caves&ok=cave`);
}

export async function unassignSectCaveAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await unassignSectCave(prisma, await characterId(), String(formData.get("caveId")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=caves`);
  }
  redirect(`/game/sect/${sectId}?tab=caves&ok=cave`);
}

export async function startSectCaveCultivationAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await startSectCaveCultivation(prisma, await characterId(), String(formData.get("caveId")), positiveIntField(formData, "minutes"));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=caves`);
  }
  redirect(`/game/sect/${sectId}?tab=caves&ok=cultivation`);
}

export async function exchangeSectTechniqueAction(formData: FormData) {
  const sectId = String(formData.get("sectId") ?? "");
  try {
    await exchangeSectTechnique(prisma, await characterId(), String(formData.get("libraryId")));
  } catch (error) {
    redirectGameError(error, `/game/sect/${sectId}?tab=library`);
  }
  redirect(`/game/sect/${sectId}?tab=library&ok=technique`);
}

export async function buyMarketListingAction(formData: FormData) {
  try {
    await purchaseMarketListing(prisma, await characterId(), String(formData.get("listingId")));
  } catch (error) {
    redirectGameError(error, "/game/market");
  }
  redirect("/game/market");
}

export async function buySystemMarketItemAction(formData: FormData) {
  const rawQuantity = String(formData.get("quantity") ?? "1").trim();
  if (!/^\d+$/.test(rawQuantity)) redirect("/game/market");
  try {
    await purchaseSystemMarketItem(prisma, await characterId(), String(formData.get("stockId")), Number(rawQuantity));
  } catch (error) {
    redirectGameError(error, "/game/market");
  }
  redirect("/game/market?ok=system-buy");
}

export async function sellItemAction(formData: FormData) {
  const rawPrice = String(formData.get("price") ?? "0").trim();
  const rawQuantity = String(formData.get("quantity") ?? "1").trim();
  if (!/^\d+$/.test(rawPrice)) redirect("/game/market?tab=sell");
  if (!/^\d+$/.test(rawQuantity)) redirect("/game/market?tab=sell");
  const price = BigInt(rawPrice);
  const quantity = Number(rawQuantity);
  try {
    await createMarketListing(prisma, await characterId(), String(formData.get("itemId")), price, quantity);
  } catch (error) {
    redirectGameError(error, "/game/market?tab=sell");
  }
  redirect("/game/market?tab=my&ok=listed");
}

export async function sellItemToNpcAction(formData: FormData) {
  const rawQuantity = String(formData.get("quantity") ?? "1").trim();
  if (!/^\d+$/.test(rawQuantity)) redirect("/game/market?tab=sell");
  try {
    await sellItemToNpc(prisma, await characterId(), String(formData.get("itemId")), Number(rawQuantity));
  } catch (error) {
    redirectGameError(error, "/game/market?tab=sell");
  }
  redirect("/game/market?tab=sell&ok=npc-sell");
}

export async function cancelMarketListingAction(formData: FormData) {
  try {
    await cancelMarketListing(prisma, await characterId(), String(formData.get("listingId")));
  } catch (error) {
    redirectGameError(error, "/game/market?tab=my");
  }
  redirect("/game/market?tab=my");
}

export async function equipItemAction(formData: FormData) {
  try {
    await equipItem(prisma, await characterId(), String(formData.get("itemId")));
  } catch (error) {
    redirectGameError(error, "/game/inventory");
  }
  redirect("/game/inventory");
}

export async function unequipItemAction(formData: FormData) {
  try {
    await unequipItem(prisma, await characterId(), String(formData.get("itemId")));
  } catch (error) {
    redirectGameError(error, "/game/inventory");
  }
  redirect("/game/inventory");
}

export async function consumeItemAction(formData: FormData) {
  try {
    await consumeItem(prisma, await characterId(), String(formData.get("itemId")));
  } catch (error) {
    redirectGameError(error, "/game/inventory");
  }
  redirect("/game/inventory");
}

export async function markNotificationReadAction(formData: FormData) {
  const cid = await characterId();
  const id = String(formData.get("id") ?? "");
  await prisma.notification.updateMany({ where: { id, characterId: cid, readAt: null }, data: { readAt: new Date() } });
  redirect("/game/mail");
}

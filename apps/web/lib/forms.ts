"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, SectAlignment, SectFacilityType } from "@ttg/db";
import { createSession, destroySession, getUser, hashPassword, verifyPassword } from "./auth";
import { acceptFriendRequest, acceptQuest, acceptSectMission, applyToSect, approveSectApplication, assignSectCave, attackExplorationEncounter, attemptBreakthrough, blockPlayer, cancelCultivation, cancelExploration, cancelFriendRequest, cancelMarketListing, cancelSectApplication, cancelTraining, claimCultivation, claimExploration, claimSectMining, claimTraining, claimTravel, completeQuest, completeSectMission, consumeItem, createMarketListing, createSect, depositSectCurrency, depositSectItem, ensureOnboardingProgress, equipItem, exchangeSectTechnique, expandSectFacility, GameError, harvestSectCrop, InventoryError, leaveExplorationEncounter, plantSectCrop, progressQuestEvent, purchaseMarketListing, purchaseSystemMarketItem, QuestError, rejectFriendRequest, rejectSectApplication, removeFriend, SectError, sellItemToNpc, sendDirectMessage, sendFriendCurrency, sendFriendItem, sendFriendRequest, SocialError, startCultivation, startExploration, startSectCaveCultivation, startSectMining, startTraining, startTravel, talkToNpc, unblockPlayer, unassignSectCave, unequipItem, updatePlayerSettings, upgradeSectRank, withdrawSectCurrency, withdrawSectItem } from "@ttg/game";

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
  if (error instanceof GameError || error instanceof SectError || error instanceof QuestError || error instanceof InventoryError || error instanceof SocialError) redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message)}`);
  throw error;
}

function boolField(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function cultivateAction(formData: FormData) {
  try {
    await startCultivation(prisma, await characterId(), String(formData.get("duration")) as never);
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

export async function startTrainingAction(formData: FormData) {
  try {
    await startTraining(prisma, await characterId(), String(formData.get("trainingType")) as never, String(formData.get("duration")) as never);
  } catch (error) {
    redirectGameError(error, "/game/training");
  }
  redirect("/game/training");
}

export async function claimTrainingAction(formData: FormData) {
  try {
    await claimTraining(prisma, await characterId(), String(formData.get("id")));
  } catch (error) {
    redirectGameError(error, "/game/training");
  }
  redirect("/game/training");
}

export async function cancelTrainingAction(formData: FormData) {
  try {
    await cancelTraining(prisma, await characterId(), String(formData.get("id")));
  } catch (error) {
    redirectGameError(error, "/game/training");
  }
  redirect("/game/training");
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

export async function visitSectPageAction() {
  try {
    await progressQuestEvent(prisma, { characterId: await characterId(), eventType: "VISIT_SECT_PAGE", amount: 1 });
  } catch (error) {
    redirectGameError(error, "/game/sect");
  }
  redirect("/game/sect");
}

export async function talkToNpcAction(formData: FormData) {
  const npcKey = String(formData.get("npcKey") ?? "");
  try {
    await talkToNpc(prisma, await characterId(), npcKey);
  } catch (error) {
    redirectGameError(error, `/game/npc/${encodeURIComponent(npcKey)}`);
  }
  redirect(`/game/npc/${encodeURIComponent(npcKey)}`);
}

export async function acceptQuestAction(formData: FormData) {
  const npcKey = String(formData.get("npcKey") ?? "");
  try {
    await acceptQuest(prisma, await characterId(), String(formData.get("questKey")));
  } catch (error) {
    redirectGameError(error, `/game/npc/${encodeURIComponent(npcKey)}`);
  }
  redirect(`/game/npc/${encodeURIComponent(npcKey)}?ok=accepted`);
}

export async function completeQuestAction(formData: FormData) {
  const npcKey = String(formData.get("npcKey") ?? "");
  try {
    await completeQuest(prisma, await characterId(), String(formData.get("questId")));
  } catch (error) {
    redirectGameError(error, `/game/npc/${encodeURIComponent(npcKey)}`);
  }
  redirect(`/game/npc/${encodeURIComponent(npcKey)}?ok=completed`);
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
  const rawQuantity = String(formData.get("quantity") ?? "1").trim();
  if (!/^\d+$/.test(rawQuantity)) redirect("/game/market?error=Số lượng không hợp lệ.");
  try {
    await purchaseMarketListing(prisma, await characterId(), String(formData.get("listingId")), Number(rawQuantity), String(formData.get("transactionKey") ?? ""));
  } catch (error) {
    redirectGameError(error, "/game/market");
  }
  redirect("/game/market");
}

export async function buySystemMarketItemAction(formData: FormData) {
  const rawQuantity = String(formData.get("quantity") ?? "1").trim();
  if (!/^\d+$/.test(rawQuantity)) redirect("/game/market?error=Số lượng không hợp lệ.");
  try {
    const result = await purchaseSystemMarketItem(prisma, await characterId(), String(formData.get("stockId")), Number(rawQuantity), String(formData.get("transactionKey") ?? ""));
    redirect(`/game/market?ok=${encodeURIComponent(`Đã mua ${result.quantity} ${result.itemName} với giá ${result.totalPrice.toLocaleString("vi-VN")} Linh Thạch.`)}`);
  } catch (error) {
    redirectGameError(error, "/game/market");
  }
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
    await sellItemToNpc(prisma, await characterId(), String(formData.get("itemId")), Number(rawQuantity), String(formData.get("transactionKey") ?? ""));
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
  const rawQuantity = String(formData.get("quantity") ?? "1").trim();
  if (!/^\d+$/.test(rawQuantity)) redirect("/game/inventory?error=Số lượng không hợp lệ.");
  try {
    await consumeItem(prisma, await characterId(), String(formData.get("itemId")), Number(rawQuantity));
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

export async function sendFriendRequestAction(formData: FormData) {
  try {
    await sendFriendRequest(prisma, await characterId(), String(formData.get("targetId")), String(formData.get("message") ?? ""));
  } catch (error) {
    redirectGameError(error, "/game/friends");
  }
  redirect("/game/friends?ok=request");
}

export async function acceptFriendRequestAction(formData: FormData) {
  try {
    await acceptFriendRequest(prisma, await characterId(), String(formData.get("requestId")));
  } catch (error) {
    redirectGameError(error, "/game/friends");
  }
  redirect("/game/friends?ok=friend");
}

export async function rejectFriendRequestAction(formData: FormData) {
  try {
    await rejectFriendRequest(prisma, await characterId(), String(formData.get("requestId")));
  } catch (error) {
    redirectGameError(error, "/game/friends");
  }
  redirect("/game/friends");
}

export async function cancelFriendRequestAction(formData: FormData) {
  try {
    await cancelFriendRequest(prisma, await characterId(), String(formData.get("requestId")));
  } catch (error) {
    redirectGameError(error, "/game/friends");
  }
  redirect("/game/friends");
}

export async function removeFriendAction(formData: FormData) {
  try {
    await removeFriend(prisma, await characterId(), String(formData.get("friendId")));
  } catch (error) {
    redirectGameError(error, "/game/friends");
  }
  redirect("/game/friends?ok=removed");
}

export async function blockPlayerAction(formData: FormData) {
  const targetId = String(formData.get("targetId") ?? "");
  const back = String(formData.get("back") ?? "/game/friends");
  try {
    await blockPlayer(prisma, await characterId(), targetId);
  } catch (error) {
    redirectGameError(error, back);
  }
  redirect(`${back}${back.includes("?") ? "&" : "?"}ok=blocked`);
}

export async function unblockPlayerAction(formData: FormData) {
  try {
    await unblockPlayer(prisma, await characterId(), String(formData.get("targetId")));
  } catch (error) {
    redirectGameError(error, "/game/settings");
  }
  redirect("/game/settings?ok=unblocked");
}

export async function sendMessageAction(formData: FormData) {
  const receiverId = String(formData.get("receiverId") ?? "");
  try {
    await sendDirectMessage(prisma, await characterId(), receiverId, String(formData.get("body") ?? ""));
  } catch (error) {
    redirectGameError(error, `/game/chat?with=${encodeURIComponent(receiverId)}`);
  }
  redirect(`/game/chat?with=${encodeURIComponent(receiverId)}`);
}

export async function sendFriendCurrencyAction(formData: FormData) {
  const receiverId = String(formData.get("receiverId") ?? "");
  const raw = String(formData.get("amount") ?? "0").trim();
  if (!/^\d+$/.test(raw)) redirect(`/game/chat?with=${encodeURIComponent(receiverId)}&error=Số Linh Thạch không hợp lệ.`);
  try {
    await sendFriendCurrency(prisma, await characterId(), receiverId, BigInt(raw), String(formData.get("transactionKey") ?? ""));
  } catch (error) {
    redirectGameError(error, `/game/chat?with=${encodeURIComponent(receiverId)}`);
  }
  redirect(`/game/chat?with=${encodeURIComponent(receiverId)}&ok=currency`);
}

export async function sendFriendItemAction(formData: FormData) {
  const receiverId = String(formData.get("receiverId") ?? "");
  const raw = String(formData.get("quantity") ?? "1").trim();
  if (!/^\d+$/.test(raw)) redirect(`/game/chat?with=${encodeURIComponent(receiverId)}&error=Số lượng không hợp lệ.`);
  try {
    await sendFriendItem(prisma, await characterId(), receiverId, String(formData.get("itemId")), Number(raw), String(formData.get("transactionKey") ?? ""));
  } catch (error) {
    redirectGameError(error, `/game/chat?with=${encodeURIComponent(receiverId)}`);
  }
  redirect(`/game/chat?with=${encodeURIComponent(receiverId)}&ok=item`);
}

export async function updatePlayerSettingsAction(formData: FormData) {
  try {
    await updatePlayerSettings(prisma, await characterId(), {
      animationEnabled: boolField(formData, "animationEnabled"),
      fontScale: Number(formData.get("fontScale") ?? 100),
      messageNotifications: boolField(formData, "messageNotifications"),
      friendNotifications: boolField(formData, "friendNotifications"),
      transferNotifications: boolField(formData, "transferNotifications"),
      allowStrangerMessages: boolField(formData, "allowStrangerMessages"),
      allowFriendRequests: boolField(formData, "allowFriendRequests"),
      showOnlineStatus: boolField(formData, "showOnlineStatus"),
      confirmRareSell: boolField(formData, "confirmRareSell"),
      confirmItemTransfer: boolField(formData, "confirmItemTransfer"),
      confirmCurrencyTransfer: boolField(formData, "confirmCurrencyTransfer")
    });
  } catch (error) {
    redirectGameError(error, "/game/settings");
  }
  redirect("/game/settings?ok=saved");
}

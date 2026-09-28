"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { Currency, ItemCategory, NpcSpawnMode, NpcType, Prisma, QuestObjectiveType, QuestTriggerType, QuestType, Rarity, WalletTxType, prisma } from "@ttg/db";
import { currentSystemMarketPeriod, getItemEconomy, jsonRecord } from "@ttg/game";
import { getUser } from "@/lib/auth";

const maxUploadBytes = 2 * 1024 * 1024;
const uploadDir = process.env.ADMIN_UPLOAD_DIR ?? path.join(process.cwd(), "apps", "web", "public", "uploads", "items");

export async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") redirect("/game");
  return user;
}

export async function createItemTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  const key = slug(String(formData.get("key") || formData.get("name") || ""));
  if (!key) redirect("/admin/items?error=Key không hợp lệ");
  const data = itemDataFromForm(formData, key);
  const item = await prisma.itemTemplate.create({ data });
  await audit(admin.id, "ITEM_CREATE", "ItemTemplate", item.id, null, item, String(formData.get("reason") ?? "Tạo vật phẩm"));
  redirect(`/admin/items/${item.id}?ok=created`);
}

export async function updateItemTemplateAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const before = await prisma.itemTemplate.findUniqueOrThrow({ where: { id } });
  const data = itemDataFromForm(formData, before.key, before);
  const item = await prisma.itemTemplate.update({ where: { id }, data });
  await audit(admin.id, "ITEM_UPDATE", "ItemTemplate", id, before, item, String(formData.get("reason") ?? "Cập nhật vật phẩm"));
  redirect(`/admin/items/${id}?ok=saved`);
}

export async function uploadItemImageAction(formData: FormData) {
  const admin = await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "");
  const file = formData.get("image");
  const item = await prisma.itemTemplate.findUniqueOrThrow({ where: { id: itemId } });
  if (!(file instanceof File) || file.size <= 0) redirect(`/admin/items/${itemId}?error=Chưa chọn ảnh`);
  if (file.size > maxUploadBytes) redirect(`/admin/items/${itemId}?error=File quá lớn`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = detectImageExt(bytes);
  if (!ext) redirect(`/admin/items/${itemId}?error=Định dạng ảnh không hỗ trợ`);
  await mkdir(uploadDir, { recursive: true });
  const name = `${item.key}-${Date.now()}.${ext}`;
  await writeFile(path.join(uploadDir, name), bytes);
  const before = item;
  const bindRules = { ...jsonRecord(item.bindRules), imageUrl: `/uploads/items/${name}` };
  const after = await prisma.itemTemplate.update({ where: { id: itemId }, data: { bindRules } });
  await audit(admin.id, "ITEM_IMAGE_UPLOAD", "ItemTemplate", itemId, before, after, "Upload ảnh vật phẩm");
  redirect(`/admin/items/${itemId}?ok=image`);
}

export async function adjustSystemMarketStockAction(formData: FormData) {
  const admin = await requireAdmin();
  const stockId = String(formData.get("stockId") ?? "");
  const delta = numberField(formData, "delta");
  const reason = requiredReason(formData);
  const before = await prisma.systemMarketStock.findUniqueOrThrow({ where: { id: stockId }, include: { template: true } });
  const nextStock = Math.max(0, before.stock + delta);
  const after = await prisma.systemMarketStock.update({ where: { id: stockId }, data: { stock: nextStock } });
  await audit(admin.id, "MARKET_STOCK_ADJUST", "SystemMarketStock", stockId, before, after, reason);
  redirect("/admin/market?ok=stock");
}

export async function refreshAdminMarketStockAction() {
  const admin = await requireAdmin();
  const periodKey = currentSystemMarketPeriod();
  const items = await prisma.itemTemplate.findMany({ where: { tradeable: true } });
  let count = 0;
  for (const item of items) {
    const economy = getItemEconomy(item);
    if (!economy.systemMarketEnabled) continue;
    await prisma.systemMarketStock.upsert({
      where: { periodKey_templateId: { periodKey, templateId: item.id } },
      update: { price: economy.systemBasePrice },
      create: { periodKey, templateId: item.id, stock: 0, price: economy.systemBasePrice }
    });
    count += 1;
  }
  await audit(admin.id, "MARKET_STOCK_REFRESH", "SystemMarketStock", periodKey, null, { count }, "Refresh stock admin");
  redirect("/admin/market?ok=refresh");
}

export async function grantItemToCharacterAction(formData: FormData) {
  const admin = await requireAdmin();
  const characterId = String(formData.get("characterId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const quantity = positiveInt(formData, "quantity");
  const reason = requiredReason(formData);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.itemInstance.findFirst({ where: { ownerId: characterId, templateId, quality: 1, enhancement: 0, bound: false, equippedSlot: null, customModifiers: { equals: Prisma.JsonNull } } });
    if (existing) return tx.itemInstance.update({ where: { id: existing.id }, data: { quantity: { increment: quantity } } });
    return tx.itemInstance.create({ data: { ownerId: characterId, templateId, quantity, quality: 1, enhancement: 0, bound: false } });
  });
  await audit(admin.id, "PLAYER_GRANT_ITEM", "Character", characterId, null, { templateId, quantity, itemInstanceId: result.id }, reason);
  redirect(`/admin/users?ok=grant`);
}

export async function adjustCharacterCurrencyAction(formData: FormData) {
  const admin = await requireAdmin();
  const characterId = String(formData.get("characterId") ?? "");
  const currency = String(formData.get("currency") ?? "LINH_THACH") as Currency;
  const delta = BigInt(String(formData.get("amount") ?? "0"));
  const reason = requiredReason(formData);
  if (delta === 0n) redirect("/admin/users?error=Số tiền không hợp lệ");
  await prisma.$transaction(async (tx) => {
    const c = await tx.character.findUniqueOrThrow({ where: { id: characterId } });
    const before = currency === "TIEN_NGOC" ? c.tienNgoc : c.linhThach;
    const after = before + delta;
    if (after < 0n) throw new Error("NEGATIVE_BALANCE");
    await tx.character.update({ where: { id: characterId }, data: currency === "TIEN_NGOC" ? { tienNgoc: after } : { linhThach: after } });
    await tx.walletTransaction.create({ data: { characterId, currency, type: WalletTxType.ADMIN, amount: delta, balanceBefore: before, balanceAfter: after, referenceType: "Admin", referenceId: admin.id, metadata: { reason } } });
  });
  await audit(admin.id, "PLAYER_CURRENCY_ADJUST", "Character", characterId, null, { currency, delta: delta.toString() }, reason);
  redirect("/admin/users?ok=currency");
}

export async function updateSectAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const sectId = String(formData.get("sectId") ?? "");
  const reason = requiredReason(formData);
  const before = await prisma.sect.findUniqueOrThrow({ where: { id: sectId } });
  const after = await prisma.sect.update({
    where: { id: sectId },
    data: {
      name: String(formData.get("name") ?? before.name).trim(),
      description: String(formData.get("description") ?? before.description).trim(),
      rank: positiveInt(formData, "rank"),
      reputation: numberField(formData, "reputation"),
      treasury: BigInt(String(formData.get("treasury") ?? before.treasury.toString()))
    }
  });
  await audit(admin.id, "SECT_UPDATE", "Sect", sectId, before, after, reason);
  redirect("/admin/sects?ok=saved");
}

export async function createNpcAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const key = slug(String(formData.get("key") || formData.get("name") || ""));
  if (!key) redirect("/admin/npcs?error=Key không hợp lệ");
  const data = npcDataFromForm(formData, key);
  const npc = await prisma.npc.create({ data });
  await audit(admin.id, "NPC_CREATE", "Npc", npc.id, null, npc, String(formData.get("reason") ?? "Tạo NPC"));
  redirect("/admin/npcs?ok=created");
}

export async function updateNpcAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const before = await prisma.npc.findUniqueOrThrow({ where: { id } });
  const data = npcDataFromForm(formData, before.key);
  const npc = await prisma.npc.update({ where: { id }, data });
  await audit(admin.id, "NPC_UPDATE", "Npc", id, before, npc, requiredReason(formData));
  redirect("/admin/npcs?ok=saved");
}

export async function createQuestTemplateAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const key = slug(String(formData.get("key") || formData.get("title") || ""));
  if (!key) redirect("/admin/quests?error=Key không hợp lệ");
  const data = questTemplateDataFromForm(formData, key);
  const quest = await prisma.questTemplate.create({ data });
  await audit(admin.id, "QUEST_TEMPLATE_CREATE", "QuestTemplate", quest.id, null, quest, String(formData.get("reason") ?? "Tạo quest"));
  redirect("/admin/quests?ok=created");
}

export async function updateQuestTemplateAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const before = await prisma.questTemplate.findUniqueOrThrow({ where: { id } });
  const data = questTemplateDataFromForm(formData, before.key);
  const quest = await prisma.questTemplate.update({ where: { id }, data });
  await audit(admin.id, "QUEST_TEMPLATE_UPDATE", "QuestTemplate", id, before, quest, requiredReason(formData));
  redirect("/admin/quests?ok=saved");
}

function itemDataFromForm(formData: FormData, key: string, existing?: { bindRules: unknown }) {
  const current = jsonRecord(existing?.bindRules);
  const bindRules = {
    ...current,
    subType: String(formData.get("subType") ?? current.subType ?? ""),
    usage: String(formData.get("usage") ?? current.usage ?? ""),
    icon: String(formData.get("icon") ?? current.icon ?? "box"),
    visualKey: String(formData.get("visualKey") ?? current.visualKey ?? key),
    imageUrl: String(formData.get("imageUrl") ?? current.imageUrl ?? ""),
    systemBasePrice: positiveBigIntString(formData, "systemBasePrice"),
    npcBuyPrice: positiveBigIntString(formData, "npcBuyPrice"),
    sellableToNpc: checkbox(formData, "sellableToNpc"),
    marketEnabled: checkbox(formData, "marketEnabled"),
    systemMarketEnabled: checkbox(formData, "systemMarketEnabled"),
    auctionEligible: checkbox(formData, "auctionEligible"),
    sectExchangeEnabled: checkbox(formData, "sectExchangeEnabled"),
    sectContributionPrice: positiveInt(formData, "sectContributionPrice"),
    donationContributionValue: positiveInt(formData, "donationContributionValue"),
    requiredRealmOrder: nullableInt(formData, "requiredRealmOrder"),
    requiredSectRank: nullableInt(formData, "requiredSectRank")
  };
  return {
    key,
    itemFamily: blankToNull(formData.get("itemFamily")),
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "MATERIAL") as ItemCategory,
    rarity: String(formData.get("rarity") ?? "HA") as Rarity,
    description: String(formData.get("description") ?? "").trim(),
    stackable: checkbox(formData, "stackable"),
    maxStack: positiveInt(formData, "maxStack"),
    tradeable: checkbox(formData, "tradeable"),
    baseModifiers: parseJson(String(formData.get("baseModifiers") ?? "{}")),
    bindRules
  };
}

function npcDataFromForm(formData: FormData, key: string) {
  const locationId = String(formData.get("locationId") ?? "");
  const regionId = blankToNull(formData.get("regionId"));
  const sectId = blankToNull(formData.get("sectId"));
  const dialogueSetId = blankToNull(formData.get("dialogueSetId"));
  const npcTypes = formData.getAll("npcTypes").map(String).filter((value): value is NpcType => value in NpcType);
  return {
    key,
    name: String(formData.get("name") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    portraitUrl: blankToNull(formData.get("portraitUrl")),
    iconKey: String(formData.get("iconKey") ?? "user").trim() || "user",
    regionId,
    locationId,
    npcTypes,
    sectId,
    realm: blankToNull(formData.get("realm")),
    roleTitle: blankToNull(formData.get("roleTitle")),
    dialogueSetId,
    questProvider: checkbox(formData, "questProvider"),
    shopProvider: checkbox(formData, "shopProvider"),
    serviceProvider: checkbox(formData, "serviceProvider"),
    active: checkbox(formData, "active"),
    spawnMode: String(formData.get("spawnMode") ?? "STATIC") as NpcSpawnMode,
    metadata: parseJson(String(formData.get("metadata") ?? "{}"))
  };
}

function questTemplateDataFromForm(formData: FormData, key: string) {
  return {
    key,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    type: String(formData.get("type") ?? "NPC") as QuestType,
    difficulty: positiveInt(formData, "difficulty"),
    objectiveType: String(formData.get("objectiveType") ?? "TALK_TO_NPC") as QuestObjectiveType,
    objective: parseJson(String(formData.get("objective") ?? "{}")),
    targetCount: positiveInt(formData, "targetCount"),
    triggerType: String(formData.get("triggerType") ?? "TALK_TO_NPC") as QuestTriggerType,
    startNpcId: blankToNull(formData.get("startNpcId")),
    turnInNpcId: blankToNull(formData.get("turnInNpcId")),
    prerequisiteKey: blankToNull(formData.get("prerequisiteKey")),
    nextQuestKey: blankToNull(formData.get("nextQuestKey")),
    reward: parseJson(String(formData.get("reward") ?? "{}")),
    flagsOnComplete: String(formData.get("flagsOnComplete") ?? "").split(",").map((flag) => flag.trim()).filter(Boolean),
    active: checkbox(formData, "active"),
    repeatable: checkbox(formData, "repeatable")
  };
}

async function audit(actorId: string, action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown, reason: string) {
  await prisma.adminAuditLog.create({ data: { actorId, action, target: `${entityType}:${entityId}`, metadata: { entityType, entityId, beforeData: serialize(beforeData), afterData: serialize(afterData), reason } } });
}

function serialize(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v));
}

function detectImageExt(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return "";
}

function slug(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function checkbox(formData: FormData, name: string) { return formData.get(name) === "on"; }
function blankToNull(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || null; }
function positiveInt(formData: FormData, name: string) { return Math.max(1, Math.floor(Number(formData.get(name) ?? 1))); }
function nullableInt(formData: FormData, name: string) { const raw = String(formData.get(name) ?? "").trim(); return raw ? Math.max(0, Math.floor(Number(raw))) : null; }
function numberField(formData: FormData, name: string) { return Math.floor(Number(formData.get(name) ?? 0)); }
function positiveBigIntString(formData: FormData, name: string) { const raw = String(formData.get(name) ?? "0"); return /^\d+$/.test(raw) ? raw : "0"; }
function parseJson(value: string) { try { return JSON.parse(value) as Prisma.InputJsonValue; } catch { return {}; } }
function requiredReason(formData: FormData) { const reason = String(formData.get("reason") ?? "").trim(); if (!reason) throw new Error("ADMIN_REASON_REQUIRED"); return reason; }

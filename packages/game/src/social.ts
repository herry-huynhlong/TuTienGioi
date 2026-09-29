import { AssetTransferType, Currency, FriendRequestStatus, Prisma, WalletTxType, type PrismaClient } from "@ttg/db";
import { addItemToInventory, removeItemFromInventory } from "./inventory.js";
import { creditWallet, debitWallet } from "./services.js";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export class SocialError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function pair(a: string, b: string) {
  return a < b ? [a, b] as const : [b, a] as const;
}

function validAmount(value: bigint) {
  return value > 0n && value <= 999_999_999_999n;
}

async function isBlocked(tx: Tx, a: string, b: string) {
  return Boolean(await tx.blockedPlayer.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } }));
}

async function isFriend(tx: Tx, a: string, b: string) {
  const [memberAId, memberBId] = pair(a, b);
  return Boolean(await tx.friendship.findUnique({ where: { memberAId_memberBId: { memberAId, memberBId } } }));
}

async function assertNotSelf(senderId: string, targetId: string) {
  if (senderId === targetId) throw new SocialError("SELF_TARGET", "Không thể thao tác với chính mình.");
}

async function assertNoBlock(tx: Tx, senderId: string, targetId: string) {
  if (await isBlocked(tx, senderId, targetId)) throw new SocialError("BLOCKED", "Hai bên đang chặn nhau.");
}

async function assertFriend(tx: Tx, senderId: string, targetId: string) {
  if (!(await isFriend(tx, senderId, targetId))) throw new SocialError("NOT_FRIEND", "Chỉ bạn bè mới có thể gửi tài sản.");
}

export async function ensurePlayerSettings(db: Db | Tx, characterId: string) {
  return db.playerSettings.upsert({ where: { characterId }, update: {}, create: { characterId } });
}

export async function sendFriendRequest(db: Db, requesterId: string, addresseeId: string, message = "") {
  return db.$transaction(async (tx) => {
    await assertNotSelf(requesterId, addresseeId);
    const addressee = await tx.character.findUnique({ where: { id: addresseeId }, select: { id: true } });
    if (!addressee) throw new SocialError("PLAYER_NOT_FOUND", "Không tìm thấy người chơi.");
    await assertNoBlock(tx, requesterId, addresseeId);
    if (await isFriend(tx, requesterId, addresseeId)) throw new SocialError("ALREADY_FRIEND", "Hai người đã là bằng hữu.");
    const settings = await ensurePlayerSettings(tx, addresseeId);
    if (!settings.allowFriendRequests) throw new SocialError("REQUEST_DISABLED", "Người này hiện không nhận lời mời kết bạn.");
    const existing = await tx.friendRequest.findFirst({ where: { requesterId, addresseeId, status: FriendRequestStatus.PENDING } });
    if (existing) return existing;
    const reverse = await tx.friendRequest.findFirst({ where: { requesterId: addresseeId, addresseeId: requesterId, status: FriendRequestStatus.PENDING } });
    if (reverse) throw new SocialError("REVERSE_PENDING", "Người này đã gửi lời mời cho bạn.");
    return tx.friendRequest.create({ data: { requesterId, addresseeId, message: message.slice(0, 240) } });
  });
}

export async function acceptFriendRequest(db: Db, characterId: string, requestId: string) {
  return db.$transaction(async (tx) => {
    const request = await tx.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.addresseeId !== characterId || request.status !== FriendRequestStatus.PENDING) throw new SocialError("REQUEST_NOT_FOUND", "Lời mời không còn khả dụng.");
    await assertNoBlock(tx, request.requesterId, request.addresseeId);
    const [memberAId, memberBId] = pair(request.requesterId, request.addresseeId);
    await tx.friendship.upsert({ where: { memberAId_memberBId: { memberAId, memberBId } }, update: {}, create: { memberAId, memberBId } });
    await tx.friendRequest.update({ where: { id: request.id }, data: { status: FriendRequestStatus.ACCEPTED, decidedAt: new Date() } });
    return { memberAId, memberBId };
  });
}

export async function rejectFriendRequest(db: Db, characterId: string, requestId: string) {
  return db.friendRequest.updateMany({ where: { id: requestId, addresseeId: characterId, status: FriendRequestStatus.PENDING }, data: { status: FriendRequestStatus.REJECTED, decidedAt: new Date() } });
}

export async function cancelFriendRequest(db: Db, characterId: string, requestId: string) {
  return db.friendRequest.updateMany({ where: { id: requestId, requesterId: characterId, status: FriendRequestStatus.PENDING }, data: { status: FriendRequestStatus.CANCELLED, decidedAt: new Date() } });
}

export async function removeFriend(db: Db, characterId: string, friendId: string) {
  const [memberAId, memberBId] = pair(characterId, friendId);
  return db.friendship.deleteMany({ where: { memberAId, memberBId } });
}

export async function blockPlayer(db: Db, blockerId: string, blockedId: string) {
  return db.$transaction(async (tx) => {
    await assertNotSelf(blockerId, blockedId);
    const [memberAId, memberBId] = pair(blockerId, blockedId);
    await tx.friendship.deleteMany({ where: { memberAId, memberBId } });
    await tx.friendRequest.updateMany({ where: { OR: [{ requesterId: blockerId, addresseeId: blockedId }, { requesterId: blockedId, addresseeId: blockerId }], status: FriendRequestStatus.PENDING }, data: { status: FriendRequestStatus.CANCELLED, decidedAt: new Date() } });
    return tx.blockedPlayer.upsert({ where: { blockerId_blockedId: { blockerId, blockedId } }, update: {}, create: { blockerId, blockedId } });
  });
}

export async function unblockPlayer(db: Db, blockerId: string, blockedId: string) {
  return db.blockedPlayer.deleteMany({ where: { blockerId, blockedId } });
}

export async function getOrCreateConversation(tx: Tx, a: string, b: string) {
  const [memberAId, memberBId] = pair(a, b);
  return tx.conversation.upsert({
    where: { memberAId_memberBId: { memberAId, memberBId } },
    update: {},
    create: { memberAId, memberBId }
  });
}

export async function sendDirectMessage(db: Db, senderId: string, receiverId: string, body: string) {
  const text = body.trim().slice(0, 1000);
  if (!text) throw new SocialError("EMPTY_MESSAGE", "Tin nhắn trống.");
  return db.$transaction(async (tx) => {
    await assertNotSelf(senderId, receiverId);
    const receiver = await tx.character.findUnique({ where: { id: receiverId }, select: { id: true } });
    if (!receiver) throw new SocialError("PLAYER_NOT_FOUND", "Không tìm thấy người chơi.");
    await assertNoBlock(tx, senderId, receiverId);
    const settings = await ensurePlayerSettings(tx, receiverId);
    if (!settings.allowStrangerMessages && !(await isFriend(tx, senderId, receiverId))) throw new SocialError("MESSAGE_DISABLED", "Người này chỉ nhận tin nhắn từ bạn bè.");
    const conversation = await getOrCreateConversation(tx, senderId, receiverId);
    const message = await tx.message.create({ data: { conversationId: conversation.id, senderId, receiverId, body: text } });
    await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessage: text, lastMessageAt: message.createdAt } });
    return message;
  });
}

export async function markConversationRead(db: Db, characterId: string, conversationId: string) {
  return db.message.updateMany({ where: { conversationId, receiverId: characterId, readAt: null }, data: { readAt: new Date() } });
}

export async function sendFriendCurrency(db: Db, senderId: string, receiverId: string, amount: bigint, idempotencyKey?: string) {
  if (!validAmount(amount)) throw new SocialError("INVALID_AMOUNT", "Số Linh Thạch không hợp lệ.");
  return db.$transaction(async (tx) => {
    await assertNotSelf(senderId, receiverId);
    await assertNoBlock(tx, senderId, receiverId);
    await assertFriend(tx, senderId, receiverId);
    const key = idempotencyKey ? `transfer-currency:${receiverId}:${amount}:${idempotencyKey}` : `transfer-currency:${receiverId}:${amount}:${Date.now()}`;
    const existing = await tx.assetTransfer.findUnique({ where: { senderId_idempotencyKey: { senderId, idempotencyKey: key } } });
    if (existing) return existing;
    await debitWallet(tx, senderId, Currency.LINH_THACH, amount, WalletTxType.MARKET, "AssetTransfer", receiverId, key);
    await creditWallet(tx, receiverId, Currency.LINH_THACH, amount, WalletTxType.MARKET, "AssetTransfer", senderId, `${key}:recv`);
    await sendSystemTransferMessage(tx, senderId, receiverId, `Đã gửi ${amount.toString()} Linh Thạch.`);
    const transfer = await tx.assetTransfer.create({ data: { senderId, receiverId, type: AssetTransferType.LINH_THACH, currency: Currency.LINH_THACH, amount, idempotencyKey: key } });
    await createTransferNotification(tx, receiverId, "Nhận Linh Thạch", `Bạn nhận ${amount.toString()} Linh Thạch từ bằng hữu.`);
    return transfer;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function sendFriendItem(db: Db, senderId: string, receiverId: string, itemId: string, quantity: number, idempotencyKey?: string) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new SocialError("INVALID_QUANTITY", "Số lượng không hợp lệ.");
  return db.$transaction(async (tx) => {
    await assertNotSelf(senderId, receiverId);
    await assertNoBlock(tx, senderId, receiverId);
    await assertFriend(tx, senderId, receiverId);
    const key = idempotencyKey ? `transfer-item:${receiverId}:${itemId}:${quantity}:${idempotencyKey}` : `transfer-item:${receiverId}:${itemId}:${quantity}:${Date.now()}`;
    const existing = await tx.assetTransfer.findUnique({ where: { senderId_idempotencyKey: { senderId, idempotencyKey: key } } });
    if (existing) return existing;
    const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: "ACTIVE" } } } });
    if (!item || item.ownerId !== senderId) throw new SocialError("ITEM_NOT_FOUND", "Không tìm thấy vật phẩm.");
    if (!item.template.tradeable || item.bound || item.template.category === "QUEST") throw new SocialError("ITEM_NOT_TRANSFERABLE", "Vật phẩm này không thể gửi.");
    if (item.equippedSlot) throw new SocialError("ITEM_EQUIPPED", "Không thể gửi trang bị đang mặc.");
    if (item.listings.length > 0) throw new SocialError("ITEM_LISTED", "Không thể gửi vật phẩm đang bày bán.");
    if (!item.template.stackable && quantity !== 1) throw new SocialError("INVALID_QUANTITY", "Trang bị chỉ có thể gửi từng món.");
    if (quantity > item.quantity) throw new SocialError("INVALID_QUANTITY", "Không đủ số lượng vật phẩm.");
    if (item.template.stackable) {
      await removeItemFromInventory(tx, senderId, item.id, quantity);
      await addItemToInventory(tx, receiverId, item.templateId, quantity, { quality: item.quality, enhancement: item.enhancement, bound: item.bound, customModifiers: item.customModifiers });
    } else {
      await tx.itemInstance.update({ where: { id: item.id }, data: { ownerId: receiverId } });
    }
    await sendSystemTransferMessage(tx, senderId, receiverId, `Đã gửi ${item.template.name} x${quantity}.`);
    const transfer = await tx.assetTransfer.create({ data: { senderId, receiverId, type: AssetTransferType.ITEM, itemId: item.id, templateId: item.templateId, quantity, metadata: { name: item.template.name }, idempotencyKey: key } });
    await createTransferNotification(tx, receiverId, "Nhận vật phẩm", `Bạn nhận ${item.template.name} x${quantity} từ bằng hữu.`);
    return transfer;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function sendSystemTransferMessage(tx: Tx, senderId: string, receiverId: string, body: string) {
  const conversation = await getOrCreateConversation(tx, senderId, receiverId);
  const message = await tx.message.create({ data: { conversationId: conversation.id, senderId, receiverId, body } });
  await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessage: body, lastMessageAt: message.createdAt } });
}

async function createTransferNotification(tx: Tx, characterId: string, title: string, body: string) {
  const settings = await ensurePlayerSettings(tx, characterId);
  if (!settings.transferNotifications) return null;
  return tx.notification.create({ data: { characterId, title, body } });
}

export async function updatePlayerSettings(db: Db, characterId: string, input: Record<string, boolean | number>) {
  await ensurePlayerSettings(db, characterId);
  return db.playerSettings.update({ where: { characterId }, data: input });
}

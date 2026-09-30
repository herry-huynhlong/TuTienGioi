import { AuctionStatus, ListingStatus, Prisma } from "@ttg/db";

type Tx = Prisma.TransactionClient;

export class InventoryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function addItemToInventory(tx: Tx, characterId: string, templateId: string, quantity: number, options: { quality?: number; enhancement?: number; bound?: boolean; customModifiers?: unknown } = {}) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new InventoryError("INVALID_QUANTITY", "Số lượng vật phẩm không hợp lệ.");
  const template = await tx.itemTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const quality = options.quality ?? 1;
  const enhancement = options.enhancement ?? 0;
  const bound = options.bound ?? false;
  const customModifiers = parseJsonRecord(options.customModifiers);
  if (!template.stackable) {
    let last = null;
    for (let i = 0; i < quantity; i += 1) {
      last = await tx.itemInstance.create({ data: { ownerId: characterId, templateId, quantity: 1, quality, enhancement, bound, customModifiers: inputJson(customModifiers) } });
    }
    return last!;
  }
  let remaining = quantity;
  const candidates = await tx.itemInstance.findMany({
    where: {
      ownerId: characterId,
      templateId,
      quality,
      enhancement,
      bound,
      equippedSlot: null,
      durability: null,
      listings: { none: { status: ListingStatus.ACTIVE } },
      auctions: { none: { status: AuctionStatus.ACTIVE } }
    },
    orderBy: { createdAt: "asc" }
  });
  let last = null;
  for (const stack of candidates) {
    if (remaining <= 0) break;
    if (JSON.stringify(parseJsonRecord(stack.customModifiers)) !== JSON.stringify(customModifiers)) continue;
    const room = Math.max(0, template.maxStack - stack.quantity);
    if (room <= 0) continue;
    const add = Math.min(room, remaining);
    last = await tx.itemInstance.update({ where: { id: stack.id }, data: { quantity: { increment: add } } });
    remaining -= add;
  }
  while (remaining > 0) {
    const add = Math.min(template.maxStack, remaining);
    last = await tx.itemInstance.create({ data: { ownerId: characterId, templateId, quantity: add, quality, enhancement, bound, customModifiers: inputJson(customModifiers) } });
    remaining -= add;
  }
  return last!;
}

export async function removeItemFromInventory(tx: Tx, characterId: string, itemId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new InventoryError("INVALID_QUANTITY", "Số lượng vật phẩm không hợp lệ.");
  const item = await tx.itemInstance.findUnique({ where: { id: itemId }, include: { template: true, listings: { where: { status: ListingStatus.ACTIVE } }, auctions: { where: { status: AuctionStatus.ACTIVE } } } });
  if (!item || item.ownerId !== characterId || item.quantity <= 0) throw new InventoryError("ITEM_NOT_FOUND", "Không tìm thấy vật phẩm.");
  if (item.equippedSlot) throw new InventoryError("ITEM_EQUIPPED", "Vật phẩm đang trang bị.");
  if (item.listings.length > 0) throw new InventoryError("ITEM_LISTED", "Vật phẩm đang rao bán.");
  if ((item.auctions?.length ?? 0) > 0) throw new InventoryError("ITEM_LISTED", "Vật phẩm đang đấu giá.");
  if (quantity > item.quantity) throw new InventoryError("INVALID_QUANTITY", "Không đủ số lượng vật phẩm.");
  if (quantity === item.quantity) {
    await tx.itemInstance.delete({ where: { id: item.id } });
  } else {
    await tx.itemInstance.update({ where: { id: item.id }, data: { quantity: { decrement: quantity } } });
  }
  return item;
}

import { ListingStatus, Prisma, type PrismaClient } from "@ttg/db";
import { characterAppearanceImage, deterministicCharacterAppearanceKey, isValidCharacterAppearanceKey } from "./character-appearances.js";

type Db = PrismaClient;
const appearanceItemKey = "dich-dung-phu";

export class CharacterAppearanceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function setCharacterAppearance(db: Db, characterId: string, appearanceKey: string, actionKey: string) {
  if (!isValidCharacterAppearanceKey(appearanceKey)) throw new CharacterAppearanceError("INVALID_APPEARANCE", "Ngoại hình nhân vật không hợp lệ.");
  const normalizedActionKey = actionKey.trim();
  if (!normalizedActionKey) throw new CharacterAppearanceError("MISSING_ACTION_KEY", "Thiếu mã xác nhận đổi ngoại hình.");
  const image = characterAppearanceImage(appearanceKey);

  try {
    return await db.$transaction(async (tx) => {
      const duplicate = await tx.characterAppearanceChange.findUnique({
        where: { characterId_actionKey: { characterId, actionKey: normalizedActionKey } }
      });
      if (duplicate) {
        return tx.character.findUniqueOrThrow({
          where: { id: characterId },
          select: { id: true, appearanceKey: true, appearanceChosenAt: true, appearanceChangeCount: true, avatar: true }
        });
      }

      const character = await tx.character.findUniqueOrThrow({
        where: { id: characterId },
        select: { id: true, name: true, appearanceKey: true, appearanceChosenAt: true, appearanceChangeCount: true, avatar: true }
      });
      const currentKey = character.appearanceKey ?? deterministicCharacterAppearanceKey(character.id);
      const firstSelection = character.appearanceChosenAt === null;
      if (!firstSelection && currentKey === appearanceKey) {
        throw new CharacterAppearanceError("SAME_APPEARANCE", "Bạn đang dùng ngoại hình này.");
      }

      let consumedItemId: string | null = null;
      if (!firstSelection) {
        const item = await tx.itemInstance.findFirst({
          where: {
            ownerId: characterId,
            quantity: { gt: 0 },
            equippedSlot: null,
            template: { key: appearanceItemKey },
            listings: { none: { status: ListingStatus.ACTIVE } }
          },
          include: { template: true },
          orderBy: { createdAt: "asc" }
        });
        if (!item) throw new CharacterAppearanceError("MISSING_APPEARANCE_ITEM", "Cần Dịch Dung Phù x1 để đổi ngoại hình.");
        const consumed = await tx.itemInstance.updateMany({
          where: { id: item.id, ownerId: characterId, quantity: { gte: 1 }, equippedSlot: null },
          data: { quantity: { decrement: 1 } }
        });
        if (consumed.count !== 1) throw new CharacterAppearanceError("ITEM_ALREADY_USED", "Dịch Dung Phù đã được sử dụng.");
        await tx.itemInstance.deleteMany({ where: { id: item.id, ownerId: characterId, quantity: { lte: 0 } } });
        consumedItemId = item.id;
      }

      await tx.characterAppearanceChange.create({
        data: {
          characterId,
          oldAppearanceKey: character.appearanceKey,
          newAppearanceKey: appearanceKey,
          consumedItemId,
          source: firstSelection ? "FIRST_FREE" : "DICH_DUNG_PHU",
          actionKey: normalizedActionKey
        }
      });

      const updated = await tx.character.update({
        where: { id: characterId },
        data: {
          appearanceKey,
          avatar: image,
          appearanceChosenAt: character.appearanceChosenAt ?? new Date(),
          appearanceChangeCount: { increment: firstSelection ? 0 : 1 }
        },
        select: { id: true, appearanceKey: true, appearanceChosenAt: true, appearanceChangeCount: true, avatar: true }
      });
      await tx.gameLog.create({
        data: {
          characterId,
          type: "CHARACTER_APPEARANCE_CHANGED",
          message: firstSelection ? "Đã xác nhận ngoại hình nhân vật." : "Đã sử dụng Dịch Dung Phù và thay đổi ngoại hình nhân vật.",
          metadata: inputJson({ oldAppearanceKey: character.appearanceKey, newAppearanceKey: appearanceKey, consumedItemId, source: firstSelection ? "FIRST_FREE" : "DICH_DUNG_PHU", actionKey: normalizedActionKey, timestamp: new Date().toISOString() })
        }
      });
      if (!firstSelection) {
        await tx.notification.create({
          data: {
            characterId,
            title: "Đã sử dụng Dịch Dung Phù",
            body: "Ngoại hình nhân vật đã thay đổi."
          }
        });
      }
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof CharacterAppearanceError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.character.findUniqueOrThrow({
        where: { id: characterId },
        select: { id: true, appearanceKey: true, appearanceChosenAt: true, appearanceChangeCount: true, avatar: true }
      });
    }
    throw error;
  }
}

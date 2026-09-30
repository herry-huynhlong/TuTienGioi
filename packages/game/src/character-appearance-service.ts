import { type PrismaClient } from "@ttg/db";
import { characterAppearanceImage, isValidCharacterAppearanceKey } from "./character-appearances.js";

type Db = PrismaClient;

export class CharacterAppearanceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function setCharacterAppearance(db: Db, characterId: string, appearanceKey: string) {
  if (!isValidCharacterAppearanceKey(appearanceKey)) throw new CharacterAppearanceError("INVALID_APPEARANCE", "Ngoại hình nhân vật không hợp lệ.");
  const image = characterAppearanceImage(appearanceKey);
  return db.character.update({
    where: { id: characterId },
    data: {
      appearanceKey,
      avatar: image
    },
    select: { id: true, appearanceKey: true, avatar: true }
  });
}

ALTER TABLE "Character" ADD COLUMN "appearanceChosenAt" TIMESTAMP(3);
ALTER TABLE "Character" ADD COLUMN "appearanceChangeCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CharacterAppearanceChange" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "oldAppearanceKey" TEXT,
    "newAppearanceKey" TEXT NOT NULL,
    "consumedItemId" TEXT,
    "source" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterAppearanceChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterAppearanceChange_characterId_actionKey_key" ON "CharacterAppearanceChange"("characterId", "actionKey");
CREATE INDEX "CharacterAppearanceChange_characterId_createdAt_idx" ON "CharacterAppearanceChange"("characterId", "createdAt");
CREATE INDEX "CharacterAppearanceChange_newAppearanceKey_idx" ON "CharacterAppearanceChange"("newAppearanceKey");

ALTER TABLE "CharacterAppearanceChange" ADD CONSTRAINT "CharacterAppearanceChange_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

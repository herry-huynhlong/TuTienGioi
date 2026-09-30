ALTER TABLE "Character" ADD COLUMN "appearanceKey" TEXT;

CREATE INDEX "Character_appearanceKey_idx" ON "Character"("appearanceKey");

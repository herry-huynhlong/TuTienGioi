CREATE TYPE "CraftOutcome" AS ENUM ('SUCCESS', 'FAILURE');

ALTER TABLE "CraftJob"
  ADD COLUMN "successChanceBps" INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN "outcome" "CraftOutcome",
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE TABLE "CraftRecipeMastery" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "recipeId" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "successes" INTEGER NOT NULL DEFAULT 0,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "masteryExp" INTEGER NOT NULL DEFAULT 0,
  "masteryLevel" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CraftRecipeMastery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CraftRecipeMastery_characterId_recipeId_key" ON "CraftRecipeMastery"("characterId", "recipeId");
CREATE INDEX "CraftRecipeMastery_recipeId_masteryLevel_idx" ON "CraftRecipeMastery"("recipeId", "masteryLevel");

ALTER TABLE "CraftRecipeMastery"
  ADD CONSTRAINT "CraftRecipeMastery_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CraftRecipeMastery"
  ADD CONSTRAINT "CraftRecipeMastery_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

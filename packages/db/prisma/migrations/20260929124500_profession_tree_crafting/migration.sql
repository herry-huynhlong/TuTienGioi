CREATE TYPE "ProfessionRank" AS ENUM ('APPRENTICE', 'ADEPT', 'EXPERT', 'MASTER', 'GRANDMASTER');
CREATE TYPE "RecipeUnlockType" AS ENUM ('PROFESSION_RANK', 'ITEM', 'QUEST', 'NPC', 'SECT');

ALTER TABLE "CharacterProfession"
  ADD COLUMN "rank" "ProfessionRank" NOT NULL DEFAULT 'APPRENTICE',
  ADD COLUMN "unlockedRecipes" JSONB;

ALTER TABLE "Recipe"
  ADD COLUMN "requiredRank" "ProfessionRank" NOT NULL DEFAULT 'APPRENTICE',
  ADD COLUMN "unlockType" "RecipeUnlockType" NOT NULL DEFAULT 'PROFESSION_RANK',
  ADD COLUMN "station" TEXT NOT NULL DEFAULT 'ALCHEMY_FURNACE',
  ADD COLUMN "outputQuantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "professionExp" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CraftJob"
  ADD COLUMN "outputTemplateId" TEXT,
  ADD COLUMN "outputQuantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "ingredients" JSONB,
  ADD COLUMN "fee" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "professionExp" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Recipe_professionId_requiredRank_idx" ON "Recipe"("professionId", "requiredRank");
CREATE INDEX "Recipe_unlockType_idx" ON "Recipe"("unlockType");
CREATE INDEX "CraftJob_endsAt_status_idx" ON "CraftJob"("endsAt", "status");

ALTER TABLE "CharacterProfession" ADD CONSTRAINT "CharacterProfession_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

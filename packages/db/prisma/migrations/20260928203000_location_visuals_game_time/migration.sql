ALTER TABLE "Location"
  ADD COLUMN "biome" TEXT NOT NULL DEFAULT 'wilderness',
  ADD COLUMN "visualKey" TEXT,
  ADD COLUMN "backgroundImage" TEXT,
  ADD COLUMN "imagePosition" TEXT NOT NULL DEFAULT 'center center',
  ADD COLUMN "cultivationModifierBps" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Location_biome_idx" ON "Location"("biome");
CREATE INDEX "Location_visualKey_idx" ON "Location"("visualKey");

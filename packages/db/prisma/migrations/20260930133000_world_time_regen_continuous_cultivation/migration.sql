ALTER TABLE "Character"
ADD COLUMN "resourceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "resourceRegenRemainder" JSONB NOT NULL DEFAULT '{}';

UPDATE "Character"
SET "resourceUpdatedAt" = "energyUpdatedAt"
WHERE "resourceUpdatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "CultivationActivity"
ADD COLUMN "lastProcessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "accumulatedReward" BIGINT NOT NULL DEFAULT 0;

UPDATE "CultivationActivity"
SET "lastProcessedAt" = "startedAt";

CREATE INDEX "CultivationActivity_lastProcessedAt_idx" ON "CultivationActivity"("lastProcessedAt");

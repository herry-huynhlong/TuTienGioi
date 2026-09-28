ALTER TYPE "SectMissionStatus" ADD VALUE IF NOT EXISTS 'READY_TO_TURN_IN';

ALTER TABLE "SectMission" ADD COLUMN "periodKey" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'PATROL',
ADD COLUMN "locationId" TEXT,
ADD COLUMN "objective" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "targetCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "SectMissionParticipant" ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "targetCount" INTEGER NOT NULL DEFAULT 1;

UPDATE "SectMissionParticipant" p
SET "targetCount" = COALESCE(m."targetCount", 1)
FROM "SectMission" m
WHERE p."missionId" = m."id";

CREATE UNIQUE INDEX "SectMission_sectId_periodKey_key_key" ON "SectMission"("sectId", "periodKey", "key");
CREATE INDEX "SectMission_locationId_idx" ON "SectMission"("locationId");

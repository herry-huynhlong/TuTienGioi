ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'DOMAIN';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'FARM';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'MINE';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'CAVE';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'LIBRARY';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'EXPANSION';

ALTER TYPE "SectInventoryLogType" ADD VALUE IF NOT EXISTS 'FARM_REWARD';
ALTER TYPE "SectInventoryLogType" ADD VALUE IF NOT EXISTS 'MINE_REWARD';
ALTER TYPE "SectInventoryLogType" ADD VALUE IF NOT EXISTS 'RANK_COST';
ALTER TYPE "SectInventoryLogType" ADD VALUE IF NOT EXISTS 'EXPANSION_COST';

CREATE TYPE "SectFacilityType" AS ENUM ('FARM', 'CAVE', 'MINE', 'STORAGE', 'OTHER');
CREATE TYPE "SectWorkStatus" AS ENUM ('EMPTY', 'ACTIVE', 'READY', 'CLAIMED', 'CANCELLED');
CREATE TYPE "SectCaveQuality" AS ENUM ('COMMON', 'SPIRIT', 'MYSTIC', 'EARTH', 'HEAVEN');

CREATE TABLE "SectFacilityExpansion" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "facilityType" "SectFacilityType" NOT NULL,
    "currentCapacity" INTEGER NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "expansionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SectFacilityExpansion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SectFarmPlot" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "plotIndex" INTEGER NOT NULL,
    "planterId" TEXT,
    "cropKey" TEXT,
    "status" "SectWorkStatus" NOT NULL DEFAULT 'EMPTY',
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "harvestedAt" TIMESTAMP(3),
    "reward" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SectFarmPlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SectMineWork" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "mineKey" TEXT NOT NULL,
    "status" "SectWorkStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "reward" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SectMineWork_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SectCave" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quality" "SectCaveQuality" NOT NULL,
    "cultivationBonusBps" INTEGER NOT NULL,
    "breakthroughBonusBps" INTEGER NOT NULL DEFAULT 0,
    "requiredRole" "SectRoleName" NOT NULL DEFAULT 'OUTER',
    "requiredRealmOrder" INTEGER NOT NULL DEFAULT 0,
    "assignedCharacterId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SectCave_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SectLibraryTechnique" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "techniqueId" TEXT NOT NULL,
    "accessRole" "SectRoleName" NOT NULL DEFAULT 'OUTER',
    "requiredRealmOrder" INTEGER NOT NULL DEFAULT 0,
    "contributionCost" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'rank_unlock',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SectLibraryTechnique_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SectFacilityExpansion_sectId_facilityType_key" ON "SectFacilityExpansion"("sectId", "facilityType");
CREATE INDEX "SectFacilityExpansion_sectId_facilityType_idx" ON "SectFacilityExpansion"("sectId", "facilityType");
CREATE UNIQUE INDEX "SectFarmPlot_sectId_plotIndex_key" ON "SectFarmPlot"("sectId", "plotIndex");
CREATE INDEX "SectFarmPlot_sectId_status_readyAt_idx" ON "SectFarmPlot"("sectId", "status", "readyAt");
CREATE INDEX "SectFarmPlot_planterId_status_idx" ON "SectFarmPlot"("planterId", "status");
CREATE INDEX "SectMineWork_sectId_status_readyAt_idx" ON "SectMineWork"("sectId", "status", "readyAt");
CREATE INDEX "SectMineWork_workerId_status_idx" ON "SectMineWork"("workerId", "status");
CREATE INDEX "SectCave_sectId_quality_idx" ON "SectCave"("sectId", "quality");
CREATE INDEX "SectCave_assignedCharacterId_idx" ON "SectCave"("assignedCharacterId");
CREATE UNIQUE INDEX "SectLibraryTechnique_sectId_techniqueId_key" ON "SectLibraryTechnique"("sectId", "techniqueId");
CREATE INDEX "SectLibraryTechnique_sectId_accessRole_idx" ON "SectLibraryTechnique"("sectId", "accessRole");

DROP INDEX IF EXISTS "SectMissionParticipant_characterId_missionKey_status_key";
CREATE INDEX "SectMissionParticipant_characterId_missionKey_status_idx" ON "SectMissionParticipant"("characterId", "missionKey", "status");
CREATE UNIQUE INDEX "SectMissionParticipant_characterId_missionKey_active_key" ON "SectMissionParticipant"("characterId", "missionKey") WHERE "status" = 'ACTIVE';

ALTER TABLE "SectFacilityExpansion" ADD CONSTRAINT "SectFacilityExpansion_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectFarmPlot" ADD CONSTRAINT "SectFarmPlot_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectFarmPlot" ADD CONSTRAINT "SectFarmPlot_planterId_fkey" FOREIGN KEY ("planterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SectMineWork" ADD CONSTRAINT "SectMineWork_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectMineWork" ADD CONSTRAINT "SectMineWork_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectCave" ADD CONSTRAINT "SectCave_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectCave" ADD CONSTRAINT "SectCave_assignedCharacterId_fkey" FOREIGN KEY ("assignedCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SectLibraryTechnique" ADD CONSTRAINT "SectLibraryTechnique_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectLibraryTechnique" ADD CONSTRAINT "SectLibraryTechnique_techniqueId_fkey" FOREIGN KEY ("techniqueId") REFERENCES "Technique"("id") ON DELETE CASCADE ON UPDATE CASCADE;

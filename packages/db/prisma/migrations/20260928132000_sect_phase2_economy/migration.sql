-- CreateEnum
CREATE TYPE "SectInventoryLogType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'MISSION_REWARD', 'MISSION_COST', 'BUILDING_COST', 'ADMIN');

-- CreateEnum
CREATE TYPE "SectMissionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'INVENTORY';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'MISSION';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'CONTRIBUTION';

-- CreateTable
CREATE TABLE "SectInventoryItem" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "quality" INTEGER NOT NULL DEFAULT 1,
    "enhancement" INTEGER NOT NULL DEFAULT 0,
    "bound" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectInventoryLog" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "characterId" TEXT,
    "templateId" TEXT NOT NULL,
    "type" "SectInventoryLogType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "beforeQuantity" INTEGER NOT NULL,
    "afterQuantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectInventoryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectContributionTransaction" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectContributionTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectMission" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "durationMinutes" INTEGER NOT NULL DEFAULT 10,
    "maxParticipants" INTEGER NOT NULL DEFAULT 1,
    "reward" JSONB NOT NULL,
    "cost" JSONB,
    "status" "SectMissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SectMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectMissionParticipant" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "missionId" TEXT,
    "missionKey" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "status" "SectMissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "reward" JSONB,
    "idempotencyKey" TEXT,

    CONSTRAINT "SectMissionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SectInventoryItem_sectId_templateId_quality_enhancement_bound_key" ON "SectInventoryItem"("sectId", "templateId", "quality", "enhancement", "bound");

-- CreateIndex
CREATE INDEX "SectInventoryItem_sectId_quantity_idx" ON "SectInventoryItem"("sectId", "quantity");

-- CreateIndex
CREATE INDEX "SectInventoryItem_templateId_idx" ON "SectInventoryItem"("templateId");

-- CreateIndex
CREATE INDEX "SectInventoryLog_sectId_createdAt_idx" ON "SectInventoryLog"("sectId", "createdAt");

-- CreateIndex
CREATE INDEX "SectInventoryLog_characterId_createdAt_idx" ON "SectInventoryLog"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "SectInventoryLog_templateId_idx" ON "SectInventoryLog"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "SectContributionTransaction_characterId_idempotencyKey_key" ON "SectContributionTransaction"("characterId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SectContributionTransaction_sectId_createdAt_idx" ON "SectContributionTransaction"("sectId", "createdAt");

-- CreateIndex
CREATE INDEX "SectContributionTransaction_characterId_createdAt_idx" ON "SectContributionTransaction"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "SectMission_sectId_status_idx" ON "SectMission"("sectId", "status");

-- CreateIndex
CREATE INDEX "SectMission_key_idx" ON "SectMission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SectMissionParticipant_characterId_missionKey_status_key" ON "SectMissionParticipant"("characterId", "missionKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SectMissionParticipant_characterId_idempotencyKey_key" ON "SectMissionParticipant"("characterId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SectMissionParticipant_sectId_status_endsAt_idx" ON "SectMissionParticipant"("sectId", "status", "endsAt");

-- CreateIndex
CREATE INDEX "SectMissionParticipant_missionId_status_idx" ON "SectMissionParticipant"("missionId", "status");

-- AddForeignKey
ALTER TABLE "SectInventoryItem" ADD CONSTRAINT "SectInventoryItem_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectInventoryItem" ADD CONSTRAINT "SectInventoryItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ItemTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectInventoryLog" ADD CONSTRAINT "SectInventoryLog_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectInventoryLog" ADD CONSTRAINT "SectInventoryLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectInventoryLog" ADD CONSTRAINT "SectInventoryLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ItemTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectContributionTransaction" ADD CONSTRAINT "SectContributionTransaction_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectContributionTransaction" ADD CONSTRAINT "SectContributionTransaction_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectMission" ADD CONSTRAINT "SectMission_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectMissionParticipant" ADD CONSTRAINT "SectMissionParticipant_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectMissionParticipant" ADD CONSTRAINT "SectMissionParticipant_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "SectMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectMissionParticipant" ADD CONSTRAINT "SectMissionParticipant_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

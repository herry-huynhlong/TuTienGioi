-- CreateEnum
CREATE TYPE "SectAlignment" AS ENUM ('RIGHTEOUS', 'NEUTRAL', 'DEMONIC');

-- CreateEnum
CREATE TYPE "SectApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SectLogType" AS ENUM ('CREATE', 'APPLICATION', 'MEMBER', 'ADMIN', 'RANK', 'TREASURY');

-- AlterTable
ALTER TABLE "Sect" ADD COLUMN "emblem" TEXT NOT NULL DEFAULT 'yin-yang',
ADD COLUMN "alignment" "SectAlignment" NOT NULL DEFAULT 'NEUTRAL',
ADD COLUMN "rank" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "recruiting" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "autoAccept" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "joinRequirement" TEXT NOT NULL DEFAULT 'Không yêu cầu',
ADD COLUMN "notice" TEXT NOT NULL DEFAULT 'Sơn môn mới lập, mọi sự vụ đang chờ người hữu duyên cùng gây dựng.',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Normalize old sect limits to the new rank baseline unless already lower.
UPDATE "Sect" SET "memberLimit" = LEAST("memberLimit", 5) WHERE "rank" = 5;
ALTER TABLE "Sect" ALTER COLUMN "memberLimit" SET DEFAULT 5;

-- AlterTable
ALTER TABLE "SectMember" ADD COLUMN "contribution" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "weeklyContribution" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SectBuilding" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "SectApplication" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "status" "SectApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectAnnouncement" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectLog" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "SectLogType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectTreasuryTransaction" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "characterId" TEXT,
    "type" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" BIGINT NOT NULL,
    "before" BIGINT NOT NULL,
    "after" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectTreasuryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sect_rank_recruiting_idx" ON "Sect"("rank", "recruiting");

-- CreateIndex
CREATE INDEX "Sect_reputation_idx" ON "Sect"("reputation");

-- CreateIndex
CREATE INDEX "SectMember_sectId_contribution_idx" ON "SectMember"("sectId", "contribution");

-- CreateIndex
CREATE UNIQUE INDEX "SectApplication_sectId_characterId_status_key" ON "SectApplication"("sectId", "characterId", "status");

-- CreateIndex
CREATE INDEX "SectApplication_characterId_status_idx" ON "SectApplication"("characterId", "status");

-- CreateIndex
CREATE INDEX "SectApplication_sectId_status_createdAt_idx" ON "SectApplication"("sectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SectAnnouncement_sectId_pinned_createdAt_idx" ON "SectAnnouncement"("sectId", "pinned", "createdAt");

-- CreateIndex
CREATE INDEX "SectLog_sectId_createdAt_idx" ON "SectLog"("sectId", "createdAt");

-- CreateIndex
CREATE INDEX "SectLog_actorId_createdAt_idx" ON "SectLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "SectTreasuryTransaction_sectId_createdAt_idx" ON "SectTreasuryTransaction"("sectId", "createdAt");

-- CreateIndex
CREATE INDEX "SectTreasuryTransaction_characterId_createdAt_idx" ON "SectTreasuryTransaction"("characterId", "createdAt");

-- AddForeignKey
ALTER TABLE "SectApplication" ADD CONSTRAINT "SectApplication_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectApplication" ADD CONSTRAINT "SectApplication_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectAnnouncement" ADD CONSTRAINT "SectAnnouncement_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectAnnouncement" ADD CONSTRAINT "SectAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectLog" ADD CONSTRAINT "SectLog_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectLog" ADD CONSTRAINT "SectLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectTreasuryTransaction" ADD CONSTRAINT "SectTreasuryTransaction_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectTreasuryTransaction" ADD CONSTRAINT "SectTreasuryTransaction_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

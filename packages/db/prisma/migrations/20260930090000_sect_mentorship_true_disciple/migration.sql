ALTER TYPE "SectRoleName" ADD VALUE IF NOT EXISTS 'TRUE_DISCIPLE';

ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'MENTOR_INVITED';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'MENTOR_INVITE_ACCEPTED';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'MENTOR_INVITE_REJECTED';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'MENTOR_QUEST_COMPLETED';
ALTER TYPE "SectLogType" ADD VALUE IF NOT EXISTS 'TRUE_DISCIPLE_PROMOTED';

CREATE TYPE "SectMentorshipType" AS ENUM ('ELDER_DISCIPLE', 'SECT_MASTER_DISCIPLE');
CREATE TYPE "SectMentorshipStatus" AS ENUM ('INVITED', 'ACTIVE', 'ENDED', 'REJECTED');

CREATE TABLE "SectMentorship" (
  "id" TEXT NOT NULL,
  "sectId" TEXT NOT NULL,
  "masterCharacterId" TEXT NOT NULL,
  "discipleCharacterId" TEXT NOT NULL,
  "type" "SectMentorshipType" NOT NULL,
  "status" "SectMentorshipStatus" NOT NULL DEFAULT 'INVITED',
  "invitationReason" TEXT NOT NULL DEFAULT '',
  "acceptedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SectMentorship_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SectMentorship_sectId_status_idx" ON "SectMentorship"("sectId", "status");
CREATE INDEX "SectMentorship_masterCharacterId_status_idx" ON "SectMentorship"("masterCharacterId", "status");
CREATE INDEX "SectMentorship_discipleCharacterId_status_idx" ON "SectMentorship"("discipleCharacterId", "status");

ALTER TABLE "SectMentorship" ADD CONSTRAINT "SectMentorship_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectMentorship" ADD CONSTRAINT "SectMentorship_masterCharacterId_fkey" FOREIGN KEY ("masterCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SectMentorship" ADD CONSTRAINT "SectMentorship_discipleCharacterId_fkey" FOREIGN KEY ("discipleCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

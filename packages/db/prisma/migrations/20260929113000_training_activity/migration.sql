CREATE TYPE "TrainingType" AS ENUM ('BODY', 'ATTACK', 'DEFENSE', 'SPEED', 'SPIRIT');

CREATE TABLE "TrainingActivity" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "trainingType" "TrainingType" NOT NULL,
  "durationKey" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "ActivityStatus" NOT NULL DEFAULT 'ACTIVE',
  "energyCost" INTEGER NOT NULL,
  "baseGain" INTEGER NOT NULL,
  "modifierBps" INTEGER NOT NULL DEFAULT 10000,
  "finalGain" INTEGER NOT NULL,
  "statBefore" INTEGER NOT NULL,
  "statCap" INTEGER NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingActivity_characterId_status_idx" ON "TrainingActivity"("characterId", "status");
CREATE INDEX "TrainingActivity_endsAt_status_idx" ON "TrainingActivity"("endsAt", "status");
CREATE INDEX "TrainingActivity_trainingType_idx" ON "TrainingActivity"("trainingType");

ALTER TABLE "TrainingActivity"
  ADD CONSTRAINT "TrainingActivity_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

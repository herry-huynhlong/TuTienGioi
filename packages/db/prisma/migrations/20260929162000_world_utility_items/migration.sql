-- Sealed world objects unlocked by utility talismans such as Pha Cam Phu.
CREATE TABLE "WorldSeal" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "requiredBreakSealGrade" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'SEALED',
  "unlockedAt" TIMESTAMP(3),
  "unlockedByCharacterId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorldSeal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorldSeal_key_key" ON "WorldSeal"("key");
CREATE INDEX "WorldSeal_locationId_status_idx" ON "WorldSeal"("locationId", "status");
CREATE INDEX "WorldSeal_targetType_targetId_idx" ON "WorldSeal"("targetType", "targetId");

ALTER TABLE "WorldSeal" ADD CONSTRAINT "WorldSeal_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldSeal" ADD CONSTRAINT "WorldSeal_unlockedByCharacterId_fkey" FOREIGN KEY ("unlockedByCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Npc" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "Npc" ADD COLUMN "visualKey" TEXT;
ALTER TABLE "Npc" ADD COLUMN "homeLocationId" TEXT;

UPDATE "Npc" SET "homeLocationId" = "locationId" WHERE "homeLocationId" IS NULL;

CREATE TABLE "NpcWorldState" (
  "id" TEXT NOT NULL,
  "npcId" TEXT NOT NULL,
  "currentLocationId" TEXT NOT NULL,
  "movementType" TEXT NOT NULL DEFAULT 'fixed',
  "route" JSONB NOT NULL DEFAULT '[]',
  "schedule" JSONB NOT NULL DEFAULT '{}',
  "state" JSONB NOT NULL DEFAULT '{}',
  "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NpcWorldState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NpcWorldState_npcId_key" UNIQUE ("npcId")
);

CREATE TABLE "PlayerNpcState" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "npcId" TEXT NOT NULL,
  "firstMetAt" TIMESTAMP(3),
  "lastMetAt" TIMESTAMP(3),
  "timesMet" INTEGER NOT NULL DEFAULT 0,
  "lastLocationMetId" TEXT,
  "relationshipScore" INTEGER NOT NULL DEFAULT 0,
  "relationshipState" TEXT NOT NULL DEFAULT 'Xa lạ',
  "lastDialogueNode" TEXT,
  "flags" JSONB NOT NULL DEFAULT '{}',
  "questState" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerNpcState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlayerNpcState_characterId_npcId_key" UNIQUE ("characterId", "npcId")
);

INSERT INTO "NpcWorldState" ("id", "npcId", "currentLocationId", "movementType", "route", "schedule", "state", "movedAt", "updatedAt")
SELECT concat('npc_world_', "id"), "id", "locationId", lower("spawnMode"::text), '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Npc"
ON CONFLICT ("npcId") DO NOTHING;

CREATE INDEX "NpcWorldState_currentLocationId_idx" ON "NpcWorldState"("currentLocationId");
CREATE INDEX "NpcWorldState_movementType_idx" ON "NpcWorldState"("movementType");
CREATE INDEX "PlayerNpcState_characterId_idx" ON "PlayerNpcState"("characterId");
CREATE INDEX "PlayerNpcState_npcId_idx" ON "PlayerNpcState"("npcId");
CREATE INDEX "PlayerNpcState_relationshipState_idx" ON "PlayerNpcState"("relationshipState");
CREATE INDEX "Npc_homeLocationId_idx" ON "Npc"("homeLocationId");

ALTER TABLE "Npc" ADD CONSTRAINT "Npc_homeLocationId_fkey" FOREIGN KEY ("homeLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NpcWorldState" ADD CONSTRAINT "NpcWorldState_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NpcWorldState" ADD CONSTRAINT "NpcWorldState_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerNpcState" ADD CONSTRAINT "PlayerNpcState_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerNpcState" ADD CONSTRAINT "PlayerNpcState_npcId_fkey" FOREIGN KEY ("npcId") REFERENCES "Npc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

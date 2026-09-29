-- Active timed effects created by consumables, formations, and later combat/world systems.
CREATE TABLE "CharacterBuff" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "effectType" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "stackRule" TEXT NOT NULL DEFAULT 'REFRESH_DURATION',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterBuff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CharacterBuff_characterId_sourceType_sourceId_effectType_key" ON "CharacterBuff"("characterId", "sourceType", "sourceId", "effectType");
CREATE INDEX "CharacterBuff_characterId_endsAt_idx" ON "CharacterBuff"("characterId", "endsAt");
CREATE INDEX "CharacterBuff_effectType_endsAt_idx" ON "CharacterBuff"("effectType", "endsAt");

ALTER TABLE "CharacterBuff" ADD CONSTRAINT "CharacterBuff_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

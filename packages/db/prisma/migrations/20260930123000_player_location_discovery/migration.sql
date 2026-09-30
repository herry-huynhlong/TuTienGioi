-- Persist which locations a player has discovered so hidden places do not
-- revert to unknown after reload.
CREATE TABLE "PlayerLocationDiscovery" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'adjacent',

    CONSTRAINT "PlayerLocationDiscovery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerLocationDiscovery_characterId_locationId_key" ON "PlayerLocationDiscovery"("characterId", "locationId");
CREATE INDEX "PlayerLocationDiscovery_characterId_discoveredAt_idx" ON "PlayerLocationDiscovery"("characterId", "discoveredAt");
CREATE INDEX "PlayerLocationDiscovery_locationId_idx" ON "PlayerLocationDiscovery"("locationId");

ALTER TABLE "PlayerLocationDiscovery"
ADD CONSTRAINT "PlayerLocationDiscovery_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlayerLocationDiscovery"
ADD CONSTRAINT "PlayerLocationDiscovery_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

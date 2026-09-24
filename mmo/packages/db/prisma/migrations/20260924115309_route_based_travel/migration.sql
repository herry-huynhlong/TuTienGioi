-- CreateTable
CREATE TABLE "Travel" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'ACTIVE',
    "travelCost" BIGINT NOT NULL DEFAULT 0,
    "dangerSnapshot" INTEGER NOT NULL,
    "securitySnapshot" "RouteSecurityLevel" NOT NULL,
    "encounterSnapshot" JSONB NOT NULL,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "Travel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Travel_characterId_status_idx" ON "Travel"("characterId", "status");

-- CreateIndex
CREATE INDEX "Travel_endsAt_status_idx" ON "Travel"("endsAt", "status");

-- CreateIndex
CREATE INDEX "Travel_routeId_idx" ON "Travel"("routeId");

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Travel" ADD CONSTRAINT "Travel_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

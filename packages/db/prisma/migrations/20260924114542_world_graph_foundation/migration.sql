-- CreateEnum
CREATE TYPE "RouteSecurityLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "currentLocationId" TEXT;

-- AlterTable
ALTER TABLE "Zone" ADD COLUMN     "regionId" TEXT;

-- CreateTable
CREATE TABLE "World" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "calendar" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "climate" TEXT,
    "lawLevel" "RouteSecurityLevel" NOT NULL DEFAULT 'MEDIUM',

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "securityLevel" "RouteSecurityLevel" NOT NULL DEFAULT 'MEDIUM',
    "services" TEXT[],
    "minimumRealmOrder" INTEGER NOT NULL DEFAULT 0,
    "encounterTable" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "travelMinutes" INTEGER NOT NULL,
    "travelCost" BIGINT NOT NULL DEFAULT 0,
    "dangerLevel" INTEGER NOT NULL,
    "securityLevel" "RouteSecurityLevel" NOT NULL DEFAULT 'MEDIUM',
    "ambushAllowed" BOOLEAN NOT NULL DEFAULT false,
    "caravanAllowed" BOOLEAN NOT NULL DEFAULT false,
    "minimumRealmOrder" INTEGER NOT NULL DEFAULT 0,
    "encounterTable" JSONB NOT NULL,
    "weatherModifiers" JSONB,
    "eventModifiers" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "World_key_key" ON "World"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Region_key_key" ON "Region"("key");

-- CreateIndex
CREATE INDEX "Region_worldId_order_idx" ON "Region"("worldId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Location_key_key" ON "Location"("key");

-- CreateIndex
CREATE INDEX "Location_zoneId_idx" ON "Location"("zoneId");

-- CreateIndex
CREATE INDEX "Location_securityLevel_idx" ON "Location"("securityLevel");

-- CreateIndex
CREATE UNIQUE INDEX "Route_key_key" ON "Route"("key");

-- CreateIndex
CREATE INDEX "Route_originId_active_idx" ON "Route"("originId", "active");

-- CreateIndex
CREATE INDEX "Route_destinationId_active_idx" ON "Route"("destinationId", "active");

-- CreateIndex
CREATE INDEX "Route_securityLevel_idx" ON "Route"("securityLevel");

-- CreateIndex
CREATE INDEX "Character_currentLocationId_idx" ON "Character"("currentLocationId");

-- CreateIndex
CREATE INDEX "Zone_regionId_idx" ON "Zone"("regionId");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_currentLocationId_fkey" FOREIGN KEY ("currentLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_originId_fkey" FOREIGN KEY ("originId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

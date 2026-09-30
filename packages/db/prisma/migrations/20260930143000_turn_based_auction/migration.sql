CREATE TYPE "AuctionPhase" AS ENUM ('OPEN_REGISTRATION', 'LIVE', 'SETTLED', 'CANCELLED');

CREATE TYPE "AuctionParticipantStatus" AS ENUM ('ACTIVE', 'PASSED', 'WINNER', 'LOST');

ALTER TABLE "Auction"
ADD COLUMN "bidStep" BIGINT NOT NULL DEFAULT 1,
ADD COLUMN "currentPrice" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "currentRound" INTEGER NOT NULL DEFAULT -1,
ADD COLUMN "currentTurnParticipantId" TEXT,
ADD COLUMN "phase" "AuctionPhase" NOT NULL DEFAULT 'OPEN_REGISTRATION',
ADD COLUMN "registrationEndsAt" TIMESTAMP(3),
ADD COLUMN "turnEndsAt" TIMESTAMP(3),
ADD COLUMN "settledAt" TIMESTAMP(3);

UPDATE "Auction"
SET
  "bidStep" = GREATEST(("startingPrice" * 3000 / 10000), 1),
  "currentPrice" = COALESCE(NULLIF("currentBid", 0), 0),
  "registrationEndsAt" = "startsAt",
  "phase" = CASE
    WHEN "status" = 'SETTLED' THEN 'SETTLED'::"AuctionPhase"
    WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"AuctionPhase"
    ELSE 'OPEN_REGISTRATION'::"AuctionPhase"
  END;

ALTER TABLE "Auction"
ALTER COLUMN "registrationEndsAt" SET NOT NULL;

CREATE TABLE "AuctionParticipant" (
  "id" TEXT NOT NULL,
  "auctionId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "status" "AuctionParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActionAt" TIMESTAMP(3),
  "lastBidRound" INTEGER,
  "lastBidPrice" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuctionParticipant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuctionBid"
ADD COLUMN "round" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "AuctionParticipant_auctionId_characterId_key" ON "AuctionParticipant"("auctionId", "characterId");
CREATE INDEX "AuctionParticipant_auctionId_status_joinedAt_idx" ON "AuctionParticipant"("auctionId", "status", "joinedAt");
CREATE INDEX "AuctionParticipant_characterId_status_idx" ON "AuctionParticipant"("characterId", "status");
CREATE INDEX "Auction_phase_registrationEndsAt_idx" ON "Auction"("phase", "registrationEndsAt");
CREATE INDEX "Auction_phase_turnEndsAt_idx" ON "Auction"("phase", "turnEndsAt");
CREATE INDEX "Auction_sellerId_status_idx" ON "Auction"("sellerId", "status");
CREATE INDEX "Auction_itemId_status_idx" ON "Auction"("itemId", "status");
CREATE UNIQUE INDEX "AuctionBid_auctionId_round_key" ON "AuctionBid"("auctionId", "round");

ALTER TABLE "Auction"
ADD CONSTRAINT "Auction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Auction"
ADD CONSTRAINT "Auction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Auction"
ADD CONSTRAINT "Auction_highestBidderId_fkey" FOREIGN KEY ("highestBidderId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Auction"
ADD CONSTRAINT "Auction_currentTurnParticipantId_fkey" FOREIGN KEY ("currentTurnParticipantId") REFERENCES "AuctionParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuctionParticipant"
ADD CONSTRAINT "AuctionParticipant_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuctionParticipant"
ADD CONSTRAINT "AuctionParticipant_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

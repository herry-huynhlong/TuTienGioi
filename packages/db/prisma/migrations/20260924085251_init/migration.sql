-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'LOCKED', 'BANNED');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CLAIMED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('LINH_THACH', 'TIEN_NGOC');

-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('CREDIT', 'DEBIT', 'ESCROW', 'RELEASE', 'TAX', 'ADMIN', 'PAYMENT', 'REWARD', 'MARKET', 'AUCTION', 'CRAFT', 'SECT');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('MATERIAL', 'CONSUMABLE', 'EQUIPMENT', 'TECHNIQUE', 'COSMETIC', 'QUEST');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('PHAM', 'HA', 'TRUNG', 'THUONG', 'CUC', 'HOANG', 'HUYEN', 'DIA', 'THIEN', 'TIEN');

-- CreateEnum
CREATE TYPE "EquipmentSlot" AS ENUM ('WEAPON', 'ARMOR', 'HELMET', 'BOOTS', 'RING', 'TALISMAN', 'ARTIFACT');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('ACTIVE', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SectRoleName" AS ENUM ('LEADER', 'VICE_LEADER', 'ELDER', 'OFFICER', 'INNER', 'OUTER');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('ALLIANCE', 'NEUTRAL', 'ENEMY', 'WAR', 'NAP');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Tán Tu',
    "avatar" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'Ẩn',
    "age" INTEGER NOT NULL DEFAULT 16,
    "lifespan" INTEGER NOT NULL DEFAULT 100,
    "cultivation" BIGINT NOT NULL DEFAULT 0,
    "hp" INTEGER NOT NULL DEFAULT 120,
    "maxHp" INTEGER NOT NULL DEFAULT 120,
    "qi" INTEGER NOT NULL DEFAULT 80,
    "maxQi" INTEGER NOT NULL DEFAULT 80,
    "spirit" INTEGER NOT NULL DEFAULT 40,
    "body" INTEGER NOT NULL DEFAULT 10,
    "attack" INTEGER NOT NULL DEFAULT 15,
    "defense" INTEGER NOT NULL DEFAULT 8,
    "speed" INTEGER NOT NULL DEFAULT 10,
    "luck" INTEGER NOT NULL DEFAULT 5,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "karma" INTEGER NOT NULL DEFAULT 0,
    "energyStored" INTEGER NOT NULL DEFAULT 30,
    "energyMax" INTEGER NOT NULL DEFAULT 30,
    "energyUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "realmStageId" TEXT NOT NULL,
    "spiritualRootId" TEXT NOT NULL,
    "locationId" TEXT,
    "sectId" TEXT,
    "linhThach" BIGINT NOT NULL DEFAULT 1000,
    "tienNgoc" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Realm" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Realm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealmStage" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "requiredCultivation" BIGINT NOT NULL,
    "baseHp" INTEGER NOT NULL,
    "baseQi" INTEGER NOT NULL,
    "baseAttack" INTEGER NOT NULL,
    "baseDefense" INTEGER NOT NULL,
    "baseSpeed" INTEGER NOT NULL,
    "lifespanBonus" INTEGER NOT NULL,
    "breakthroughChanceBps" INTEGER NOT NULL,
    "tribulationRequired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RealmStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpiritualRoot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "elements" TEXT[],
    "quality" TEXT NOT NULL,
    "multiplierBps" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "SpiritualRoot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "polarity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "effects" JSONB NOT NULL,

    CONSTRAINT "Talent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterTalent" (
    "characterId" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,

    CONSTRAINT "CharacterTalent_pkey" PRIMARY KEY ("characterId","talentId")
);

-- CreateTable
CREATE TABLE "Technique" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "element" TEXT,
    "realmOrder" INTEGER NOT NULL,
    "cultivationModifierBps" INTEGER NOT NULL DEFAULT 10000,
    "effects" JSONB NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Technique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterTechnique" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "techniqueId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "equipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CharacterTechnique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "description" TEXT NOT NULL,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "maxStack" INTEGER NOT NULL DEFAULT 1,
    "tradeable" BOOLEAN NOT NULL DEFAULT true,
    "equipSlot" "EquipmentSlot",
    "baseModifiers" JSONB NOT NULL,
    "bindRules" JSONB,

    CONSTRAINT "ItemTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemInstance" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "templateId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "quality" INTEGER NOT NULL DEFAULT 1,
    "durability" INTEGER,
    "enhancement" INTEGER NOT NULL DEFAULT 0,
    "customModifiers" JSONB,
    "bound" BOOLEAN NOT NULL DEFAULT false,
    "equippedSlot" "EquipmentSlot",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minimumRealmOrder" INTEGER NOT NULL DEFAULT 0,
    "dangerLevel" INTEGER NOT NULL,
    "travelCost" BIGINT NOT NULL DEFAULT 0,
    "travelMinutes" INTEGER NOT NULL DEFAULT 5,
    "resourceTable" JSONB NOT NULL,
    "monsterTable" JSONB NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CultivationActivity" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'ACTIVE',
    "baseReward" BIGINT NOT NULL,
    "multiplierBps" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "CultivationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExplorationActivity" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'ACTIVE',
    "eventKey" TEXT,
    "reward" JSONB,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "ExplorationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profession" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Profession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterProfession" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "specialization" TEXT,

    CONSTRAINT "CharacterProfession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,
    "outputTemplateId" TEXT NOT NULL,
    "ingredients" JSONB NOT NULL,
    "craftMinutes" INTEGER NOT NULL,
    "fee" BIGINT NOT NULL DEFAULT 0,
    "requiredLevel" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CraftJob" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'ACTIVE',
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "CraftJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "realmOrder" INTEGER NOT NULL,
    "hp" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "lootTable" JSONB NOT NULL,
    "locationKey" TEXT NOT NULL,

    CONSTRAINT "Monster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Combat" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "monsterKey" TEXT NOT NULL,
    "winner" TEXT NOT NULL,
    "log" JSONB NOT NULL,
    "reward" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Combat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" BIGINT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketTransaction" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "itemTemplateId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" BIGINT NOT NULL,
    "tax" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "startingPrice" BIGINT NOT NULL,
    "currentBid" BIGINT NOT NULL DEFAULT 0,
    "highestBidderId" TEXT,
    "status" "AuctionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balanceBefore" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "treasury" BIGINT NOT NULL DEFAULT 0,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "memberLimit" INTEGER NOT NULL DEFAULT 30,
    "leaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectMember" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "role" "SectRoleName" NOT NULL DEFAULT 'OUTER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectBuilding" (
    "id" TEXT NOT NULL,
    "sectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "bonus" JSONB NOT NULL,

    CONSTRAINT "SectBuilding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectRelation" (
    "id" TEXT NOT NULL,
    "sectAId" TEXT NOT NULL,
    "sectBId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldEvent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "modifiers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldNews" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "permanent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorldNews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopupPackage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "tienNgoc" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TopupPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopupOrder" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "rewardTienNgoc" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "TopupOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "GameLog" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Character_userId_key" ON "Character"("userId");

-- CreateIndex
CREATE INDEX "Character_realmStageId_idx" ON "Character"("realmStageId");

-- CreateIndex
CREATE INDEX "Character_sectId_idx" ON "Character"("sectId");

-- CreateIndex
CREATE INDEX "Character_locationId_idx" ON "Character"("locationId");

-- CreateIndex
CREATE INDEX "Character_cultivation_idx" ON "Character"("cultivation");

-- CreateIndex
CREATE UNIQUE INDEX "Realm_key_key" ON "Realm"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Realm_order_key" ON "Realm"("order");

-- CreateIndex
CREATE INDEX "RealmStage_requiredCultivation_idx" ON "RealmStage"("requiredCultivation");

-- CreateIndex
CREATE UNIQUE INDEX "RealmStage_realmId_order_key" ON "RealmStage"("realmId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SpiritualRoot_name_key" ON "SpiritualRoot"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Talent_key_key" ON "Talent"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Technique_key_key" ON "Technique"("key");

-- CreateIndex
CREATE INDEX "CharacterTechnique_characterId_equipped_idx" ON "CharacterTechnique"("characterId", "equipped");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterTechnique_characterId_techniqueId_key" ON "CharacterTechnique"("characterId", "techniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemTemplate_key_key" ON "ItemTemplate"("key");

-- CreateIndex
CREATE INDEX "ItemInstance_ownerId_idx" ON "ItemInstance"("ownerId");

-- CreateIndex
CREATE INDEX "ItemInstance_templateId_idx" ON "ItemInstance"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_key_key" ON "Zone"("key");

-- CreateIndex
CREATE INDEX "CultivationActivity_characterId_status_idx" ON "CultivationActivity"("characterId", "status");

-- CreateIndex
CREATE INDEX "CultivationActivity_endsAt_status_idx" ON "CultivationActivity"("endsAt", "status");

-- CreateIndex
CREATE INDEX "ExplorationActivity_characterId_status_idx" ON "ExplorationActivity"("characterId", "status");

-- CreateIndex
CREATE INDEX "ExplorationActivity_endsAt_status_idx" ON "ExplorationActivity"("endsAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Profession_key_key" ON "Profession"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterProfession_characterId_professionId_key" ON "CharacterProfession"("characterId", "professionId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_key_key" ON "Recipe"("key");

-- CreateIndex
CREATE INDEX "CraftJob_characterId_status_idx" ON "CraftJob"("characterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Monster_key_key" ON "Monster"("key");

-- CreateIndex
CREATE INDEX "Combat_characterId_createdAt_idx" ON "Combat"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketListing_sellerId_status_idx" ON "MarketListing"("sellerId", "status");

-- CreateIndex
CREATE INDEX "MarketListing_status_expiresAt_idx" ON "MarketListing"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Auction_status_endsAt_idx" ON "Auction"("status", "endsAt");

-- CreateIndex
CREATE INDEX "AuctionBid_auctionId_amount_idx" ON "AuctionBid"("auctionId", "amount");

-- CreateIndex
CREATE INDEX "WalletTransaction_characterId_createdAt_idx" ON "WalletTransaction"("characterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_characterId_currency_idempotencyKey_key" ON "WalletTransaction"("characterId", "currency", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Sect_name_key" ON "Sect"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sect_tag_key" ON "Sect"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "SectMember_characterId_key" ON "SectMember"("characterId");

-- CreateIndex
CREATE INDEX "SectMember_sectId_role_idx" ON "SectMember"("sectId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "SectBuilding_sectId_key_key" ON "SectBuilding"("sectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SectRelation_sectAId_sectBId_key" ON "SectRelation"("sectAId", "sectBId");

-- CreateIndex
CREATE INDEX "WorldEvent_startsAt_endsAt_idx" ON "WorldEvent"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "WorldNews_createdAt_idx" ON "WorldNews"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_channel_createdAt_idx" ON "ChatMessage"("channel", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopupPackage_key_key" ON "TopupPackage"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TopupOrder_orderCode_key" ON "TopupOrder"("orderCode");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerTransactionId_key" ON "PaymentTransaction"("providerTransactionId");

-- CreateIndex
CREATE INDEX "GameLog_characterId_createdAt_idx" ON "GameLog"("characterId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_realmStageId_fkey" FOREIGN KEY ("realmStageId") REFERENCES "RealmStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_spiritualRootId_fkey" FOREIGN KEY ("spiritualRootId") REFERENCES "SpiritualRoot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealmStage" ADD CONSTRAINT "RealmStage_realmId_fkey" FOREIGN KEY ("realmId") REFERENCES "Realm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterTalent" ADD CONSTRAINT "CharacterTalent_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterTalent" ADD CONSTRAINT "CharacterTalent_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "Talent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterTechnique" ADD CONSTRAINT "CharacterTechnique_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterTechnique" ADD CONSTRAINT "CharacterTechnique_techniqueId_fkey" FOREIGN KEY ("techniqueId") REFERENCES "Technique"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemInstance" ADD CONSTRAINT "ItemInstance_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemInstance" ADD CONSTRAINT "ItemInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ItemTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultivationActivity" ADD CONSTRAINT "CultivationActivity_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplorationActivity" ADD CONSTRAINT "ExplorationActivity_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterProfession" ADD CONSTRAINT "CharacterProfession_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_outputTemplateId_fkey" FOREIGN KEY ("outputTemplateId") REFERENCES "ItemTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftJob" ADD CONSTRAINT "CraftJob_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CraftJob" ADD CONSTRAINT "CraftJob_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectMember" ADD CONSTRAINT "SectMember_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectMember" ADD CONSTRAINT "SectMember_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectBuilding" ADD CONSTRAINT "SectBuilding_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectRelation" ADD CONSTRAINT "SectRelation_sectAId_fkey" FOREIGN KEY ("sectAId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectRelation" ADD CONSTRAINT "SectRelation_sectBId_fkey" FOREIGN KEY ("sectBId") REFERENCES "Sect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "TopupOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameLog" ADD CONSTRAINT "GameLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
CREATE TYPE "AssetTransferType" AS ENUM ('LINH_THACH', 'ITEM');

CREATE TABLE "FriendRequest" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "addresseeId" TEXT NOT NULL,
  "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Friendship" (
  "id" TEXT NOT NULL,
  "memberAId" TEXT NOT NULL,
  "memberBId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlockedPlayer" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlockedPlayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "memberAId" TEXT NOT NULL,
  "memberBId" TEXT NOT NULL,
  "lastMessage" TEXT NOT NULL DEFAULT '',
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetTransfer" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "type" "AssetTransferType" NOT NULL,
  "currency" "Currency",
  "amount" BIGINT,
  "itemId" TEXT,
  "templateId" TEXT,
  "quantity" INTEGER,
  "metadata" JSONB,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetTransfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerSettings" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "animationEnabled" BOOLEAN NOT NULL DEFAULT true,
  "fontScale" INTEGER NOT NULL DEFAULT 100,
  "messageNotifications" BOOLEAN NOT NULL DEFAULT true,
  "friendNotifications" BOOLEAN NOT NULL DEFAULT true,
  "transferNotifications" BOOLEAN NOT NULL DEFAULT true,
  "allowStrangerMessages" BOOLEAN NOT NULL DEFAULT true,
  "allowFriendRequests" BOOLEAN NOT NULL DEFAULT true,
  "showOnlineStatus" BOOLEAN NOT NULL DEFAULT true,
  "confirmRareSell" BOOLEAN NOT NULL DEFAULT true,
  "confirmItemTransfer" BOOLEAN NOT NULL DEFAULT true,
  "confirmCurrencyTransfer" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FriendRequest_requesterId_addresseeId_status_key" ON "FriendRequest"("requesterId", "addresseeId", "status");
CREATE INDEX "FriendRequest_addresseeId_status_createdAt_idx" ON "FriendRequest"("addresseeId", "status", "createdAt");
CREATE INDEX "FriendRequest_requesterId_status_createdAt_idx" ON "FriendRequest"("requesterId", "status", "createdAt");
CREATE UNIQUE INDEX "Friendship_memberAId_memberBId_key" ON "Friendship"("memberAId", "memberBId");
CREATE INDEX "Friendship_memberAId_idx" ON "Friendship"("memberAId");
CREATE INDEX "Friendship_memberBId_idx" ON "Friendship"("memberBId");
CREATE UNIQUE INDEX "BlockedPlayer_blockerId_blockedId_key" ON "BlockedPlayer"("blockerId", "blockedId");
CREATE INDEX "BlockedPlayer_blockedId_idx" ON "BlockedPlayer"("blockedId");
CREATE UNIQUE INDEX "Conversation_memberAId_memberBId_key" ON "Conversation"("memberAId", "memberBId");
CREATE INDEX "Conversation_memberAId_lastMessageAt_idx" ON "Conversation"("memberAId", "lastMessageAt");
CREATE INDEX "Conversation_memberBId_lastMessageAt_idx" ON "Conversation"("memberBId", "lastMessageAt");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_receiverId_readAt_idx" ON "Message"("receiverId", "readAt");
CREATE UNIQUE INDEX "AssetTransfer_senderId_idempotencyKey_key" ON "AssetTransfer"("senderId", "idempotencyKey");
CREATE INDEX "AssetTransfer_senderId_createdAt_idx" ON "AssetTransfer"("senderId", "createdAt");
CREATE INDEX "AssetTransfer_receiverId_createdAt_idx" ON "AssetTransfer"("receiverId", "createdAt");
CREATE UNIQUE INDEX "PlayerSettings_characterId_key" ON "PlayerSettings"("characterId");

ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_memberAId_fkey" FOREIGN KEY ("memberAId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_memberBId_fkey" FOREIGN KEY ("memberBId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlockedPlayer" ADD CONSTRAINT "BlockedPlayer_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlockedPlayer" ADD CONSTRAINT "BlockedPlayer_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_memberAId_fkey" FOREIGN KEY ("memberAId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_memberBId_fkey" FOREIGN KEY ("memberBId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerSettings" ADD CONSTRAINT "PlayerSettings_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

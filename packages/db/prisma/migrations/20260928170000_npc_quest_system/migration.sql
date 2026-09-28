CREATE TYPE "NpcType" AS ENUM ('GUIDE', 'SECT', 'QUEST', 'MERCHANT', 'CRAFTSMAN', 'GUARD', 'ELDER', 'WANDERER', 'EVENT', 'LORE');
CREATE TYPE "NpcSpawnMode" AS ENUM ('STATIC', 'RANDOM', 'EVENT');
CREATE TYPE "QuestType" AS ENUM ('MAIN', 'SIDE', 'NPC', 'SECT', 'WORLD', 'EVENT');
CREATE TYPE "QuestStatus" AS ENUM ('AVAILABLE', 'ACTIVE', 'READY_TO_TURN_IN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "QuestObjectiveType" AS ENUM ('TALK_TO_NPC', 'VISIT_LOCATION', 'KILL_MONSTER', 'COLLECT_ITEM', 'DELIVER_ITEM', 'MINE_RESOURCE', 'HARVEST_CROP', 'BUY_ITEM', 'SELL_ITEM', 'JOIN_SECT', 'REACH_REALM', 'VISIT_SECT_PAGE');
CREATE TYPE "QuestTriggerType" AS ENUM ('TALK_TO_NPC', 'ENTER_LOCATION', 'MONSTER_KILLED', 'ITEM_OBTAINED', 'REALM_REACHED', 'SECT_JOINED', 'WORLD_EVENT', 'RANDOM_ENCOUNTER', 'MANUAL');

CREATE TABLE "Npc" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "portraitUrl" TEXT,
  "iconKey" TEXT NOT NULL DEFAULT 'user',
  "regionId" TEXT,
  "locationId" TEXT NOT NULL,
  "npcTypes" "NpcType"[],
  "sectId" TEXT,
  "realm" TEXT,
  "roleTitle" TEXT,
  "dialogueSetId" TEXT,
  "questProvider" BOOLEAN NOT NULL DEFAULT false,
  "shopProvider" BOOLEAN NOT NULL DEFAULT false,
  "serviceProvider" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "spawnMode" "NpcSpawnMode" NOT NULL DEFAULT 'STATIC',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Npc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DialogueSet" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DialogueSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DialogueNode" (
  "id" TEXT NOT NULL,
  "dialogueSetId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "speaker" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "conditions" JSONB,
  "actions" JSONB,
  CONSTRAINT "DialogueNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DialogueChoice" (
  "id" TEXT NOT NULL,
  "dialogueNodeId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "nextNodeKey" TEXT,
  "action" TEXT,
  "metadata" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DialogueChoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "type" "QuestType" NOT NULL DEFAULT 'NPC',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "difficulty" INTEGER NOT NULL DEFAULT 1,
  "objectiveType" "QuestObjectiveType" NOT NULL,
  "objective" JSONB NOT NULL DEFAULT '{}',
  "targetCount" INTEGER NOT NULL DEFAULT 1,
  "triggerType" "QuestTriggerType" NOT NULL DEFAULT 'TALK_TO_NPC',
  "startNpcId" TEXT,
  "turnInNpcId" TEXT,
  "prerequisiteKey" TEXT,
  "nextQuestKey" TEXT,
  "reward" JSONB NOT NULL DEFAULT '{}',
  "flagsOnComplete" TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "repeatable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CharacterQuest" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "status" "QuestStatus" NOT NULL DEFAULT 'ACTIVE',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "targetCount" INTEGER NOT NULL DEFAULT 1,
  "state" JSONB NOT NULL DEFAULT '{}',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readyAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CharacterQuest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CharacterQuestFlag" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CharacterQuestFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Npc_key_key" ON "Npc"("key");
CREATE INDEX "Npc_locationId_active_idx" ON "Npc"("locationId", "active");
CREATE INDEX "Npc_sectId_idx" ON "Npc"("sectId");
CREATE UNIQUE INDEX "DialogueSet_key_key" ON "DialogueSet"("key");
CREATE UNIQUE INDEX "DialogueNode_dialogueSetId_key_key" ON "DialogueNode"("dialogueSetId", "key");
CREATE INDEX "DialogueNode_dialogueSetId_sortOrder_idx" ON "DialogueNode"("dialogueSetId", "sortOrder");
CREATE INDEX "DialogueChoice_dialogueNodeId_sortOrder_idx" ON "DialogueChoice"("dialogueNodeId", "sortOrder");
CREATE UNIQUE INDEX "QuestTemplate_key_key" ON "QuestTemplate"("key");
CREATE INDEX "QuestTemplate_type_active_idx" ON "QuestTemplate"("type", "active");
CREATE INDEX "QuestTemplate_startNpcId_idx" ON "QuestTemplate"("startNpcId");
CREATE INDEX "QuestTemplate_turnInNpcId_idx" ON "QuestTemplate"("turnInNpcId");
CREATE INDEX "QuestTemplate_prerequisiteKey_idx" ON "QuestTemplate"("prerequisiteKey");
CREATE UNIQUE INDEX "CharacterQuest_characterId_templateId_key" ON "CharacterQuest"("characterId", "templateId");
CREATE INDEX "CharacterQuest_characterId_status_idx" ON "CharacterQuest"("characterId", "status");
CREATE INDEX "CharacterQuest_templateId_status_idx" ON "CharacterQuest"("templateId", "status");
CREATE UNIQUE INDEX "CharacterQuestFlag_characterId_key_key" ON "CharacterQuestFlag"("characterId", "key");
CREATE INDEX "CharacterQuestFlag_characterId_idx" ON "CharacterQuestFlag"("characterId");

ALTER TABLE "Npc" ADD CONSTRAINT "Npc_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Npc" ADD CONSTRAINT "Npc_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Npc" ADD CONSTRAINT "Npc_sectId_fkey" FOREIGN KEY ("sectId") REFERENCES "Sect"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Npc" ADD CONSTRAINT "Npc_dialogueSetId_fkey" FOREIGN KEY ("dialogueSetId") REFERENCES "DialogueSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DialogueNode" ADD CONSTRAINT "DialogueNode_dialogueSetId_fkey" FOREIGN KEY ("dialogueSetId") REFERENCES "DialogueSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DialogueChoice" ADD CONSTRAINT "DialogueChoice_dialogueNodeId_fkey" FOREIGN KEY ("dialogueNodeId") REFERENCES "DialogueNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestTemplate" ADD CONSTRAINT "QuestTemplate_startNpcId_fkey" FOREIGN KEY ("startNpcId") REFERENCES "Npc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuestTemplate" ADD CONSTRAINT "QuestTemplate_turnInNpcId_fkey" FOREIGN KEY ("turnInNpcId") REFERENCES "Npc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CharacterQuest" ADD CONSTRAINT "CharacterQuest_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterQuest" ADD CONSTRAINT "CharacterQuest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuestTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterQuestFlag" ADD CONSTRAINT "CharacterQuestFlag_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

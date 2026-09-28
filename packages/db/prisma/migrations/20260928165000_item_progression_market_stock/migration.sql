ALTER TABLE "ItemTemplate"
ADD COLUMN "itemFamily" TEXT;

ALTER TABLE "Character"
ADD COLUMN "breakthroughBonusBps" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ItemTemplate_itemFamily_idx" ON "ItemTemplate"("itemFamily");
CREATE INDEX "ItemTemplate_rarity_category_idx" ON "ItemTemplate"("rarity", "category");

CREATE TABLE "SystemMarketStock" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "price" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemMarketStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemMarketStock_periodKey_templateId_key" ON "SystemMarketStock"("periodKey", "templateId");
CREATE INDEX "SystemMarketStock_periodKey_stock_idx" ON "SystemMarketStock"("periodKey", "stock");
CREATE INDEX "SystemMarketStock_templateId_idx" ON "SystemMarketStock"("templateId");

ALTER TABLE "SystemMarketStock"
ADD CONSTRAINT "SystemMarketStock_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "ItemTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

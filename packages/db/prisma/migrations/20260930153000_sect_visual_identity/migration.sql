ALTER TABLE "Sect" ADD COLUMN "iconKey" TEXT NOT NULL DEFAULT 'golden-dragon';
ALTER TABLE "Sect" ADD COLUMN "iconLockedAt" TIMESTAMP(3);
ALTER TABLE "Sect" ADD COLUMN "backgroundKey" TEXT NOT NULL DEFAULT 'cloud-mountain';

UPDATE "Sect"
SET "iconKey" = 'azure-dragon',
    "backgroundKey" = 'cloud-mountain',
    "emblem" = 'azure-dragon'
WHERE "tag" = 'TVM';

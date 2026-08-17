-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Mention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "via" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Mention" ("createdAt", "id", "sourceId", "sourceType", "targetId", "targetType") SELECT "createdAt", "id", "sourceId", "sourceType", "targetId", "targetType" FROM "Mention";
DROP TABLE "Mention";
ALTER TABLE "new_Mention" RENAME TO "Mention";
CREATE INDEX "Mention_targetType_targetId_idx" ON "Mention"("targetType", "targetId");
CREATE INDEX "Mention_sourceType_sourceId_idx" ON "Mention"("sourceType", "sourceId");
CREATE UNIQUE INDEX "Mention_sourceType_sourceId_targetType_targetId_key" ON "Mention"("sourceType", "sourceId", "targetType", "targetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

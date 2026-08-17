-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'DOING',
    "scope" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkItem" ("bucket", "companyId", "createdAt", "id", "order", "title", "updatedAt") SELECT "bucket", "companyId", "createdAt", "id", "order", "title", "updatedAt" FROM "WorkItem";
DROP TABLE "WorkItem";
ALTER TABLE "new_WorkItem" RENAME TO "WorkItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'BACKUP',
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "workMode" TEXT,
    "city" TEXT,
    "offerAmount" REAL,
    "offerMax" REAL,
    "offerNote" TEXT NOT NULL DEFAULT '',
    "offerCurrency" TEXT DEFAULT 'INR',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Application" ("category", "city", "company", "createdAt", "description", "id", "notes", "offerAmount", "offerCurrency", "role", "status", "updatedAt", "workMode") SELECT "category", "city", "company", "createdAt", "description", "id", "notes", "offerAmount", "offerCurrency", "role", "status", "updatedAt", "workMode" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

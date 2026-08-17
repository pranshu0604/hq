-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'me',
    "sex" TEXT NOT NULL DEFAULT 'MALE',
    "birthYear" INTEGER NOT NULL DEFAULT 2004,
    "heightCm" REAL NOT NULL DEFAULT 177.8,
    "activity" TEXT NOT NULL DEFAULT 'LIGHT',
    "goal" TEXT NOT NULL DEFAULT 'MAINTAIN',
    "startWeightKg" REAL NOT NULL DEFAULT 64,
    "sleepTargetMin" INTEGER NOT NULL DEFAULT 1380,
    "wakeTargetMin" INTEGER NOT NULL DEFAULT 420,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Profile" ("activity", "birthYear", "goal", "heightCm", "id", "sex", "startWeightKg", "updatedAt") SELECT "activity", "birthYear", "goal", "heightCm", "id", "sex", "startWeightKg", "updatedAt" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

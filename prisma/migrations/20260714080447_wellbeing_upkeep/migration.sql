-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HealthDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "brushed" INTEGER NOT NULL DEFAULT 0,
    "bathed" BOOLEAN NOT NULL DEFAULT false,
    "roomCleaned" BOOLEAN NOT NULL DEFAULT false,
    "beardTrimmed" BOOLEAN NOT NULL DEFAULT false,
    "smokes" INTEGER NOT NULL DEFAULT 0,
    "waterMl" INTEGER NOT NULL DEFAULT 0,
    "sleepHours" REAL,
    "posture" INTEGER,
    "mood" INTEGER,
    "nutrients" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_HealthDay" ("bathed", "brushed", "createdAt", "date", "id", "mood", "notes", "nutrients", "posture", "sleepHours", "smokes", "updatedAt", "waterMl") SELECT "bathed", "brushed", "createdAt", "date", "id", "mood", "notes", "nutrients", "posture", "sleepHours", "smokes", "updatedAt", "waterMl" FROM "HealthDay";
DROP TABLE "HealthDay";
ALTER TABLE "new_HealthDay" RENAME TO "HealthDay";
CREATE UNIQUE INDEX "HealthDay_date_key" ON "HealthDay"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

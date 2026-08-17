-- AlterTable
ALTER TABLE "Meal" ADD COLUMN "calories" INTEGER;
ALTER TABLE "Meal" ADD COLUMN "proteinG" REAL;

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'me',
    "sex" TEXT NOT NULL DEFAULT 'MALE',
    "birthYear" INTEGER NOT NULL DEFAULT 2004,
    "heightCm" REAL NOT NULL DEFAULT 177.8,
    "activity" TEXT NOT NULL DEFAULT 'LIGHT',
    "goal" TEXT NOT NULL DEFAULT 'MAINTAIN',
    "startWeightKg" REAL NOT NULL DEFAULT 64,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BodyWeight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "kg" REAL NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HealthDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "brushed" INTEGER NOT NULL DEFAULT 0,
    "bathed" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_HealthDay" ("bathed", "brushed", "createdAt", "date", "id", "mood", "notes", "nutrients", "posture", "sleepHours", "smokes", "updatedAt") SELECT "bathed", "brushed", "createdAt", "date", "id", "mood", "notes", "nutrients", "posture", "sleepHours", "smokes", "updatedAt" FROM "HealthDay";
DROP TABLE "HealthDay";
ALTER TABLE "new_HealthDay" RENAME TO "HealthDay";
CREATE UNIQUE INDEX "HealthDay_date_key" ON "HealthDay"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BodyWeight_date_key" ON "BodyWeight"("date");

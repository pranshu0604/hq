-- CreateTable
CREATE TABLE "HealthDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "brushed" INTEGER NOT NULL DEFAULT 0,
    "bathed" BOOLEAN NOT NULL DEFAULT false,
    "smokes" INTEGER NOT NULL DEFAULT 0,
    "sleepHours" REAL,
    "posture" INTEGER,
    "mood" INTEGER,
    "nutrients" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "junkLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meal_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "HealthDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthDay_date_key" ON "HealthDay"("date");

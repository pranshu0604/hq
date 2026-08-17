-- CreateTable
CREATE TABLE "Capture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'IDEA',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "who" TEXT NOT NULL DEFAULT '',
    "todoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DayPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "energy" TEXT NOT NULL DEFAULT '',
    "maintenance" BOOLEAN NOT NULL DEFAULT false,
    "finished" TEXT NOT NULL DEFAULT '',
    "remaining" TEXT NOT NULL DEFAULT '',
    "firstAction" TEXT NOT NULL DEFAULT '',
    "shutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "targetDate" DATETIME,
    "goal" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "blocker" TEXT NOT NULL DEFAULT '',
    "nextAction" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("createdAt", "description", "id", "link", "notes", "priority", "status", "targetDate", "title", "updatedAt") SELECT "createdAt", "description", "id", "link", "notes", "priority", "status", "targetDate", "title", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Capture_status_idx" ON "Capture"("status");

-- CreateIndex
CREATE INDEX "Capture_kind_idx" ON "Capture"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "DayPlan_date_key" ON "DayPlan"("date");

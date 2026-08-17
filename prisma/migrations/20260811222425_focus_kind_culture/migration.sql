-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FocusSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FOCUS',
    "goal" TEXT NOT NULL DEFAULT '',
    "nextAction" TEXT NOT NULL DEFAULT '',
    "todoId" TEXT,
    "projectId" TEXT,
    "plannedMin" INTEGER NOT NULL DEFAULT 25,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" DATETIME NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "remainingMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_FocusSession" ("createdAt", "endedAt", "endsAt", "goal", "id", "label", "nextAction", "paused", "plannedMin", "projectId", "remainingMs", "startedAt", "status", "todoId") SELECT "createdAt", "endedAt", "endsAt", "goal", "id", "label", "nextAction", "paused", "plannedMin", "projectId", "remainingMs", "startedAt", "status", "todoId" FROM "FocusSession";
DROP TABLE "FocusSession";
ALTER TABLE "new_FocusSession" RENAME TO "FocusSession";
CREATE INDEX "FocusSession_status_idx" ON "FocusSession"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

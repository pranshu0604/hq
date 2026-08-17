-- CreateTable
CREATE TABLE "FocusSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
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

-- CreateIndex
CREATE INDEX "FocusSession_status_idx" ON "FocusSession"("status");

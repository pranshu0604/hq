-- CreateTable
CREATE TABLE "SocialLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'POST',
    "note" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

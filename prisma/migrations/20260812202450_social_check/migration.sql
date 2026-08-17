-- CreateTable
CREATE TABLE "SocialCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "interpretation" TEXT NOT NULL DEFAULT '',
    "evidenceFor" TEXT NOT NULL DEFAULT '',
    "evidenceAgainst" TEXT NOT NULL DEFAULT '',
    "verdict" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

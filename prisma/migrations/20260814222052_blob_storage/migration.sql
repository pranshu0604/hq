-- CreateTable
CREATE TABLE "Blob" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

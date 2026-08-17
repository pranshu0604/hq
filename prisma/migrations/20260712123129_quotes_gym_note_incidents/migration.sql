-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'QUOTE',
    "labels" TEXT NOT NULL DEFAULT '',
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groups" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "durationMin" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReflectionThought" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reflectionId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "noteId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReflectionThought_reflectionId_fkey" FOREIGN KEY ("reflectionId") REFERENCES "Reflection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReflectionThought_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReflectionThought" ("body", "createdAt", "id", "order", "reflectionId", "side") SELECT "body", "createdAt", "id", "order", "reflectionId", "side" FROM "ReflectionThought";
DROP TABLE "ReflectionThought";
ALTER TABLE "new_ReflectionThought" RENAME TO "ReflectionThought";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

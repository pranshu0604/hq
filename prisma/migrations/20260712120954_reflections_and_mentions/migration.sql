-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Reflection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "thesisLabel" TEXT NOT NULL DEFAULT 'Thesis',
    "antithesisLabel" TEXT NOT NULL DEFAULT 'Antithesis',
    "thesisBody" TEXT NOT NULL DEFAULT '',
    "antithesisBody" TEXT NOT NULL DEFAULT '',
    "synthesis" TEXT NOT NULL DEFAULT '',
    "lean" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReflectionThought" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reflectionId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReflectionThought_reflectionId_fkey" FOREIGN KEY ("reflectionId") REFERENCES "Reflection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Mention_targetType_targetId_idx" ON "Mention"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Mention_sourceType_sourceId_idx" ON "Mention"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Mention_sourceType_sourceId_targetType_targetId_key" ON "Mention"("sourceType", "sourceId", "targetType", "targetId");

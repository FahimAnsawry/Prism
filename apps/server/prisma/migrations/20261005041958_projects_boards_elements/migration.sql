-- CreateEnum
CREATE TYPE "ElementType" AS ENUM ('text', 'sticky', 'list', 'rect', 'ellipse', 'diamond', 'line', 'arrow', 'freehand', 'emoji', 'image', 'svg', 'chart', 'frame');

-- CreateEnum
CREATE TYPE "StrokeStyle" AS ENUM ('solid', 'dashed', 'dotted');

-- CreateEnum
CREATE TYPE "Author" AS ENUM ('user', 'claude');

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled project',
    "description" TEXT,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Untitled board',
    "description" TEXT,
    "thumbnailKey" TEXT,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "element" (
    "boardId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ElementType" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "z" DOUBLE PRECISION NOT NULL,
    "stroke" TEXT NOT NULL,
    "fill" TEXT,
    "strokeWidth" DOUBLE PRECISION NOT NULL,
    "strokeStyle" "StrokeStyle" NOT NULL DEFAULT 'solid',
    "sketch" BOOLEAN NOT NULL DEFAULT false,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "groupId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,
    "props" JSONB NOT NULL DEFAULT '{}',
    "updatedBy" "Author" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "element_pkey" PRIMARY KEY ("boardId","id")
);

-- CreateIndex
CREATE INDEX "project_ownerId_editedAt_idx" ON "project"("ownerId", "editedAt" DESC);

-- CreateIndex
CREATE INDEX "board_ownerId_editedAt_idx" ON "board"("ownerId", "editedAt" DESC);

-- CreateIndex
CREATE INDEX "board_projectId_editedAt_idx" ON "board"("projectId", "editedAt" DESC);

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board" ADD CONSTRAINT "board_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board" ADD CONSTRAINT "board_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element" ADD CONSTRAINT "element_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

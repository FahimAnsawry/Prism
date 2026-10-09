-- Sharing: team members (editor | viewer) on boards and projects, pending email invites, and
-- secret tokens for public view-only links.

-- CreateEnum
CREATE TYPE "ShareRole" AS ENUM ('editor', 'viewer');

-- AlterTable
ALTER TABLE "board" ADD COLUMN     "shareToken" TEXT;

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "shareToken" TEXT;

-- CreateTable
CREATE TABLE "board_member" (
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ShareRole" NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_member_pkey" PRIMARY KEY ("boardId","userId")
);

-- CreateTable
CREATE TABLE "project_member" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ShareRole" NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "share_invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "ShareRole" NOT NULL,
    "boardId" TEXT,
    "projectId" TEXT,
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "board_member_userId_idx" ON "board_member"("userId");

-- CreateIndex
CREATE INDEX "project_member_userId_idx" ON "project_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "share_invite_token_key" ON "share_invite"("token");

-- CreateIndex
CREATE INDEX "share_invite_email_idx" ON "share_invite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "share_invite_boardId_email_key" ON "share_invite"("boardId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "share_invite_projectId_email_key" ON "share_invite"("projectId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "board_shareToken_key" ON "board"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "project_shareToken_key" ON "project"("shareToken");

-- AddForeignKey
ALTER TABLE "board_member" ADD CONSTRAINT "board_member_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_member" ADD CONSTRAINT "board_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_invite" ADD CONSTRAINT "share_invite_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_invite" ADD CONSTRAINT "share_invite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_invite" ADD CONSTRAINT "share_invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- An invite is for exactly one board or one project.
ALTER TABLE "share_invite" ADD CONSTRAINT "share_invite_one_target" CHECK (("boardId" IS NULL) <> ("projectId" IS NULL));

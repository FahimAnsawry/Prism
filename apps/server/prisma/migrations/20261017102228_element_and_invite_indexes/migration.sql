-- CreateIndex
CREATE INDEX "element_boardId_z_idx" ON "element"("boardId", "z") WHERE ("deletedAt" IS NULL);

-- CreateIndex
CREATE INDEX "element_boardId_updatedAt_idx" ON "element"("boardId", "updatedAt");

-- CreateIndex
CREATE INDEX "element_deletedAt_idx" ON "element"("deletedAt") WHERE ("deletedAt" IS NOT NULL);

-- CreateIndex
CREATE INDEX "share_invite_invitedById_idx" ON "share_invite"("invitedById");

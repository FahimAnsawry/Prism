import type { ShareRole } from "@prism/shared";
import { prisma } from "./db/client.js";

// Pending share invites (share_invite) turning into memberships.

type Invite = {
  id: string;
  role: ShareRole;
  boardId: string | null;
  projectId: string | null;
  invitedById: string;
};

/** The stronger of two roles, so accepting an invite never takes edit rights away. */
const stronger = (a: ShareRole, b: ShareRole | undefined): ShareRole =>
  a === "editor" || b === "editor" ? "editor" : "viewer";

/** Makes the user a member of what the invite is for, then drops the invite. */
export async function acceptInvite(userId: string, invite: Invite) {
  const by = { invitedById: invite.invitedById };
  if (invite.boardId) {
    const boardId = invite.boardId;
    const [board, existing] = await Promise.all([
      prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } }),
      prisma.boardMember.findUnique({ where: { boardId_userId: { boardId, userId } } }),
    ]);
    // The owner opening their own invite has nothing to join.
    if (board && board.ownerId !== userId) {
      const role = stronger(invite.role, existing?.role);
      await prisma.boardMember.upsert({
        where: { boardId_userId: { boardId, userId } },
        create: { boardId, userId, role, ...by },
        update: { role },
      });
    }
  } else if (invite.projectId) {
    const projectId = invite.projectId;
    const [project, existing] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } }),
      prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } }),
    ]);
    if (project && project.ownerId !== userId) {
      const role = stronger(invite.role, existing?.role);
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId } },
        create: { projectId, userId, role, ...by },
        update: { role },
      });
    }
  }
  await prisma.shareInvite.deleteMany({ where: { id: invite.id } });
}

/**
 * Accepts every invite for the user's email once that email is verified (a Google or GitHub
 * sign-in proves it). An unverified email/password account accepts by opening the invite link,
 * which only the invited person was sent.
 */
export async function claimInvites(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  if (!user?.emailVerified) return;
  const invites = await prisma.shareInvite.findMany({
    where: { email: user.email.toLowerCase() },
    select: { id: true, role: true, boardId: true, projectId: true, invitedById: true },
  });
  for (const invite of invites) await acceptInvite(userId, invite);
}

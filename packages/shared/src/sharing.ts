import { z } from "zod";
import { boardElementsSchema } from "./elements.js";

// Sharing: team members (editor or viewer) on a board or a project, email invites, and public
// view-only links. The owner manages all of it; members only see what's shared with them.

export const SHARE_ROLES = ["editor", "viewer"] as const;
export const shareRoleSchema = z.enum(SHARE_ROLES);

/** What the signed-in user may do with a board or project. */
export const ACCESS_LEVELS = ["owner", ...SHARE_ROLES] as const;
export const accessSchema = z.enum(ACCESS_LEVELS);

export const SHARE_KINDS = ["board", "project"] as const;
export const shareKindSchema = z.enum(SHARE_KINDS);

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter an email address.").max(254)),
  role: shareRoleSchema,
});

export const updateMemberSchema = z.object({ role: shareRoleSchema });

/** Turn the public link on (keeps an existing one) or replace it, so the old one stops working. */
export const shareLinkSchema = z.object({ action: z.enum(["enable", "regenerate"]) });

const person = {
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
};

export const shareMemberSchema = z.object({
  userId: z.string(),
  ...person,
  role: shareRoleSchema,
});

export const shareInviteSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: shareRoleSchema,
  /** The link the owner sends; opening it signed in with this email accepts. */
  url: z.url(),
  createdAt: z.iso.datetime(),
});

/** The owner's Share dialog. */
export const shareSettingsSchema = z.object({
  kind: shareKindSchema,
  id: z.uuid(),
  name: z.string(),
  owner: z.object(person),
  members: z.array(shareMemberSchema),
  invites: z.array(shareInviteSchema),
  /** The public view-only link, or null while it's off. */
  link: z.url().nullable(),
});

/** Reply to an invite: added straight away (the email has an account) or invited by link. */
export const inviteResultSchema = z.object({
  status: z.enum(["added", "invited"]),
  /** For "invited": the link to send. */
  url: z.url().optional(),
  settings: shareSettingsSchema,
});

/** What an invite link shows before it's accepted. */
export const inviteInfoSchema = z.object({
  kind: shareKindSchema,
  name: z.string(),
  role: shareRoleSchema,
  email: z.string(),
  invitedBy: z.string(),
});

export const acceptedInviteSchema = z.object({ kind: shareKindSchema, id: z.uuid() });

// ── Public links (no account) ──────────────────────────────────────────────

export const publicBoardSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  itemCount: z.number().int(),
  editedAt: z.iso.datetime(),
});

/** What a public link opens: one board, or a project and its boards. */
export const publicShareSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("board"), ownerName: z.string(), board: publicBoardSchema }),
  z.object({
    kind: z.literal("project"),
    ownerName: z.string(),
    project: z.object({
      id: z.uuid(),
      name: z.string(),
      description: z.string().nullable(),
      boards: z.array(publicBoardSchema),
    }),
  }),
]);

/** One board behind a public link, with its elements. */
export const publicBoardDataSchema = z.object({
  board: publicBoardSchema,
  projectName: z.string().nullable(),
  elements: boardElementsSchema.shape.elements,
});

export type ShareRole = (typeof SHARE_ROLES)[number];
export type Access = (typeof ACCESS_LEVELS)[number];
export type ShareKind = (typeof SHARE_KINDS)[number];
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type ShareMember = z.infer<typeof shareMemberSchema>;
export type ShareInvite = z.infer<typeof shareInviteSchema>;
export type ShareSettings = z.infer<typeof shareSettingsSchema>;
export type InviteResult = z.infer<typeof inviteResultSchema>;
export type InviteInfo = z.infer<typeof inviteInfoSchema>;
export type PublicBoard = z.infer<typeof publicBoardSchema>;
export type PublicShare = z.infer<typeof publicShareSchema>;
export type PublicBoardData = z.infer<typeof publicBoardDataSchema>;

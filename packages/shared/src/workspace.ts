import { z } from "zod";
import { googleFontNameSchema } from "./elements.js";

// Dashboard API: the request bodies the server validates and the responses the client parses.

export const NAME_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 500;

const name = z
  .string()
  .trim()
  .min(1, "Give it a name.")
  .max(NAME_MAX_LENGTH, `Use ${NAME_MAX_LENGTH} characters or fewer.`);

const description = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX_LENGTH, `Use ${DESCRIPTION_MAX_LENGTH} characters or fewer.`)
  .optional();

export const createProjectSchema = z.object({ name, description });

export const createBoardSchema = z.object({
  name,
  description,
  /** Omitted or empty = a standalone board. */
  projectId: z.union([z.uuid(), z.literal("")]).optional(),
});

/** Edit replaces every field the form shows. An empty description clears it. */
export const updateProjectSchema = createProjectSchema;

export const updateBoardSchema = createBoardSchema.extend({
  /** Required on edit, so leaving it out can never move a board out of its project. "" = standalone. */
  projectId: z.union([z.uuid(), z.literal("")]),
});

/** Custom swatches and added Google fonts a board keeps for everyone who edits it. */
export const CUSTOM_COLORS_MAX = 16;
export const CUSTOM_FONTS_MAX = 20;

export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/, "Use a hex color like #1a2b3c.");

export const boardStyleSchema = z.object({
  /** Newest first. */
  customColors: z.array(hexColorSchema).max(CUSTOM_COLORS_MAX),
  /** Google Fonts family names, newest first. */
  customFonts: z.array(googleFontNameSchema).max(CUSTOM_FONTS_MAX),
});

/** Replaces either list (or both). */
export const updateBoardStyleSchema = boardStyleSchema.partial();

/** Reply to a delete. */
export const deletedSchema = z.object({ id: z.uuid() });

const timestamps = {
  /** ISO 8601. */
  createdAt: z.iso.datetime(),
  /** ISO 8601. Last change to the item (for a project: to the project or any of its boards). */
  editedAt: z.iso.datetime(),
};

export const boardSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  projectId: z.uuid().nullable(),
  /** Live (non-deleted) elements on the board. */
  itemCount: z.number().int(),
  ...boardStyleSchema.shape,
  ...timestamps,
});

export const projectSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  boardCount: z.number().int(),
  /** The most recently edited boards, for the card tiles. */
  boards: z.array(z.object({ id: z.uuid(), name: z.string() })),
  ...timestamps,
});

export const workspaceSchema = z.object({
  projects: z.array(projectSummarySchema),
  /** Every live board: standalone ones (projectId = null) and the ones inside live projects. */
  boards: z.array(boardSummarySchema),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type BoardStyle = z.infer<typeof boardStyleSchema>;
export type UpdateBoardStyleInput = z.infer<typeof updateBoardStyleSchema>;
export type BoardSummary = z.infer<typeof boardSummarySchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type Workspace = z.infer<typeof workspaceSchema>;

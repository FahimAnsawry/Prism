import { z } from "zod";
import type { ElementOp } from "./elements.js";

// AI editors (Claude Code, Codex, … through the MCP endpoint in apps/server/src/mcp): personal
// access tokens, "Ask AI" edit requests and the Socket.IO events.

// ── Personal access tokens ─────────────────────────────────────────────────

/** Every token starts with this, so a leaked one is easy to spot. */
export const API_TOKEN_PREFIX = "prism_";
export const API_TOKENS_MAX = 20;

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(60, "Use 60 characters or fewer."),
});

export const apiTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** The token's first characters, to tell tokens apart. */
  start: z.string(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});

export const apiTokensSchema = z.object({ tokens: z.array(apiTokenSchema) });

/** Reply to a create: the only time the full token is sent. */
export const createdApiTokenSchema = apiTokenSchema.extend({ token: z.string() });

// ── "Ask AI" edit requests ─────────────────────────────────────────────────

/** pending → working (an AI editor picked it up) → done or failed. */
export const EDIT_STATUSES = ["pending", "working", "done", "failed"] as const;
export const EDIT_PROMPT_MAX = 2_000;
export const EDIT_NOTE_MAX = 500;

export const createEditRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Say what to change.")
    .max(EDIT_PROMPT_MAX, `Use ${EDIT_PROMPT_MAX} characters or fewer.`),
  elementIds: z.array(z.uuid()).max(500),
});

export const editRequestSchema = z.object({
  id: z.uuid(),
  boardId: z.uuid(),
  elementIds: z.array(z.string()),
  prompt: z.string(),
  status: z.enum(EDIT_STATUSES),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const editRequestsSchema = z.object({ requests: z.array(editRequestSchema) });

/** Longest an AI editor's wait_for_edits call may block. */
export const WAIT_EDITS_MAX_SECONDS = 300;

// ── Socket.IO events ───────────────────────────────────────────────────────

export interface ServerToClientEvents {
  /** Element ops another tab or an AI editor saved, in one batch (= one undo step). */
  "element:ops": (payload: { boardId: string; ops: ElementOp[] }) => void;
  /** An edit request was created or changed status. */
  "edit:update": (request: EditRequest) => void;
}

export interface ClientToServerEvents {
  /** Start receiving a board's updates. The ack says whether the board is the user's. */
  "board:join": (boardId: string, ack: (ok: boolean) => void) => void;
  "board:leave": (boardId: string) => void;
  /** The tab's current selection, so AI editors can read it. */
  "selection:set": (payload: { boardId: string; elementIds: string[] }) => void;
}

/** The header a tab sends with its own saves, so the server doesn't echo them back to it. */
export const SOCKET_ID_HEADER = "x-prism-socket";

export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;
export type ApiToken = z.infer<typeof apiTokenSchema>;
export type CreatedApiToken = z.infer<typeof createdApiTokenSchema>;
export type EditStatus = (typeof EDIT_STATUSES)[number];
export type CreateEditRequestInput = z.infer<typeof createEditRequestSchema>;
export type EditRequest = z.infer<typeof editRequestSchema>;

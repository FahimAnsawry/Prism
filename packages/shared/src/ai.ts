import { z } from "zod";
import type { BoardElement, ElementOp } from "./elements.js";
import type { LayoutNode, LayoutOptions } from "./layout.js";
import type { MindmapInput, MindmapOptions } from "./mindmap.js";

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

// ── Board images (export_image) ────────────────────────────────────────────

/** Longest side of an exported image unless a scale is asked for: what vision models read well. */
export const EXPORT_IMAGE_DEFAULT_SIDE = 1568;
/** Longest side an exported image can have. */
export const EXPORT_IMAGE_MAX_SIDE = 4096;

/** What a board tab should render: a frame, some elements, or (neither) the whole board. */
export interface ExportImageRequest {
  boardId: string;
  /** The board as the server has it, so the image shows what was saved. */
  elements: BoardElement[];
  frameId?: string;
  ids?: string[];
  /** Image px per board px; by default the image fits EXPORT_IMAGE_DEFAULT_SIDE. */
  scale?: number;
}

const boxSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });

export const exportImageReplySchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    /** The image, base64-encoded. */
    data: z.string().max(6_000_000),
    mimeType: z.enum(["image/png", "image/jpeg"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    /** The board area shown, in board px. */
    region: boxSchema,
  }),
  z.object({ ok: z.literal(false), error: z.string().max(500) }),
]);

export type ExportImageReply = z.infer<typeof exportImageReplySchema>;

// ── Screen layout (create_screen) ──────────────────────────────────────────

/** A layout tree for a board tab to lay out, measuring text with the board's own fonts. */
export interface LayoutScreenRequest {
  boardId: string;
  root: LayoutNode;
  options: LayoutOptions;
}

export const layoutScreenReplySchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    /** The elements to create (checked again by the server before saving). */
    elements: z.array(z.record(z.string(), z.unknown())).max(5_000),
  }),
  z.object({ ok: z.literal(false), error: z.string().max(500) }),
]);

export type LayoutScreenReply = z.infer<typeof layoutScreenReplySchema>;

/** Mind map nodes for a board tab to size with the board's fonts (create_mindmap). */
export interface LayoutMindmapRequest {
  boardId: string;
  nodes: MindmapInput[];
  options: MindmapOptions;
}

export interface ServerToClientEvents {
  /** Element ops another tab or an AI editor saved, in one batch (= one undo step). */
  "element:ops": (payload: { boardId: string; ops: ElementOp[] }) => void;
  /** An edit request was created or changed status. */
  "edit:update": (request: EditRequest) => void;
  /** An AI editor wants to see part of the board: render it and reply with the image. */
  "export:image": (request: ExportImageRequest, ack: (reply: ExportImageReply) => void) => void;
  /** An AI editor's create_screen: lay the tree out with real text measurements and reply. */
  "layout:screen": (request: LayoutScreenRequest, ack: (reply: LayoutScreenReply) => void) => void;
  /** An AI editor's create_mindmap: size the nodes with real text measurements and reply. */
  "layout:mindmap": (
    request: LayoutMindmapRequest,
    ack: (reply: LayoutScreenReply) => void,
  ) => void;
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

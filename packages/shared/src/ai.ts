import { z } from "zod";
import type { BoardElement, ElementOp } from "./elements.js";
import type { Components } from "./components.js";
import type { LayoutNode, LayoutOptions } from "./layout.js";
import type { MindmapInput, MindmapOptions } from "./mindmap.js";
import type { Theme, ThemeMode } from "./theme.js";

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

// ── Reference comparison (compare_reference) ──────────────────────────────

/** A screen (frame) for a board tab to measure against a reference image on the board. */
export interface CompareReferenceRequest {
  boardId: string;
  /** The board as the server has it. */
  elements: BoardElement[];
  frameId: string;
  /** An image (or svg) element on the board: the reference. */
  referenceId: string;
}

const colorShareSchema = z.object({ color: z.string(), share: z.number() });

export const compareReferenceReplySchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    /** 0 (unrelated) to 100 (the same picture): layout, colors and shape together. */
    score: z.number().int().min(0).max(100),
    /**
     * The score's parts, 0 to 1: where it's light and dark (tones), where the detail is
     * (structure), the color mix (colors) and the proportions (shape).
     */
    breakdown: z.object({
      tones: z.number(),
      structure: z.number(),
      colors: z.number(),
      shape: z.number(),
    }),
    /** Width / height of each. */
    aspect: z.object({ screen: z.number(), reference: z.number() }),
    /** A few dominant colors of each, with their share of the image (0-1). */
    colors: z.object({
      screen: z.array(colorShareSchema).max(8),
      reference: z.array(colorShareSchema).max(8),
    }),
    /** Mean lightness (0 dark to 1 light) of nine regions, top-left to bottom-right. */
    regions: z
      .array(z.object({ region: z.string(), screen: z.number(), reference: z.number() }))
      .max(9),
    /** Share of each image that is plain background (its most common color), 0-1. */
    whitespace: z.object({ screen: z.number(), reference: z.number() }),
    /** The biggest differences, most important first, as things to change in the screen. */
    differences: z.array(z.string().max(300)).max(5),
  }),
  z.object({ ok: z.literal(false), error: z.string().max(500) }),
]);

export type CompareReferenceReply = z.infer<typeof compareReferenceReplySchema>;

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

// ── HTML screens (create_screen with html) ─────────────────────────────────

/** Most characters of HTML one screen can have. */
export const HTML_SCREEN_MAX = 200_000;
/**
 * Asset keys an HTML screen's elements use for images the server still has to store:
 * `pending:3` is HtmlScreenReply.assets[3].
 */
export const PENDING_ASSET = "pending:";

/** An AI editor's HTML + Tailwind for a board tab to render and read back as board elements. */
export interface HtmlScreenRequest {
  boardId: string;
  html: string;
  /** Where the screen goes, its width, and its height (the viewport) if fixed. */
  options: LayoutOptions;
  /** Whether `font` was asked for (else the theme's fonts apply). */
  fontGiven: boolean;
  mode: ThemeMode;
  theme: Theme;
  components: Components;
}

const pendingAssetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().max(4_000) }),
  z.object({ kind: z.literal("svg"), markup: z.string().max(500_000) }),
]);

export const htmlScreenReplySchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    /** The elements to create, in paint order (checked again by the server before saving). */
    elements: z.array(z.record(z.string(), z.unknown())).max(5_000),
    /** Images to store with the board, referred to as `pending:<index>` asset keys. */
    assets: z.array(pendingAssetSchema).max(300),
    /** The page's background (body or html), for the frame behind the screen. */
    background: z
      .object({ fill: z.string().max(64), token: z.string().max(40).optional() })
      .nullable(),
    /** The content's height in px. */
    height: z.number().min(0),
    /** What a strict theme refuses (plain colors, sizes, off-grid spacing). */
    violations: z.array(z.string().max(300)).max(500),
    /** What couldn't be drawn as written, for the AI editor. */
    notes: z.array(z.string().max(300)).max(50),
  }),
  z.object({ ok: z.literal(false), error: z.string().max(2_000) }),
]);

export type HtmlScreenReply = z.infer<typeof htmlScreenReplySchema>;
export type PendingAsset = z.infer<typeof pendingAssetSchema>;

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
  /** An AI editor's compare_reference: measure a screen against a reference image and reply. */
  "compare:reference": (
    request: CompareReferenceRequest,
    ack: (reply: CompareReferenceReply) => void,
  ) => void;
  /** An AI editor's create_screen: lay the tree out with real text measurements and reply. */
  "layout:screen": (request: LayoutScreenRequest, ack: (reply: LayoutScreenReply) => void) => void;
  /** An AI editor's create_screen with html: render it and read it back as elements. */
  "html:screen": (request: HtmlScreenRequest, ack: (reply: HtmlScreenReply) => void) => void;
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

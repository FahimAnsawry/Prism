import { z } from "zod";

// Live presence on a board: who else is here, where their pointer is, what they have selected,
// and, when an AI editor changes the board, which elements it is working on. Cursors are not
// stored anywhere; the server only relays them to the other tabs in the board's room.

/** Somebody on the board: a person in a browser tab, or an AI editor. */
export interface Peer {
  /** One per browser tab (a person) or per editor and user (an AI editor). */
  id: string;
  name: string;
  kind: "user" | "ai";
  /** Their cursor and outline color, the same on every tab. */
  color: string;
}

/** An element's box on the board, in board px. */
export interface PresenceBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A person's pointer moved. */
export interface CursorUpdate {
  boardId: string;
  peer: Peer;
  x: number;
  y: number;
}

/** A person's selection changed. */
export interface SelectionUpdate {
  boardId: string;
  peer: Peer;
  elementIds: string[];
}

/** An AI editor changed these elements: its cursor visits `visit` in order, `flash` light up. */
export interface EditUpdate {
  boardId: string;
  peer: Peer;
  visit: PresenceBox[];
  flash: PresenceBox[];
}

/** A person left the board (or their tab closed). */
export interface LeaveUpdate {
  boardId: string;
  peerId: string;
}

export const cursorPayloadSchema = z.object({
  boardId: z.uuid(),
  x: z.number().min(-1e7).max(1e7),
  y: z.number().min(-1e7).max(1e7),
});

/** Colors for cursors and selections: distinct hues that read on light and dark boards. */
export const PRESENCE_COLORS = [
  "#e5484d",
  "#e07a1f",
  "#c79a00",
  "#2f9e5b",
  "#0e9aa7",
  "#3d7bff",
  "#7c5cff",
  "#c04cd8",
  "#e0457b",
  "#6e8b1f",
] as const;

/** The AI editors people know by color. */
const EDITOR_COLORS: [RegExp, string][] = [
  [/claude|anthropic/i, "#d97757"],
  [/codex|openai|chatgpt/i, "#10a37f"],
  [/gemini|antigravity/i, "#4285f4"],
  [/cursor/i, "#7c5cff"],
  [/copilot/i, "#8250df"],
];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A stable color for a person (by account) or an AI editor (by name). */
export function presenceColor(key: string, kind: Peer["kind"] = "user") {
  if (kind === "ai") {
    const known = EDITOR_COLORS.find(([pattern]) => pattern.test(key));
    if (known) return known[1];
  }
  return PRESENCE_COLORS[hash(key.toLowerCase()) % PRESENCE_COLORS.length] ?? PRESENCE_COLORS[0];
}

export const PEER_NAME_MAX = 24;

/** A name for a cursor tag: one short line, `fallback` when there's nothing usable. */
export function peerName(raw: string | null | undefined, fallback: string) {
  const name = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, PEER_NAME_MAX).trim();
  return name || fallback;
}

/**
 * An AI editor's batch that creates at least this many elements is shown being built: the tabs
 * reveal it in steps, in drawing order, with the editor's cursor at work, instead of all at once.
 */
export const STAGE_MIN_CREATES = 12;

/** Most elements an AI editor's cursor lights up, and most places it visits, per change. */
export const FLASH_MAX = 40;
export const VISIT_MAX = 6;

/**
 * Which of the changed elements an AI editor's cursor visits and which light up. A few changes
 * are visited one by one, in reading order; a screen of hundreds is visited as a whole, then its
 * largest parts. The largest ones light up.
 */
export function pickPresenceTargets(boxes: PresenceBox[]) {
  const area = (b: PresenceBox) => b.width * b.height;
  const reading = (a: PresenceBox, b: PresenceBox) => a.y - b.y || a.x - b.x;
  const flash = [...boxes].sort((a, b) => area(b) - area(a)).slice(0, FLASH_MAX);
  if (boxes.length <= VISIT_MAX) return { visit: [...boxes].sort(reading), flash };
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const whole: PresenceBox = {
    id: "",
    x: x0,
    y: y0,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x0,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y0,
  };
  const parts = flash.slice(0, VISIT_MAX - 1).sort(reading);
  return { visit: [whole, ...parts], flash };
}

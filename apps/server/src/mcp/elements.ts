// Element building and reading for AI editors: friendly input schemas with defaults, and a
// compact view of the board (tools.md §7 is the full data model).

import { randomUUID } from "node:crypto";
import {
  boardElementSchema,
  chartDataSchema,
  elementTypeSchema,
  fontFamilySchema,
  fontSizeSchema,
  iconNameSchema,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  listItemSchema,
  shadowSchema,
  strokeStyleSchema,
  textAlignSchema,
  type BoardElement,
  type ElementType,
  type FontFamily,
  type FontSize,
  estimateText as estimateGlyphs,
  mindNodeSize,
  mindStyle,
} from "@prism/shared";
import { z } from "zod";

/** The style and content fields an AI editor can set, described for the model. */
export const fieldShape = {
  x: z.number().describe("Left edge in board px (x grows to the right)."),
  y: z.number().describe("Top edge in board px (y grows downward)."),
  width: z
    .number()
    .describe(
      "Width in px. For line/arrow: the x offset from (x, y) to the end point (may be negative).",
    ),
  height: z
    .number()
    .describe(
      "Height in px. For line/arrow: the y offset from (x, y) to the end point (may be negative).",
    ),
  rotation: z.number().describe("Degrees, around the element's center. Default 0."),
  stroke: z
    .string()
    .max(64)
    .describe(
      "Outline color, the TEXT color on text and list elements, or the icon color. Hex, e.g. #1f2937.",
    ),
  fill: z
    .string()
    .max(64)
    .nullable()
    .describe(
      "Fill color for rect, ellipse, diamond, sticky and icon (hex; a filled icon, e.g. a solid star), or null for none.",
    ),
  strokeWidth: z
    .number()
    .min(0)
    .max(64)
    .describe(
      "Outline width in px. 0 = no outline. Default 2. On icons: line weight in the icon's 24px grid (1.5 light, 2 regular).",
    ),
  strokeStyle: strokeStyleSchema.describe("Default solid."),
  sketch: z.boolean().describe("Hand-drawn look. Default false (clean UI look)."),
  opacity: z.number().min(0).max(1).describe("0 to 1. Default 1."),
  radius: z
    .number()
    .min(0)
    .max(10_000)
    .nullable()
    .describe("Corner radius in px for rect and frame (e.g. 8 for a button, 9999 for a pill)."),
  shadow: shadowSchema
    .nullable()
    .describe(
      "Drop shadow for rect, ellipse, diamond, frame, image, svg and chart: sm (inputs, subtle), md (cards), lg (menus, popovers, modals), or null for none.",
    ),
  role: z
    .string()
    .max(60)
    .nullable()
    .describe(
      'What the element is in the UI: "button", "input", "card", "nav", "heading", "image", …',
    ),
  groupId: z
    .string()
    .max(64)
    .nullable()
    .describe(
      'Elements with the same groupId select and move together. One per component, e.g. "hero-cta".',
    ),
  locked: z.boolean().describe("Locked elements can't be moved or edited by the user."),
  text: z
    .string()
    .max(20_000)
    .describe(
      "The text of a text or sticky element (\\n for new lines), or the emoji of an emoji element.",
    ),
  font: fontFamilySchema.describe(
    'Font: "sans" (DM Sans, default), "inter", "roboto", "open-sans", "montserrat", "poppins", "lato", "playfair", "merriweather", "mono", "caveat" (handwriting), or "gf:<Google Font name>".',
  ),
  fontSize: fontSizeSchema.describe("Preset size: S=16px, M=22px (default), L=30px, XL=40px."),
  fontSizePx: z
    .number()
    .min(6)
    .max(400)
    .nullable()
    .describe("Exact text size in px; wins over fontSize."),
  fontWeight: z
    .number()
    .int()
    .min(100)
    .max(900)
    .multipleOf(100)
    .describe("100 to 900 (400 regular, 600 semibold, 700 bold)."),
  textAlign: textAlignSchema,
  lineHeight: z
    .number()
    .min(LINE_HEIGHT_MIN)
    .max(LINE_HEIGHT_MAX)
    .nullable()
    .describe(
      "Text, sticky and list: line height as a multiple of the text size. Default 1.25; ~1.1 for big headings, 1.4-1.6 for paragraphs.",
    ),
  letterSpacing: z
    .number()
    .min(LETTER_SPACING_MIN)
    .max(LETTER_SPACING_MAX)
    .nullable()
    .describe(
      "Text, sticky and list: letter spacing in ems (a fraction of the text size). Default 0; -0.02 tightens large headings, 0.05-0.1 opens up small uppercase labels.",
    ),
  items: z.array(listItemSchema).max(500).describe("Bullet list items: { text, indent 0-4 }."),
  points: z
    .array(z.number())
    .max(40_000)
    .describe("Freehand only: x0, y0, x1, y1, … relative to (x, y)."),
  startBinding: z
    .string()
    .max(64)
    .nullable()
    .describe("Arrow only: id (or key from the same call) of the element the arrow starts at."),
  endBinding: z
    .string()
    .max(64)
    .nullable()
    .describe("Arrow only: id (or key from the same call) of the element the arrow points to."),
  parentId: z
    .string()
    .max(64)
    .nullable()
    .describe(
      "Mind map node only: id (or key from the same call) of its parent node; null for a central topic.",
    ),
  collapsed: z.boolean().describe("Mind map node only: its branch is folded away."),
  textColor: z.string().max(64).describe("Mind map node only: text color (hex)."),
  chart: chartDataSchema.describe(
    "Chart only: { kind: bar|line|pie|donut, rows: [{ label, value }] }.",
  ),
  icon: iconNameSchema.describe(
    'Icon only: a Lucide icon name in kebab case (https://lucide.dev/icons), e.g. "search", "bell", "chevron-right", "shopping-cart", "circle-user", "settings". Prefer these over emoji for UI.',
  ),
  z: z.number().describe("Layer order; higher draws on top. Rarely needed."),
};

const optionalFields = z.object(fieldShape).partial();

export const createElementInput = optionalFields.extend({
  key: z
    .string()
    .max(64)
    .optional()
    .describe(
      "Your own name for the element, so arrows in the same call can bind to it. Not stored.",
    ),
  type: elementTypeSchema
    .exclude(["image", "svg"])
    .describe("Element type. Images go through add_image instead."),
  x: fieldShape.x,
  y: fieldShape.y,
});

export const updateChangesInput = optionalFields;

/** An element from create_screen's layout: create input plus whether text hugs its content. */
export const layoutElementInput = createElementInput.extend({ autoWidth: z.boolean().optional() });

export type CreateElementInput = z.infer<typeof createElementInput>;

const SIZES: Record<FontSize, number> = { S: 16, M: 22, L: 30, XL: 40 };
const LINE_HEIGHT = 1.25;

const BASE = {
  rotation: 0,
  stroke: "#3d3b4f",
  fill: null,
  strokeWidth: 2,
  strokeStyle: "solid",
  sketch: false,
  opacity: 1,
} satisfies Partial<BoardElement>;

/** Type-specific starting values (the same as the editor's tools). */
const DEFAULTS: Partial<Record<ElementType, Partial<BoardElement>>> = {
  rect: { width: 160, height: 100 },
  ellipse: { width: 120, height: 120 },
  diamond: { width: 140, height: 100 },
  line: { width: 160, height: 0 },
  arrow: { width: 160, height: 0 },
  text: { font: "sans", fontSize: "M", textAlign: "left" },
  sticky: {
    width: 200,
    height: 200,
    fill: "#ecffa3",
    font: "sans",
    fontSize: "M",
    textAlign: "center",
  },
  list: { font: "sans", fontSize: "M", textAlign: "left" },
  emoji: { width: 64, height: 64, text: "🙂" },
  icon: { width: 24, height: 24, icon: "circle" },
  chart: {
    width: 320,
    height: 220,
    chart: { kind: "bar", rows: [{ label: "A", value: 1 }] },
  },
  frame: { width: 390, height: 844, stroke: "#5f5f5f" },
  freehand: { width: 0, height: 0, points: [] },
};

/**
 * A rough text box size. An open board tab measures text properly and corrects it, so this only
 * has to be close enough when no tab is open.
 */
function estimateText(el: Partial<BoardElement>) {
  const px = el.fontSizePx ?? SIZES[el.fontSize ?? "M"];
  const lines =
    el.type === "list"
      ? (el.items ?? []).map((item) => `${"    ".repeat(item.indent)}• ${item.text}`)
      : (el.text ?? "").split("\n");
  const longest = Math.max(1, ...lines.map((line) => line.length));
  return {
    width: Math.ceil(longest * px * (0.55 + (el.letterSpacing ?? 0))) + 2,
    height: Math.max(1, lines.length) * px * (el.lineHeight ?? LINE_HEIGHT),
  };
}

/**
 * Turns AI input into full elements, on top of the board's existing ones. Keys from the batch
 * become ids in arrow bindings.
 */
export function buildElements(inputs: CreateElementInput[], existing: BoardElement[]) {
  const ids = new Map<string, string>();
  for (const input of inputs) {
    if (input.key) ids.set(input.key, randomUUID());
  }
  const resolve = (ref: string | null | undefined) => (ref ? (ids.get(ref) ?? ref) : ref);
  let z = existing.reduce((max, el) => Math.max(max, el.z), -1) + 1;

  return inputs.map((input) => {
    const { key, ...fields } = input;
    const id = (key && ids.get(key)) || randomUUID();
    const textual = input.type === "text" || input.type === "list";
    const draft: Record<string, unknown> = {
      ...BASE,
      ...DEFAULTS[input.type],
      ...fields,
      id,
      version: 1,
      z: fields.z ?? z++,
      updatedBy: "ai_agent",
      ...(input.startBinding !== undefined && { startBinding: resolve(input.startBinding) }),
      ...(input.endBinding !== undefined && { endBinding: resolve(input.endBinding) }),
      ...(input.parentId !== undefined && { parentId: resolve(input.parentId) }),
    };
    if (input.type === "mindnode") {
      // Without a size the node fits its text, like one typed on the board.
      const style = mindStyle(0, 0);
      const size = mindNodeSize(
        (draft["text"] as string | undefined) ?? "",
        {
          font: (draft["font"] as FontFamily | undefined) ?? "sans",
          px: (draft["fontSizePx"] as number | undefined) ?? style.fontSizePx,
          weight: (draft["fontWeight"] as number | undefined) ?? 400,
        },
        estimateGlyphs,
      );
      draft["width"] ??= size.width;
      draft["height"] ??= size.height;
    }
    if (textual) {
      if (input.type === "list" && !input.items) draft["items"] = [{ text: "", indent: 0 }];
      // Without a width the text grows to fit its longest line, like typed text.
      if (input.width === undefined) draft["autoWidth"] = true;
      const size = estimateText(draft as Partial<BoardElement>);
      draft["width"] ??= size.width;
      draft["height"] = input.height ?? size.height;
    }
    draft["width"] ??= 100;
    draft["height"] ??= 100;
    return boardElementSchema.parse(draft);
  });
}

/** Fields whose default value isn't worth showing the model. */
const DEFAULT_VALUES: Record<string, unknown> = {
  rotation: 0,
  opacity: 1,
  strokeStyle: "solid",
  sketch: false,
  locked: false,
};
const HIDDEN = new Set(["version", "updatedBy", "z", "assetKey", "points"]);

const round = (n: number) => Math.round(n * 10) / 10;

/** A compact element for the model: defaults and sync bookkeeping left out, numbers rounded. */
export function compact(el: BoardElement, fileUrl: (assetKey: string) => string) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(el)) {
    if (value === undefined || (value === null && key !== "fill") || HIDDEN.has(key)) continue;
    if (DEFAULT_VALUES[key] === value) continue;
    out[key] = typeof value === "number" ? round(value) : value;
  }
  if (el.assetKey) out["url"] = fileUrl(el.assetKey);
  if (el.points) out["pointCount"] = el.points.length / 2;
  return out;
}

/** Whether `el`'s center lies inside `frame`. */
export function insideFrame(el: BoardElement, frame: BoardElement) {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return (
    cx >= frame.x && cx <= frame.x + frame.width && cy >= frame.y && cy <= frame.y + frame.height
  );
}

/** The box around `elements`, or null for none. */
export function boundsOf(elements: BoardElement[]) {
  if (elements.length === 0) return null;
  const xs = elements.flatMap((el) => [el.x, el.x + el.width]);
  const ys = elements.flatMap((el) => [el.y, el.y + el.height]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: round(minX),
    y: round(minY),
    width: round(Math.max(...xs) - minX),
    height: round(Math.max(...ys) - minY),
  };
}

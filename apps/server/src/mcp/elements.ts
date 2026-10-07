// Element building and reading for AI editors: friendly input schemas with defaults, and a
// compact view of the board (tools.md §7 is the full data model).

import { randomUUID } from "node:crypto";
import {
  BACKDROP_BLUR_MAX,
  boardElementSchema,
  boundTokens,
  chartDataSchema,
  elementTokensSchema,
  elementTypeSchema,
  fontFamilySchema,
  fontSizeSchema,
  gradientSchema,
  iconNameSchema,
  type ImageFill,
  imageFillSchema,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  listItemSchema,
  shadowSchema,
  strokeStyleSchema,
  textAlignSchema,
  themeRefSchema,
  type BoardElement,
  type ElementType,
  type FontFamily,
  type FontSize,
  type Theme,
  estimateText as estimateGlyphs,
  mindNodeSize,
  mindStyle,
} from "@prism/shared";
import { z } from "zod";

/** One corner's radius: px or a `$radius-*` token. */
const corner = z.union([z.number().min(0).max(10_000), themeRefSchema]);

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
      "Outline color, the TEXT color on text and list elements, or the icon color: a theme token ($foreground, $muted-foreground, $border, $primary, …) or hex.",
    ),
  fill: z
    .string()
    .max(64)
    .nullable()
    .describe(
      "Fill color for rect, ellipse, diamond, sticky, frame and icon (a filled icon, e.g. a solid star): a theme token ($primary, $card, $muted, …) or hex, or null for none.",
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
    .union([corner, z.tuple([corner, corner, corner, corner])])
    .nullable()
    .describe(
      'Corner radius for rect and frame: a theme token ($radius-md for buttons and inputs, $radius-lg or $radius-xl for cards, $radius-full for pills) or px. One per corner as [topLeft, topRight, bottomRight, bottomLeft], e.g. ["$radius-lg", "$radius-lg", 0, 0] for a card image on top.',
    ),
  shadow: shadowSchema
    .nullable()
    .describe(
      'Drop shadow for rect, ellipse, diamond, frame, image, svg and chart: sm (inputs, subtle), md (cards), lg (menus, popovers, modals), or null for none. Or custom layers like CSS box-shadow (first on top), for soft or colored shadows: [{ x: 0, y: 24, blur: 48, spread: -12, color: "#0f172a26" }, { x: 0, y: 2, blur: 6, spread: 0, color: "#0f172a14" }]. color takes hex with alpha, rgba() or a $token.',
    ),
  gradient: gradientSchema
    .nullable()
    .describe(
      'Gradient fill for rect, ellipse and frame, as in CSS: { type: "linear", angle: 135, stops: [{ color: "$primary", position: 0 }, { color: "#a855f7", position: 100 }] } (angle 0 points up, 90 right, 180 down; position 0-100), or { type: "radial", stops: [...] } from the center to the farthest corner. Colors take $tokens or hex (alpha allowed). Without a fill, the fill becomes the first stop color. null removes it.',
    ),
  fillImage: z
    .object({
      url: z
        .url()
        .describe(
          "A public PNG, JPEG, GIF or WebP URL (up to 10 MB), or the url get_board shows for one already on the board.",
        ),
      fit: z
        .enum(["cover", "contain"])
        .optional()
        .describe("cover (default) fills the shape and crops; contain shows the whole image."),
    })
    .nullable()
    .describe(
      "A photo inside a rect, ellipse or frame (hero photo, avatar, product shot, logo), clipped to its shape and radius and drawn over the fill. Prism downloads it with the board. null removes it.",
    ),
  backdropBlur: z
    .number()
    .min(0)
    .max(BACKDROP_BLUR_MAX)
    .nullable()
    .describe(
      'Frosted glass on a rect or frame: blurs the elements under it by this many px, like CSS backdrop-filter: blur(16px). Give it a semi-transparent fill (e.g. "#ffffffb3") and a hairline stroke, and put it over a photo or gradient. null removes it.',
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
  font: z
    .union([fontFamilySchema, themeRefSchema])
    .describe(
      'Font: the theme\'s "$sans", "$heading" or "$mono", or a board font: "sans" (DM Sans), "inter", "roboto", "open-sans", "montserrat", "poppins", "lato", "playfair", "merriweather", "mono", "caveat" (handwriting), or "gf:<Google Font name>".',
    ),
  textStyle: themeRefSchema.describe(
    "Text, sticky and list: the theme's text style ($display, $h1–$h4, $body-lg, $body, $body-sm, $caption, $label), which sets size, weight, line height, spacing and font together. Prefer it to fontSizePx/fontWeight.",
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
  textColor: z.string().max(64).describe("Mind map node only: text color (theme token or hex)."),
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
export const layoutElementInput = createElementInput.extend({
  // Already stored with the board (storeLayoutImages).
  fillImage: imageFillSchema.optional(),
  autoWidth: z.boolean().optional(),
  tokens: elementTokensSchema.optional(),
  component: z.string().max(120).optional(),
});

export type CreateElementInput = z.infer<typeof createElementInput>;
/** AI input once its image fill's URL is stored with the board. */
export type StoredInput<T extends { fillImage?: unknown }> = Omit<T, "fillImage"> & {
  fillImage?: ImageFill | null | undefined;
};

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
export function buildElements(
  inputs: (StoredInput<CreateElementInput> & Pick<BoardElement, "tokens" | "component">)[],
  existing: BoardElement[],
) {
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

const round = (n: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
};

/** Small ratios that one decimal would erase (letterSpacing -0.02 would read as 0). */
const PRECISE_DECIMALS: Record<string, number> = { letterSpacing: 3, lineHeight: 2, opacity: 2 };

/**
 * A compact element for the model: defaults and sync bookkeeping left out, numbers rounded.
 * With the board's theme, values that came from a theme token read as the token ($primary).
 */
export function compact(el: BoardElement, fileUrl: (assetKey: string) => string, theme?: Theme) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(el)) {
    if (value === undefined || (value === null && key !== "fill") || HIDDEN.has(key)) continue;
    if (DEFAULT_VALUES[key] === value || key === "tokens") continue;
    out[key] = typeof value === "number" ? round(value, PRECISE_DECIMALS[key]) : value;
  }
  if (theme) {
    const bound = boundTokens(el, theme);
    Object.assign(out, bound);
    // The text style stands for these.
    if (bound.textStyle) {
      for (const key of ["fontSize", "fontSizePx", "fontWeight", "lineHeight", "letterSpacing"]) {
        delete out[key];
      }
    }
  }
  if (el.assetKey) out["url"] = fileUrl(el.assetKey);
  if (el.fillImage)
    out["fillImage"] = { url: fileUrl(el.fillImage.assetKey), fit: el.fillImage.fit };
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

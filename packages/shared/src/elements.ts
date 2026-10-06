import { z } from "zod";

// Board elements (tools.md §7) and the save API. The client keeps elements flat; the server
// stores the shared fields as columns and the type-specific ones in a `props` JSON column.

export const ELEMENT_TYPES = [
  "text",
  "sticky",
  "list",
  "rect",
  "ellipse",
  "diamond",
  "line",
  "arrow",
  "freehand",
  "emoji",
  "image",
  "svg",
  "chart",
  "frame",
  "icon",
  "mindnode",
] as const;

export const elementTypeSchema = z.enum(ELEMENT_TYPES);
export const strokeStyleSchema = z.enum(["solid", "dashed", "dotted"]);
/**
 * The self-hosted board fonts. "sans", "caveat" and "mono" were the first three and keep their
 * ids so older elements still parse.
 */
export const BUILTIN_FONTS = [
  // sans
  "sans",
  "inter",
  "roboto",
  "open-sans",
  "montserrat",
  "poppins",
  "lato",
  // serif
  "playfair",
  "merriweather",
  // mono
  "mono",
  // handwriting
  "caveat",
  "nanum-pen",
  "kalam",
  "patrick-hand",
  "indie-flower",
] as const;

/** A Google Fonts family name a user added to a board, e.g. "Lobster" or "Fira Sans". */
export const googleFontNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ]{0,63}$/, "Use letters, digits and spaces (up to 64).");

/** A built-in font id, or "gf:<Family>" for a Google font added to the board. */
export const fontFamilySchema = z.union([
  z.enum(BUILTIN_FONTS),
  z.templateLiteral(["gf:", z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 ]{0,63}$/)]),
]);
export const fontSizeSchema = z.enum(["S", "M", "L", "XL"]);
/** "normal" (400) and "bold" (700) from older elements, or a numeric weight 100–900. */
export const fontWeightSchema = z.union([
  z.enum(["normal", "bold"]),
  z.number().int().min(100).max(900).multipleOf(100),
]);
/** Bounds of a free text size in px. */
export const FONT_PX_MIN = 6;
export const FONT_PX_MAX = 400;
/** Line height as a multiple of the text size (1.25 when unset). */
export const LINE_HEIGHT_MIN = 0.5;
export const LINE_HEIGHT_MAX = 3;
/** Letter spacing in ems: a fraction of the text size added after each character (0 when unset). */
export const LETTER_SPACING_MIN = -0.2;
export const LETTER_SPACING_MAX = 1;
export const textAlignSchema = z.enum(["left", "center", "right"]);
export const chartKindSchema = z.enum(["bar", "line", "pie", "donut"]);
/** A drop shadow preset: sm (subtle, e.g. inputs), md (cards), lg (menus, modals). */
export const shadowSchema = z.enum(["sm", "md", "lg"]);
/** The element types that draw a shadow; others ignore it. */
export const SHADOW_TYPES: readonly ElementType[] = [
  "rect",
  "ellipse",
  "diamond",
  "frame",
  "image",
  "svg",
  "chart",
];
/** A Lucide icon name in kebab case, e.g. "search" or "arrow-right" (https://lucide.dev/icons). */
export const iconNameSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64);

export const listItemSchema = z.object({
  text: z.string().max(2_000),
  indent: z.number().int().min(0).max(4),
});

export const chartDataSchema = z.object({
  kind: chartKindSchema,
  rows: z
    .array(z.object({ label: z.string().max(60), value: z.number() }))
    .min(1)
    .max(50),
});

const color = z.string().max(64);
const elementRef = z.string().max(64);

/** The columns of the element table (besides id, version and the timestamps). */
const columnFields = {
  type: elementTypeSchema,
  x: z.number(),
  y: z.number(),
  /** Line and arrow: the vector from (x, y) to the end point, so it can be negative. */
  width: z.number(),
  height: z.number(),
  /** Degrees, around the element's center. */
  rotation: z.number(),
  z: z.number(),
  stroke: color,
  fill: color.nullable(),
  strokeWidth: z.number().min(0).max(64),
  strokeStyle: strokeStyleSchema,
  sketch: z.boolean(),
  opacity: z.number().min(0).max(1),
  groupId: elementRef.nullable().optional(),
  locked: z.boolean().optional(),
  role: z.string().max(60).nullable().optional(),
  updatedBy: z.enum(["user", "ai_agent"]),
};

/** Type-specific fields, stored in `props`. */
const propFields = {
  // text, sticky, emoji (the emoji itself)
  text: z.string().max(20_000).optional(),
  // text, sticky, list
  font: fontFamilySchema.optional(),
  fontSize: fontSizeSchema.optional(),
  /** A free size in px (set by resizing the text or typing a size); wins over `fontSize`. */
  fontSizePx: z.number().min(FONT_PX_MIN).max(FONT_PX_MAX).nullable().optional(),
  fontWeight: fontWeightSchema.optional(),
  textAlign: textAlignSchema.optional(),
  lineHeight: z.number().min(LINE_HEIGHT_MIN).max(LINE_HEIGHT_MAX).nullable().optional(),
  letterSpacing: z.number().min(LETTER_SPACING_MIN).max(LETTER_SPACING_MAX).nullable().optional(),
  /** Text and lists grow to fit their longest line until the user resizes them. */
  autoWidth: z.boolean().optional(),
  // list
  items: z.array(listItemSchema).max(500).optional(),
  // freehand: x0, y0, x1, y1, … relative to (x, y)
  points: z.array(z.number()).max(40_000).optional(),
  // arrow: the elements its ends are attached to
  startBinding: elementRef.nullable().optional(),
  endBinding: elementRef.nullable().optional(),
  // image, svg: the uploaded file, served at /uploads/<assetKey>
  assetKey: z.string().max(200).optional(),
  // rect, frame: corner radius in px (capped at half the shorter side when drawn)
  radius: z.number().min(0).max(10_000).nullable().optional(),
  // shapes, frames, images, SVGs and charts: a drop shadow
  shadow: shadowSchema.nullable().optional(),
  // chart
  chart: chartDataSchema.optional(),
  // mindnode: the node it branches from (none for a central topic), whether its branch is
  // folded away, and its text color (stroke is its branch color, fill its background)
  parentId: elementRef.nullable().optional(),
  collapsed: z.boolean().optional(),
  textColor: color.optional(),
  // icon: the Lucide icon drawn; stroke is its color, strokeWidth its line weight (in 24px units)
  icon: iconNameSchema.optional(),
};

export const ELEMENT_COLUMNS = Object.keys(columnFields) as (keyof typeof columnFields)[];

export const boardElementSchema = z.object({
  id: z.uuid(),
  /** Bumped on every change; when two writes race, the higher version wins. */
  version: z.number().int().min(1),
  ...columnFields,
  ...propFields,
});

/** A partial element: the fields one update changes. `null` clears an optional field. */
export const elementChangesSchema = z
  .object({ ...columnFields, ...propFields })
  .omit({ type: true })
  .partial();

/** One sync operation (tools.md §2: `element:create/update/delete` carrying `{id, version, changes}`). */
export const elementOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), element: boardElementSchema }),
  z.object({
    op: z.literal("update"),
    id: z.uuid(),
    version: z.number().int().min(1),
    changes: elementChangesSchema,
  }),
  z.object({ op: z.literal("delete"), id: z.uuid(), version: z.number().int().min(1) }),
]);

export const saveElementsSchema = z.object({ ops: z.array(elementOpSchema).min(1).max(2_000) });

export const boardElementsSchema = z.object({ elements: z.array(boardElementSchema) });

/** Reply to a save: how many ops were applied and the ids whose op lost to a newer version. */
export const saveElementsResultSchema = z.object({
  applied: z.number().int(),
  stale: z.array(z.string()),
});

export const uploadResultSchema = z.object({ assetKey: z.string() });

/** Image types the upload route accepts, besides SVG. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export const SVG_TYPE = "image/svg+xml";
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export type ElementType = z.infer<typeof elementTypeSchema>;
export type StrokeStyle = z.infer<typeof strokeStyleSchema>;
export type FontFamily = z.infer<typeof fontFamilySchema>;
export type BuiltinFont = (typeof BUILTIN_FONTS)[number];
export type FontSize = z.infer<typeof fontSizeSchema>;
export type FontWeight = z.infer<typeof fontWeightSchema>;
export type TextAlign = z.infer<typeof textAlignSchema>;
export type ChartKind = z.infer<typeof chartKindSchema>;
export type Shadow = z.infer<typeof shadowSchema>;
export type ChartData = z.infer<typeof chartDataSchema>;
export type ListItem = z.infer<typeof listItemSchema>;
export type BoardElement = z.infer<typeof boardElementSchema>;
export type ElementChanges = z.infer<typeof elementChangesSchema>;
export type ElementOp = z.infer<typeof elementOpSchema>;
export type SaveElementsInput = z.infer<typeof saveElementsSchema>;

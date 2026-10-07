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
const radiusPx = z.number().min(0).max(10_000);
/** Corner radius in px: one for every corner, or [topLeft, topRight, bottomRight, bottomLeft]. */
export const radiusSchema = z.union([radiusPx, z.tuple([radiusPx, radiusPx, radiusPx, radiusPx])]);

/** Each corner's radius (top left, top right, bottom right, bottom left), at most half the shorter side. */
export function cornerRadii(
  radius: Radius | null | undefined,
  width: number,
  height: number,
): [number, number, number, number] {
  const max = Math.min(Math.abs(width), Math.abs(height)) / 2;
  const [tl, tr, br, bl] = Array.isArray(radius) ? radius : [0, 1, 2, 3].map(() => radius ?? 0);
  return [tl, tr, br, bl].map((r) => Math.min(r ?? 0, max)) as [number, number, number, number];
}

/**
 * One gradient color stop: a color at a position along the gradient, 0 to 100 (%). `token` is the
 * theme color it came from, so it reads back as `$token` while the color still matches.
 */
export const gradientStopSchema = z.object({
  color: z.string().max(64),
  position: z.number().min(0).max(100),
  token: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(40)
    .optional(),
});
/**
 * A gradient fill, as in CSS: linear at an angle (0 points up, 90 right, 180 down) or radial from
 * the center to the farthest corner.
 */
export const gradientSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("linear"),
    angle: z.number().min(-360).max(360),
    stops: z.array(gradientStopSchema).min(2).max(8),
  }),
  z.object({
    type: z.literal("radial"),
    stops: z.array(gradientStopSchema).min(2).max(8),
  }),
]);
/** The element types a gradient fill applies to. */
export const GRADIENT_TYPES: readonly ElementType[] = ["rect", "ellipse", "frame"];

/**
 * An uploaded image painted inside a shape, clipped to its outline: cover fills the shape
 * (cropping the image), contain shows the whole image (the fill shows around it).
 */
export const imageFillSchema = z.object({
  assetKey: z.string().max(200),
  fit: z.enum(["cover", "contain"]),
});
/** The element types an image fill applies to. */
export const IMAGE_FILL_TYPES: readonly ElementType[] = ["rect", "ellipse", "frame"];

/** The element types that blur what's under them (frosted glass); others ignore backdropBlur. */
export const BLUR_TYPES: readonly ElementType[] = ["rect", "frame"];
export const BACKDROP_BLUR_MAX = 100;

/** A drop shadow preset: sm (subtle, e.g. inputs), md (cards), lg (menus, modals). */
export const shadowPresetSchema = z.enum(["sm", "md", "lg"]);
/** One shadow layer, like a CSS box-shadow: offset, blur radius, spread and color (alpha allowed). */
export const shadowLayerSchema = z.object({
  x: z.number().min(-500).max(500),
  y: z.number().min(-500).max(500),
  blur: z.number().min(0).max(500),
  spread: z.number().min(-500).max(500),
  color: z.string().max(64),
});
/** A preset, or custom layers (the first draws on top, as in CSS). */
export const shadowSchema = z.union([shadowPresetSchema, z.array(shadowLayerSchema).min(1).max(6)]);
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

/** A project theme token in place of a value: "$primary", "$radius-lg", "$heading" (theme.ts). */
export const themeRefSchema = z.templateLiteral(["$", z.string().regex(/^[a-z0-9-]{1,40}$/)]);
export type ThemeRef = z.infer<typeof themeRefSchema>;
export const isThemeRef = (value: unknown): value is ThemeRef =>
  typeof value === "string" && value.startsWith("$");

/**
 * The element fields a project theme token can set (theme.ts). textStyle isn't a field: it stands
 * for the text's size, weight, line height and letter spacing together.
 */
export const TOKEN_FIELDS = ["stroke", "fill", "textColor", "radius", "font", "textStyle"] as const;
/**
 * Which theme token set each field, e.g. { fill: "primary", textStyle: "h1" }, so AI editors
 * read `$primary` back and code it as `bg-primary`. A binding only counts while the field still
 * holds the token's value: an edit by hand leaves a stale entry that readers ignore.
 */
export const elementTokensSchema = z.partialRecord(
  z.enum(TOKEN_FIELDS),
  z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(40),
);

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
  // rect, frame: corner radius in px, one or per corner (capped at half the shorter side when drawn)
  radius: radiusSchema.nullable().optional(),
  // rect, ellipse, frame: a gradient drawn instead of the fill (which keeps its first color)
  gradient: gradientSchema.nullable().optional(),
  // rect, ellipse, frame: an uploaded image painted over the fill, clipped to the shape
  fillImage: imageFillSchema.nullable().optional(),
  // rect, frame: frosted glass, blurring the elements under it by this many px (CSS blur())
  backdropBlur: z.number().min(0).max(BACKDROP_BLUR_MAX).nullable().optional(),
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
  // any: the theme tokens its colors, radius and font came from
  tokens: elementTokensSchema.nullable().optional(),
  // any: the project component instance that drew it ("Button:primary", "Sidebar > NavItem")
  component: z.string().max(120).nullable().optional(),
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
export type ShadowPreset = z.infer<typeof shadowPresetSchema>;
export type ShadowLayer = z.infer<typeof shadowLayerSchema>;
export type Radius = z.infer<typeof radiusSchema>;
export type Gradient = z.infer<typeof gradientSchema>;
export type ImageFill = z.infer<typeof imageFillSchema>;
export type GradientStop = z.infer<typeof gradientStopSchema>;
export type ChartData = z.infer<typeof chartDataSchema>;
export type ListItem = z.infer<typeof listItemSchema>;
export type TokenField = (typeof TOKEN_FIELDS)[number];
export type ElementTokens = z.infer<typeof elementTokensSchema>;
export type BoardElement = z.infer<typeof boardElementSchema>;
export type ElementChanges = z.infer<typeof elementChangesSchema>;
export type ElementOp = z.infer<typeof elementOpSchema>;
export type SaveElementsInput = z.infer<typeof saveElementsSchema>;

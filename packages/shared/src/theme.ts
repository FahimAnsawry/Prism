import { z } from "zod";
import {
  type BoardElement,
  type BuiltinFont,
  type ElementTokens,
  type ElementType,
  type Gradient,
  type Radius,
  type Shadow,
  FONT_PX_MAX,
  FONT_PX_MIN,
  type FontFamily,
  fontFamilySchema,
  googleFontNameSchema,
  isThemeRef,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  type ThemeRef,
  type TokenField,
} from "./elements.js";
import type { LayoutNode, LayoutRadius } from "./layout.js";

// Project themes: one set of shadcn/ui CSS variables (light and dark) plus a radius and fonts per
// project, so every screen an AI editor draws and every page it codes from them use the same
// theme. Boards draw a token's value; elements remember the token (`tokens`), so the editor reads
// `$primary` back and writes `bg-primary` instead of guessing from a hex.

// ── Tokens ────────────────────────────────────────────────────────────────

/** shadcn/ui's color variables (Tailwind v4 theming), in its order. */
export const THEME_COLORS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

export const THEME_MODES = ["light", "dark"] as const;

/** Radius tokens as multiples of --radius, as in shadcn's `@theme inline`. */
export const RADIUS_SCALE = {
  "radius-sm": 0.6,
  "radius-md": 0.8,
  "radius-lg": 1,
  "radius-xl": 1.4,
  "radius-2xl": 1.8,
  "radius-3xl": 2.2,
  "radius-4xl": 2.6,
} as const;
/** Tailwind's `rounded-full`: a pill or a circle. */
const RADIUS_FULL = 9999;

export const THEME_FONTS = ["sans", "heading", "mono"] as const;

/** The type scale: each style is one Tailwind class in the app (`text-h1`, see themeToCss). */
export const TEXT_STYLES = [
  "display",
  "h1",
  "h2",
  "h3",
  "h4",
  "body-lg",
  "body",
  "body-sm",
  "caption",
  "label",
] as const;

export type ThemeColor = (typeof THEME_COLORS)[number];
export type ThemeMode = (typeof THEME_MODES)[number];
export type ThemeFont = (typeof THEME_FONTS)[number];
export type TextStyleName = (typeof TEXT_STYLES)[number];

const COLOR_FIELDS = new Set<TokenField>(["stroke", "fill", "textColor"]);
const isThemeColor = (name: string): name is ThemeColor =>
  (THEME_COLORS as readonly string[]).includes(name);
const isThemeFont = (name: string): name is ThemeFont =>
  (THEME_FONTS as readonly string[]).includes(name);
const isRadius = (name: string): name is keyof typeof RADIUS_SCALE => name in RADIUS_SCALE;
const isTextStyle = (name: string): name is TextStyleName =>
  (TEXT_STYLES as readonly string[]).includes(name);

/** Every token an AI editor can use, by kind. */
export function themeTokenNames() {
  return {
    colors: THEME_COLORS.map((name) => `$${name}`),
    radius: [...Object.keys(RADIUS_SCALE), "radius-full"].map((name) => `$${name}`),
    fonts: THEME_FONTS.map((name) => `$${name}`),
    textStyles: TEXT_STYLES.map((name) => `$${name}`),
  };
}

// ── Schema ────────────────────────────────────────────────────────────────

/** A CSS color Prism can read: hex, rgb(), hsl(), oklch(), oklab() or a bare "H S% L%". */
export const cssColorSchema = z
  .string()
  .trim()
  .max(80)
  .refine(
    (value) => parseCssColor(value) !== null,
    "Use a CSS color: hex, rgb(), hsl() or oklch().",
  );

const colorToken = z.enum(THEME_COLORS);
const fontsShape = { sans: fontFamilySchema, heading: fontFamilySchema, mono: fontFamilySchema };

export const textStyleSchema = z.object({
  /** Which theme font: $sans, $heading or $mono. */
  font: z.enum(THEME_FONTS),
  /** px. */
  size: z.number().min(FONT_PX_MIN).max(FONT_PX_MAX),
  weight: z.number().int().min(100).max(900).multipleOf(100),
  /** A multiple of the size. */
  lineHeight: z.number().min(LINE_HEIGHT_MIN).max(LINE_HEIGHT_MAX),
  /** In ems. */
  letterSpacing: z.number().min(LETTER_SPACING_MIN).max(LETTER_SPACING_MAX),
});
export type TextStyle = z.infer<typeof textStyleSchema>;

const style = (
  font: ThemeFont,
  size: number,
  weight: number,
  lineHeight: number,
  letterSpacing = 0,
): TextStyle => ({ font, size, weight, lineHeight, letterSpacing });

/** A type scale on Tailwind's sizes (h1 = text-4xl, body = text-base, …). */
export const DEFAULT_TEXT_STYLES: Record<TextStyleName, TextStyle> = {
  display: style("heading", 48, 800, 1.1, -0.025),
  h1: style("heading", 36, 700, 1.15, -0.025),
  h2: style("heading", 30, 600, 1.2, -0.02),
  h3: style("heading", 24, 600, 1.3, -0.01),
  h4: style("heading", 20, 600, 1.4),
  "body-lg": style("sans", 18, 400, 1.55),
  body: style("sans", 16, 400, 1.5),
  "body-sm": style("sans", 14, 400, 1.45),
  caption: style("sans", 12, 400, 1.35),
  label: style("sans", 14, 500, 1.2),
};

export const themeSchema = z.object({
  name: z.string().trim().max(60).optional(),
  /** --radius in px; the radius tokens scale from it (shadcn's default is 0.625rem = 10px). */
  radius: z.number().min(0).max(64),
  /** Tailwind's --spacing in px (p-4 = 4 × it). A strict theme keeps gaps and padding on its half-steps. */
  spacing: z.number().min(1).max(16).default(4),
  /** Board fonts behind --font-sans, --font-heading and --font-mono. */
  fonts: z.object(fontsShape),
  /** Every color token, as the CSS value the app uses (oklch, hex, …). */
  light: z.record(colorToken, cssColorSchema),
  dark: z.record(colorToken, cssColorSchema),
  /** The type scale. Themes saved before it existed get the default. */
  text: z.record(z.enum(TEXT_STYLES), textStyleSchema).default(DEFAULT_TEXT_STYLES),
  /**
   * Strict: AI editors must use tokens for UI colors, radius, fonts and text sizes, so screens
   * can't drift from the theme. A saved theme is strict unless turned off.
   */
  strict: z.boolean().default(true),
});

/** A change to a theme: only the given values change. */
export const themePatchSchema = z.object({
  name: themeSchema.shape.name,
  radius: themeSchema.shape.radius.optional(),
  spacing: z.number().min(1).max(16).optional(),
  fonts: z.object(fontsShape).partial().optional(),
  light: z.partialRecord(colorToken, cssColorSchema).optional(),
  dark: z.partialRecord(colorToken, cssColorSchema).optional(),
  text: z.partialRecord(z.enum(TEXT_STYLES), textStyleSchema.partial()).optional(),
  strict: z.boolean().optional(),
});

export type Theme = z.infer<typeof themeSchema>;
export type ThemePatch = z.infer<typeof themePatchSchema>;

/** A project's theme as the API sends it: `saved` is false while the project uses the default. */
export const projectThemeSchema = z.object({
  projectId: z.uuid(),
  saved: z.boolean(),
  theme: themeSchema,
  css: z.string(),
});
export type ProjectTheme = z.infer<typeof projectThemeSchema>;

/**
 * shadcn/ui's default "neutral" theme, with Inter for text and Space Mono for code. Not strict:
 * boards without a theme of their own stay free-form.
 */
export const DEFAULT_THEME: Theme = {
  name: "Neutral",
  strict: false,
  text: DEFAULT_TEXT_STYLES,
  radius: 10,
  spacing: 4,
  fonts: { sans: "inter", heading: "inter", mono: "mono" },
  light: {
    background: "oklch(1 0 0)",
    foreground: "oklch(0.145 0 0)",
    card: "oklch(1 0 0)",
    "card-foreground": "oklch(0.145 0 0)",
    popover: "oklch(1 0 0)",
    "popover-foreground": "oklch(0.145 0 0)",
    primary: "oklch(0.205 0 0)",
    "primary-foreground": "oklch(0.985 0 0)",
    secondary: "oklch(0.97 0 0)",
    "secondary-foreground": "oklch(0.205 0 0)",
    muted: "oklch(0.97 0 0)",
    "muted-foreground": "oklch(0.556 0 0)",
    accent: "oklch(0.97 0 0)",
    "accent-foreground": "oklch(0.205 0 0)",
    destructive: "oklch(0.577 0.245 27.325)",
    border: "oklch(0.922 0 0)",
    input: "oklch(0.922 0 0)",
    ring: "oklch(0.708 0 0)",
    "chart-1": "oklch(0.646 0.222 41.116)",
    "chart-2": "oklch(0.6 0.118 184.704)",
    "chart-3": "oklch(0.398 0.07 227.392)",
    "chart-4": "oklch(0.828 0.189 84.429)",
    "chart-5": "oklch(0.769 0.188 70.08)",
    sidebar: "oklch(0.985 0 0)",
    "sidebar-foreground": "oklch(0.145 0 0)",
    "sidebar-primary": "oklch(0.205 0 0)",
    "sidebar-primary-foreground": "oklch(0.985 0 0)",
    "sidebar-accent": "oklch(0.97 0 0)",
    "sidebar-accent-foreground": "oklch(0.205 0 0)",
    "sidebar-border": "oklch(0.922 0 0)",
    "sidebar-ring": "oklch(0.708 0 0)",
  },
  dark: {
    background: "oklch(0.145 0 0)",
    foreground: "oklch(0.985 0 0)",
    card: "oklch(0.205 0 0)",
    "card-foreground": "oklch(0.985 0 0)",
    popover: "oklch(0.205 0 0)",
    "popover-foreground": "oklch(0.985 0 0)",
    primary: "oklch(0.922 0 0)",
    "primary-foreground": "oklch(0.205 0 0)",
    secondary: "oklch(0.269 0 0)",
    "secondary-foreground": "oklch(0.985 0 0)",
    muted: "oklch(0.269 0 0)",
    "muted-foreground": "oklch(0.708 0 0)",
    accent: "oklch(0.269 0 0)",
    "accent-foreground": "oklch(0.985 0 0)",
    destructive: "oklch(0.704 0.191 22.216)",
    border: "oklch(1 0 0 / 10%)",
    input: "oklch(1 0 0 / 15%)",
    ring: "oklch(0.556 0 0)",
    "chart-1": "oklch(0.488 0.243 264.376)",
    "chart-2": "oklch(0.696 0.17 162.48)",
    "chart-3": "oklch(0.769 0.188 70.08)",
    "chart-4": "oklch(0.627 0.265 303.9)",
    "chart-5": "oklch(0.645 0.246 16.439)",
    sidebar: "oklch(0.205 0 0)",
    "sidebar-foreground": "oklch(0.985 0 0)",
    "sidebar-primary": "oklch(0.488 0.243 264.376)",
    "sidebar-primary-foreground": "oklch(0.985 0 0)",
    "sidebar-accent": "oklch(0.269 0 0)",
    "sidebar-accent-foreground": "oklch(0.985 0 0)",
    "sidebar-border": "oklch(1 0 0 / 10%)",
    "sidebar-ring": "oklch(0.556 0 0)",
  },
};

/** `base` with `patch` applied on top. */
export function mergeTheme(base: Theme, patch: ThemePatch): Theme {
  return themeSchema.parse({
    name: patch.name ?? base.name,
    radius: patch.radius ?? base.radius,
    spacing: patch.spacing ?? base.spacing,
    fonts: { ...base.fonts, ...patch.fonts },
    light: { ...base.light, ...patch.light },
    dark: { ...base.dark, ...patch.dark },
    text: Object.fromEntries(
      TEXT_STYLES.map((name) => [name, { ...base.text[name], ...patch.text?.[name] }]),
    ),
    strict: patch.strict ?? base.strict,
  });
}

// ── Colors ────────────────────────────────────────────────────────────────

interface Rgba {
  /** 0–255. */
  r: number;
  g: number;
  b: number;
  /** 0–1. */
  a: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** A number, or a percentage of `percentOf`; "none" is 0. */
function channel(token: string | undefined, percentOf: number): number | null {
  if (token === undefined) return null;
  if (token === "none") return 0;
  const percent = token.endsWith("%");
  const n = Number.parseFloat(token);
  if (!Number.isFinite(n)) return null;
  return percent ? (n / 100) * percentOf : n;
}

/** An angle in degrees ("deg", "turn", "rad" or a bare number). */
function hue(token: string | undefined): number | null {
  if (token === undefined) return null;
  if (token === "none") return 0;
  const n = Number.parseFloat(token);
  if (!Number.isFinite(n)) return null;
  if (token.endsWith("turn")) return n * 360;
  if (token.endsWith("rad")) return (n * 180) / Math.PI;
  return n;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** OKLab to sRGB (0–255), clipped to the sRGB gamut. */
function oklabToRgb(L: number, A: number, B: number): [number, number, number] {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ] as const;
  const gamma = (c: number) =>
    255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);
  return [gamma(linear[0]), gamma(linear[1]), gamma(linear[2])];
}

const BARE_HSL = /^(-?[\d.]+)(deg)?\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+%?))?$/;

/** Reads a CSS color, or null when Prism can't. */
export function parseCssColor(input: string): Rgba | null {
  const value = input.trim().toLowerCase();
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (value === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (value === "black") return { r: 0, g: 0, b: 0, a: 1 };

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
    const byte = (i: number) => Number.parseInt(full.slice(i * 2, i * 2 + 2), 16);
    return { r: byte(0), g: byte(1), b: byte(2), a: full.length === 8 ? byte(3) / 255 : 1 };
  }

  // shadcn v3 themes keep bare HSL channels: "222.2 47.4% 11.2%".
  const bare = BARE_HSL.exec(value);
  if (bare) return parseCssColor(`hsl(${value})`);

  const fn = /^(rgba?|hsla?|oklch|oklab)\((.*)\)$/.exec(value);
  if (!fn?.[1] || fn[2] === undefined) return null;
  const parts = fn[2].replace(/[,/]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const alpha = parts[3] === undefined ? 1 : channel(parts[3], 1);
  if (alpha === null) return null;

  let rgb: [number, number, number];
  switch (fn[1]) {
    case "rgb":
    case "rgba": {
      const [r, g, b] = parts.slice(0, 3).map((p) => channel(p, 255));
      if (r == null || g == null || b == null) return null;
      rgb = [r, g, b];
      break;
    }
    case "hsl":
    case "hsla": {
      const h = hue(parts[0]);
      const s = channel(parts[1], 1);
      const l = channel(parts[2], 1);
      if (h === null || s === null || l === null) return null;
      // Without a % sign the saturation and lightness are 0–100.
      const fraction = (n: number, token: string | undefined) =>
        token?.endsWith("%") ? n : n / 100;
      rgb = hslToRgb(((h % 360) + 360) % 360, fraction(s, parts[1]), fraction(l, parts[2]));
      break;
    }
    case "oklch": {
      const L = channel(parts[0], 1);
      const C = channel(parts[1], 0.4);
      const h = hue(parts[2]);
      if (L === null || C === null || h === null) return null;
      const rad = (h * Math.PI) / 180;
      rgb = oklabToRgb(L, C * Math.cos(rad), C * Math.sin(rad));
      break;
    }
    default: {
      const L = channel(parts[0], 1);
      const A = channel(parts[1], 0.4);
      const B = channel(parts[2], 0.4);
      if (L === null || A === null || B === null) return null;
      rgb = oklabToRgb(L, A, B);
    }
  }
  const [r, g, b] = rgb.map((c) => clamp(c, 0, 255)) as [number, number, number];
  return { r, g, b, a: clamp(alpha, 0, 1) };
}

/** A CSS color as #rrggbb (#rrggbbaa when translucent), or null when Prism can't read it. */
export function cssColorToHex(value: string): string | null {
  const rgba = parseCssColor(value);
  if (!rgba) return null;
  const byte = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  const alpha = rgba.a < 1 ? byte(rgba.a * 255) : "";
  return `#${byte(rgba.r)}${byte(rgba.g)}${byte(rgba.b)}${alpha}`;
}

/** A color token's value in `mode`, as the hex the board draws. */
export function themeColorHex(theme: Theme, mode: ThemeMode, name: ThemeColor) {
  return cssColorToHex(theme[mode][name]) ?? "#000000";
}

// ── Resolving tokens ──────────────────────────────────────────────────────

type TokenValue = string | number;

/** The value `$name` sets on `field`, or null if it isn't a token for that field. */
function tokenValue(theme: Theme, mode: ThemeMode, field: TokenField, name: string) {
  if (COLOR_FIELDS.has(field)) return isThemeColor(name) ? themeColorHex(theme, mode, name) : null;
  if (field === "radius") {
    if (name === "radius-full") return RADIUS_FULL;
    return isRadius(name) ? Math.round(theme.radius * RADIUS_SCALE[name] * 10) / 10 : null;
  }
  if (field === "font") return isThemeFont(name) ? theme.fonts[name] : null;
  return null;
}

/** A text style's values as element fields, plus its font as a token. */
function textStyleFields(theme: Theme, name: TextStyleName) {
  const s = theme.text[name];
  return {
    fontSizePx: s.size,
    fontWeight: s.weight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    font: `$${s.font}` as ThemeRef,
  };
}

/** The text fields a text style sets; setting one by hand leaves the style. */
const TEXT_STYLE_FIELDS = ["fontSizePx", "fontWeight", "lineHeight", "letterSpacing", "fontSize"];

/** Explains unknown tokens and lists the valid ones, for an AI editor to correct itself. */
export function unknownTokensMessage(unknown: string[]) {
  const names = themeTokenNames();
  return [
    `Unknown theme token${unknown.length > 1 ? "s" : ""}: ${[...new Set(unknown)].join(", ")}.`,
    `Colors: ${names.colors.join(" ")}.`,
    `Text styles: ${names.textStyles.join(" ")}.`,
    `Radius: ${names.radius.join(" ")}.`,
    `Fonts: ${names.fonts.join(" ")}.`,
  ].join("\n");
}

/** Explains a strict theme's refusal of plain values. */
export function strictMessage(violations: string[]) {
  const names = themeTokenNames();
  return [
    `This project's theme is strict, so UI values come from its tokens. Not allowed: ${[...new Set(violations)].join(", ")}.`,
    `Colors: ${names.colors.join(" ")}.`,
    `Text: textStyle ${names.textStyles.join(" ")} (sets size, weight, line height, spacing and font).`,
    `Radius: ${names.radius.join(" ")} or 0.`,
    "Spacing: gaps, padding, spacers and icon sizes on the theme's spacing steps (4, 8, 12, 16, 24, … with the default 4px).",
    "If no token fits, add one to the theme with set_theme, or turn strict off there.",
  ].join("\n");
}

/** Element types a strict theme checks: UI. Notes, arrows, mind maps and charts stay free. */
const STRICT_TYPES = new Set<ElementType>([
  "text",
  "list",
  "rect",
  "ellipse",
  "diamond",
  "line",
  "icon",
  "frame",
]);

const plainColor = (value: unknown) =>
  typeof value === "string" && !isThemeRef(value) && value !== "transparent";
const plainRadius = (value: unknown): boolean =>
  Array.isArray(value) ? value.some(plainRadius) : typeof value === "number" && value !== 0;

/**
 * The token binding of a per-corner radius set with `$radius-*` tokens: each corner reads back as
 * the token whose value it holds (boundTokens).
 */
const CORNER_TOKENS = "corners";

/** The `$radius-*` token whose value is `px`, if any. */
function radiusTokenFor(theme: Theme, px: number): ThemeRef | null {
  if (px === RADIUS_FULL) return "$radius-full";
  const name = (Object.keys(RADIUS_SCALE) as (keyof typeof RADIUS_SCALE)[]).find((n) =>
    near(tokenValue(theme, "light", "radius", n) as number, px),
  );
  return name ? `$${name}` : null;
}

/** A gradient with each stop's `$color` token resolved and remembered on the stop. */
function resolveGradient(
  gradient: Gradient,
  theme: Theme,
  mode: ThemeMode,
  unknown: string[],
): Gradient {
  const stops = gradient.stops.map(({ token: _, ...stop }) => {
    if (!isThemeRef(stop.color)) return stop;
    const resolved = tokenValue(theme, mode, "fill", stop.color.slice(1));
    if (typeof resolved === "string")
      return { ...stop, color: resolved, token: stop.color.slice(1) };
    unknown.push(`gradient color: ${stop.color}`);
    return { ...stop, color: "#000000" };
  });
  return { ...gradient, stops };
}

/** Custom shadow layers with their `$color` tokens resolved; presets pass through. */
function resolveShadow(
  shadow: Shadow | undefined,
  theme: Theme,
  mode: ThemeMode,
  unknown: string[],
): Shadow | undefined {
  if (!Array.isArray(shadow)) return shadow;
  return shadow.map((layer) => {
    if (!isThemeRef(layer.color)) return layer;
    const resolved = tokenValue(theme, mode, "fill", layer.color.slice(1));
    if (typeof resolved === "string") return { ...layer, color: resolved };
    unknown.push(`shadow color: ${layer.color}`);
    return { ...layer, color: "#000000" };
  });
}

/** Per-corner radius with its `$radius-*` tokens resolved to px; unknown tokens become 0. */
function resolveCorners(
  corners: readonly TokenValue[],
  theme: Theme,
  mode: ThemeMode,
  unknown: string[],
): Radius {
  const px = corners.map((corner) => {
    if (!isThemeRef(corner)) return Number(corner);
    const resolved = tokenValue(theme, mode, "radius", corner.slice(1));
    if (typeof resolved === "number") return resolved;
    unknown.push(`radius: ${corner}`);
    return 0;
  });
  return [px[0] ?? 0, px[1] ?? 0, px[2] ?? 0, px[3] ?? 0];
}

/** What a strict theme refuses in an element's fields: plain colors, radius, fonts, text sizes. */
export function strictViolations(fields: Record<string, unknown>, type: ElementType) {
  if (!STRICT_TYPES.has(type)) return [];
  const out: string[] = [];
  for (const field of ["stroke", "fill"]) {
    if (plainColor(fields[field])) out.push(`${field} ${String(fields[field])}`);
  }
  for (const stop of (fields["gradient"] as Gradient | null | undefined)?.stops ?? []) {
    if (plainColor(stop.color)) out.push(`gradient color ${stop.color}`);
  }
  if (plainRadius(fields["radius"])) out.push(`radius ${String(fields["radius"])}`);
  if (typeof fields["font"] === "string" && !isThemeRef(fields["font"])) {
    out.push(`font ${fields["font"]}`);
  }
  for (const field of TEXT_STYLE_FIELDS) {
    if (fields[field] !== undefined && fields[field] !== null) out.push(field);
  }
  return out;
}

/**
 * Replaces `$token` values in an element's fields (create or update) with the theme's values and
 * records the tokens. `textStyle: "$h1"` sets the text's size, weight, line height, spacing and
 * font. A field set to a plain value drops its token. `current` is the element's tokens before an
 * update. `tokens` is undefined when there's nothing to store or clear.
 */
export function resolveElementTokens<T extends Record<string, unknown>>(
  fields: T,
  theme: Theme,
  mode: ThemeMode,
  current?: ElementTokens | null,
) {
  const out: Record<string, unknown> = { ...fields };
  const tokens: ElementTokens = { ...current };
  const unknown: string[] = [];
  let changed = false;

  if ("textStyle" in fields) {
    const value = fields["textStyle"];
    delete out["textStyle"];
    const name = isThemeRef(value) ? value.slice(1) : null;
    if (name !== null && isTextStyle(name)) {
      const styled = textStyleFields(theme, name);
      for (const [key, v] of Object.entries(styled)) out[key] = fields[key] ?? v;
      tokens.textStyle = name;
      changed = true;
    } else if (name !== null) unknown.push(`textStyle: ${String(value)}`);
    else if (tokens.textStyle !== undefined) {
      delete tokens.textStyle;
      changed = true;
    }
  } else if (tokens.textStyle !== undefined && TEXT_STYLE_FIELDS.some((f) => f in fields)) {
    delete tokens.textStyle;
    changed = true;
  }

  if (Array.isArray(out["shadow"])) {
    out["shadow"] = resolveShadow(out["shadow"] as Shadow, theme, mode, unknown);
  }
  const gradient = out["gradient"] as Gradient | null | undefined;
  if (gradient) {
    // The fill keeps the gradient's first color (and its token), for contrast checks and readers
    // that don't draw gradients.
    if (!("fill" in fields)) out["fill"] = gradient.stops[0]?.color ?? null;
    out["gradient"] = resolveGradient(gradient, theme, mode, unknown);
  }

  for (const field of ["stroke", "fill", "textColor", "radius", "font"] as const) {
    if (!(field in out)) continue;
    const value = out[field];
    if (field === "radius" && Array.isArray(value)) {
      out[field] = resolveCorners(value as TokenValue[], theme, mode, unknown);
      if (value.some(isThemeRef)) tokens.radius = CORNER_TOKENS;
      else delete tokens.radius;
      changed = true;
      continue;
    }
    if (isThemeRef(value)) {
      const resolved = tokenValue(theme, mode, field, value.slice(1));
      if (resolved === null) unknown.push(`${field}: ${value}`);
      else {
        out[field] = resolved;
        tokens[field] = value.slice(1);
        changed = true;
      }
    } else if (tokens[field] !== undefined) {
      delete tokens[field];
      changed = true;
    }
  }
  const hasTokens = Object.keys(tokens).length > 0;
  const next = changed ? (hasTokens ? tokens : current ? null : undefined) : undefined;
  return { fields: out, tokens: next, unknown };
}

/**
 * A layout tree (create_screen) with its `$token` values replaced by the theme's, each node
 * remembering its tokens for the elements it draws. Text without a textStyle or size gets $body,
 * text and icons without a color $foreground, dividers $border. `defaultFont` (the call's font)
 * wins over a text style's font. With `strict`, plain colors, radius, fonts and text sizes come
 * back as violations.
 */
export function resolveLayoutTokens(
  root: LayoutNode,
  theme: Theme,
  mode: ThemeMode,
  defaultFont?: FontFamily,
  strict = false,
) {
  const unknown: string[] = [];
  const violations: string[] = [];
  if (strict && defaultFont) violations.push(`font ${defaultFont}`);

  // Gaps, padding, spacers and icon sizes stay on the spacing scale's half-steps (Tailwind's
  // p-0.5, p-1, p-1.5, …), so p-4 in code is 16px on the board.
  const step = theme.spacing / 2;
  const offGrid = (what: string, value: number | number[] | "fill" | undefined) => {
    if (!strict || value === undefined || value === "fill") return;
    for (const v of Array.isArray(value) ? value : [value]) {
      if (Math.abs(v / step - Math.round(v / step)) > 1e-6) {
        violations.push(`${what} ${v} (not a multiple of ${step}px)`);
      }
    }
  };

  /** A box's or container's fill and gradient; the fill defaults to the gradient's first color. */
  function paint(
    node: { fill?: string | undefined; gradient?: Gradient | undefined },
    tokens: ElementTokens,
  ) {
    if (!node.gradient) return { fill: resolve("fill", node.fill, tokens) as string | undefined };
    if (strict) {
      for (const stop of node.gradient.stops) {
        if (plainColor(stop.color)) violations.push(`gradient color ${stop.color}`);
      }
    }
    return {
      fill: resolve("fill", node.fill ?? node.gradient.stops[0]?.color, tokens) as
        string | undefined,
      gradient: resolveGradient(node.gradient, theme, mode, unknown),
    };
  }

  function resolveRadius(value: LayoutRadius | undefined, tokens: ElementTokens) {
    if (!Array.isArray(value)) return resolve("radius", value, tokens) as number | undefined;
    if (strict && plainRadius(value)) violations.push(`radius [${value.join(", ")}]`);
    if (value.some(isThemeRef)) tokens.radius = CORNER_TOKENS;
    return resolveCorners(value, theme, mode, unknown);
  }

  function resolve(field: TokenField, value: TokenValue | undefined, tokens: ElementTokens) {
    if (!isThemeRef(value)) {
      if (strict && field !== "font" && (plainColor(value) || plainRadius(value))) {
        violations.push(`${field === "stroke" ? "color" : field} ${String(value)}`);
      }
      return value;
    }
    const resolved = tokenValue(theme, mode, field, value.slice(1));
    if (resolved === null) {
      unknown.push(value);
      return undefined;
    }
    tokens[field] = value.slice(1);
    return resolved;
  }

  function visit(node: LayoutNode): LayoutNode {
    const tokens: ElementTokens = {};
    const withTokens = <N extends LayoutNode>(resolved: N): N =>
      Object.keys(tokens).length > 0 ? { ...resolved, tokens } : resolved;
    switch (node.type) {
      case "spacer":
        offGrid("spacer", node.size);
        return node;
      // Expanded before tokens are resolved (components.ts).
      case "use":
      case "slot":
        return node;
      case "text": {
        if (strict) {
          for (const field of [
            "fontSizePx",
            "fontWeight",
            "lineHeight",
            "letterSpacing",
          ] as const) {
            if (node[field] !== undefined)
              violations.push(`${field} on "${node.text.slice(0, 30)}"`);
          }
          if (node.font !== undefined && !isThemeRef(node.font))
            violations.push(`font ${node.font}`);
        }
        const ref = node.textStyle ?? (node.fontSizePx === undefined ? "$body" : undefined);
        let styled: Partial<ReturnType<typeof textStyleFields>> = {};
        if (ref !== undefined) {
          const name = ref.slice(1);
          if (isTextStyle(name)) {
            styled = textStyleFields(theme, name);
            tokens.textStyle = name;
          } else unknown.push(ref);
        }
        return withTokens({
          ...node,
          fontSizePx: node.fontSizePx ?? styled.fontSizePx,
          fontWeight: node.fontWeight ?? styled.fontWeight,
          lineHeight: node.lineHeight ?? styled.lineHeight,
          letterSpacing: node.letterSpacing ?? styled.letterSpacing,
          color: resolve("stroke", node.color ?? "$foreground", tokens) as string | undefined,
          font: resolve("font", node.font ?? defaultFont ?? styled.font ?? "$sans", tokens) as
            FontFamily | undefined,
        });
      }
      case "icon":
        offGrid("icon size", node.size);
        return withTokens({
          ...node,
          color: resolve("stroke", node.color ?? "$foreground", tokens) as string | undefined,
        });
      case "divider":
        return withTokens({
          ...node,
          color: resolve("stroke", node.color ?? "$border", tokens) as string | undefined,
        });
      case "box":
        return withTokens({
          ...node,
          ...paint(node, tokens),
          stroke: resolve("stroke", node.stroke, tokens) as string | undefined,
          radius: resolveRadius(node.radius, tokens),
          shadow: resolveShadow(node.shadow, theme, mode, unknown),
        });
      default:
        offGrid("gap", node.gap);
        offGrid("padding", node.padding);
        return withTokens({
          ...node,
          ...paint(node, tokens),
          stroke: resolve("stroke", node.stroke, tokens) as string | undefined,
          radius: resolveRadius(node.radius, tokens),
          shadow: resolveShadow(node.shadow, theme, mode, unknown),
          children: node.children.map(visit),
        });
    }
  }

  return { root: visit(root), unknown, violations };
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.001;
const weightOf = (weight: BoardElement["fontWeight"]) =>
  weight === "bold" ? 700 : weight === "normal" || weight === undefined ? 400 : weight;

/**
 * The element's fields that still hold their token's value, as `$token`s: { fill: "$primary",
 * textStyle: "$h1" }. A field changed by hand since no longer counts.
 */
export function boundTokens(el: BoardElement, theme: Theme) {
  const bound: Partial<Record<Exclude<TokenField, "radius">, ThemeRef>> & {
    radius?: ThemeRef | (ThemeRef | number)[];
    gradient?: Gradient;
  } = {};
  if (el.gradient) {
    const stops = el.gradient.stops.map(({ token, ...stop }) => {
      const holds =
        token !== undefined &&
        THEME_MODES.some(
          (mode) =>
            tokenValue(theme, mode, "fill", token)?.toString().toLowerCase() ===
            stop.color.toLowerCase(),
        );
      return holds ? { ...stop, color: `$${token}` } : stop;
    });
    bound.gradient = { ...el.gradient, stops };
  }
  for (const [field, name] of Object.entries(el.tokens ?? {}) as [TokenField, string][]) {
    if (field === "radius" && name === CORNER_TOKENS) {
      if (Array.isArray(el.radius)) {
        bound.radius = el.radius.map((px) => (px === 0 ? 0 : (radiusTokenFor(theme, px) ?? px)));
      }
      continue;
    }
    if (field === "textStyle") {
      const s = isTextStyle(name) ? theme.text[name] : undefined;
      if (
        s &&
        el.fontSizePx === s.size &&
        weightOf(el.fontWeight) === s.weight &&
        near(el.lineHeight ?? 1.25, s.lineHeight) &&
        near(el.letterSpacing ?? 0, s.letterSpacing)
      ) {
        bound.textStyle = `$${name}`;
      }
      continue;
    }
    const actual = el[field];
    if (actual === undefined || actual === null) continue;
    const holds = THEME_MODES.some((mode) => {
      const expected = tokenValue(theme, mode, field, name);
      return typeof expected === "string" && typeof actual === "string"
        ? expected.toLowerCase() === actual.toLowerCase()
        : expected === actual;
    });
    if (holds) bound[field] = `$${name}`;
  }
  return bound;
}

// ── CSS ───────────────────────────────────────────────────────────────────

/** CSS family names of the built-in board fonts. */
const FONT_FAMILIES: Record<BuiltinFont, string> = {
  sans: "DM Sans",
  inter: "Inter",
  roboto: "Roboto",
  "open-sans": "Open Sans",
  montserrat: "Montserrat",
  poppins: "Poppins",
  lato: "Lato",
  playfair: "Playfair Display",
  merriweather: "Merriweather",
  mono: "Space Mono",
  caveat: "Caveat",
  "nanum-pen": "Nanum Pen Script",
  kalam: "Kalam",
  "patrick-hand": "Patrick Hand",
  "indie-flower": "Indie Flower",
};
const SERIF_FONTS = new Set<FontFamily>(["playfair", "merriweather"]);
const HAND_FONTS = new Set<FontFamily>([
  "caveat",
  "nanum-pen",
  "kalam",
  "patrick-hand",
  "indie-flower",
]);

/** A board font's CSS family name: "Inter", or "Lobster" for "gf:Lobster". */
export function fontFamilyName(font: FontFamily) {
  return font.startsWith("gf:") ? font.slice(3) : FONT_FAMILIES[font as BuiltinFont];
}

function fontStack(font: FontFamily, slot: ThemeFont) {
  const generic =
    slot === "mono" || font === "mono"
      ? "ui-monospace, SFMono-Regular, Menlo, monospace"
      : SERIF_FONTS.has(font)
        ? "ui-serif, Georgia, serif"
        : HAND_FONTS.has(font)
          ? "cursive"
          : "ui-sans-serif, system-ui, sans-serif";
  return `"${fontFamilyName(font)}", ${generic}`;
}

const rem = (px: number) => `${Math.round((px / 16) * 1000) / 1000}rem`;

/**
 * The theme as Tailwind v4 + shadcn/ui CSS: the `@theme inline` mapping and the `:root` / `.dark`
 * variables, to replace those blocks in the app's global CSS.
 */
export function themeToCss(theme: Theme) {
  const vars = (mode: ThemeMode) =>
    THEME_COLORS.map((name) => `  --${name}: ${theme[mode][name]};`);
  return [
    `/* Prism theme${theme.name ? `: ${theme.name}` : ""}. Tailwind v4 + shadcn/ui. */`,
    `@custom-variant dark (&:is(.dark *));`,
    ``,
    `@theme inline {`,
    `  --spacing: ${rem(theme.spacing)};`,
    ...THEME_COLORS.map((name) => `  --color-${name}: var(--${name});`),
    ...Object.entries(RADIUS_SCALE).map(([name, scale]) =>
      scale === 1 ? `  --${name}: var(--radius);` : `  --${name}: calc(var(--radius) * ${scale});`,
    ),
    ...THEME_FONTS.map((slot) => `  --font-${slot}: ${fontStack(theme.fonts[slot], slot)};`),
    ...TEXT_STYLES.flatMap((name) => {
      const s = theme.text[name];
      return [
        `  --text-${name}: ${rem(s.size)};`,
        `  --text-${name}--line-height: ${s.lineHeight};`,
        `  --text-${name}--letter-spacing: ${s.letterSpacing}em;`,
        `  --text-${name}--font-weight: ${s.weight};`,
      ];
    }),
    `}`,
    ``,
    `:root {`,
    `  --radius: ${rem(theme.radius)};`,
    ...vars("light"),
    `}`,
    ``,
    `.dark {`,
    ...vars("dark"),
    `}`,
    ``,
  ].join("\n");
}

/** A length in px: "0.625rem", "10px", "0.5em" (16px root), or null. */
function lengthPx(value: string) {
  const match = /^(-?[\d.]+)(rem|px|em)?$/.exec(value.trim());
  if (!match?.[1]) return null;
  const n = Number.parseFloat(match[1]);
  if (!Number.isFinite(n)) return null;
  return match[2] === "px" || (match[2] === undefined && n > 4) ? n : n * 16;
}

/** The board font for a CSS font list: its first family, if it's a board or Google font. */
function fontFromStack(stack: string): FontFamily | null {
  const first =
    stack
      .split(",")[0]
      ?.trim()
      .replace(/^["']|["']$/g, "") ?? "";
  const family = first.replace(/ Variable$/i, "");
  if (!family || /^(ui-|system-ui|sans-serif|serif|monospace|cursive|var\()/i.test(family)) {
    return null;
  }
  const builtin = (Object.entries(FONT_FAMILIES) as [BuiltinFont, string][]).find(
    ([, name]) => name.toLowerCase() === family.toLowerCase(),
  );
  if (builtin) return builtin[0];
  return googleFontNameSchema.safeParse(family).success ? `gf:${family}` : null;
}

/** Every custom property (`--name: value`) in a stylesheet, with the selectors it's nested in. */
function customProperties(css: string) {
  const found: { selectors: string[]; name: string; value: string }[] = [];
  const stack: string[] = [];
  let buffer = "";
  const flush = () => {
    const decl = /^--([\w-]+)\s*:\s*([\s\S]+)$/.exec(buffer.trim());
    if (decl?.[1] && decl[2])
      found.push({ selectors: [...stack], name: decl[1], value: decl[2].trim() });
    buffer = "";
  };
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (char === "{") {
      stack.push(buffer.trim());
      buffer = "";
    } else if (char === "}") {
      flush();
      stack.pop();
    } else if (char === ";") flush();
    else buffer += char;
  }
  return found;
}

/**
 * Reads a theme from an app's global CSS (shadcn/ui `:root` and `.dark` variables, `--radius`,
 * `--font-*`), on top of `base`. `var()` references between variables are followed. Returns
 * what it found and the color variables it couldn't read.
 */
export function parseThemeCss(css: string, base: Theme = DEFAULT_THEME) {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  for (const { selectors, name, value } of customProperties(css)) {
    const isDark = selectors.some((s) =>
      /\.dark\b|\[data-theme=["']?dark|prefers-color-scheme:\s*dark/.test(s),
    );
    (isDark ? dark : light).set(name, value);
  }

  const lookup = (name: string, vars: Map<string, string>, depth = 0): string | undefined => {
    const value = vars.get(name) ?? light.get(name);
    if (value === undefined || depth > 8) return value;
    const ref = /^var\(\s*--([\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value);
    if (!ref?.[1]) return value;
    return lookup(ref[1], vars, depth + 1) ?? ref[2]?.trim();
  };

  const found: string[] = [];
  const skipped: string[] = [];
  const palette = (vars: Map<string, string>, label: string) => {
    const out: Partial<Record<ThemeColor, string>> = {};
    for (const name of THEME_COLORS) {
      if (!vars.has(name)) continue;
      const raw = lookup(name, vars);
      const value = raw && BARE_HSL.test(raw.trim()) ? `hsl(${raw.trim()})` : raw?.trim();
      if (value && parseCssColor(value)) {
        out[name] = value;
        found.push(`${label}.${name}`);
      } else skipped.push(`${label}.${name}`);
    }
    return out;
  };

  const radiusRaw = lookup("radius", light);
  const radius = radiusRaw ? lengthPx(radiusRaw) : null;
  if (radius !== null) found.push("radius");
  const spacingRaw = lookup("spacing", light);
  const spacing = spacingRaw ? lengthPx(spacingRaw) : null;
  if (spacing !== null) found.push("spacing");
  const fonts: Partial<Record<ThemeFont, FontFamily>> = {};
  for (const [slot, names] of [
    ["sans", ["font-sans"]],
    ["heading", ["font-heading", "font-display"]],
    ["mono", ["font-mono"]],
  ] as const) {
    for (const name of names) {
      const stack = lookup(name, light);
      const font = stack ? fontFromStack(stack) : null;
      if (font) {
        fonts[slot] = font;
        found.push(`fonts.${slot}`);
        break;
      }
    }
  }
  // An app without a heading font uses its sans font for headings.
  if (fonts.sans && !fonts.heading) fonts.heading = fonts.sans;

  // A type scale exported by themeToCss (--text-h1 and its --line-height, … modifiers).
  const text: Partial<Record<TextStyleName, Partial<TextStyle>>> = {};
  for (const name of TEXT_STYLES) {
    const sizeRaw = lookup(`text-${name}`, light);
    const size = sizeRaw ? lengthPx(sizeRaw) : null;
    if (size === null) continue;
    const number = (suffix: string) => {
      const n = Number.parseFloat(lookup(`text-${name}--${suffix}`, light) ?? "");
      return Number.isFinite(n) ? n : undefined;
    };
    const lineHeight = number("line-height");
    const letterSpacing = number("letter-spacing");
    const weight = number("font-weight");
    text[name] = {
      size,
      ...(lineHeight !== undefined && { lineHeight }),
      ...(letterSpacing !== undefined && { letterSpacing }),
      ...(weight !== undefined && { weight }),
    };
    found.push(`text.${name}`);
  }

  const theme = mergeTheme(base, {
    ...(radius !== null && { radius: clamp(radius, 0, 64) }),
    ...(spacing !== null && { spacing: clamp(spacing, 1, 16) }),
    fonts,
    light: palette(light, "light"),
    dark: palette(dark, "dark"),
    text,
  });
  return { theme, found, skipped };
}

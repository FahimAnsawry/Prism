// Board fonts: the self-hosted ones (imported in index.css) and Google fonts a board adds by
// name. Text is measured on a canvas, which only uses a web font once it has loaded, so every
// font goes through loadFont() before text is laid out with it.

import type { BoardElement, BuiltinFont, FontFamily, FontSize } from "@prism/shared";
import "./board-fonts.css";

export type FontCategory = "sans" | "serif" | "mono" | "handwriting";

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: "sans", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "mono", label: "Mono" },
  { id: "handwriting", label: "Handwriting" },
];

interface FontInfo {
  label: string;
  /** The family the browser knows it by (for document.fonts.load). */
  family: string;
  /** The full CSS font-family list, fallbacks included. */
  stack: string;
  category: FontCategory;
  /** The weights it ships (index.css imports each one), lightest first. */
  weights: number[];
  /** Pixel sizes behind S / M / L / XL, when the font runs small or large. */
  sizes?: Record<FontSize, number>;
}

const SANS = "ui-sans-serif, system-ui, sans-serif";
const SERIF = "ui-serif, Georgia, serif";
const HAND = '"Comic Sans MS", cursive';

/** Light through Black. */
const ALL_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

const sans = (family: string, weights = ALL_WEIGHTS): FontInfo => ({
  label: family,
  family,
  stack: `"${family}", ${SANS}`,
  category: "sans",
  weights,
});

export const BUILTIN_FONT_INFO: Record<BuiltinFont, FontInfo> = {
  sans: {
    label: "DM Sans",
    family: "DM Sans Variable",
    stack: `"DM Sans Variable", "DM Sans", ${SANS}`,
    category: "sans",
    weights: ALL_WEIGHTS,
  },
  inter: sans("Inter"),
  roboto: sans("Roboto"),
  "open-sans": sans("Open Sans", [300, 400, 500, 600, 700, 800]),
  montserrat: sans("Montserrat"),
  poppins: sans("Poppins"),
  lato: sans("Lato", [300, 400, 700, 900]),
  playfair: {
    label: "Playfair Display",
    family: "Playfair Display",
    stack: `"Playfair Display", ${SERIF}`,
    category: "serif",
    weights: [400, 500, 600, 700, 800, 900],
  },
  merriweather: {
    label: "Merriweather",
    family: "Merriweather",
    stack: `"Merriweather", ${SERIF}`,
    category: "serif",
    weights: ALL_WEIGHTS,
  },
  mono: {
    label: "Space Mono",
    family: "Space Mono",
    stack:
      '"Space Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    category: "mono",
    weights: [400, 700],
    sizes: { S: 14, M: 18, L: 24, XL: 32 },
  },
  caveat: {
    label: "Caveat",
    family: "Caveat",
    stack: `"Caveat", ${HAND}`,
    category: "handwriting",
    weights: [400, 500, 600, 700],
    sizes: { S: 20, M: 26, L: 34, XL: 44 },
  },
  "nanum-pen": {
    label: "Nanum Pen",
    family: "Nanum Pen Script",
    stack: `"Nanum Pen Script", ${HAND}`,
    category: "handwriting",
    weights: [400],
    sizes: { S: 22, M: 30, L: 38, XL: 50 },
  },
  kalam: {
    label: "Kalam",
    family: "Kalam",
    stack: `"Kalam", ${HAND}`,
    category: "handwriting",
    weights: [300, 400, 700],
  },
  "patrick-hand": {
    label: "Patrick Hand",
    family: "Patrick Hand",
    stack: `"Patrick Hand", ${HAND}`,
    category: "handwriting",
    weights: [400],
    sizes: { S: 18, M: 24, L: 32, XL: 42 },
  },
  "indie-flower": {
    label: "Indie Flower",
    family: "Indie Flower",
    stack: `"Indie Flower", ${HAND}`,
    category: "handwriting",
    weights: [400],
  },
};

export const BUILTIN_FONT_IDS = Object.keys(BUILTIN_FONT_INFO) as BuiltinFont[];

/** Pixel sizes for fonts without their own (DM Sans's, and any Google font). */
export const DEFAULT_SIZES: Record<FontSize, number> = { S: 16, M: 22, L: 30, XL: 40 };

const GOOGLE_PREFIX = "gf:";

export const googleFontId = (family: string): FontFamily => `gf:${family}`;

/** The Google Fonts family name behind a "gf:" id, or null for a built-in font. */
export function googleFamily(font: FontFamily) {
  return font.startsWith(GOOGLE_PREFIX) ? font.slice(GOOGLE_PREFIX.length) : null;
}

export function fontInfo(font: FontFamily): FontInfo {
  const google = googleFamily(font);
  if (google !== null) {
    // Only the regular style is requested (not every family has a bold); bold is synthesized.
    return {
      label: google,
      family: google,
      stack: `"${google}", ${SANS}`,
      category: "sans",
      weights: [400, 700],
    };
  }
  return BUILTIN_FONT_INFO[font as BuiltinFont] ?? BUILTIN_FONT_INFO.sans;
}

export const fontStack = (font: FontFamily) => fontInfo(font).stack;

export const WEIGHT_NAMES: Record<number, string> = {
  100: "Thin",
  200: "Extra light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra bold",
  900: "Black",
};

/** An element's weight as a number ("normal" / "bold" come from older elements). */
export function weightOf(el: Pick<BoardElement, "fontWeight">) {
  const w = el.fontWeight;
  if (w === "bold") return 700;
  if (w === undefined || w === "normal") return 400;
  return w;
}

/** The weight of `font` closest to `weight` (ties go to the heavier one). */
export function nearestWeight(font: FontFamily, weight: number) {
  return fontInfo(font).weights.reduce((best, w) => {
    const d = Math.abs(w - weight);
    const bestD = Math.abs(best - weight);
    return d < bestD || (d === bestD && w > best) ? w : best;
  });
}

export const isHandwriting = (font: FontFamily | undefined) =>
  font !== undefined && fontInfo(font).category === "handwriting";

// ── Loading ───────────────────────────────────────────────────────────────

const stylesheets = new Map<string, Promise<boolean>>();
const loading = new Map<string, Promise<boolean>>();

/** Adds the Google Fonts stylesheet for `family`; resolves false if Google doesn't know it. */
function addGoogleStylesheet(family: string) {
  return new Promise<boolean>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`;
    link.dataset.boardFont = family;
    link.onload = () => resolve(true);
    link.onerror = () => {
      link.remove();
      resolve(false);
    };
    document.head.append(link);
  });
}

/** Adds each family's stylesheet once; one that failed can be tried again. */
function googleStylesheet(family: string) {
  let pending = stylesheets.get(family);
  if (!pending) {
    pending = addGoogleStylesheet(family);
    stylesheets.set(family, pending);
    void pending.then((ok) => {
      if (!ok) stylesheets.delete(family);
    });
  }
  return pending;
}

/**
 * Loads one weight of a board font and resolves whether the font exists. Each weight loads
 * once; a failed load can be tried again.
 */
export function loadFont(font: FontFamily, weight = 400): Promise<boolean> {
  const key = `${font}|${weight}`;
  let pending = loading.get(key);
  if (!pending) {
    pending = (async () => {
      const google = googleFamily(font);
      if (google !== null && !(await googleStylesheet(google))) return false;
      const { family } = fontInfo(font);
      try {
        const faces = await document.fonts.load(`${weight} 16px "${family}"`);
        return faces.length > 0;
      } catch {
        return false;
      }
    })();
    loading.set(key, pending);
    void pending.then((ok) => {
      if (!ok) loading.delete(key);
    });
  }
  return pending;
}

/**
 * Loads each font in the weight given (400 if none), giving up after `timeout` ms so a slow
 * network never blocks the board.
 */
export async function loadFonts(
  fonts: Iterable<FontFamily | readonly [FontFamily, number]>,
  timeout = 3_000,
) {
  const pairs = new Map<string, readonly [FontFamily, number]>();
  for (const entry of fonts) {
    const pair = typeof entry === "string" ? ([entry, 400] as const) : entry;
    pairs.set(`${pair[0]}|${pair[1]}`, pair);
  }
  await Promise.race([
    Promise.allSettled([...pairs.values()].map(([font, weight]) => loadFont(font, weight))),
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ]);
}

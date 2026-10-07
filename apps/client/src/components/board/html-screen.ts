// create_screen with html (tools.md §6): an AI editor's HTML + Tailwind is rendered here, in a
// hidden sandboxed iframe styled with the project theme, and read back as board elements where
// the browser put them: painted boxes as rects, text as text, Lucide icons, photos, avatars and
// inline SVGs. Project components (<x-use>) are drawn by the board's own layout engine, at the
// size the page gives them. Theme classes (bg-primary, text-h1, rounded-lg, …) come back as
// $tokens, so the board remembers them the way it does for layout trees.

import {
  avatarUrl,
  AVATAR_STYLES,
  type AvatarStyle,
  BACKDROP_BLUR_MAX,
  type Components,
  cssColorToHex,
  expandComponents,
  FONT_PX_MAX,
  FONT_PX_MIN,
  type FontFamily,
  type Gradient,
  type HtmlScreenReply,
  type HtmlScreenRequest,
  iconNameSchema,
  LAYOUT_NODES_MAX,
  type LayoutElement,
  layoutFonts,
  type LayoutImageStore,
  type LayoutNode,
  layoutScreen,
  type LayoutUse,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  PENDING_ASSET,
  type PendingAsset,
  RADIUS_SCALE,
  resolveElementTokens,
  resolveLayoutTokens,
  storeLayoutImages,
  strictViolations,
  TEXT_STYLES,
  type TextStyleName,
  type Theme,
  THEME_COLORS,
  THEME_FONTS,
  themeColorHex,
  type ThemeColor,
  type ThemeFont,
  type ThemeMode,
  themeToCss,
} from "@prism/shared";
import type { compile } from "tailwindcss";
import { BUILTIN_FONT_IDS, fontInfo, fontStack, googleFamily, loadFonts } from "./fonts";
import { boardMeasure, resetMeasurements } from "./text-layout";

/** A problem the AI editor can fix in its HTML: sent back as the tool's error. */
class HtmlScreenError extends Error {}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Corners = [number, number, number, number];
type Corner = number | `$${string}`;
type Fields = Record<string, unknown> & { type: LayoutElement["type"] };

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ── Tailwind ──────────────────────────────────────────────────────────────

type TailwindModule = { compile: typeof compile; css: string };
let tailwind: Promise<TailwindModule> | null = null;

/** Tailwind's compiler and stylesheet, loaded the first time an HTML screen is drawn. */
function loadTailwind() {
  tailwind ??= Promise.all([import("tailwindcss"), import("tailwindcss/index.css?raw")]).then(
    ([module, css]) => ({ compile: module.compile, css: css.default }),
    (error: unknown) => {
      tailwind = null;
      throw error;
    },
  );
  return tailwind;
}

/** The CSS for the page: Tailwind with the project theme, the board's fonts and a few defaults. */
async function pageCss(theme: Theme, candidates: Iterable<string>, bodyFont: string | null) {
  const { compile, css } = await loadTailwind();
  const input = [
    `@import "tailwindcss";`,
    themeToCss(theme),
    // The board's own font stacks, so the page measures text with the fonts the board draws.
    `@theme inline {`,
    ...THEME_FONTS.map((slot) => `  --font-${slot}: ${fontStack(theme.fonts[slot])};`),
    `}`,
    `@layer base {`,
    `  *, ::after, ::before, ::backdrop { border-color: var(--border); }`,
    `  body { font-family: ${bodyFont ?? "var(--font-sans)"}; color: var(--foreground); background-color: var(--background); }`,
    `  [data-icon] { display: inline-block; width: 1em; height: 1em; flex-shrink: 0; vertical-align: middle; }`,
    `  x-use { display: inline-block; vertical-align: top; }`,
    `}`,
  ].join("\n");
  const compiler = await compile(input, {
    base: "/",
    loadStylesheet: async (id, base) => {
      if (id === "tailwindcss") return { path: "tailwindcss/index.css", base, content: css };
      throw new HtmlScreenError(`Only Tailwind itself can be imported (got @import "${id}").`);
    },
  });
  return compiler.build([...candidates]);
}

// ── Fonts ─────────────────────────────────────────────────────────────────

let fontFaces: string | null = null;

/** The board's @font-face rules with absolute URLs, for the page to load the same files. */
function boardFontFaces() {
  if (fontFaces) return fontFaces;
  const out: string[] = [];
  const rulesOf = (sheet: CSSStyleSheet): Iterable<CSSRule> => {
    try {
      return sheet.cssRules;
    } catch {
      return []; // Another origin's stylesheet (Google Fonts): copied as a <link> instead.
    }
  };
  const absolute = (css: string, base: string) =>
    css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (_, _q: string, url: string) => {
      try {
        return `url("${new URL(url, base).href}")`;
      } catch {
        return `url("${url}")`;
      }
    });
  const visit = (rules: Iterable<CSSRule>, base: string) => {
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) out.push(absolute(rule.cssText, base));
      else if (rule instanceof CSSImportRule && rule.styleSheet) {
        visit(rulesOf(rule.styleSheet), rule.styleSheet.href ?? base);
      } else if (rule instanceof CSSGroupingRule) visit(rule.cssRules, base);
    }
  };
  for (const sheet of document.styleSheets) visit(rulesOf(sheet), sheet.href ?? document.baseURI);
  fontFaces = out.join("\n");
  return fontFaces;
}

/** The board font a CSS font list starts with, if it's one. */
function boardFont(families: string, theme: Theme, google: ReadonlySet<string>): FontFamily | null {
  const first = (families.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
  for (const id of BUILTIN_FONT_IDS) {
    const info = fontInfo(id);
    if (info.family === first || info.label === first) return id;
  }
  for (const slot of THEME_FONTS) {
    if (googleFamily(theme.fonts[slot]) === first) return theme.fonts[slot];
  }
  // A Google font the page asked for (and that loaded).
  return google.has(first) ? (`gf:${first}` as FontFamily) : null;
}

/** CSS generic families and system fonts: never fetched from Google Fonts. */
const SYSTEM_FONTS = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "math",
  "emoji",
  "inherit",
  "initial",
  "arial",
  "helvetica",
  "georgia",
  "times new roman",
  "courier new",
  "verdana",
  "tahoma",
  "segoe ui",
]);

/**
 * The font families the page names itself (font-['Instrument_Serif'] classes and inline
 * font-family styles), other than board fonts and system ones: Google fonts to load.
 */
function pageFontFamilies(doc: Document) {
  const found = new Set<string>();
  const add = (list: string) => {
    const first = (list.split(",")[0] ?? "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
    const lower = first.toLowerCase();
    if (!first || SYSTEM_FONTS.has(lower) || lower.startsWith("ui-") || lower.startsWith("var(")) {
      return;
    }
    if (/^[\d.]+$/.test(first)) return; // font-[550]: a weight, not a family.
    if (BUILTIN_FONT_IDS.some((id) => [fontInfo(id).family, fontInfo(id).label].includes(first))) {
      return;
    }
    found.add(first);
  };
  for (const el of doc.querySelectorAll("[class]")) {
    for (const cls of el.classList) {
      const utility = splitVariants(cls).pop() ?? "";
      const value = /^font-\[(.+)\]$/.exec(utility)?.[1];
      if (value) add(value.replace(/^family-name:/, "").replace(/_/g, " "));
    }
  }
  for (const el of doc.querySelectorAll("[style]")) {
    const value = /font-family\s*:\s*([^;]+)/i.exec(el.getAttribute("style") ?? "")?.[1];
    if (value) add(value);
  }
  return found;
}

const googleLink = (family: string) =>
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap">`;

// ── Colors ────────────────────────────────────────────────────────────────

let probe: CanvasRenderingContext2D | null | undefined;

/** A computed CSS color as hex (#rrggbb or #rrggbbaa), or null. */
function hexOf(css: string): string | null {
  const direct = cssColorToHex(css);
  if (direct) return direct;
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!probe) return null;
  probe.fillStyle = "#000000";
  probe.fillStyle = css;
  const legacy = cssColorToHex(String(probe.fillStyle));
  if (legacy) return legacy;
  // A color space the canvas keeps as written: read a pixel back.
  probe.clearRect(0, 0, 1, 1);
  probe.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = probe.getImageData(0, 0, 1, 1).data;
  return cssColorToHex(`rgba(${r}, ${g}, ${b}, ${a / 255})`);
}

const alphaOf = (hex: string) => (hex.length === 9 ? Number.parseInt(hex.slice(7), 16) / 255 : 1);
const isVisible = (hex: string | null): hex is string => hex !== null && alphaOf(hex) > 0.004;

function sameColor(a: string, b: string) {
  const channels = (hex: string) =>
    [1, 3, 5, 7].map((i) => (i < hex.length ? Number.parseInt(hex.slice(i, i + 2), 16) : 255));
  const ca = channels(a);
  const cb = channels(b);
  return ca.every((v, i) => Math.abs(v - (cb[i] ?? 0)) <= 2);
}

// ── Classes ───────────────────────────────────────────────────────────────

const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };

/** Splits "md:hover:bg-primary" into its variants and utility, ignoring ':' inside brackets. */
function splitVariants(cls: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < cls.length; i++) {
    const ch = cls[i];
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (ch === ":" && depth === 0) {
      parts.push(cls.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(cls.slice(start));
  return parts;
}

// ── Parsing computed values ──────────────────────────────────────────────

/** Splits a CSS list on top-level commas. */
function splitTop(value: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

const COLOR_PART = /^(?:[a-z-]+\([^()]*(?:\([^()]*\)[^()]*)*\)|#[0-9a-f]{3,8}|[a-z]+)/i;

/** A value's color (the first color-looking part) and the rest. */
function takeColor(value: string): { color: string | null; rest: string } {
  const words = value.trim();
  // Chrome puts a shadow's or stop's color first; other browsers may put it last.
  for (const candidate of [words, ...words.split(/\s+(?![^(]*\))/).slice(1)]) {
    const match = COLOR_PART.exec(candidate);
    if (!match) continue;
    const hex = hexOf(match[0]);
    if (hex && !/^-?[\d.]/.test(match[0])) {
      return { color: hex, rest: words.replace(match[0], " ").trim() };
    }
  }
  return { color: null, rest: words };
}

const DIRECTIONS: Record<string, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
  "top right": 45,
  "right top": 45,
  "bottom right": 135,
  "right bottom": 135,
  "bottom left": 225,
  "left bottom": 225,
  "top left": 315,
  "left top": 315,
};

function angleOf(value: string): number | null {
  const v = value.replace(/\s+in\s+[\w-]+(\s+[\w-]+)?$/, "").trim();
  if (v.startsWith("to ")) return DIRECTIONS[v.slice(3).trim()] ?? null;
  const match = /^(-?[\d.]+)(deg|turn|rad|grad)$/.exec(v);
  if (!match?.[1]) return null;
  const n = Number.parseFloat(match[1]);
  const unit = match[2];
  return unit === "turn"
    ? n * 360
    : unit === "rad"
      ? (n * 180) / Math.PI
      : unit === "grad"
        ? n * 0.9
        : n;
}

interface ParsedStop {
  color: string;
  position: number | null;
}

/** A CSS linear or radial gradient as a board gradient (without tokens), or null. */
function parseGradient(layer: string, length: number): Gradient | null {
  const match = /^(repeating-)?(linear|radial)-gradient\((.*)\)$/s.exec(layer.trim());
  if (!match || match[1]) return null;
  const type = match[2] as "linear" | "radial";
  const args = splitTop(match[3] ?? "");
  let angle = 180;
  const first = args[0] ?? "";
  if (type === "linear") {
    const parsed = angleOf(first);
    if (parsed !== null || first.startsWith("in ")) {
      if (parsed !== null) angle = parsed;
      args.shift();
    }
  } else if (
    takeColor(first).color === null ||
    /^(circle|ellipse|closest|farthest|at |in )/.test(first)
  ) {
    args.shift();
  }
  const stops: ParsedStop[] = [];
  for (const arg of args) {
    const { color, rest } = takeColor(arg);
    if (!color) continue; // A color hint.
    const pos = /(-?[\d.]+)(%|px)/.exec(rest);
    const position = pos?.[1]
      ? pos[2] === "px"
        ? (Number.parseFloat(pos[1]) / Math.max(1, length)) * 100
        : Number.parseFloat(pos[1])
      : null;
    stops.push({ color, position });
  }
  if (stops.length < 2) return null;
  // Missing positions spread evenly between their neighbors, as in CSS.
  if (stops[0] && stops[0].position === null) stops[0].position = 0;
  const last = stops[stops.length - 1];
  if (last && last.position === null) last.position = 100;
  for (let i = 1; i < stops.length - 1; i++) {
    if (stops[i]?.position !== null) continue;
    let j = i;
    while (stops[j]?.position === null) j++;
    const from = stops[i - 1]?.position ?? 0;
    const to = stops[j]?.position ?? 100;
    for (let k = i; k < j; k++) {
      const stop = stops[k];
      if (stop) stop.position = from + ((to - from) * (k - i + 1)) / (j - i + 1);
    }
  }
  // At most 8 stops: keep the ends and an even spread between.
  const picked =
    stops.length <= 8
      ? stops
      : Array.from({ length: 8 }, (_, i) => stops[Math.round((i * (stops.length - 1)) / 7)]!);
  const out = picked.map((stop) => ({
    color: stop.color,
    position: r2(clamp(stop.position ?? 0, 0, 100)),
  }));
  return type === "linear"
    ? { type, angle: r2(((angle % 360) + 360) % 360), stops: out }
    : { type, stops: out };
}

interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

/** A computed box-shadow as board shadow layers (inset and invisible ones left out). */
function parseShadows(value: string): ShadowLayer[] {
  if (!value || value === "none") return [];
  const layers: ShadowLayer[] = [];
  for (const part of splitTop(value)) {
    if (/\binset\b/.test(part)) continue;
    const { color, rest } = takeColor(part);
    if (!isVisible(color)) continue;
    const [x = 0, y = 0, blur = 0, spread = 0] = (rest.match(/-?[\d.]+(?=px|\b)/g) ?? []).map(
      Number,
    );
    layers.push({
      x: r2(clamp(x, -500, 500)),
      y: r2(clamp(y, -500, 500)),
      blur: r2(clamp(blur, 0, 500)),
      spread: r2(clamp(spread, -500, 500)),
      color,
    });
  }
  return layers.slice(0, 6);
}

const px = (value: string) => Number.parseFloat(value) || 0;

// ── Components ────────────────────────────────────────────────────────────

/** Fills that mark the component's box and its slot while it's measured (never drawn). */
const BOX_MARK = "#01020400";
const SLOT_MARK = "#01020300";
const RESERVED_ATTRIBUTES = new Set(["component", "variant", "class", "style", "id", "props"]);

interface UseSpec {
  index: number;
  use: LayoutUse;
  hasSlot: boolean;
  /** As wide as it needs (its sizer's width); the page may make it wider or narrower. */
  natural: number;
  /** The width it was last laid out at. */
  width: number;
  height: number;
  slotHeight: number;
  slot: Box | null;
}

const hasSlotNode = (tree: unknown): boolean =>
  Array.isArray(tree)
    ? tree.some(hasSlotNode)
    : tree !== null && typeof tree === "object"
      ? (tree as { type?: unknown }).type === "slot" || Object.values(tree).some(hasSlotNode)
      : false;

/** The <x-use> elements as `use` nodes; props come from attributes (any case) or `props` JSON. */
function readUses(doc: Document, components: Components) {
  const specs: UseSpec[] = [];
  doc.querySelectorAll("x-use").forEach((el, index) => {
    const component = el.getAttribute("component")?.trim() ?? "";
    if (!component) {
      throw new HtmlScreenError('An <x-use> needs component="Name" (list_components).');
    }
    const def = components[component];
    const known = def
      ? [...Object.keys(def.props), ...Object.values(def.variants).flatMap(Object.keys)]
      : [];
    const propName = (attr: string) => {
      const bare = attr.replace(/^data-prop-/, "");
      return known.find((k) => k.toLowerCase() === bare.replace(/-/g, "")) ?? bare;
    };
    const props: Record<string, string | number | null> = {};
    const json = el.getAttribute("props");
    if (json) {
      try {
        Object.assign(props, JSON.parse(json) as Record<string, string | number | null>);
      } catch {
        throw new HtmlScreenError(`${component}'s props attribute isn't valid JSON.`);
      }
    }
    for (const attr of el.attributes) {
      if (RESERVED_ATTRIBUTES.has(attr.name) || attr.name.startsWith("data-prism")) continue;
      if (attr.name === "data-name" || attr.name === "data-role") continue;
      const name = propName(attr.name);
      const isNumber = typeof def?.props[name]?.default === "number";
      props[name] = isNumber && attr.value.trim() !== "" ? Number(attr.value) : attr.value;
    }
    const children = [...el.childNodes].filter(
      (node) => node.nodeType === Node.ELEMENT_NODE || node.textContent?.trim(),
    );
    const slotted = def !== undefined && hasSlotNode(def.root) && children.length > 0;
    // A component without a slot takes its text as the label, if it has one.
    if (!slotted && children.length > 0) {
      const text = el.textContent?.trim() ?? "";
      if (def && "label" in def.props && props["label"] === undefined && text) {
        props["label"] = text;
      }
      el.replaceChildren();
    }
    if (slotted) {
      const slot = doc.createElement("div");
      slot.setAttribute("data-prism-slot", "");
      slot.append(...el.childNodes);
      el.replaceChildren(slot);
    }
    // The sizer gives the element the component's size, as content, so the page's layout (a
    // grid cell, a flex row, w-full) can still stretch or shrink it like any element.
    const sizer = doc.createElement("span");
    sizer.setAttribute("data-prism-sizer", "");
    el.prepend(sizer);
    el.setAttribute("data-prism-use", String(index));
    const use: LayoutUse = {
      type: "use",
      component,
      ...(el.getAttribute("variant") && { variant: el.getAttribute("variant") ?? undefined }),
      ...(Object.keys(props).length > 0 && { props }),
      ...(el.getAttribute("data-name") && { name: el.getAttribute("data-name") ?? undefined }),
      ...(el.getAttribute("data-role") && { role: el.getAttribute("data-role") ?? undefined }),
    };
    specs.push({
      index,
      use,
      hasSlot: slotted,
      natural: 0,
      width: 0,
      height: 0,
      slotHeight: 0,
      slot: null,
    });
  });
  return specs;
}

// ── The page ──────────────────────────────────────────────────────────────

/** Never rendered: scripts, frames, plugins, media and anything that loads more than images. */
const REMOVED = "script,iframe,frame,frameset,object,embed,link,meta,base,portal,noscript,template";
const MEDIA = "video,audio,canvas";

const escapeAttribute = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Parses the HTML inertly and strips what can run or load anything but images. */
function preparePage(html: string, notes: Set<string>) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(REMOVED).forEach((el) => el.remove());
  if (doc.querySelector(MEDIA)) {
    notes.add("<video>, <audio> and <canvas> aren't drawn: use an <img> (a poster frame) instead.");
    doc.querySelectorAll(MEDIA).forEach((el) => el.remove());
  }
  for (const el of doc.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }
  for (const img of doc.querySelectorAll("img")) {
    img.setAttribute("loading", "eager");
    const name = img.getAttribute("data-avatar");
    if (name && !img.getAttribute("src"))
      img.setAttribute("src", avatarUrl(name, avatarStyle(img)));
  }
  return doc;
}

function avatarStyle(el: Element): AvatarStyle {
  const style = el.getAttribute("data-avatar-style");
  return (AVATAR_STYLES as readonly string[]).includes(style ?? "")
    ? (style as AvatarStyle)
    : "notionists";
}

function pageMarkup(
  doc: Document,
  css: string,
  theme: Theme,
  mode: ThemeMode,
  pageFonts: ReadonlySet<string>,
) {
  const fonts = THEME_FONTS.map((slot) => googleFamily(theme.fonts[slot])).filter(
    (family): family is string => family !== null,
  );
  // One link per family, so a name Google doesn't know can't break the others.
  const links = [...new Set([...fonts, ...pageFonts])].map(googleLink).join("");
  const csp =
    "default-src 'none'; img-src * data: blob:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src * data:";
  const htmlClass = [mode === "dark" ? "dark" : "", doc.documentElement.className].join(" ").trim();
  const bodyStyle = doc.body.getAttribute("style");
  return [
    `<!doctype html><html class="${escapeAttribute(htmlClass)}"><head><meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    links,
    `<style>${boardFontFaces()}</style>`,
    `<style>${css}</style>`,
    `<style id="prism-uses"></style>`,
    `</head><body class="${escapeAttribute(doc.body.className)}"${bodyStyle ? ` style="${escapeAttribute(bodyStyle)}"` : ""}>`,
    doc.body.innerHTML,
    `</body></html>`,
  ].join("");
}

async function renderFrame(markup: string, width: number, height: number) {
  const frame = document.createElement("iframe");
  // Same origin so this tab can read the layout; no allow-scripts, so nothing in it runs.
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${width}px`,
    height: `${height}px`,
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  const loaded = new Promise<void>((resolve) => {
    frame.addEventListener("load", () => resolve(), { once: true });
  });
  frame.srcdoc = markup;
  document.body.append(frame);
  await Promise.race([loaded, sleep(10_000)]);
  const doc = frame.contentDocument;
  if (!doc?.body) {
    frame.remove();
    throw new Error("The page didn't load.");
  }
  return { frame, doc };
}

/** Waits (a while at most) for the page's fonts and images, so what's measured is final. */
async function settle(doc: Document) {
  doc.body.getBoundingClientRect(); // Lay out, so the fonts in use start loading.
  const images = [...doc.images].map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
  );
  await Promise.race([Promise.all([doc.fonts.ready, ...images]), sleep(8_000)]);
  await Promise.race([doc.fonts.ready, sleep(2_000)]);
}

// ── Reading the page ──────────────────────────────────────────────────────

interface Clip {
  box: Box;
  corners: Corners;
}

interface Ctx {
  /** Paint order: positioned content draws after the flow, by z-index. */
  level: number;
  layer: string | undefined;
  group: string | undefined;
  opacity: number;
  clip: Clip | null;
  /** Text inside `bg-clip-text` takes this gradient. */
  textGradient: Gradient | null;
}

interface Glyph {
  ch: string;
  rect: DOMRect;
  space: boolean;
  /** A forced line break comes before it. */
  breakBefore: boolean;
}

/** A text node inside a run, with the element that styles it. */
interface Segment {
  node: Text;
  host: Element;
}

type RunItem = Segment | "br" | "atomic";

const LEAF_TAGS = new Set(["img", "svg", "input", "textarea", "select", "x-use", "button"]);
const SEMANTIC_ROLES: Record<string, string> = {
  button: "button",
  input: "input",
  textarea: "input",
  select: "input",
  nav: "nav",
  img: "image",
  header: "header",
  footer: "footer",
};
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const MARKERS: Record<string, string> = { disc: "•", circle: "◦", square: "▪" };

function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right - x > 0.5 && bottom - y > 0.5
    ? { x, y, width: right - x, height: bottom - y }
    : null;
}

const boxOf = (rect: DOMRect): Box => ({
  x: rect.left,
  y: rect.top,
  width: rect.width,
  height: rect.height,
});

export async function htmlScreenOnTab(request: HtmlScreenRequest): Promise<HtmlScreenReply> {
  let frame: HTMLIFrameElement | null = null;
  try {
    const rendered = await convert(request, (f) => {
      frame = f;
    });
    return rendered;
  } catch (error) {
    if (!(error instanceof HtmlScreenError)) console.error("[Prism] HTML screen failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 2_000) : "The HTML couldn't be drawn.",
    };
  } finally {
    (frame as HTMLIFrameElement | null)?.remove();
  }
}

async function convert(
  request: HtmlScreenRequest,
  onFrame: (frame: HTMLIFrameElement) => void,
): Promise<HtmlScreenReply> {
  const { theme, mode, components, options } = request;
  const width = options.width;
  const viewportHeight = options.height ?? (width < 768 ? 844 : 900);
  const notes = new Set<string>();
  const violations: string[] = [];
  const assets: PendingAsset[] = [];
  const assetKeys = new Map<string, string>();

  /** A stand-in asset key for an image the server stores (PENDING_ASSET). */
  const pending = (asset: PendingAsset) => {
    const id = asset.kind === "url" ? `url:${asset.url}` : `svg:${asset.markup}`;
    let key = assetKeys.get(id);
    if (!key) {
      key = `${PENDING_ASSET}${assets.push(asset) - 1}`;
      assetKeys.set(id, key);
    }
    return key;
  };
  const imageStore: LayoutImageStore = {
    image: async (url) => pending({ kind: "url", url }),
    svg: async (markup) => pending({ kind: "svg", markup }),
  };

  // ── The page, with components sized ──
  const parsed = preparePage(request.html, notes);
  const pageFonts = pageFontFamilies(parsed);
  const specs = readUses(parsed, components);
  const candidates = new Set<string>();
  for (const el of [parsed.documentElement, ...parsed.querySelectorAll("[class]")]) {
    for (const cls of el.classList) candidates.add(cls);
  }
  const css = await pageCss(theme, candidates, request.fontGiven ? fontStack(options.font) : null);

  /** Lays a component out: its size and its slot's place at `w` (null: as wide as it needs). */
  async function measureUse(spec: UseSpec, w: number | null) {
    const children: LayoutNode[] | undefined = spec.hasSlot
      ? [
          {
            type: "stack",
            // Its natural width doesn't count the slot's content, which the page lays out.
            width: w === null ? 1 : "fill",
            height: spec.slotHeight,
            fill: SLOT_MARK,
            children: [],
          },
        ]
      : undefined;
    const use: LayoutUse = { ...spec.use, ...(w !== null && { width: w }), children };
    const wrapped: LayoutNode = { type: "stack", align: "start", fill: BOX_MARK, children: [use] };
    const expanded = expandComponents(
      w === null ? { type: "row", children: [wrapped] } : wrapped,
      components,
    );
    if (expanded.errors.length > 0) throw new HtmlScreenError(expanded.errors.join("\n"));
    const { root } = resolveLayoutTokens(expanded.root, theme, mode);
    await loadFonts(layoutFonts(root, options.font));
    const els = layoutScreen(
      root,
      { x: 0, y: 0, width: w ?? width, font: options.font },
      boardMeasure,
    );
    const box = els.find((el) => el.fill === BOX_MARK);
    const slot = els.find((el) => el.fill === SLOT_MARK);
    return {
      width: box?.width ?? 0,
      height: box?.height ?? 0,
      slot:
        slot && box
          ? { x: slot.x - box.x, y: slot.y - box.y, width: slot.width, height: slot.height }
          : null,
    };
  }

  resetMeasurements();
  for (const spec of specs) {
    Object.assign(spec, await measureUse(spec, null));
    spec.natural = spec.width;
  }

  const { frame, doc } = await renderFrame(
    pageMarkup(parsed, css, theme, mode, pageFonts),
    width,
    viewportHeight,
  );
  onFrame(frame);
  const view = doc.defaultView;
  if (!view) throw new Error("The page has no window.");
  const win = view;
  const instanceStyle = doc.getElementById("prism-uses");
  const instanceElement = (spec: UseSpec) =>
    doc.querySelector<HTMLElement>(`[data-prism-use="${spec.index}"]`);
  const slotElement = (spec: UseSpec) =>
    instanceElement(spec)?.querySelector<HTMLElement>(":scope > [data-prism-slot]") ?? null;

  // Each component's sizer holds its size (classes on the <x-use> such as w-full still win, and
  // one with a slot is a block, like a card), and its slot content goes where its slot is.
  const writeUseRules = () => {
    if (!instanceStyle) return;
    const sizes = specs.map(
      (s) =>
        `:where(x-use[data-prism-use="${s.index}"]) { position: relative;${s.hasSlot ? " display: block;" : ""} }`,
    );
    const sizers = specs.map(
      (s) =>
        `x-use[data-prism-use="${s.index}"] > [data-prism-sizer] { display: block; width: ${s.natural}px; max-width: 100%; height: ${s.height}px; }`,
    );
    const slots = specs
      .filter((s) => s.slot)
      .map(
        (s) =>
          `x-use[data-prism-use="${s.index}"] > [data-prism-slot] { position: absolute; left: ${s.slot?.x ?? 0}px; top: ${s.slot?.y ?? 0}px; width: ${s.slot?.width ?? 0}px; height: auto; }`,
      );
    instanceStyle.textContent = `@layer base {\n${sizes.join("\n")}\n}\n${[...sizers, ...slots].join("\n")}`;
  };
  writeUseRules();
  await settle(doc);
  // The page's own Google fonts that loaded; the others fall back (fontOf says so).
  const loadedFonts = new Set<string>();
  doc.fonts.forEach((face) => {
    const family = face.family.replace(/^["']|["']$/g, "");
    if (face.status === "loaded" && pageFonts.has(family)) loadedFonts.add(family);
  });

  for (let round = 0; round < 4 && specs.length > 0; round++) {
    let changed = false;
    for (const spec of specs) {
      const el = instanceElement(spec);
      if (!el) continue;
      const w = el.getBoundingClientRect().width;
      const slotHeight = spec.hasSlot
        ? (slotElement(spec)?.getBoundingClientRect().height ?? 0)
        : 0;
      if (Math.abs(w - spec.width) <= 0.5 && Math.abs(slotHeight - spec.slotHeight) <= 0.5) {
        continue;
      }
      spec.slotHeight = slotHeight;
      const measured = await measureUse(spec, w);
      spec.width = w;
      spec.height = measured.height;
      spec.slot = measured.slot;
      changed = true;
    }
    if (!changed) break;
    writeUseRules();
    doc.body.getBoundingClientRect();
  }

  // Each component drawn where the page put it, with its images still to store.
  const drawnInstances = new Map<Element, LayoutElement[]>();
  for (const spec of specs) {
    const el = instanceElement(spec);
    if (!el || view.getComputedStyle(el).display === "none") continue;
    const rect = el.getBoundingClientRect();
    const use: LayoutUse = {
      ...spec.use,
      width: rect.width,
      height: rect.height,
      children: spec.hasSlot
        ? [{ type: "stack", width: "fill", height: spec.slotHeight, children: [] }]
        : undefined,
    };
    const expanded = expandComponents(use, components);
    if (expanded.errors.length > 0) throw new HtmlScreenError(expanded.errors.join("\n"));
    const stored = await storeLayoutImages(expanded.root, imageStore);
    const resolved = resolveLayoutTokens(stored, theme, mode, undefined, theme.strict);
    violations.push(...resolved.violations);
    await loadFonts(layoutFonts(resolved.root, options.font));
    drawnInstances.set(
      el,
      layoutScreen(
        resolved.root,
        {
          // Relative to the page, like everything read from it (push adds the screen's place).
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          font: options.font,
        },
        boardMeasure,
      ),
    );
  }

  // ── Reading it back ──
  const out: { level: number; seq: number; el: LayoutElement }[] = [];
  let seq = 0;
  let layers = 0;
  let groups = 0;
  const groupSuffix = Math.random().toString(36).slice(2, 7);
  const textDone = new Set<Element>();
  const step = theme.spacing / 2;

  const utilitiesCache = new Map<Element, string[]>();
  /** The element's classes that apply at this width and mode, without their variants. */
  function utilities(el: Element) {
    let list = utilitiesCache.get(el);
    if (list) return list;
    list = [];
    for (const cls of el.classList) {
      const parts = splitVariants(cls);
      const utility = (parts.pop() ?? "").replace(/^!|!$/g, "");
      const applies = parts.every((variant) => {
        if (variant === "dark") return mode === "dark";
        const min = BREAKPOINTS[variant];
        if (min !== undefined) return width >= min;
        const max = variant.startsWith("max-") ? BREAKPOINTS[variant.slice(4)] : undefined;
        return max !== undefined && width < max;
      });
      if (applies) list.push(utility);
    }
    utilitiesCache.set(el, list);
    return list;
  }

  /** The theme color a class on `el` (or an ancestor, for inherited colors) gave it. */
  function colorToken(
    el: Element,
    prefixes: string[],
    hex: string,
    inherited: boolean,
    fallback: ThemeColor[] = [],
  ): ThemeColor | null {
    for (let node: Element | null = el; node; node = inherited ? node.parentElement : null) {
      for (const utility of utilities(node)) {
        for (const prefix of prefixes) {
          if (!utility.startsWith(prefix)) continue;
          const name = utility.slice(prefix.length);
          if (
            (THEME_COLORS as readonly string[]).includes(name) &&
            sameColor(themeColorHex(theme, mode, name as ThemeColor), hex)
          ) {
            return name as ThemeColor;
          }
        }
      }
    }
    return fallback.find((name) => sameColor(themeColorHex(theme, mode, name), hex)) ?? null;
  }

  const colorRef = (hex: string, token: ThemeColor | null) => (token ? `$${token}` : hex);

  /** The text style a text-* class gave the text, if its size still matches. */
  function textStyleOf(el: Element, size: number): TextStyleName | null {
    for (let node: Element | null = el; node; node = node.parentElement) {
      for (const utility of utilities(node)) {
        const name = utility.slice(5);
        if (
          utility.startsWith("text-") &&
          (TEXT_STYLES as readonly string[]).includes(name) &&
          Math.abs(theme.text[name as TextStyleName].size - size) < 0.05
        ) {
          return name as TextStyleName;
        }
      }
    }
    return null;
  }

  /** The text's font: a theme font as a token, else a board font, else the theme's sans. */
  function fontOf(el: Element, families: string): string {
    const font = boardFont(families, theme, loadedFonts);
    if (!font) {
      notes.add(
        `The font "${families.split(",")[0]?.trim()}" isn't a board font or a Google font that loaded; that text uses the theme's $sans. Use font-sans, font-heading or font-mono, or a Google font by its exact name, e.g. font-['Instrument_Serif'].`,
      );
      return "$sans";
    }
    for (let node: Element | null = el; node; node = node.parentElement) {
      for (const utility of utilities(node)) {
        const slot = utility.slice(5) as ThemeFont;
        if (
          utility.startsWith("font-") &&
          THEME_FONTS.includes(slot) &&
          theme.fonts[slot] === font
        ) {
          return `$${slot}`;
        }
      }
    }
    const slot = THEME_FONTS.find((s) => theme.fonts[s] === font);
    return slot ? `$${slot}` : font;
  }

  /** A theme radius token whose value is `value` px and that a rounded-* class asked for. */
  function radiusToken(el: Element, value: number, full: boolean): Corner {
    for (const utility of utilities(el)) {
      const match =
        /^rounded(?:-(?:t|r|b|l|s|e|x|y|tl|tr|br|bl|ss|se|es|ee|ts|te|bs|be))?-(\w+)$/.exec(
          utility,
        );
      const size = match?.[1];
      if (!size) continue;
      if (size === "full" && full) return "$radius-full";
      const name = `radius-${size}` as keyof typeof RADIUS_SCALE;
      const scale = RADIUS_SCALE[name];
      if (
        scale !== undefined &&
        Math.abs(Math.round(theme.radius * scale * 10) / 10 - value) < 0.1
      ) {
        return `$${name}`;
      }
    }
    return r2(value);
  }

  /** The element's corner radii in px, with the corners a rounded clipping parent rounds. */
  function cornersOf(cs: CSSStyleDeclaration, box: Box, clip: Clip | null): Corners {
    const half = Math.min(box.width, box.height) / 2;
    const own: Corners = [
      px(cs.borderTopLeftRadius),
      px(cs.borderTopRightRadius),
      px(cs.borderBottomRightRadius),
      px(cs.borderBottomLeftRadius),
    ];
    if (clip) {
      const c = clip.box;
      const near = (a: number, b: number) => Math.abs(a - b) <= 1;
      const left = near(box.x, c.x);
      const right = near(box.x + box.width, c.x + c.width);
      const top = near(box.y, c.y);
      const bottom = near(box.y + box.height, c.y + c.height);
      if (top && left) own[0] = Math.max(own[0], clip.corners[0]);
      if (top && right) own[1] = Math.max(own[1], clip.corners[1]);
      if (bottom && right) own[2] = Math.max(own[2], clip.corners[2]);
      if (bottom && left) own[3] = Math.max(own[3], clip.corners[3]);
    }
    return own.map((r) => Math.min(r, half)) as Corners;
  }

  /** Corner radii as the board's radius field, with tokens where a class set them. */
  function radiusField(el: Element, cs: CSSStyleDeclaration, corners: Corners, box: Box) {
    const half = Math.min(box.width, box.height) / 2;
    const full = [
      cs.borderTopLeftRadius,
      cs.borderTopRightRadius,
      cs.borderBottomRightRadius,
      cs.borderBottomLeftRadius,
    ].map((v) => px(v) >= half - 0.5);
    const values = corners.map((r, i) => (r === 0 ? 0 : radiusToken(el, r, full[i] ?? false)));
    if (values.every((v) => v === 0)) return undefined;
    return values.every((v) => v === values[0])
      ? values[0]
      : (values as [Corner, Corner, Corner, Corner]);
  }

  function push(fields: Fields, ctx: Ctx, opts: { resolved?: boolean; role?: string | null } = {}) {
    let el: Record<string, unknown> = fields;
    if (!opts.resolved) {
      if (theme.strict) violations.push(...strictViolations(fields, fields.type));
      const result = resolveElementTokens(fields, theme, mode);
      el = { ...result.fields, ...(result.tokens && { tokens: result.tokens }) };
      for (const unknown of result.unknown) notes.add(`Unknown token ${unknown}.`);
    }
    const out_ = {
      ...el,
      x: r2(options.x + (fields.x as number)),
      y: r2(options.y + (fields.y as number)),
      width: r2(fields.width as number),
      height: r2(fields.height as number),
      ...(ctx.layer && { layer: ctx.layer }),
      ...(ctx.group && { groupId: ctx.group }),
      ...(opts.role && { role: opts.role }),
      ...(ctx.opacity < 0.999 && { opacity: r2(ctx.opacity) }),
    } as LayoutElement;
    out.push({ level: ctx.level, seq: seq++, el: out_ });
  }

  /** The element's box: background, gradient or image, border, shadow and backdrop blur. */
  function paintBox(
    el: Element,
    cs: CSSStyleDeclaration,
    rect: Box,
    ctx: Ctx,
    role: string | null,
    extra: {
      fillImage?: { assetKey: string; fit: "cover" | "contain" };
      force?: boolean;
      skipColor?: boolean;
    } = {},
  ) {
    const box = ctx.clip ? intersect(rect, ctx.clip.box) : rect;
    if (!box) return;
    const bg = extra.skipColor ? null : hexOf(cs.backgroundColor);
    const fill = isVisible(bg) ? bg : null;
    let gradient: Gradient | null = null;
    let fillImage = extra.fillImage;
    if (cs.backgroundImage && cs.backgroundImage !== "none" && cs.backgroundClip !== "text") {
      for (const layer of splitTop(cs.backgroundImage)) {
        const url = /^url\(\s*(["']?)(.*?)\1\s*\)$/.exec(layer)?.[2];
        if (url && !fillImage) {
          fillImage = {
            assetKey: pending({ kind: "url", url: new URL(url, doc.baseURI).href }),
            fit: cs.backgroundSize === "contain" ? "contain" : "cover",
          };
        } else if (!gradient && !url) {
          gradient = parseGradient(layer, Math.max(box.width, box.height));
          if (!gradient && /gradient\(/.test(layer)) {
            notes.add("Conic and repeating gradients aren't drawn; use a linear or radial one.");
          }
        }
      }
    }
    const sides = (["Top", "Right", "Bottom", "Left"] as const).map((side) => {
      const style = cs.getPropertyValue(`border-${side.toLowerCase()}-style`);
      const w =
        style === "none" || style === "hidden"
          ? 0
          : px(cs.getPropertyValue(`border-${side.toLowerCase()}-width`));
      const color = hexOf(cs.getPropertyValue(`border-${side.toLowerCase()}-color`));
      return { side, w, color: isVisible(color) ? color : null };
    });
    const shadow = parseShadows(cs.boxShadow);
    const blur = /blur\(([\d.]+)px\)/.exec(
      cs.backdropFilter || cs.getPropertyValue("-webkit-backdrop-filter"),
    );
    const uniform =
      sides[0]!.w > 0 &&
      sides[0]!.color !== null &&
      sides.every((s) => Math.abs(s.w - sides[0]!.w) < 0.01 && s.color === sides[0]!.color);
    const painted =
      fill !== null ||
      gradient !== null ||
      fillImage !== undefined ||
      shadow.length > 0 ||
      blur !== null;
    if (painted || uniform || extra.force) {
      const corners = cornersOf(cs, box, ctx.clip);
      const circle =
        Math.abs(box.width - box.height) < 1 && corners.every((r) => r >= box.width / 2 - 0.5);
      const borderColor = uniform ? sides[0]!.color! : null;
      const inset = uniform ? sides[0]!.w / 2 : 0;
      const tokenFill = fill ? colorToken(el, ["bg-"], fill, false) : null;
      const fields: Fields = {
        type: circle ? "ellipse" : "rect",
        x: box.x + inset,
        y: box.y + inset,
        width: Math.max(0, box.width - inset * 2),
        height: Math.max(0, box.height - inset * 2),
        fill: fill ? colorRef(fill, tokenFill) : null,
        strokeWidth: uniform ? r2(sides[0]!.w) : 0,
        ...(borderColor && {
          stroke: colorRef(
            borderColor,
            colorToken(el, ["border-"], borderColor, false, ["border", "input"]),
          ),
        }),
        ...(!circle && { radius: radiusField(el, cs, corners, box) }),
        ...(shadow.length > 0 && { shadow }),
        ...(gradient && { gradient: gradientWithTokens(el, gradient) }),
        ...(fillImage && { fillImage }),
        ...(blur?.[1] && { backdropBlur: clamp(r2(Number(blur[1])), 0, BACKDROP_BLUR_MAX) }),
      };
      if (fields["radius"] === undefined) delete fields["radius"];
      push(fields, ctx, { role });
    }
    // Borders on some sides only (a navbar's bottom rule): one line per side.
    if (!uniform) {
      for (const { side, w, color } of sides) {
        if (w <= 0 || !color) continue;
        const stroke = colorRef(
          color,
          colorToken(el, ["border-", `border-${side[0]!.toLowerCase()}-`], color, false, [
            "border",
            "input",
          ]),
        );
        const horizontal = side === "Top" || side === "Bottom";
        const at =
          side === "Top"
            ? box.y + w / 2
            : side === "Bottom"
              ? box.y + box.height - w / 2
              : side === "Left"
                ? box.x + w / 2
                : box.x + box.width - w / 2;
        push(
          horizontal
            ? {
                type: "line",
                x: box.x,
                y: at,
                width: box.width,
                height: 0,
                stroke,
                strokeWidth: r2(w),
              }
            : {
                type: "line",
                x: at,
                y: box.y,
                width: 0,
                height: box.height,
                stroke,
                strokeWidth: r2(w),
              },
          ctx,
        );
      }
    }
  }

  /** A gradient with its stops' colors as tokens where from-/via-/to- classes set them. */
  function gradientWithTokens(el: Element, gradient: Gradient): Gradient {
    return {
      ...gradient,
      stops: gradient.stops.map((stop) => {
        const token = colorToken(el, ["from-", "via-", "to-"], stop.color, false);
        return { ...stop, color: colorRef(stop.color, token) };
      }),
    };
  }

  /** The characters of a text node with where the browser drew each one. */
  function glyphsOf(
    node: Text,
    pre: boolean,
    clip: Box | null,
  ): { glyphs: Glyph[]; clipped: boolean } {
    const glyphs: Glyph[] = [];
    const range = doc.createRange();
    const data = node.data;
    let clipped = false;
    let breakNext = false;
    for (let i = 0; i < data.length;) {
      const code = data.codePointAt(i) ?? 0;
      const len = code > 0xffff ? 2 : 1;
      const ch = data.slice(i, i + len);
      range.setStart(node, i);
      range.setEnd(node, i + len);
      i += len;
      if (pre && ch === "\n") {
        breakNext = true;
        continue;
      }
      const rects = range.getClientRects();
      const rect = [...rects].find((r) => r.width > 0) ?? rects[0];
      const space = /\s/.test(ch);
      if (!rect || (!space && rect.width === 0 && rect.height === 0)) continue;
      if (
        !space &&
        clip &&
        (rect.right > clip.x + clip.width + 1 ||
          rect.left < clip.x - 1 ||
          rect.bottom < clip.y ||
          rect.top > clip.y + clip.height)
      ) {
        clipped = true;
        continue;
      }
      glyphs.push({ ch: space && !pre ? " " : ch, rect, space, breakBefore: breakNext });
      breakNext = false;
    }
    return { glyphs, clipped };
  }

  /** Groups glyphs into the lines the browser broke them into. */
  function linesOf(glyphs: Glyph[]) {
    const lines: { glyphs: Glyph[]; left: number; right: number; top: number; height: number }[] =
      [];
    for (const glyph of glyphs) {
      const line = lines[lines.length - 1];
      const mid = glyph.rect.top + glyph.rect.height / 2;
      const sameLine =
        line &&
        !glyph.breakBefore &&
        (glyph.space || Math.abs(mid - (line.top + line.height / 2)) < line.height / 2);
      if (sameLine) {
        line.glyphs.push(glyph);
        if (!glyph.space) {
          line.left = Math.min(line.left, glyph.rect.left);
          line.right = Math.max(line.right, glyph.rect.right);
          line.top = Math.min(line.top, glyph.rect.top);
          line.height = Math.max(line.height, glyph.rect.height);
        }
      } else if (!glyph.space || glyph.breakBefore) {
        lines.push({
          glyphs: [glyph],
          left: glyph.space ? Infinity : glyph.rect.left,
          right: glyph.space ? -Infinity : glyph.rect.right,
          top: glyph.rect.top,
          height: glyph.rect.height,
        });
      }
    }
    return lines.filter((line) => line.right > line.left);
  }

  const transform = (text: string, cs: CSSStyleDeclaration) =>
    cs.textTransform === "uppercase"
      ? text.toUpperCase()
      : cs.textTransform === "lowercase"
        ? text.toLowerCase()
        : cs.textTransform === "capitalize"
          ? text.replace(/(^|\s)(\p{L})/gu, (_, s: string, c: string) => s + c.toUpperCase())
          : text;

  /** Joins glyphs into text, collapsing spaces as the browser did. */
  function textOf(glyphs: Glyph[]) {
    let text = "";
    for (const glyph of glyphs) {
      if (glyph.breakBefore) text = `${text.trimEnd()}\n`;
      if (glyph.space && glyph.ch === " ") {
        if (text && !text.endsWith(" ") && !text.endsWith("\n")) text += " ";
      } else text += glyph.ch;
    }
    return text.replace(/ +$/gm, "").trim();
  }

  const lineHeightPx = (cs: CSSStyleDeclaration) =>
    cs.lineHeight === "normal" ? px(cs.fontSize) * 1.2 : px(cs.lineHeight);

  /** The text fields for text styled by `cs` on `host`. */
  function textFields(host: Element, cs: CSSStyleDeclaration, ctx: Ctx) {
    const size = clamp(px(cs.fontSize), FONT_PX_MIN, FONT_PX_MAX);
    const weight = clamp(Math.round(px(cs.fontWeight) / 100) * 100 || 400, 100, 900);
    const lineHeight = r2(clamp(lineHeightPx(cs) / size, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX));
    const letterSpacing =
      cs.letterSpacing === "normal"
        ? 0
        : Math.round(
            clamp(px(cs.letterSpacing) / size, LETTER_SPACING_MIN, LETTER_SPACING_MAX) * 1000,
          ) / 1000;
    const font = fontOf(host, cs.fontFamily);
    const styleName = textStyleOf(host, size);
    const style = styleName ? theme.text[styleName] : null;
    const color = hexOf(cs.color) ?? "#000000";
    const gradient = ctx.textGradient;
    return {
      font,
      ...(style
        ? {
            textStyle: `$${styleName}`,
            ...(style.weight !== weight && { fontWeight: weight }),
            ...(Math.abs(style.lineHeight - lineHeight) > 0.02 && { lineHeight }),
            ...(Math.abs(style.letterSpacing - letterSpacing) > 0.002 && { letterSpacing }),
          }
        : { fontSizePx: r2(size), fontWeight: weight, lineHeight, letterSpacing }),
      ...(gradient
        ? { stroke: gradient.stops[0]?.color ?? color, gradient }
        : { stroke: colorRef(color, colorToken(host, ["text-"], color, true)) }),
      visible: gradient !== null || isVisible(color),
    };
  }

  /** Draws the text directly inside `el` (and in plain inline elements inside it). */
  function drawText(el: Element, ctx: Ctx, role: string | null) {
    const items: RunItem[] = [];
    const walk = (parent: Element) => {
      for (const child of parent.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          if ((child as Text).data.length > 0) items.push({ node: child as Text, host: parent });
          continue;
        }
        if (!(child instanceof win.Element)) continue;
        const tag = child.tagName.toLowerCase();
        if (tag === "br") {
          items.push("br");
          continue;
        }
        const ccs = win.getComputedStyle(child);
        if (ccs.display === "none") continue;
        const plainInline =
          (ccs.display === "inline" || ccs.display === "contents") &&
          !LEAF_TAGS.has(tag) &&
          !child.hasAttribute("data-icon") &&
          !child.hasAttribute("data-avatar") &&
          !hasPaint(ccs);
        if (plainInline) {
          textDone.add(child);
          walk(child);
        } else items.push("atomic");
      }
    };
    walk(el);
    const segments = items.filter((item): item is Segment => typeof item === "object");
    if (segments.length === 0) return;

    // Text is clipped by its own box too (truncate), leaving room for the ellipsis it shows.
    const ownStyle = win.getComputedStyle(el);
    let clip = ctx.clip?.box ?? null;
    if (ownStyle.overflowX !== "visible" || ownStyle.overflowY !== "visible") {
      const own = boxOf(el.getBoundingClientRect());
      const left = own.x + px(ownStyle.borderLeftWidth) + px(ownStyle.paddingLeft);
      const right = own.x + own.width - px(ownStyle.borderRightWidth) - px(ownStyle.paddingRight);
      const room = ownStyle.textOverflow === "ellipsis" ? px(ownStyle.fontSize) * 0.9 : 0;
      const content = { ...own, x: left, width: Math.max(0, right - left - room) };
      clip = clip ? (intersect(content, clip) ?? content) : content;
    }
    const styled = segments.map((segment) => {
      const cs = win.getComputedStyle(segment.host);
      const pre = /^(pre|pre-wrap|break-spaces|pre-line)$/.test(cs.whiteSpace);
      return { ...segment, cs, ...glyphsOf(segment.node, pre, clip) };
    });
    // A <br> breaks before the next character drawn.
    let breakPending = false;
    let index = 0;
    for (const item of items) {
      if (item === "br") breakPending = true;
      else if (typeof item === "object") {
        const first = styled[index++]?.glyphs.find((g) => !g.space);
        if (first && breakPending) first.breakBefore = true;
        if (first) breakPending = false;
      }
    }
    const visible = styled.filter((s) => s.glyphs.some((g) => !g.space));
    if (visible.length === 0) return;

    const key = (cs: CSSStyleDeclaration) =>
      [
        cs.fontFamily,
        cs.fontSize,
        cs.fontWeight,
        cs.fontStyle,
        cs.color,
        cs.letterSpacing,
        cs.lineHeight,
        cs.textTransform,
      ].join("|");
    const textIndexes = items.flatMap((item, i) => (typeof item === "object" ? [i] : []));
    const atomicBetween = items.some(
      (item, i) =>
        item === "atomic" &&
        i > (textIndexes[0] ?? 0) &&
        i < (textIndexes[textIndexes.length - 1] ?? 0),
    );
    const allGlyphs = visible.flatMap((s) => s.glyphs);
    const lines = linesOf(allGlyphs);
    const hasAtomic = items.includes("atomic");
    // Inline text that wraps (a <span> in a heading) starts mid-line, so it can't be one box.
    const inline = win.getComputedStyle(el).display === "inline";
    const uniform =
      visible.every((s) => key(s.cs) === key(visible[0]!.cs)) &&
      !atomicBetween &&
      !((hasAtomic || inline) && lines.length > 1);

    if (uniform) {
      const { cs, host } = visible[0]!;
      const { visible: shown, ...fields } = textFields(host, cs, ctx);
      if (!shown || lines.length === 0) return;
      let text = "";
      for (const line of lines) {
        const part = textOf(line.glyphs);
        const hard = line.glyphs[0]?.breakBefore ?? false;
        text += !text
          ? part
          : hard
            ? `
${part}`
            : text.endsWith("-")
              ? part
              : ` ${part}`;
      }
      text = transform(text, cs);
      if (styled.some((s) => s.clipped) && cs.textOverflow === "ellipsis")
        text = `${text.trimEnd()}…`;
      const lh = lineHeightPx(cs);
      const first = lines[0]!;
      const left = Math.min(...lines.map((l) => l.left));
      const widest = Math.max(...lines.map((l) => l.right - l.left));
      const hardLines = text.split("\n").length;
      const hug = lines.length <= hardLines;
      const align =
        cs.textAlign === "center"
          ? "center"
          : cs.textAlign === "right" || cs.textAlign === "end"
            ? "right"
            : "left";
      // One line hugging its text needs no alignment; several keep theirs (a centered title
      // broken with <br> stays centered).
      const textAlign = hug && lines.length === 1 ? "left" : align;
      push(
        {
          type: "text",
          x: left - (textAlign === "center" ? 1 : textAlign === "right" ? 2 : 0),
          y: first.top - (lh - first.height) / 2,
          width: Math.ceil(widest) + 2,
          height: lines.length * lh,
          text,
          textAlign,
          autoWidth: hug,
          // Text the browser wrapped: its last line, for the orphan check (not stored).
          ...(!hug && { lastLine: transform(textOf(lines[lines.length - 1]?.glyphs ?? []), cs) }),
          ...fields,
        },
        ctx,
        { role },
      );
      return;
    }
    // Mixed styles: each piece of text on each line is its own text element, where it was drawn.
    for (const segment of visible) {
      const { visible: shown, ...fields } = textFields(segment.host, segment.cs, ctx);
      if (!shown) continue;
      const lh = lineHeightPx(segment.cs);
      for (const line of linesOf(segment.glyphs)) {
        const text = transform(
          textOf(line.glyphs.map((g) => ({ ...g, breakBefore: false }))),
          segment.cs,
        );
        if (!text) continue;
        push(
          {
            type: "text",
            x: line.left,
            y: line.top - (lh - line.height) / 2,
            width: Math.ceil(line.right - line.left) + 2,
            height: lh,
            text,
            textAlign: "left",
            autoWidth: true,
            ...fields,
          },
          ctx,
          { role },
        );
      }
    }
  }

  function hasPaint(cs: CSSStyleDeclaration) {
    return (
      isVisible(hexOf(cs.backgroundColor)) ||
      (cs.backgroundImage !== "none" && cs.backgroundImage !== "") ||
      px(cs.borderTopWidth) +
        px(cs.borderRightWidth) +
        px(cs.borderBottomWidth) +
        px(cs.borderLeftWidth) >
        0 ||
      (cs.boxShadow !== "none" && cs.boxShadow !== "")
    );
  }

  const describe = (el: Element) => {
    const classes = [...el.classList].slice(0, 4).join(" ");
    return `<${el.tagName.toLowerCase()}${classes ? ` class="${classes}"` : ""}>`;
  };

  /** A strict theme keeps padding and gaps on its spacing half-steps. */
  function checkSpacing(el: Element, cs: CSSStyleDeclaration) {
    if (!theme.strict || violations.length > 400) return;
    const check = (what: string, value: string) => {
      const v = px(value);
      if (v !== 0 && Math.abs(v / step - Math.round(v / step)) > 1e-3) {
        violations.push(`${what} ${r2(v)}px on ${describe(el)} (not a multiple of ${step}px)`);
      }
    };
    for (const side of ["top", "right", "bottom", "left"]) {
      check(`padding-${side}`, cs.getPropertyValue(`padding-${side}`));
    }
    if (/flex|grid/.test(cs.display)) {
      if (cs.rowGap !== "normal") check("row gap", cs.rowGap);
      if (cs.columnGap !== "normal") check("column gap", cs.columnGap);
    }
  }

  function drawIcon(
    el: Element,
    cs: CSSStyleDeclaration,
    rect: Box,
    ctx: Ctx,
    role: string | null,
  ) {
    const name = (el.getAttribute("data-icon") ?? "").trim().toLowerCase();
    if (!iconNameSchema.safeParse(name).success) {
      notes.add(`"${name}" isn't a Lucide icon name (kebab case, e.g. "arrow-right").`);
      return;
    }
    if (rect.width < 1 || rect.height < 1) return;
    const color = hexOf(cs.color) ?? "#000000";
    const filled = utilities(el).some((u) => u.startsWith("fill-") && u !== "fill-none");
    const fill = filled ? hexOf(cs.fill) : null;
    const strokeUtility = utilities(el).find((u) => /^stroke-(\d|\[)/.test(u));
    const strokeWidth =
      el.getAttribute("data-stroke-width") ?? (strokeUtility ? cs.strokeWidth : null);
    push(
      {
        type: "icon",
        ...rect,
        icon: name,
        stroke: colorRef(color, colorToken(el, ["text-"], color, true)),
        ...(fill &&
          isVisible(fill) && { fill: colorRef(fill, colorToken(el, ["fill-"], fill, false)) }),
        strokeWidth: strokeWidth ? clamp(r2(px(strokeWidth)), 0.5, 4) : 2,
      },
      ctx,
      { role },
    );
  }

  /** An inline SVG as markup with its classes' colors written in, so it draws on its own. */
  function svgMarkup(svg: SVGSVGElement, rect: Box) {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const originals = [svg, ...svg.querySelectorAll("*")];
    const copies = [clone, ...clone.querySelectorAll("*")];
    originals.forEach((original, i) => {
      const copy = copies[i];
      if (!copy) return;
      const cs = win.getComputedStyle(original);
      for (const property of ["fill", "stroke"] as const) {
        const value = cs.getPropertyValue(property);
        const hex = value && value !== "none" && !value.startsWith("url(") ? hexOf(value) : null;
        if (hex) copy.setAttribute(property, hex);
        else if (value === "none") copy.setAttribute(property, "none");
      }
      const strokeWidth = cs.getPropertyValue("stroke-width");
      if (strokeWidth) copy.setAttribute("stroke-width", String(px(strokeWidth)));
      if (original instanceof win.SVGTextElement) {
        copy.setAttribute("font-family", cs.fontFamily);
        copy.setAttribute("font-size", cs.fontSize);
        copy.setAttribute("font-weight", cs.fontWeight);
      }
      copy.removeAttribute("class");
    });
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(r2(rect.width)));
    clone.setAttribute("height", String(r2(rect.height)));
    return clone.outerHTML;
  }

  function drawControl(
    el: HTMLElement,
    cs: CSSStyleDeclaration,
    rect: Box,
    ctx: Ctx,
    role: string | null,
  ) {
    const tag = el.tagName.toLowerCase();
    const type = tag === "input" ? (el as HTMLInputElement).type || "text" : tag;
    if (type === "hidden") return;
    if (type === "checkbox" || type === "radio") {
      const checked = (el as HTMLInputElement).checked;
      push(
        {
          type: type === "radio" ? "ellipse" : "rect",
          ...rect,
          fill: checked ? "$primary" : "$background",
          stroke: checked ? "$primary" : "$border",
          strokeWidth: 1,
          ...(type === "checkbox" && { radius: Math.min(4, rect.width / 4) }),
        },
        ctx,
        { role: type },
      );
      if (checked && type === "checkbox") {
        const inset = rect.width * 0.15;
        push(
          {
            type: "icon",
            x: rect.x + inset,
            y: rect.y + inset,
            width: rect.width - inset * 2,
            height: rect.height - inset * 2,
            icon: "check",
            stroke: "$primary-foreground",
            strokeWidth: 3,
          },
          ctx,
        );
      } else if (checked) {
        const d = rect.width * 0.4;
        push(
          {
            type: "ellipse",
            x: rect.x + (rect.width - d) / 2,
            y: rect.y + (rect.height - d) / 2,
            width: d,
            height: d,
            fill: "$primary-foreground",
            strokeWidth: 0,
          },
          ctx,
        );
      }
      return;
    }
    paintBox(el, cs, rect, ctx, role ?? "input", { force: true });
    const field = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const isSelect = tag === "select";
    const value = isSelect
      ? ((field as HTMLSelectElement).selectedOptions[0]?.textContent ?? "")
      : field.value;
    const placeholder = !isSelect && !value ? ((field as HTMLInputElement).placeholder ?? "") : "";
    const text = (value || placeholder).trim();
    const left = rect.x + px(cs.borderLeftWidth) + px(cs.paddingLeft);
    const right = rect.x + rect.width - px(cs.borderRightWidth) - px(cs.paddingRight);
    const lh = lineHeightPx(cs);
    const textCs = placeholder ? win.getComputedStyle(el, "::placeholder") : cs;
    if (text) {
      const { visible: shown, ...fields } = textFields(el, cs, ctx);
      const color = hexOf(textCs.color) ?? "#888888";
      if (shown || placeholder) {
        push(
          {
            type: "text",
            x: left,
            y:
              tag === "textarea"
                ? rect.y + px(cs.borderTopWidth) + px(cs.paddingTop)
                : rect.y + (rect.height - lh) / 2,
            width: Math.max(1, right - left),
            height: lh,
            text,
            textAlign: "left",
            autoWidth: tag !== "textarea",
            ...fields,
            stroke: colorRef(
              color,
              placeholder
                ? colorToken(el, ["placeholder:text-"], color, false, [
                    "muted-foreground",
                    "foreground",
                  ])
                : colorToken(el, ["text-"], color, true),
            ),
          },
          ctx,
        );
      }
    }
    if (isSelect) {
      const size = Math.min(16, rect.height - 4);
      const color = hexOf(cs.color) ?? "#000000";
      push(
        {
          type: "icon",
          x: right - size,
          y: rect.y + (rect.height - size) / 2,
          width: size,
          height: size,
          icon: "chevron-down",
          stroke: colorRef(color, colorToken(el, ["text-"], color, true)),
          strokeWidth: 2,
        },
        ctx,
      );
    }
  }

  function drawMarker(el: Element, cs: CSSStyleDeclaration, rect: Box, ctx: Ctx) {
    if (cs.listStyleType === "none" || cs.listStylePosition === "inside") return;
    let marker = MARKERS[cs.listStyleType];
    if (!marker && /decimal/.test(cs.listStyleType)) {
      const list = el.parentElement;
      const start = Number(list?.getAttribute("start") ?? 1) || 1;
      marker = `${start + [...(list?.children ?? [])].filter((c) => c.tagName === "LI").indexOf(el)}.`;
    }
    if (!marker) return;
    const size = px(cs.fontSize);
    const lh = lineHeightPx(cs);
    const { visible: shown, ...fields } = textFields(el, cs, ctx);
    if (!shown) return;
    push(
      {
        type: "text",
        x: rect.x - size * (marker.length > 1 ? 1.6 : 1.1),
        y: rect.y + px(cs.paddingTop),
        width: size * 1.5,
        height: lh,
        text: marker,
        textAlign: "left",
        autoWidth: true,
        ...fields,
      },
      ctx,
    );
  }

  function visit(el: Element, ctx: Ctx) {
    const cs = win.getComputedStyle(el);
    if (cs.display === "none") return;
    const tag = el.tagName.toLowerCase();
    const rect = boxOf(el.getBoundingClientRect());
    const isRoot = el === doc.documentElement || el === doc.body;
    const slot = el.hasAttribute("data-prism-slot");
    const positioned = !slot && (cs.position === "absolute" || cs.position === "fixed");
    const z = Number.parseInt(cs.zIndex, 10);
    const level = positioned
      ? Number.isFinite(z) && z < 0
        ? ctx.level - 0.5
        : Math.max(ctx.level, 1 + (Number.isFinite(z) ? z : 0))
      : ctx.level;
    const opacity = ctx.opacity * (Number.parseFloat(cs.opacity) || 0);
    if (opacity < 0.02) return;
    const name = el.getAttribute("data-name");
    const autoGroup =
      !name && (tag === "button" || (tag === "a" && hasPaint(cs)))
        ? tag === "a"
          ? "Link"
          : "Button"
        : null;
    const group = name || autoGroup ? `${name ?? autoGroup}-${++groups}-${groupSuffix}` : ctx.group;
    const here: Ctx = {
      ...ctx,
      level,
      layer: positioned ? `html-layer-${++layers}` : ctx.layer,
      group,
      opacity,
    };
    if (!isRoot && here.clip && !intersect(rect, here.clip.box) && cs.display !== "contents")
      return;
    const role = el.getAttribute("data-role") ?? SEMANTIC_ROLES[tag] ?? null;
    const shown = cs.visibility !== "hidden";

    if (shown) {
      const instance = drawnInstances.get(el);
      if (instance) {
        for (const part of instance) {
          push(
            part as Fields,
            {
              ...here,
              layer: (part.layer as string | undefined) ?? here.layer,
              group: part.groupId ?? here.group,
            },
            { resolved: true },
          );
        }
        for (const child of el.children) visit(child, here);
        return;
      }
      if (el.hasAttribute("data-icon")) {
        drawIcon(el, cs, rect, here, role);
        return;
      }
      if (el instanceof win.SVGSVGElement) {
        if (rect.width >= 1 && rect.height >= 1) {
          paintBox(el, cs, rect, here, role ?? "image", {
            force: true,
            fillImage: {
              assetKey: pending({ kind: "svg", markup: svgMarkup(el, rect) }),
              fit: "contain",
            },
          });
        }
        return;
      }
      const avatar = el.getAttribute("data-avatar");
      if (tag === "img" || avatar) {
        const src = avatar
          ? avatarUrl(avatar, avatarStyle(el))
          : (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src;
        if (rect.width < 1 || rect.height < 1) {
          notes.add(`An image has no size (${describe(el)}); give it width and height classes.`);
          return;
        }
        let assetKey: string | null = null;
        if (src.startsWith("data:image/svg+xml")) {
          const markup = decodeURIComponent(src.slice(src.indexOf(",") + 1));
          assetKey = pending({
            kind: "svg",
            markup: src.includes(";base64,") ? atob(src.slice(src.indexOf(",") + 1)) : markup,
          });
        } else if (/^https?:/.test(src)) assetKey = pending({ kind: "url", url: src });
        else notes.add(`Skipped an image that isn't an http(s) URL (${src.slice(0, 40)}…).`);
        const fit =
          cs.objectFit === "contain" || cs.objectFit === "scale-down" ? "contain" : "cover";
        paintBox(el, cs, rect, here, role ?? "image", {
          force: true,
          ...(assetKey && { fillImage: { assetKey, fit } }),
        });
        return;
      }
      if (tag === "input" || tag === "textarea" || tag === "select") {
        drawControl(el as HTMLElement, cs, rect, here, role);
        return;
      }
      if (!isRoot) {
        paintBox(el, cs, rect, here, role);
        checkSpacing(el, cs);
      } else if (cs.backgroundImage !== "none") {
        paintBox(el, cs, rect, here, null, { skipColor: true });
      }
    }

    const clipText =
      cs.backgroundClip === "text" || cs.getPropertyValue("-webkit-background-clip") === "text";
    if (clipText && cs.backgroundImage !== "none") {
      const gradient = parseGradient(
        splitTop(cs.backgroundImage)[0] ?? "",
        Math.max(rect.width, rect.height),
      );
      if (gradient) here.textGradient = gradientWithTokens(el, gradient);
    }
    if (shown && !textDone.has(el)) {
      // Roles name the box (a button, a card); its text only says when it is a heading.
      drawText(el, here, HEADINGS.has(tag) ? "heading" : null);
    }
    if (shown && cs.display === "list-item") drawMarker(el, cs, rect, here);

    const overflow = cs.overflowX !== "visible" || cs.overflowY !== "visible";
    const childCtx: Ctx =
      overflow && !isRoot
        ? {
            ...here,
            clip: {
              box: (here.clip ? intersect(rect, here.clip.box) : rect) ?? rect,
              corners: cornersOf(cs, rect, here.clip),
            },
          }
        : here;
    for (const child of el.children) visit(child, childCtx);
  }

  visit(doc.documentElement, {
    level: 0,
    layer: undefined,
    group: undefined,
    opacity: 1,
    clip: null,
    textGradient: null,
  });

  if (out.length > LAYOUT_NODES_MAX) {
    throw new HtmlScreenError(
      `The page draws ${out.length} elements; one screen can have at most ${LAYOUT_NODES_MAX}. Split it into several screens or simplify it.`,
    );
  }
  out.sort((a, b) => a.level - b.level || a.seq - b.seq);

  // The page background goes on the frame behind the screen.
  let background: { fill: string; token?: string } | null = null;
  for (const el of [doc.body, doc.documentElement]) {
    const hex = hexOf(view.getComputedStyle(el).backgroundColor);
    if (!isVisible(hex)) continue;
    const token = colorToken(el, ["bg-"], hex, false, ["background"]);
    background = { fill: hex, ...(token && { token }) };
    break;
  }
  // The content's height (the page's viewport only counts when the frame's height is fixed).
  const bodyStyle = view.getComputedStyle(doc.body);
  const height = Math.max(
    doc.body.getBoundingClientRect().bottom + px(bodyStyle.marginBottom),
    ...out.map(({ el }) => el.y - options.y + el.height),
  );

  return {
    ok: true,
    elements: out.map(({ el }) => el as Record<string, unknown>),
    assets,
    background,
    height: Math.ceil(height),
    violations: [...new Set(violations)].slice(0, 500),
    notes: [...notes].slice(0, 50),
  };
}

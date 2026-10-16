// Text measuring and wrapping for text, sticky notes and lists (tools.md §1, tools 3–6). Widths
// come from a hidden <canvas> measureText(), so the SVG <tspan> lines match what the browser draws.

import {
  type BoardElement,
  FONT_PX_MAX,
  FONT_PX_MIN,
  type FontFamily,
  type FontSize,
  type ListItem,
  MIND_LINE_HEIGHT,
  MIND_MAX_TEXT,
  mindNodeSize,
  tableSize,
  type TextMeasurer,
} from "@prism/shared";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_SIZES,
  fontInfo,
  fontStack,
  isFontLoaded,
  loadedFontCount,
  loadFonts,
  weightOf,
} from "./fonts";

/** Pixel sizes behind S / M / L / XL for a font (handwriting fonts run small, so they step up). */
export function fontSizes(font: FontFamily): Record<FontSize, number> {
  return fontInfo(font).sizes ?? DEFAULT_SIZES;
}

/** The default line height, as a multiple of the text size. */
export const LINE_HEIGHT = 1.25;
/** Space between a sticky note's edge and its text. */
export const STICKY_PADDING = 16;
/** Smallest size a sticky note shrinks its text to. */
const STICKY_MIN_FONT = 10;
/** Per indent level of a list, and the room the bullet takes, in ems. */
export const LIST_INDENT_EM = 1.2;
export const LIST_BULLET_EM = 1;
export const BULLETS = ["•", "◦", "▪", "•", "◦"];

let context: CanvasRenderingContext2D | null | undefined;

/**
 * Measured widths. Wrapping measures every candidate line, so a board full of paragraphs takes
 * tens of thousands of entries; a smaller cap would empty it during every redraw.
 */
const widthCache = new Map<string, number>();
const WIDTH_CACHE_LIMIT = 100_000;

/** Bumped when measurements are dropped, so drawn text lays itself out again. */
let measureEpoch = 0;
const epochListeners = new Set<() => void>();

const subscribeEpoch = (listener: () => void) => {
  epochListeners.add(listener);
  return () => epochListeners.delete(listener);
};

/**
 * Re-renders the caller when measurements are reset (web fonts finished loading). Shapes are
 * memoized on their element, so without it text would keep the fallback font's line breaks.
 */
export function useMeasureEpoch() {
  return useSyncExternalStore(subscribeEpoch, () => measureEpoch);
}

/**
 * The width of `text` in px. `spacing` is letter spacing in ems; browsers add it after every
 * character (the last one too), in SVG and in the editor's textarea alike.
 */
export function measure(text: string, font: FontFamily, px: number, weight = 400, spacing = 0) {
  const extra = spacing ? [...text].length * spacing * px : 0;
  const key = `${font}|${px}|${weight}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached + extra;
  if (context === undefined) context = document.createElement("canvas").getContext("2d");
  // Without a canvas (very old browsers, tests), estimate.
  if (!context) return text.length * px * 0.55 + extra;
  context.font = `${weight} ${px}px ${fontStack(font)}`;
  const width = context.measureText(text).width;
  if (widthCache.size > WIDTH_CACHE_LIMIT) widthCache.clear();
  widthCache.set(key, width);
  return width + extra;
}

/** Forget measurements once web fonts finish loading (they were taken with a fallback font). */
export function resetMeasurements() {
  widthCache.clear();
  measureEpoch++;
  for (const listener of epochListeners) listener();
}

/**
 * Text is measured on a canvas, which doesn't load web fonts by itself; load the fonts the
 * board's elements use first so the first layout is right. Gives up after 3s and measures with
 * what's there.
 */
export async function loadBoardFonts(elements: BoardElement[]) {
  const used = elements.flatMap((el) =>
    el.font || el.fontWeight ? [[el.font ?? "sans", weightOf(el)] as const] : [],
  );
  const before = loadedFontCount();
  await loadFonts(["sans", "caveat", "mono", ...used]);
  // Fonts already there (a second board, each dashboard preview) keep the measurements, and
  // drawn text doesn't lay itself out again.
  if (loadedFontCount() !== before || loadedFontCount() === 0) resetMeasurements();
  return true;
}

/**
 * Whether every font the board's text uses has loaded, so it can open without waiting: a board
 * with no text, or one opened after another board (or the dashboard) loaded the same fonts.
 */
export function boardFontsReady(elements: BoardElement[]) {
  return elements.every((el) => !hasText(el) || isFontLoaded(el.font ?? "sans", weightOf(el)));
}

/** Elements that draw text (theirs, or a table's or chart's labels). */
const hasText = (el: BoardElement) =>
  Boolean(el.text?.trim() || el.items?.length || el.table || el.chart);

const boardFontsKey = (boardId: string) => `prism:board-fonts:${boardId}`;

/**
 * Starts loading the fonts the board's text used when it was last opened in this browser, so
 * they download alongside its elements instead of after them.
 */
export function preloadBoardFonts(boardId: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(boardFontsKey(boardId)) ?? "[]") as unknown;
    if (!Array.isArray(saved)) return;
    const fonts = saved.filter(
      (entry): entry is [FontFamily, number] =>
        Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number",
    );
    if (fonts.length > 0) void loadFonts(fonts);
  } catch {
    // Nothing remembered; the fonts load once the elements are here.
  }
}

/** Remembers the fonts the board's text uses, for preloadBoardFonts next time. */
function rememberBoardFonts(boardId: string, elements: BoardElement[]) {
  const fonts = new Map<string, [FontFamily, number]>();
  for (const el of elements) {
    if (!hasText(el)) continue;
    const pair: [FontFamily, number] = [el.font ?? "sans", weightOf(el)];
    fonts.set(pair.join("|"), pair);
  }
  try {
    localStorage.setItem(boardFontsKey(boardId), JSON.stringify([...fonts.values()]));
  } catch {
    // Not remembered; next time the fonts load once the elements are here.
  }
}

/** The longest a board's opening loader waits for its fonts once its elements are here. */
export const BOARD_OPEN_FONT_WAIT_MS = 500;

/**
 * loadBoardFonts for a board that is opening: the loader waits for the fonts at most
 * BOARD_OPEN_FONT_WAIT_MS, then the board shows with fallback fonts. The fonts keep loading and
 * swap in (loadBoardFonts resets the measurements when they do).
 */
export function loadBoardFontsToOpen(elements: BoardElement[], boardId?: string) {
  if (boardId) rememberBoardFonts(boardId, elements);
  return Promise.race([
    loadBoardFonts(elements),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), BOARD_OPEN_FONT_WAIT_MS)),
  ]);
}

/** Splits text into lines: on newlines, then word by word to fit `maxWidth` (null = no wrap). */
export function wrapText(
  text: string,
  font: FontFamily,
  px: number,
  weight: number,
  maxWidth: number | null,
  spacing = 0,
): string[] {
  const widthOf = (part: string) => measure(part, font, px, weight, spacing);
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (maxWidth === null || widthOf(paragraph) <= maxWidth) {
      lines.push(paragraph);
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      const candidate = line + word;
      if (widthOf(candidate) <= maxWidth || !line.trim()) {
        line = candidate;
      } else {
        lines.push(line.trimEnd());
        line = word.trimStart();
      }
      // A single word wider than the box breaks by character.
      while (widthOf(line) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && widthOf(line.slice(0, cut)) > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

/** The element's text size: its free size if it has one, else its S / M / L / XL preset. */
export const fontPx = (el: BoardElement) =>
  el.fontSizePx ?? fontSizes(el.font ?? "sans")[el.fontSize ?? "M"];

/** The element's line height, as a multiple of its text size. */
export const lineHeightOf = (el: BoardElement) => el.lineHeight ?? LINE_HEIGHT;

/** The element's letter spacing in ems. */
export const letterSpacingOf = (el: BoardElement) => el.letterSpacing ?? 0;

/** A free text size kept to whole pixels within the allowed range. */
export const clampFontPx = (px: number) =>
  Math.min(FONT_PX_MAX, Math.max(FONT_PX_MIN, Math.round(px)));

export interface TextLayout {
  lines: string[];
  px: number;
  lineHeight: number;
  /** Widest line. */
  width: number;
}

/** A text element's lines: one per newline when it auto-sizes, wrapped to its width otherwise. */
export function layoutText(el: BoardElement): TextLayout {
  const font = el.font ?? "sans";
  const px = fontPx(el);
  const weight = weightOf(el);
  const spacing = letterSpacingOf(el);
  const maxWidth = el.autoWidth ? null : el.width;
  const lines = wrapText(el.text ?? "", font, px, weight, maxWidth, spacing);
  const width = Math.max(0, ...lines.map((line) => measure(line, font, px, weight, spacing)));
  return { lines, px, lineHeight: px * lineHeightOf(el), width };
}

/** A sticky note's lines, with the font shrunk step by step until the text fits the note. */
export function layoutSticky(el: BoardElement): TextLayout {
  const font = el.font ?? "sans";
  const weight = weightOf(el);
  const innerWidth = Math.max(1, el.width - 2 * STICKY_PADDING);
  const innerHeight = Math.max(1, el.height - 2 * STICKY_PADDING);
  const spacing = letterSpacingOf(el);
  const lineHeight = lineHeightOf(el);
  let px = fontPx(el);
  for (;;) {
    const lines = wrapText(el.text ?? "", font, px, weight, innerWidth, spacing);
    const fits = lines.length * px * lineHeight <= innerHeight;
    if (fits || px <= STICKY_MIN_FONT) {
      const width = Math.max(0, ...lines.map((line) => measure(line, font, px, weight, spacing)));
      return { lines, px, lineHeight: px * lineHeight, width };
    }
    px -= 1;
  }
}

/** The board's own wrapping and canvas measuring, for layouts computed outside the canvas. */
export const boardMeasure: TextMeasurer = (text, style, maxWidth) => {
  const { font, px, weight, letterSpacing } = style;
  const lines = wrapText(text, font, px, weight, maxWidth, letterSpacing);
  const width = Math.max(0, ...lines.map((line) => measure(line, font, px, weight, letterSpacing)));
  return { width, lines: lines.length, last: lines[lines.length - 1] ?? "" };
};

/** A mind map node's lines: on newlines, wrapped past MIND_MAX_TEXT. */
export function layoutMind(el: BoardElement): TextLayout {
  const font = el.font ?? "sans";
  const px = fontPx(el);
  const weight = weightOf(el);
  let lines = wrapText(el.text ?? "", font, px, weight, null);
  let width = Math.max(0, ...lines.map((line) => measure(line, font, px, weight)));
  if (width > MIND_MAX_TEXT) {
    lines = wrapText(el.text ?? "", font, px, weight, MIND_MAX_TEXT);
    width = MIND_MAX_TEXT;
  }
  return { lines, px, lineHeight: px * MIND_LINE_HEIGHT, width };
}

export interface ListLine {
  text: string;
  indent: number;
  /** Only the first line of an item gets the bullet. */
  bullet: boolean;
}

/** A list's lines: each item wrapped to the width left after its indent and bullet. */
export function layoutList(el: BoardElement) {
  const font = el.font ?? "sans";
  const px = fontPx(el);
  const weight = weightOf(el);
  const spacing = letterSpacingOf(el);
  const lines: ListLine[] = [];
  let width = 0;
  for (const item of el.items ?? []) {
    const offset = (item.indent * LIST_INDENT_EM + LIST_BULLET_EM) * px;
    const maxWidth = el.autoWidth ? null : el.width - offset;
    const wrapped = wrapText(item.text, font, px, weight, maxWidth, spacing);
    wrapped.forEach((text, i) => {
      lines.push({ text, indent: item.indent, bullet: i === 0 });
      width = Math.max(width, offset + measure(text, font, px, weight, spacing));
    });
  }
  return { lines, px, lineHeight: px * lineHeightOf(el), width };
}

/**
 * Text, lists and mind map nodes size their box to their text, and tables to their columns (as
 * wide as their text needs, or wider once resized by hand); anything else is as-is.
 */
export function fitTextBox(el: BoardElement): BoardElement {
  if (el.type === "table") {
    if (!el.table) return el;
    const size = tableSize(el.table, el.font ?? "sans", boardMeasure, !!el.keysOnly);
    const width = el.autoWidth ? size.width : Math.max(el.width, size.width);
    if (width === el.width && size.height === el.height) return el;
    return { ...el, width, height: size.height };
  }
  if (el.type === "mindnode") {
    const size = mindNodeSize(
      el.text ?? "",
      { font: el.font ?? "sans", px: fontPx(el), weight: weightOf(el) },
      boardMeasure,
    );
    if (size.width === el.width && size.height === el.height) return el;
    return { ...el, ...size };
  }
  if (el.type !== "text" && el.type !== "list") return el;
  const layout = el.type === "text" ? layoutText(el) : layoutList(el);
  const lineCount = Math.max(1, layout.lines.length);
  // An empty box keeps room for the caret.
  const width = el.autoWidth ? Math.max(layout.px, Math.ceil(layout.width) + 2) : el.width;
  const height = lineCount * layout.lineHeight;
  if (width === el.width && height === el.height) return el;
  return { ...el, width, height };
}

// ── List editing ──────────────────────────────────────────────────────────

/** The text a list shows in its editor: one item per line, indented with spaces, bullet first. */
export function listToText(items: ListItem[]) {
  return items.map((item) => `${"    ".repeat(item.indent)}• ${item.text}`).join("\n");
}

/** Reads the editor's text back into items: 4 leading spaces (or a tab) per indent level. */
export function textToList(text: string): ListItem[] {
  return text.split("\n").map((line) => {
    const lead = /^[ \t]*/.exec(line)?.[0] ?? "";
    const columns = [...lead].reduce((sum, ch) => sum + (ch === "\t" ? 4 : 1), 0);
    const indent = Math.min(4, Math.floor(columns / 4));
    const content = line.slice(lead.length).replace(/^[•◦▪-]\s?/, "");
    return { text: content, indent };
  });
}

// Text measuring and wrapping for text, sticky notes and lists (tools.md §1, tools 3–6). Widths
// come from a hidden <canvas> measureText(), so the SVG <tspan> lines match what the browser draws.

import {
  type BoardElement,
  FONT_PX_MAX,
  FONT_PX_MIN,
  type FontFamily,
  type FontSize,
  type ListItem,
} from "@prism/shared";
import { DEFAULT_SIZES, fontInfo, fontStack, weightOf } from "./fonts";

/** Pixel sizes behind S / M / L / XL for a font (handwriting fonts run small, so they step up). */
export function fontSizes(font: FontFamily): Record<FontSize, number> {
  return fontInfo(font).sizes ?? DEFAULT_SIZES;
}

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

const widthCache = new Map<string, number>();

export function measure(text: string, font: FontFamily, px: number, weight = 400) {
  const key = `${font}|${px}|${weight}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  if (context === undefined) context = document.createElement("canvas").getContext("2d");
  // Without a canvas (very old browsers, tests), estimate.
  if (!context) return text.length * px * 0.55;
  context.font = `${weight} ${px}px ${fontStack(font)}`;
  const width = context.measureText(text).width;
  if (widthCache.size > 5_000) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

/** Forget measurements once web fonts finish loading (they were taken with a fallback font). */
export function resetMeasurements() {
  widthCache.clear();
}

/** Splits text into lines: on newlines, then word by word to fit `maxWidth` (null = no wrap). */
export function wrapText(
  text: string,
  font: FontFamily,
  px: number,
  weight: number,
  maxWidth: number | null,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (maxWidth === null || measure(paragraph, font, px, weight) <= maxWidth) {
      lines.push(paragraph);
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      const candidate = line + word;
      if (measure(candidate, font, px, weight) <= maxWidth || !line.trim()) {
        line = candidate;
      } else {
        lines.push(line.trimEnd());
        line = word.trimStart();
      }
      // A single word wider than the box breaks by character.
      while (measure(line, font, px, weight) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut), font, px, weight) > maxWidth) cut--;
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
  const lines = wrapText(el.text ?? "", font, px, weight, el.autoWidth ? null : el.width);
  const width = Math.max(0, ...lines.map((line) => measure(line, font, px, weight)));
  return { lines, px, lineHeight: px * LINE_HEIGHT, width };
}

/** A sticky note's lines, with the font shrunk step by step until the text fits the note. */
export function layoutSticky(el: BoardElement): TextLayout {
  const font = el.font ?? "sans";
  const weight = weightOf(el);
  const innerWidth = Math.max(1, el.width - 2 * STICKY_PADDING);
  const innerHeight = Math.max(1, el.height - 2 * STICKY_PADDING);
  let px = fontPx(el);
  for (;;) {
    const lines = wrapText(el.text ?? "", font, px, weight, innerWidth);
    const fits = lines.length * px * LINE_HEIGHT <= innerHeight;
    if (fits || px <= STICKY_MIN_FONT) {
      const width = Math.max(0, ...lines.map((line) => measure(line, font, px, weight)));
      return { lines, px, lineHeight: px * LINE_HEIGHT, width };
    }
    px -= 1;
  }
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
  const lines: ListLine[] = [];
  let width = 0;
  for (const item of el.items ?? []) {
    const offset = (item.indent * LIST_INDENT_EM + LIST_BULLET_EM) * px;
    const wrapped = wrapText(item.text, font, px, weight, el.autoWidth ? null : el.width - offset);
    wrapped.forEach((text, i) => {
      lines.push({ text, indent: item.indent, bullet: i === 0 });
      width = Math.max(width, offset + measure(text, font, px, weight));
    });
  }
  return { lines, px, lineHeight: px * LINE_HEIGHT, width };
}

/** Text and lists size their box to their text; everything else is returned as-is. */
export function fitTextBox(el: BoardElement): BoardElement {
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

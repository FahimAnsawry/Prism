import type { BoardElement } from "@prism/shared";

// Checks a screen create_screen just built and reports what an AI editor should fix before it
// shows the user: text that wraps more than it was written, content spilling out of its
// container, unreadable contrast, tiny text, too many sizes and too many accent colors. It reads
// only the laid-out elements, so it works the same for browser-measured and estimated layouts.

export type ScreenWarning = { kind: string; ids: string[]; message: string };

const WARNINGS_MAX = 20;
/** Rounding slack in px before something counts as spilling out. */
const TOLERANCE = 1;
const PRESET_PX = { S: 16, M: 22, L: 30, XL: 40 } as const;
const MIN_TEXT_PX = 12;
const TEXT_SIZES_MAX = 8;
const ACCENT_FAMILIES_MAX = 3;
/** Shapes smaller than this (traffic-light dots, avatars) don't count toward the palette. */
const ACCENT_AREA_MIN = 400;

const isText = (el: BoardElement) => el.type === "text";
const pxOf = (el: BoardElement) => el.fontSizePx ?? PRESET_PX[el.fontSize ?? "M"];
const quote = (text: string | undefined) => {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return `"${flat.length > 40 ? `${flat.slice(0, 40)}…` : flat}"`;
};

/** A shape that visibly encloses what sits on it: a filled or outlined rect, ellipse or frame. */
function isContainer(el: BoardElement) {
  if (el.type !== "rect" && el.type !== "ellipse" && el.type !== "frame") return false;
  return el.fill !== null || el.strokeWidth > 0;
}

const area = (el: BoardElement) => Math.abs(el.width * el.height);

/** The topmost container drawn below `elements[index]` that holds its center, if any. */
function containerOf(elements: BoardElement[], index: number, filledOnly = false) {
  const el = elements[index]!;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  for (let i = index - 1; i >= 0; i--) {
    const c = elements[i]!;
    if (!isContainer(c) || (filledOnly && c.fill === null) || area(c) <= area(el)) continue;
    if (cx >= c.x && cx <= c.x + c.width && cy >= c.y && cy <= c.y + c.height) return c;
  }
  return undefined;
}

function spillsOut(el: BoardElement, c: BoardElement) {
  return (
    el.x < c.x - TOLERANCE ||
    el.y < c.y - TOLERANCE ||
    el.x + el.width > c.x + c.width + TOLERANCE ||
    el.y + el.height > c.y + c.height + TOLERANCE
  );
}

function rgb(color: string | null | undefined): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color ?? "")?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]) {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: [number, number, number], b: [number, number, number]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The color family of a saturated, mid-light color; null for neutrals, pale tints and near-black. */
function accentFamily(color: [number, number, number]) {
  const [r, g, b] = color.map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  if (max === min || light < 0.2 || light > 0.8) return null;
  const sat = (max - min) / (1 - Math.abs(2 * light - 1));
  if (sat < 0.35) return null;
  const d = max - min;
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 70) return "yellow";
  if (hue < 170) return "green";
  if (hue < 200) return "teal";
  if (hue < 250) return "blue";
  if (hue < 290) return "purple";
  return "pink";
}

export function lintScreen(elements: BoardElement[]): ScreenWarning[] {
  const warnings: ScreenWarning[] = [];
  const frame = elements.find((el) => el.type === "frame");
  const grouped = new Map<string, { ids: string[]; texts: string[]; detail: string }>();
  const group = (key: string, el: BoardElement, detail: () => string) => {
    const entry = grouped.get(key) ?? { ids: [], texts: [], detail: detail() };
    entry.ids.push(el.id);
    entry.texts.push(el.text ?? "");
    grouped.set(key, entry);
  };

  elements.forEach((el, index) => {
    if (el.type === "frame" || el.type === "line" || el.type === "arrow") return;

    // Spilling out of the frame, or out of the card, button or panel it sits on.
    if (frame && spillsOut(el, frame)) {
      warnings.push({
        kind: "overflow",
        ids: [el.id],
        message: `${isText(el) ? `Text ${quote(el.text)}` : `A ${el.role ?? el.type}`} reaches outside the frame. Make it or its row narrower, or let it wrap.`,
      });
    } else {
      const container = containerOf(elements, index);
      if (container && container !== frame && spillsOut(el, container)) {
        warnings.push({
          kind: "overflow",
          ids: [el.id],
          message: `${isText(el) ? `Text ${quote(el.text)}` : `A ${el.role ?? el.type}`} spills out of the ${container.role ?? container.type} it sits on (${container.id}). Give the container room (width, padding) or shorten the content.`,
        });
      }
    }

    if (!isText(el) || !el.text) return;
    const px = pxOf(el);

    // Wrapping into more lines than written: a headline or label that breaks where it shouldn't.
    const written = el.text.split("\n").length;
    const lines = Math.round(el.height / (px * (el.lineHeight ?? 1.25)));
    if (lines > written && (px >= 24 || el.text.length <= 48)) {
      warnings.push({
        kind: "wrap",
        ids: [el.id],
        message: `Text ${quote(el.text)} wraps to ${lines} lines (written as ${written}). Widen its container, shorten it, or put \\n where it should break.`,
      });
    }

    if (px < MIN_TEXT_PX) {
      group(`small:${px}`, el, () => `${px}px; keep text at ${MIN_TEXT_PX}px or more.`);
    }

    // WCAG AA against the fill it sits on (or the frame).
    const backgroundFill = (containerOf(elements, index, true) ?? frame)?.fill;
    const text = rgb(el.stroke);
    const background = rgb(backgroundFill);
    if (text && background && el.opacity >= 1) {
      const ratio = contrast(text, background);
      const weight =
        el.fontWeight === "bold" ? 700 : el.fontWeight === "normal" ? 400 : el.fontWeight;
      const large = px >= 24 || (px >= 18.6 && (weight ?? 400) >= 700);
      const needed = large ? 3 : 4.5;
      if (ratio < needed) {
        group(
          `contrast:${el.stroke}:${backgroundFill}:${needed}`,
          el,
          () =>
            `${el.stroke} on ${backgroundFill} is ${ratio.toFixed(1)}:1; it needs ${needed}:1. Darken the text or lighten the fill.`,
        );
      }
    }
  });

  // One warning per cause: a row of six gray logos is one problem, not six.
  for (const [key, { ids, texts, detail }] of grouped) {
    const kind = key.slice(0, key.indexOf(":"));
    const subject =
      ids.length === 1
        ? `Text ${quote(texts[0])}`
        : `${ids.length} texts (${texts.slice(0, 3).map(quote).join(", ")}${ids.length > 3 ? ", …" : ""})`;
    warnings.push({
      kind: kind === "small" ? "small-text" : kind,
      ids,
      message: `${subject}: ${detail}`,
    });
  }

  const sizes = [...new Set(elements.filter(isText).map(pxOf))].sort((a, b) => a - b);
  if (sizes.length > TEXT_SIZES_MAX) {
    warnings.push({
      kind: "type-scale",
      ids: frame ? [frame.id] : [],
      message: `The screen uses ${sizes.length} text sizes (${sizes.join(", ")}px). Settle on a scale of about ${TEXT_SIZES_MAX - 1} and give each role one size.`,
    });
  }

  const families = new Set<string>();
  for (const el of elements) {
    const colors =
      el.type === "text" || el.type === "icon"
        ? [el.stroke]
        : area(el) >= ACCENT_AREA_MIN
          ? [el.fill, el.strokeWidth > 0 ? el.stroke : null]
          : [];
    for (const color of colors) {
      const parsed = rgb(color);
      const family = parsed && accentFamily(parsed);
      if (family) families.add(family);
    }
  }
  if (families.size > ACCENT_FAMILIES_MAX) {
    warnings.push({
      kind: "palette",
      ids: frame ? [frame.id] : [],
      message: `The screen uses ${families.size} accent color families (${[...families].join(", ")}). Keep one accent; use the others only for status chips and charts.`,
    });
  }

  return warnings.slice(0, WARNINGS_MAX);
}

import { cornerRadii, type BoardElement } from "@prism/shared";

// Checks a screen create_screen just built and reports what an AI editor should fix before it
// shows the user: text that wraps more than it was written, content spilling out of its
// container, unreadable contrast, tiny text, too many sizes, too many accent colors, gray boxes
// standing in for images, and the design guide's hierarchy rules (pure black or white ink, thin
// or badly leaded text, repeated radii, competing primary buttons, ungrouped labels, gray shadows
// on colored grounds). It reads only the laid-out elements, so it works the same for
// browser-measured and estimated layouts.

export type ScreenWarning = { kind: string; ids: string[]; message: string };

const WARNINGS_MAX = 20;
/** Rounding slack in px before something counts as spilling out. */
const TOLERANCE = 1;
const PRESET_PX = { S: 16, M: 22, L: 30, XL: 40 } as const;
const MIN_TEXT_PX = 12;
const TEXT_SIZES_MAX = 8;
const ACCENT_FAMILIES_MAX = 3;
/** Status chips and badges: short shapes whose colors (and their text's) mean state, not brand. */
const STATUS_HEIGHT_MAX = 32;
const STATUS_WIDTH_MAX = 200;
/** Icons a row of reads as a rating, which needs the active ones filled. */
const RATING_ICONS = new Set(["star", "heart", "thumbs-up", "circle"]);
const RATING_ROW_MIN = 3;
/** Side-by-side cards: same top and width within this many px; heights may differ this much. */
const SIBLING_ALIGN_TOLERANCE = 4;
const SIBLING_HEIGHT_TOLERANCE = 4;
const SIBLING_SIZE_MIN = 60;
/** Off the main column: an edge this close to the column's, but not on it. */
const COLUMN_NEAR_MIN = 4;
const COLUMN_NEAR_MAX = 24;
/** A block at least this share of the column's width is checked against it. */
const COLUMN_BLOCK_SHARE = 0.3;
/** A gray box this big on both sides, with nothing on it, reads as a missing image. */
const PLACEHOLDER_SIDE_MIN = 80;
/** How far apart a gray's channels may be (a slate tint still counts as gray). */
const PLACEHOLDER_TINT_MAX = 24;
/** Shapes smaller than this (traffic-light dots, avatars) don't count toward the palette. */
const ACCENT_AREA_MIN = 400;
/** A wrapped paragraph's last line this short (or one word) is an orphan. */
const ORPHAN_CHARS_MAX = 12;
/** Line height when a text doesn't set one (as drawn). */
const LINE_HEIGHT_DEFAULT = 1.25;
/** Body text (up to this size) wants 1.3-1.75 when it wraps; headings (from HEADING_PX) at most 1.3. */
const BODY_PX_MAX = 20;
const BODY_LINE_HEIGHT_MIN = 1.3;
const BODY_LINE_HEIGHT_MAX = 1.75;
const HEADING_PX = 32;
const HEADING_LINE_HEIGHT_MAX = 1.3;
/** Weights under this are for display sizes only (LIGHT_WEIGHT_PX and up). */
const LIGHT_WEIGHT_MAX = 400;
const LIGHT_WEIGHT_PX = 20;
/** A box this close to its container's edges shows whether their corners nest. */
const NESTED_INSET_MAX = 48;
/** Buttons in one row: centers this close vertically, at most this far apart. */
const ROW_ALIGN_TOLERANCE = 4;
const ROW_GAP_MAX = 64;
/** A text this close above a field (and no bigger) is its label. */
const LABEL_GAP_MAX = 32;
/** How far apart a shadow color's channels may be and still read as gray. */
const NEUTRAL_SHADOW_TINT_MAX = 12;

const isText = (el: BoardElement) => el.type === "text";
const pxOf = (el: BoardElement) => el.fontSizePx ?? PRESET_PX[el.fontSize ?? "M"];
const weightOf = (el: BoardElement) =>
  el.fontWeight === "bold" ? 700 : el.fontWeight === "normal" ? 400 : (el.fontWeight ?? 400);
const isLine = (el: BoardElement) => el.type === "line" || el.type === "arrow";
const bottomOf = (el: BoardElement) => el.y + el.height;
/** Whether `a` and `b` share some horizontal span. */
const overlapsX = (a: BoardElement, b: BoardElement) => a.x < b.x + b.width && a.x + a.width > b.x;
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

/**
 * `layers` gives the overlay layer (create_screen) of elements drawn in one: such an element only
 * spills out of containers in its own layer, since a layer may hang over what's under it.
 */
/** Filled shapes small enough to be status chips or badges. */
function statusShapes(elements: BoardElement[]) {
  return new Set(
    elements.filter(
      (el) =>
        (el.type === "rect" || el.type === "ellipse") &&
        el.fill !== null &&
        Math.abs(el.height) <= STATUS_HEIGHT_MAX &&
        Math.abs(el.width) <= STATUS_WIDTH_MAX,
    ),
  );
}

/** A row of rating-style icons (stars, hearts) with none filled: it reads as an empty rating. */
function emptyRatings(elements: BoardElement[]): ScreenWarning[] {
  const rows = new Map<string, BoardElement[]>();
  for (const el of elements) {
    if (el.type !== "icon" || !el.icon || !RATING_ICONS.has(el.icon)) continue;
    const key = `${el.icon}:${Math.round(el.y)}:${Math.round(el.height)}`;
    rows.set(key, [...(rows.get(key) ?? []), el]);
  }
  const warnings: ScreenWarning[] = [];
  for (const icons of rows.values()) {
    const run: BoardElement[] = [];
    const flush = () => {
      if (run.length >= RATING_ROW_MIN && run.every((el) => !el.fill)) {
        const icon = run[0]?.icon ?? "star";
        warnings.push({
          kind: "outline-rating",
          ids: run.map((el) => el.id),
          message: `${run.length} outline ${icon} icons in a row read as an empty rating. Fill the active ones (fill: "#f59e0b" for stars, the accent for hearts) and keep the rest outlined or light.`,
        });
      }
      run.length = 0;
    };
    // Neighbors only: icons in one row sit within two icon widths of each other.
    for (const el of icons.sort((a, b) => a.x - b.x)) {
      const last = run.at(-1);
      if (last && el.x - (last.x + last.width) > last.width * 2) flush();
      run.push(el);
    }
    flush();
  }
  return warnings;
}

/** The component a shape belongs to: its role, its component, else its group's name. */
function kindOf(el: BoardElement) {
  return el.role ?? el.component ?? el.groupId?.replace(/-\d+-[a-z0-9]+$/, "") ?? null;
}

/** Cards side by side (same top, same width, same kind) with different heights. */
function unevenSiblings(elements: BoardElement[]): ScreenWarning[] {
  const cards = elements.filter(
    (el) =>
      (el.type === "rect" || el.type === "ellipse") &&
      isContainer(el) &&
      kindOf(el) !== null &&
      Math.min(Math.abs(el.width), Math.abs(el.height)) >= SIBLING_SIZE_MIN,
  );
  const warnings: ScreenWarning[] = [];
  const seen = new Set<BoardElement>();
  for (const card of cards) {
    if (seen.has(card)) continue;
    const row = cards.filter(
      (other) =>
        kindOf(other) === kindOf(card) &&
        Math.abs(other.y - card.y) <= SIBLING_ALIGN_TOLERANCE &&
        Math.abs(other.width - card.width) <= SIBLING_ALIGN_TOLERANCE,
    );
    for (const other of row) seen.add(other);
    const heights = row.map((el) => el.height);
    const spread = Math.max(...heights) - Math.min(...heights);
    if (row.length < 2 || spread <= SIBLING_HEIGHT_TOLERANCE) continue;
    warnings.push({
      kind: "uneven-siblings",
      ids: row.map((el) => el.id),
      message: `${row.length} side-by-side "${kindOf(card)}" blocks have different heights (${heights.map((h) => Math.round(h)).join(", ")}px). Make them equal: put them in a grid, or give their row align: "stretch".`,
    });
  }
  return warnings;
}

/**
 * Blocks whose left edge is close to the page's main column but not on it. The column is the
 * left edge the page's top-level blocks share most (weighted by width); blocks inside a card or
 * panel line up with that instead, and overlay layers may sit anywhere.
 */
function offColumn(
  elements: BoardElement[],
  frame: BoardElement,
  layers: ReadonlyMap<string, string>,
): ScreenWarning[] {
  const fullBleed = (el: BoardElement) => Math.abs(el.width) >= Math.abs(frame.width) - 2;
  const topLevel = elements.filter((el, index) => {
    if (el === frame || fullBleed(el) || layers.has(el.id)) return false;
    if (el.type === "line" || el.type === "arrow") return false;
    if (isText(el) && el.textAlign === "center") return false;
    const holder = containerOf(elements, index);
    return !holder || holder === frame || fullBleed(holder);
  });
  const weight = new Map<number, number>();
  for (const el of topLevel) {
    const left = Math.round(el.x);
    weight.set(left, (weight.get(left) ?? 0) + Math.abs(el.width));
  }
  const column = [...weight].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (column === undefined) return [];
  const columnWidth = Math.max(
    ...topLevel.filter((el) => Math.round(el.x) === column).map((el) => Math.abs(el.width)),
  );
  return topLevel.flatMap((el): ScreenWarning[] => {
    const off = el.x - column;
    if (Math.abs(el.width) < columnWidth * COLUMN_BLOCK_SHARE) return [];
    if (Math.abs(off) < COLUMN_NEAR_MIN || Math.abs(off) > COLUMN_NEAR_MAX) return [];
    return [
      {
        kind: "off-column",
        ids: [el.id],
        message: `${isText(el) ? `Text ${quote(el.text)}` : `A ${el.role ?? el.type}`} starts ${Math.round(Math.abs(off))}px ${off > 0 ? "right" : "left"} of the page's main column (${Math.round(column - frame.x)}px from the frame's left edge). Line it up with the other sections: give it the same padding as theirs.`,
      },
    ];
  });
}

/** A neutral gray between light and dark: not a white or near-white surface, not a dark panel. */
function isMidGray(color: string | null | undefined) {
  const parsed = rgb(color);
  if (!parsed) return false;
  const max = Math.max(...parsed);
  const min = Math.min(...parsed);
  const light = (max + min) / 2 / 255;
  return max - min <= PLACEHOLDER_TINT_MAX && light >= 0.55 && light <= 0.95;
}

/**
 * A big flat gray rect or ellipse with nothing on it (`above`: what's drawn after it): the gray
 * box that stands in for a photo, an avatar or an illustration.
 */
function isPlaceholder(el: BoardElement, above: BoardElement[]) {
  if (el.type !== "rect" && el.type !== "ellipse") return false;
  if (el.gradient || el.fillImage || !isMidGray(el.fill)) return false;
  if (Math.min(Math.abs(el.width), Math.abs(el.height)) < PLACEHOLDER_SIDE_MIN) return false;
  return !above.some((other) => {
    const cx = other.x + other.width / 2;
    const cy = other.y + other.height / 2;
    return cx >= el.x && cx <= el.x + el.width && cy >= el.y && cy <= el.y + el.height;
  });
}

const isPureBlack = (color: string | null | undefined) =>
  /^#(000|000000|000000ff)$/i.test(color ?? "");
const isPureWhite = (color: string | null | undefined) =>
  /^#(fff|ffffff|ffffffff)$/i.test(color ?? "");

/** A noticeably colored ground, pale tints included (a lilac field), but not cream or slate. */
function isColoredGround(color: string | null | undefined) {
  const parsed = rgb(color);
  if (!parsed) return false;
  const max = Math.max(...parsed) / 255;
  const min = Math.min(...parsed) / 255;
  const light = (max + min) / 2;
  if (max - min < 0.1 || light < 0.45) return false;
  return (max - min) / (1 - Math.abs(2 * light - 1)) >= 0.4;
}

/** A shadow drawn in gray or black: the presets, or custom layers that are all untinted. */
function isNeutralShadow(shadow: BoardElement["shadow"]) {
  if (!shadow) return false;
  if (typeof shadow === "string") return true;
  return shadow.every((layer) => {
    const parsed = rgb(layer.color);
    return parsed !== null && Math.max(...parsed) - Math.min(...parsed) <= NEUTRAL_SHADOW_TINT_MAX;
  });
}

/** `color` darkened toward black, at a soft alpha: a shadow in that color's hue. */
function tintedShadow(color: [number, number, number]) {
  return `#${color
    .map((v) =>
      Math.round(v * 0.35)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}40`;
}

const isButton = (el: BoardElement) =>
  el.role === "button" || /^button\b/i.test(el.component ?? "");

/** A filled button in the accent: the primary token, or a saturated fill. */
function isPrimaryButton(el: BoardElement) {
  if (el.type !== "rect" || el.fill === null || el.fillImage || !isButton(el)) return false;
  if (el.tokens?.fill === "primary") return true;
  const parsed = rgb(el.fill);
  return parsed !== null && accentFamily(parsed) !== null;
}

/** The text drawn on a shape (a button's label), if any. */
function labelOn(elements: BoardElement[], shape: BoardElement) {
  return elements.find((el) => {
    if (!isText(el)) return false;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    return (
      cx >= shape.x && cx <= shape.x + shape.width && cy >= shape.y && cy <= shape.y + shape.height
    );
  });
}

/**
 * Boxes inside a rounded container, near its edges, whose radius is as big as the container's:
 * nested corners take the outer radius minus the padding between them.
 */
function nestedRadius(
  elements: BoardElement[],
  layers: ReadonlyMap<string, string>,
): ScreenWarning[] {
  const byContainer = new Map<BoardElement, { ids: string[]; inner: number; inset: number }>();
  elements.forEach((el, index) => {
    if (el.type !== "rect" || !isContainer(el)) return;
    const c = containerOf(elements, index);
    if (!c || c.type !== "rect" || layers.get(c.id) !== layers.get(el.id)) return;
    const outer = Math.max(...cornerRadii(c.radius, c.width, c.height));
    const inner = Math.max(...cornerRadii(el.radius, el.width, el.height));
    // Pills and circles are their own shape family, not a smaller version of the container's.
    const round = inner >= Math.min(Math.abs(el.width), Math.abs(el.height)) / 2 - 0.5;
    if (outer <= 0 || inner <= 0 || round || inner < outer) return;
    const insetX = Math.min(el.x - c.x, c.x + c.width - (el.x + el.width));
    const insetY = Math.min(el.y - c.y, bottomOf(c) - bottomOf(el));
    // Flush with an edge (a cover photo on top of a card) is not nested.
    if (insetX <= TOLERANCE || insetY <= TOLERANCE) return;
    const inset = Math.min(insetX, insetY);
    if (inset > NESTED_INSET_MAX) return;
    const entry = byContainer.get(c) ?? { ids: [], inner, inset };
    entry.ids.push(el.id);
    byContainer.set(c, entry);
  });
  return [...byContainer].map(([c, { ids, inner, inset }]) => {
    const outer = Math.max(...cornerRadii(c.radius, c.width, c.height));
    const suggested = Math.max(Math.round(outer / 2), Math.round(outer - inset));
    return {
      kind: "nested-radius",
      ids,
      message: `${ids.length === 1 ? "A box" : `${ids.length} boxes`} inside the ${c.role ?? c.type} (${c.id}) ${ids.length === 1 ? "has" : "have"} radius ${Math.round(inner)}, as round as the ${c.role ?? c.type}'s ${Math.round(outer)}. An inner radius is the outer radius minus the padding between them: make ${ids.length === 1 ? "it" : "them"} about ${suggested}.`,
    };
  });
}

/** Two or more filled accent buttons side by side in one container: two equal choices. */
function primaryCount(elements: BoardElement[]): ScreenWarning[] {
  const buttons = elements.flatMap((el, index) =>
    isPrimaryButton(el) ? [{ el, holder: containerOf(elements, index) }] : [],
  );
  const warnings: ScreenWarning[] = [];
  const seen = new Set<BoardElement>();
  for (const { el, holder } of buttons) {
    if (seen.has(el)) continue;
    const cy = el.y + el.height / 2;
    const row = buttons
      .filter(
        (other) =>
          other.holder === holder &&
          Math.abs(other.el.y + other.el.height / 2 - cy) <= ROW_ALIGN_TOLERANCE,
      )
      .map((other) => other.el)
      .sort((a, b) => a.x - b.x);
    for (const other of row) seen.add(other);
    // Neighbors only: two buttons far apart in a wide row are separate places.
    const runs: BoardElement[][] = [];
    for (const button of row) {
      const run = runs.at(-1);
      const last = run?.at(-1);
      if (run && last && button.x - (last.x + last.width) <= ROW_GAP_MAX) run.push(button);
      else runs.push([button]);
    }
    for (const run of runs.filter((r) => r.length >= 2)) {
      const labels = run.map((button) => quote(labelOn(elements, button)?.text));
      warnings.push({
        kind: "primary-count",
        ids: run.map((button) => button.id),
        message: `${run.length} filled accent buttons side by side (${labels.join(", ")}) read as ${run.length} equal choices. Keep the main action filled and make the others outline, ghost or a text link.`,
      });
    }
  }
  return warnings;
}

/**
 * Field labels no closer to their field than to what's above them, so the label doesn't read
 * with its own field.
 */
function proximity(elements: BoardElement[]): ScreenWarning[] {
  const holders = elements.map((_, index) => containerOf(elements, index));
  const found: { label: BoardElement; below: number; above: number }[] = [];
  const isInput = (el: BoardElement) =>
    el.type === "rect" && (el.role === "input" || /^input\b/i.test(el.component ?? ""));
  elements.forEach((input, index) => {
    if (!isInput(input)) return;
    // Only what shares the field's container and horizontal span.
    const near = elements.filter(
      (el, i) => holders[i] === holders[index] && el !== input && overlapsX(el, input),
    );
    // The label: the nearest small text above the field.
    const label = near
      .filter((el) => isText(el) && pxOf(el) <= BODY_PX_MAX && bottomOf(el) <= input.y + TOLERANCE)
      .sort((a, b) => bottomOf(b) - bottomOf(a))[0];
    if (!label) return;
    const below = input.y - bottomOf(label);
    if (below > LABEL_GAP_MAX) return;
    // What's above the label: the previous field, its helper text, a heading.
    const gaps = near
      .filter(
        (el) =>
          el !== label && el.type !== "frame" && !isLine(el) && bottomOf(el) <= label.y + TOLERANCE,
      )
      .map((el) => label.y - bottomOf(el));
    if (gaps.length === 0) return;
    const above = Math.min(...gaps);
    if (below + 0.5 >= above) found.push({ label, below, above });
  });
  if (found.length === 0) return [];
  const first = found[0]!;
  return [
    {
      kind: "proximity",
      ids: found.map(({ label }) => label.id),
      message: `${
        found.length === 1
          ? `The label ${quote(first.label.text)} sits`
          : `${found.length} field labels (${found
              .slice(0, 3)
              .map(({ label }) => quote(label.text))
              .join(", ")}${found.length > 3 ? ", …" : ""}) sit`
      } as far from ${found.length === 1 ? "its field" : "their fields"} as from what's above (${Math.round(first.below)}px below, ${Math.round(first.above)}px above), so nothing reads as grouped. Put a label 8 above its field and 24 or more between fields.`,
    },
  ];
}

/** Neutral gray shadows on a colored ground, where they read as dirt. */
function grayShadow(elements: BoardElement[], frame: BoardElement | undefined): ScreenWarning[] {
  const byGround = new Map<BoardElement, string[]>();
  elements.forEach((el, index) => {
    if (!isNeutralShadow(el.shadow)) return;
    const ground = containerOf(elements, index, true) ?? frame;
    if (!ground || ground === el || !isColoredGround(ground.fill)) return;
    byGround.set(ground, [...(byGround.get(ground) ?? []), el.id]);
  });
  return [...byGround].map(([ground, ids]) => ({
    kind: "gray-shadow",
    ids,
    message: `${ids.length === 1 ? "A shadow" : `${ids.length} shadows`} on the ${ground.role ?? ground.type} (${ground.fill}) ${ids.length === 1 ? "is" : "are"} neutral gray. On a colored ground a shadow takes the ground's hue: use custom layers such as [{ x: 0, y: 12, blur: 32, spread: -8, color: "${tintedShadow(rgb(ground.fill)!)}" }].`,
  }));
}

/** What the layout knew besides the elements (none of it stored). */
export interface LintExtras {
  /** Wrapped text's last line, by element id. */
  lastLines?: ReadonlyMap<string, string>;
  /** Rows a child without a width grows across (rowFillTraps), as messages. */
  rowFill?: string[];
}

export function lintScreen(
  elements: BoardElement[],
  layers: ReadonlyMap<string, string> = new Map(),
  extras: LintExtras = {},
): ScreenWarning[] {
  const warnings: ScreenWarning[] = [];
  const rowFill = extras.rowFill ?? [];
  // A row grown too wide is usually why things spill: say so where they do.
  const spillCause =
    rowFill.length > 0
      ? " A row that grows to its full width (see the row-fill warning) is the likely cause."
      : "";
  for (const message of rowFill) warnings.push({ kind: "row-fill", ids: [], message });
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
        message: `${isText(el) ? `Text ${quote(el.text)}` : `A ${el.role ?? el.type}`} reaches outside the frame. Make it or its row narrower, or let it wrap.${spillCause}`,
      });
    } else {
      const container = containerOf(elements, index);
      const sameLayer = container && layers.get(container.id) === layers.get(el.id);
      if (container && container !== frame && sameLayer && spillsOut(el, container)) {
        warnings.push({
          kind: "overflow",
          ids: [el.id],
          message: `${isText(el) ? `Text ${quote(el.text)}` : `A ${el.role ?? el.type}`} spills out of the ${container.role ?? container.type} it sits on (${container.id}). Give the container room (width, padding) or shorten the content.${spillCause}`,
        });
      }
    }

    if (!isText(el) || !el.text) return;
    const px = pxOf(el);

    // Wrapping into more lines than written: a headline or label that breaks where it shouldn't.
    const written = el.text.split("\n").length;
    const lineHeight = el.lineHeight ?? LINE_HEIGHT_DEFAULT;
    const lines = Math.round(el.height / (px * lineHeight));
    if (lines > written && (px >= 24 || el.text.length <= 48)) {
      warnings.push({
        kind: "wrap",
        ids: [el.id],
        message: `Text ${quote(el.text)} wraps to ${lines} lines (written as ${written}). Widen its container, shorten it, or put \\n where it should break.`,
      });
    } else {
      // A paragraph that wraps with one short word left on its last line.
      const last = extras.lastLines?.get(el.id)?.trim();
      if (last && (!/\s/.test(last) || last.length <= ORPHAN_CHARS_MAX)) {
        warnings.push({
          kind: "orphan",
          ids: [el.id],
          message: `Text ${quote(el.text)} ends with "${last}" alone on its last line. Reword it, make its container a little wider or narrower, or put \\n where a line should break, so the last line holds a few words.`,
        });
      }
    }

    if (px < MIN_TEXT_PX) {
      group(`small:${px}`, el, () => `${px}px; keep text at ${MIN_TEXT_PX}px or more.`);
    }

    const weight = weightOf(el);
    if (weight < LIGHT_WEIGHT_MAX && px < LIGHT_WEIGHT_PX) {
      group(
        `light-weight:${weight}:${px}`,
        el,
        () =>
          `weight ${weight} at ${px}px reads thin. Use 400 or more below ${LIGHT_WEIGHT_PX}px; keep light weights for display sizes.`,
      );
    }

    // Leading: paragraphs that wrap want 1.5-1.6, headings stay tight.
    if (px <= BODY_PX_MAX && lines > 1 && lineHeight < BODY_LINE_HEIGHT_MIN) {
      group(
        `line-height:tight:${lineHeight}`,
        el,
        () =>
          `line height ${lineHeight} is cramped for paragraph text. Give it lineHeight 1.5 (1.5-1.6).`,
      );
    } else if (px <= BODY_PX_MAX && lines > 1 && lineHeight > BODY_LINE_HEIGHT_MAX) {
      group(
        `line-height:loose:${lineHeight}`,
        el,
        () =>
          `line height ${lineHeight} pulls the lines apart. Keep paragraph text at 1.5-1.6, never above ${BODY_LINE_HEIGHT_MAX}.`,
      );
    } else if (px >= HEADING_PX && lineHeight > HEADING_LINE_HEIGHT_MAX) {
      group(
        `line-height:heading:${lineHeight}`,
        el,
        () =>
          `line height ${lineHeight} is loose for a heading. Use 1.05-1.15 at display sizes and about 1.3 at 32-40px, never above ${HEADING_LINE_HEIGHT_MAX}.`,
      );
    }

    // WCAG AA against the fill it sits on (or the frame).
    const holder = containerOf(elements, index, true);
    const backgroundFill = (holder ?? frame)?.fill;
    const text = rgb(el.stroke);
    const background = rgb(backgroundFill);
    if (text && background && el.opacity >= 1) {
      // Pure black on a light neutral, or pure white paragraphs on a dark one, are harsh.
      const neutral = accentFamily(background) === null;
      if (neutral && isPureBlack(el.stroke) && luminance(background) >= 0.5) {
        group(
          `pure-ink:${el.stroke}:${backgroundFill}`,
          el,
          () =>
            `pure ${el.stroke} on ${backgroundFill} is harsh. Use a near-black tinted toward the palette (e.g. #111827, or $foreground).`,
        );
      } else if (
        neutral &&
        isPureWhite(el.stroke) &&
        luminance(background) < 0.2 &&
        px <= BODY_PX_MAX &&
        lines > 1 &&
        !(holder && isButton(holder))
      ) {
        group(
          `pure-ink:${el.stroke}:${backgroundFill}`,
          el,
          () =>
            `pure ${el.stroke} paragraph text on ${backgroundFill} glares. Dim body text a step (e.g. #d4d4d8, or $muted-foreground) and keep off-white for headings.`,
        );
      }

      const ratio = contrast(text, background);
      const large = px >= 24 || (px >= 18.6 && weight >= 700);
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
  const status = statusShapes(elements);
  elements.forEach((el, index) => {
    // State colors on chips and badges (and their text and icons) and charts aren't the palette.
    if (el.type === "chart" || status.has(el)) return;
    const holder = containerOf(elements, index, true);
    if (holder && status.has(holder)) return;
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
  });
  if (families.size > ACCENT_FAMILIES_MAX) {
    warnings.push({
      kind: "palette",
      ids: frame ? [frame.id] : [],
      message: `The screen uses ${families.size} accent color families (${[...families].join(", ")}). Keep one accent; use the others only for status chips and charts.`,
    });
  }

  warnings.push(
    ...emptyRatings(elements),
    ...unevenSiblings(elements),
    ...primaryCount(elements),
    ...proximity(elements),
    ...nestedRadius(elements, layers),
    ...grayShadow(elements, frame),
  );
  if (frame) warnings.push(...offColumn(elements, frame, layers));

  const placeholders = elements.filter((el, i) => isPlaceholder(el, elements.slice(i + 1)));
  if (placeholders.length > 0) {
    const sizes = placeholders.map((el) => `${Math.round(el.width)}×${Math.round(el.height)}`);
    warnings.push({
      kind: "missing-imagery",
      ids: placeholders.map((el) => el.id),
      message: `${placeholders.length === 1 ? `A ${sizes[0]} gray box looks like an image placeholder` : `${placeholders.length} gray boxes (${sizes.join(", ")}) look like image placeholders`}. Fill ${placeholders.length === 1 ? "it" : "them"} with a real photo (search_images, then image: { url }), an avatar (avatar on a box) or an SVG illustration (svg on a box).`,
    });
  }

  return warnings.slice(0, WARNINGS_MAX);
}

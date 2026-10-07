// Board math (tools.md §2): bounds, hit-testing in each element's rotated local space, arrow
// bindings and the resize / rotate transforms behind the selection handles.

import { type BoardElement, BLUR_TYPES } from "@prism/shared";
import { clampFontPx, fitTextBox, fontPx } from "./text-layout";

export interface Point {
  x: number;
  y: number;
}

/** An axis-aligned box with a positive width and height. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate" | "start" | "end";

/** Lines and arrows: (x, y) is the start point and (width, height) the vector to the end. */
export const isLinear = (el: BoardElement) => el.type === "line" || el.type === "arrow";

/** Images, SVGs, emoji and icons keep their aspect ratio on resize. */
export const keepsRatio = (el: BoardElement) =>
  el.type === "image" || el.type === "svg" || el.type === "emoji" || el.type === "icon";

/**
 * Text and lists scale their text when dragged by a corner or the top / bottom handle; the
 * left and right handles change the wrap width instead.
 */
export const scalesText = (el: BoardElement, handle: Handle) =>
  (el.type === "text" || el.type === "list") && handle !== "e" && handle !== "w";

/** What an arrow end can attach to. */
export const isBindable = (el: BoardElement) =>
  !isLinear(el) && el.type !== "freehand" && el.type !== "frame";

export const center = (el: BoardElement): Point => ({
  x: el.x + el.width / 2,
  y: el.y + el.height / 2,
});

export const startPoint = (el: BoardElement): Point => ({ x: el.x, y: el.y });
export const endPoint = (el: BoardElement): Point => ({ x: el.x + el.width, y: el.y + el.height });

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function rotatePoint(p: Point, origin: Point, degrees: number): Point {
  if (!degrees) return p;
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos };
}

/** A world point in the element's unrotated frame. */
export const toLocal = (el: BoardElement, p: Point) => rotatePoint(p, center(el), -el.rotation);

export function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** A freehand stroke's points in world space (unrotated). */
export function strokePoints(el: BoardElement): Point[] {
  const points = el.points ?? [];
  const out: Point[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    out.push({ x: el.x + (points[i] ?? 0), y: el.y + (points[i + 1] ?? 0) });
  }
  return out;
}

/** The four corners of the element's box, rotated. */
function corners(el: BoardElement): Point[] {
  const c = center(el);
  return [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y },
    { x: el.x + el.width, y: el.y + el.height },
    { x: el.x, y: el.y + el.height },
  ].map((p) => rotatePoint(p, c, el.rotation));
}

function boxAround(points: Point[]): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** The axis-aligned box around the element as drawn (rotation included). */
export function elementBounds(el: BoardElement): Box {
  if (isLinear(el)) return boxAround([startPoint(el), endPoint(el)]);
  return boxAround(corners(el));
}

export function boundsOf(elements: BoardElement[]): Box | null {
  if (elements.length === 0) return null;
  return boxAround(
    elements.flatMap((el) => {
      const b = elementBounds(el);
      return [
        { x: b.x, y: b.y },
        { x: b.x + b.width, y: b.y + b.height },
      ];
    }),
  );
}

export const intersects = (a: Box, b: Box) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

/**
 * What a frosted-glass element blurs: the elements under it (before it in `ordered`, bottom layer
 * first) that overlap it. Undefined for elements without a background blur.
 */
export function backdropOf(ordered: BoardElement[], index: number): BoardElement[] | undefined {
  const el = ordered[index];
  if (!el?.backdropBlur || !BLUR_TYPES.includes(el.type)) return undefined;
  const box = elementBounds(el);
  return ordered.slice(0, index).filter((other) => intersects(elementBounds(other), box));
}

export function boxFromPoints(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** Whether `p` touches the element, within `tolerance` world units of its outline. */
export function hitTest(el: BoardElement, p: Point, tolerance: number) {
  const reach = tolerance + el.strokeWidth / 2;
  if (isLinear(el)) return distanceToSegment(p, startPoint(el), endPoint(el)) <= reach;

  const local = toLocal(el, p);
  if (el.type === "freehand") {
    const points = strokePoints(el);
    if (points.length === 1 && points[0]) return distance(local, points[0]) <= reach;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (a && b && distanceToSegment(local, a, b) <= reach) return true;
    }
    return false;
  }

  const c = center(el);
  const hw = Math.abs(el.width) / 2 + tolerance;
  const hh = Math.abs(el.height) / 2 + tolerance;
  const dx = Math.abs(local.x - c.x);
  const dy = Math.abs(local.y - c.y);
  if (el.type === "ellipse") return (dx / hw) ** 2 + (dy / hh) ** 2 <= 1;
  if (el.type === "diamond") return dx / hw + dy / hh <= 1;
  return dx <= hw && dy <= hh;
}

/** The topmost element under `p`. `ordered` is bottom layer first. */
export function topHit(
  ordered: BoardElement[],
  p: Point,
  tolerance: number,
  accept: (el: BoardElement) => boolean = () => true,
) {
  for (let i = ordered.length - 1; i >= 0; i--) {
    const el = ordered[i];
    if (el && accept(el) && hitTest(el, p, tolerance)) return el;
  }
  return undefined;
}

// ── Arrows ────────────────────────────────────────────────────────────────

/** Space left between an arrow's end and the shape it's attached to. */
const BINDING_GAP = 6;

/**
 * Where the line from the shape's center toward `toward` crosses its outline, plus a small gap.
 * Works in the shape's local frame, so rotated shapes bind correctly.
 */
export function edgePoint(shape: BoardElement, toward: Point): Point {
  const c = center(shape);
  const local = toLocal(shape, toward);
  const dx = local.x - c.x;
  const dy = local.y - c.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return c;
  const ux = dx / length;
  const uy = dy / length;
  const hw = Math.abs(shape.width) / 2;
  const hh = Math.abs(shape.height) / 2;

  let t: number;
  if (shape.type === "ellipse") {
    t = 1 / Math.sqrt((ux / hw) ** 2 + (uy / hh) ** 2);
  } else if (shape.type === "diamond") {
    t = 1 / (Math.abs(ux) / hw + Math.abs(uy) / hh);
  } else {
    t = Math.min(ux ? hw / Math.abs(ux) : Infinity, uy ? hh / Math.abs(uy) : Infinity);
  }
  // Never past the point it aims at (the other end may sit right on the outline).
  const reach = Math.min(t + BINDING_GAP, Math.max(t, length));
  return rotatePoint({ x: c.x + ux * reach, y: c.y + uy * reach }, c, shape.rotation);
}

/** The arrow with its bound ends moved onto the outlines of the shapes they're attached to. */
export function routeArrow(arrow: BoardElement, byId: Map<string, BoardElement>): BoardElement {
  const from = arrow.startBinding ? byId.get(arrow.startBinding) : undefined;
  const to = arrow.endBinding ? byId.get(arrow.endBinding) : undefined;
  if (!from && !to) return arrow;
  const start = startPoint(arrow);
  const end = endPoint(arrow);
  const s = from ? edgePoint(from, to ? center(to) : end) : start;
  const e = to ? edgePoint(to, from ? center(from) : start) : end;
  const next = { x: s.x, y: s.y, width: e.x - s.x, height: e.y - s.y };
  if (
    next.x === arrow.x &&
    next.y === arrow.y &&
    next.width === arrow.width &&
    next.height === arrow.height
  ) {
    return arrow;
  }
  return { ...arrow, ...next };
}

/** Re-routes every attached arrow. Returns the same array if nothing moved. */
export function updateBindings(elements: BoardElement[]) {
  if (!elements.some((el) => el.startBinding || el.endBinding)) return elements;
  const byId = new Map(elements.map((el) => [el.id, el]));
  let changed = false;
  const next = elements.map((el) => {
    if (el.type !== "arrow" || (!el.startBinding && !el.endBinding)) return el;
    const routed = routeArrow(el, byId);
    if (routed !== el) changed = true;
    return routed;
  });
  return changed ? next : elements;
}

/** The shape an arrow end at `p` would attach to. */
export function bindingTarget(
  ordered: BoardElement[],
  p: Point,
  tolerance: number,
  exclude: string[],
) {
  return topHit(ordered, p, tolerance, (el) => isBindable(el) && !exclude.includes(el.id));
}

/** Rounds the direction from `origin` to `p` to 15° steps, keeping the length. */
export function snapAngle(origin: Point, p: Point): Point {
  const step = Math.PI / 12;
  const angle = Math.round(Math.atan2(p.y - origin.y, p.x - origin.x) / step) * step;
  const length = distance(origin, p);
  return { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
}

// ── Transforms ────────────────────────────────────────────────────────────

const MIN_SIZE = 4;

export const moveElement = (el: BoardElement, dx: number, dy: number): BoardElement => ({
  ...el,
  x: el.x + dx,
  y: el.y + dy,
});

/** Freehand points refit to a new box (`sx`, `sy` are the signed scale factors). */
function scalePoints(el: BoardElement, sx: number, sy: number, shiftX: number, shiftY: number) {
  if (!el.points) return undefined;
  return el.points.map((v, i) => (i % 2 === 0 ? v * sx + shiftX : v * sy + shiftY));
}

/** `el` with its text size (and a fixed wrap width) multiplied by `k`, refit to its text. */
function scaleTextBy(el: BoardElement, k: number): BoardElement {
  const px = fontPx(el);
  const next = clampFontPx(px * k);
  return fitTextBox({
    ...el,
    fontSizePx: next,
    width: el.autoWidth ? el.width : Math.max(MIN_SIZE, el.width * (next / px)),
  });
}

/**
 * Scales a text or list element's text by dragging `handle` to `p`: the opposite corner (or
 * edge) stays put and the font grows or shrinks with the box.
 */
function scaleText(el: BoardElement, handle: Handle, p: Point, start: Point): BoardElement {
  const c = center(el);
  const local = rotatePoint(p, c, -el.rotation);
  // Measured against where the drag began (the handle sits outside the box, on the frame).
  const from = rotatePoint(start, c, -el.rotation);
  const left = el.x;
  const right = el.x + el.width;
  const top = el.y;
  const bottom = el.y + el.height;
  // The point that stays where it is.
  const ax = handle.includes("w") ? right : handle.includes("e") ? left : c.x;
  const ay = handle.includes("n") ? bottom : handle.includes("s") ? top : c.y;
  const scales: number[] = [];
  if (handle.includes("w") || handle.includes("e")) {
    scales.push(Math.abs(local.x - ax) / Math.max(1, Math.abs(from.x - ax)));
  }
  if (handle.includes("n") || handle.includes("s")) {
    scales.push(Math.abs(local.y - ay) / Math.max(1, Math.abs(from.y - ay)));
  }
  const sized = scaleTextBy(el, Math.max(...scales));
  const nx = handle.includes("w")
    ? ax - sized.width
    : handle.includes("e")
      ? ax
      : c.x - sized.width / 2;
  const ny = handle.includes("n")
    ? ay - sized.height
    : handle.includes("s")
      ? ay
      : c.y - sized.height / 2;
  const placed = rotatePoint({ x: nx + sized.width / 2, y: ny + sized.height / 2 }, c, el.rotation);
  return { ...sized, x: placed.x - sized.width / 2, y: placed.y - sized.height / 2 };
}

/**
 * Resizes one element by dragging `handle` to `p`. Works in the element's local frame, then
 * places the new box so the opposite side stays where it was on screen.
 */
export function resizeElement(
  el: BoardElement,
  handle: Handle,
  p: Point,
  keepRatio: boolean,
  /** Where the drag began; text scales relative to it. */
  start: Point = p,
): BoardElement {
  if (scalesText(el, handle)) return scaleText(el, handle, p, start);
  const c = center(el);
  const local = rotatePoint(p, c, -el.rotation);
  let x0 = el.x;
  let y0 = el.y;
  let x1 = el.x + el.width;
  let y1 = el.y + el.height;
  if (handle.includes("w")) x0 = local.x;
  if (handle.includes("e")) x1 = local.x;
  if (handle.includes("n")) y0 = local.y;
  if (handle.includes("s")) y1 = local.y;

  if ((keepRatio || keepsRatio(el)) && el.width > 0 && el.height > 0) {
    const ratio = el.width / el.height;
    const w = x1 - x0;
    const h = y1 - y0;
    if (handle === "e" || handle === "w") {
      const nh = Math.abs(w) / ratio;
      y0 = c.y - nh / 2;
      y1 = c.y + nh / 2;
    } else if (handle === "n" || handle === "s") {
      const nw = Math.abs(h) * ratio;
      x0 = c.x - nw / 2;
      x1 = c.x + nw / 2;
    } else {
      const scale = Math.max(Math.abs(w) / el.width, Math.abs(h) / el.height);
      const nw = el.width * scale * (Math.sign(w) || 1);
      const nh = el.height * scale * (Math.sign(h) || 1);
      if (handle.includes("w")) x0 = x1 - nw;
      else x1 = x0 + nw;
      if (handle.includes("n")) y0 = y1 - nh;
      else y1 = y0 + nh;
    }
  }

  const nx = Math.min(x0, x1);
  const ny = Math.min(y0, y1);
  const nw = Math.max(MIN_SIZE, Math.abs(x1 - x0));
  const nh = Math.max(MIN_SIZE, Math.abs(y1 - y0));
  const placed = rotatePoint({ x: nx + nw / 2, y: ny + nh / 2 }, c, el.rotation);

  const sx = el.width ? (x1 - x0) / el.width : 1;
  const sy = el.height ? (y1 - y0) / el.height : 1;
  const points = scalePoints(el, sx, sy, x0 - nx, y0 - ny);
  return {
    ...el,
    x: placed.x - nw / 2,
    y: placed.y - nh / 2,
    width: nw,
    height: nh,
    ...(points && { points }),
    ...(el.autoWidth && { autoWidth: false }),
  };
}

/** The new group box when `handle` of `box` is dragged to `p` (no rotation). */
export function resizeBox(box: Box, handle: Handle, p: Point, keepRatio: boolean): Box {
  let x0 = box.x;
  let y0 = box.y;
  let x1 = box.x + box.width;
  let y1 = box.y + box.height;
  if (handle.includes("w")) x0 = Math.min(p.x, x1 - MIN_SIZE);
  if (handle.includes("e")) x1 = Math.max(p.x, x0 + MIN_SIZE);
  if (handle.includes("n")) y0 = Math.min(p.y, y1 - MIN_SIZE);
  if (handle.includes("s")) y1 = Math.max(p.y, y0 + MIN_SIZE);
  if (keepRatio && box.width > 0 && box.height > 0 && handle.length === 2) {
    const scale = Math.max((x1 - x0) / box.width, (y1 - y0) / box.height);
    const nw = box.width * scale;
    const nh = box.height * scale;
    if (handle.includes("w")) x0 = x1 - nw;
    else x1 = x0 + nw;
    if (handle.includes("n")) y0 = y1 - nh;
    else y1 = y0 + nh;
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Maps an element from group box `from` into group box `to` (multi-select resize). With
 * `scaleText`, text and lists scale their text too instead of rewrapping.
 */
export function fitIntoBox(el: BoardElement, from: Box, to: Box, scaleText = false): BoardElement {
  const sx = from.width ? to.width / from.width : 1;
  const sy = from.height ? to.height / from.height : 1;
  const map = (p: Point) => ({ x: to.x + (p.x - from.x) * sx, y: to.y + (p.y - from.y) * sy });
  if (scaleText && (el.type === "text" || el.type === "list")) {
    // A top / bottom drag only changes the height, so that's the scale.
    const sized = scaleTextBy(el, sx === 1 ? sy : Math.min(sx, sy));
    const c = map(center(el));
    return { ...sized, x: c.x - sized.width / 2, y: c.y - sized.height / 2 };
  }
  if (isLinear(el)) {
    const s = map(startPoint(el));
    const e = map(endPoint(el));
    return { ...el, x: s.x, y: s.y, width: e.x - s.x, height: e.y - s.y };
  }
  const uniform = keepsRatio(el) ? Math.min(sx, sy) : null;
  const width = Math.max(1, el.width * (uniform ?? sx));
  const height = Math.max(1, el.height * (uniform ?? sy));
  const c = map(center(el));
  const points = scalePoints(el, uniform ?? sx, uniform ?? sy, 0, 0);
  return {
    ...el,
    x: c.x - width / 2,
    y: c.y - height / 2,
    width,
    height,
    ...(points && { points }),
    ...(el.autoWidth && { autoWidth: false }),
  };
}

/** Turns an element by `degrees` around `origin` (its own center for a single element). */
export function rotateAround(el: BoardElement, origin: Point, degrees: number): BoardElement {
  if (isLinear(el)) {
    const s = rotatePoint(startPoint(el), origin, degrees);
    const e = rotatePoint(endPoint(el), origin, degrees);
    return { ...el, x: s.x, y: s.y, width: e.x - s.x, height: e.y - s.y };
  }
  const c = rotatePoint(center(el), origin, degrees);
  const rotation = (((el.rotation + degrees) % 360) + 360) % 360;
  return { ...el, x: c.x - el.width / 2, y: c.y - el.height / 2, rotation };
}

/** The angle from `origin` to `p` in degrees, 0 pointing up (where the rotate handle sits). */
export const angleTo = (origin: Point, p: Point) =>
  (Math.atan2(p.y - origin.y, p.x - origin.x) * 180) / Math.PI + 90;

// ── Selection handles ─────────────────────────────────────────────────────

/** In screen pixels: the frame's distance from the element, and the rotate handle's offset. */
export const FRAME_PAD = 8;
export const ROTATE_OFFSET = 30;

export interface Frame {
  /** The box the frame outlines (unrotated), already padded. */
  box: Box;
  rotation: number;
  /** Handles in world space. */
  handles: { handle: Handle; point: Point }[];
}

const BOX_HANDLES: [Handle, number, number][] = [
  ["nw", 0, 0],
  ["n", 0.5, 0],
  ["ne", 1, 0],
  ["e", 1, 0.5],
  ["se", 1, 1],
  ["s", 0.5, 1],
  ["sw", 0, 1],
  ["w", 0, 0.5],
];

/** The selection frame for `selected` at `zoom`: one element's rotated box, or the group's. */
export function selectionFrame(selected: BoardElement[], zoom: number): Frame | null {
  const pad = FRAME_PAD / zoom;
  const only = selected.length === 1 ? selected[0] : undefined;

  if (only && isLinear(only)) {
    const b = elementBounds(only);
    return {
      box: { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad },
      rotation: 0,
      handles: only.locked
        ? []
        : [
            { handle: "start", point: startPoint(only) },
            { handle: "end", point: endPoint(only) },
          ],
    };
  }

  const rotation = only ? only.rotation : 0;
  const inner = only
    ? { x: only.x, y: only.y, width: only.width, height: only.height }
    : boundsOf(selected);
  if (!inner) return null;
  const box = {
    x: inner.x - pad,
    y: inner.y - pad,
    width: inner.width + 2 * pad,
    height: inner.height + 2 * pad,
  };
  const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const editable = selected.some((el) => !el.locked);
  const handles: Frame["handles"] = editable
    ? [
        ...BOX_HANDLES.map(([handle, fx, fy]) => ({
          handle,
          point: rotatePoint(
            { x: box.x + fx * box.width, y: box.y + fy * box.height },
            c,
            rotation,
          ),
        })),
        {
          handle: "rotate" as const,
          point: rotatePoint({ x: c.x, y: box.y - ROTATE_OFFSET / zoom }, c, rotation),
        },
      ]
    : [];
  return { box, rotation, handles };
}

/** The handle under `p`, within 8 screen pixels. */
export function handleAt(frame: Frame | null, p: Point, zoom: number) {
  if (!frame) return undefined;
  return frame.handles.find(({ point }) => distance(point, p) <= 8 / zoom)?.handle;
}

const CURSORS = ["ns-resize", "nesw-resize", "ew-resize", "nwse-resize"];
const HANDLE_ANGLE: Partial<Record<Handle, number>> = {
  n: 0,
  ne: 45,
  e: 90,
  se: 135,
  s: 180,
  sw: 225,
  w: 270,
  nw: 315,
};

/** The resize cursor for a handle, turned with the frame. */
export function handleCursor(handle: Handle, rotation: number) {
  if (handle === "rotate") return "grab";
  if (handle === "start" || handle === "end") return "move";
  const angle = (HANDLE_ANGLE[handle] ?? 0) + rotation;
  const step = Math.round((((angle % 180) + 180) % 180) / 45) % 4;
  return CURSORS[step] ?? "default";
}

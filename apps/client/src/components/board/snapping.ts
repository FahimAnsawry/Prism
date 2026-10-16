// Alignment guides and snapping (tools.md §1 Select, Resize): while a card, section or frame is
// dragged or resized, its left / center / right edges snap to those of nearby elements on X and
// its top / middle / bottom edges on Y, and gaps that match between three or more elements snap
// to equal spacing. Everything here is pure: gestures ask for a snap and draw the guides it
// returns.

import type { BoardElement } from "@prism/shared";
import { type Box, elementBounds, type Handle } from "./geometry";

/** A guide line: at `at` on its axis, from `from` to `to` along the other. */
export interface GuideLine {
  /** "x" is a vertical line at x = `at`; "y" a horizontal one at y = `at`. */
  axis: "x" | "y";
  at: number;
  from: number;
  to: number;
}

/** One gap of an equal-spacing run: from `from` to `to` along `axis`, across at `at`. */
export interface GapMark {
  axis: "x" | "y";
  from: number;
  to: number;
  at: number;
}

export interface SnapGuides {
  lines: GuideLine[];
  gaps: GapMark[];
}

/** In screen pixels: how near an edge must come to snap, whatever the zoom. */
export const SNAP_DISTANCE = 6;
/** In screen pixels: elements farther than this from the dragged box don't take part. */
const REACH = 600;
/** Two positions closer than this (screen px) count as the same line. */
const SAME = 0.5;
const MIN_SIZE = 4;

/** Whether an element can be snapped to: shapes, text, images and frames; not strokes or arrows. */
const snappable = (el: BoardElement) =>
  el.type !== "arrow" && el.type !== "freehand" && (el.width !== 0 || el.height !== 0);

/**
 * The boxes of the elements a drag can snap to: everything except `skip` (what is being moved),
 * mind map nodes folded away (`hidden`), strokes and arrows.
 */
export function snapTargets(
  elements: BoardElement[],
  skip: ReadonlySet<string>,
  hidden: ReadonlySet<string>,
): Box[] {
  return elements
    .filter((el) => !skip.has(el.id) && !hidden.has(el.id) && snappable(el))
    .map(elementBounds);
}

const right = (b: Box) => b.x + b.width;
const bottom = (b: Box) => b.y + b.height;

const xAnchors = (b: Box) => [b.x, b.x + b.width / 2, right(b)];
const yAnchors = (b: Box) => [b.y, b.y + b.height / 2, bottom(b)];

/** The box with its axes swapped, so one X routine serves both. */
const transpose = (b: Box): Box => ({ x: b.y, y: b.x, width: b.height, height: b.width });

/** The targets near `box` (within REACH screen px of it). */
function nearby(box: Box, targets: Box[], zoom: number) {
  const reach = REACH / zoom;
  return targets.filter(
    (t) =>
      t.x <= right(box) + reach &&
      right(t) >= box.x - reach &&
      t.y <= bottom(box) + reach &&
      bottom(t) >= box.y - reach,
  );
}

/** The smallest move that puts one of `values` on one of `anchors`, within `threshold`. */
function nearest(values: number[], anchors: number[], threshold: number) {
  let best: number | null = null;
  for (const value of values) {
    for (const anchor of anchors) {
      const delta = anchor - value;
      if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best))) {
        best = delta;
      }
    }
  }
  return best;
}

/** Vertical lines where an edge of `box` (`values`, x positions) sits on a target's x anchor. */
function linesAt(box: Box, values: number[], targets: Box[], eps: number): GuideLine[] {
  const found = new Map<number, GuideLine>();
  for (const t of targets) {
    for (const anchor of xAnchors(t)) {
      if (!values.some((v) => Math.abs(v - anchor) <= eps)) continue;
      const key = Math.round(anchor * 100);
      const from = Math.min(box.y, t.y);
      const to = Math.max(bottom(box), bottom(t));
      const line = found.get(key);
      if (line) {
        line.from = Math.min(line.from, from);
        line.to = Math.max(line.to, to);
      } else {
        found.set(key, { axis: "x", at: anchor, from, to });
      }
    }
  }
  return [...found.values()];
}

const flipLine = (line: GuideLine): GuideLine => ({ ...line, axis: line.axis === "x" ? "y" : "x" });
const flipGap = (gap: GapMark): GapMark => ({ ...gap, axis: gap.axis === "x" ? "y" : "x" });

// ── Equal spacing (X; Y runs through transpose) ───────────────────────────

/** The part of two boxes' Y ranges they share, or null. */
function overlapY(a: Box, b: Box) {
  const from = Math.max(a.y, b.y);
  const to = Math.min(bottom(a), bottom(b));
  return to > from ? { from, to } : null;
}

/** Neighbors of `box` in its row: those left of it (nearest first) and right of it. */
function rowOf(box: Box, others: Box[]) {
  const row = others.filter((t) => overlapY(box, t));
  return {
    left: row.filter((t) => right(t) <= box.x).sort((a, b) => right(b) - right(a)),
    right: row.filter((t) => t.x >= right(box)).sort((a, b) => a.x - b.x),
  };
}

/** How far `box` would have to move in X to make a gap equal to another between its neighbors. */
function spacingMoves(box: Box, others: Box[], threshold: number) {
  const { left, right: after } = rowOf(box, others);
  const moves: number[] = [];
  const [l1, l2] = left;
  const [r1, r2] = after;
  // Between two neighbors: the same gap on both sides.
  if (l1 && r1) moves.push((r1.x - right(box) - (box.x - right(l1))) / 2);
  // Beside two neighbors that are a gap apart: that gap again.
  if (l1 && l2 && l1.x >= right(l2)) moves.push(right(l1) + (l1.x - right(l2)) - box.x);
  if (r1 && r2 && r2.x >= right(r1)) moves.push(r1.x - (r2.x - right(r1)) - right(box));
  return moves.filter((m) => Math.abs(m) <= threshold);
}

/** The equal gaps `box` makes with its neighbors where it is now. */
function spacingMarks(box: Box, others: Box[], eps: number): GapMark[] {
  const { left, right: after } = rowOf(box, others);
  const [l1, l2] = left;
  const [r1, r2] = after;
  const mark = (a: Box, b: Box): GapMark => {
    const across = overlapY(a, b);
    return {
      axis: "x",
      from: right(a),
      to: b.x,
      at: across ? (across.from + across.to) / 2 : a.y + a.height / 2,
    };
  };
  const equal = (a: Box, b: Box, c: Box, d: Box) =>
    b.x - right(a) >= -eps && Math.abs(b.x - right(a) - (d.x - right(c))) <= eps;
  const marks: GapMark[] = [];
  if (l1 && r1 && equal(l1, box, box, r1)) marks.push(mark(l1, box), mark(box, r1));
  if (l1 && l2 && equal(l2, l1, l1, box)) marks.push(mark(l2, l1), mark(l1, box));
  if (r1 && r2 && equal(box, r1, r1, r2)) marks.push(mark(box, r1), mark(r1, r2));
  return marks;
}

// ── Moving ────────────────────────────────────────────────────────────────

export interface MoveSnap {
  /** What to add to the box's position to put it on the guides. */
  dx: number;
  dy: number;
  guides: SnapGuides;
}

/**
 * Snaps a dragged `box` to `targets`: its left / center / right edges to theirs, its top /
 * middle / bottom likewise, and equal gaps in a row or column. `zoom` makes the distances
 * screen pixels. The guides describe the box after the snap.
 */
export function snapMove(box: Box, targets: Box[], zoom: number): MoveSnap {
  const near = nearby(box, targets, zoom);
  const threshold = SNAP_DISTANCE / zoom;
  const eps = SAME / zoom;

  /** The smallest move on X that lines `b` up with an edge or evens out a gap. */
  const axisMove = (b: Box, others: Box[]) => {
    const edge = nearest(xAnchors(b), others.flatMap(xAnchors), threshold);
    const moves = [...(edge === null ? [] : [edge]), ...spacingMoves(b, others, threshold)];
    return moves.reduce(
      (best, move) => (Math.abs(move) < Math.abs(best) ? move : best),
      moves[0] ?? 0,
    );
  };
  const dx = axisMove(box, near);
  const dy = axisMove(transpose(box), near.map(transpose));

  const snapped: Box = { ...box, x: box.x + dx, y: box.y + dy };
  const lines = [
    ...linesAt(snapped, xAnchors(snapped), near, eps),
    ...linesAt(transpose(snapped), yAnchors(snapped), near.map(transpose), eps).map(flipLine),
  ];
  const gaps = [
    ...spacingMarks(snapped, near, eps),
    ...spacingMarks(transpose(snapped), near.map(transpose), eps).map(flipGap),
  ];
  return { dx, dy, guides: { lines, gaps } };
}

// ── Resizing ──────────────────────────────────────────────────────────────

/**
 * Snaps the edges `handle` drags (an "e" handle moves the right edge, "nw" the top and left, …)
 * to the targets' edges and centers. Returns the box after the snap and its guides.
 */
export function snapResize(
  box: Box,
  handle: Handle,
  targets: Box[],
  zoom: number,
): { box: Box; guides: SnapGuides } {
  const near = nearby(box, targets, zoom);
  const threshold = SNAP_DISTANCE / zoom;
  const eps = SAME / zoom;
  const anchorsX = near.flatMap(xAnchors);
  const anchorsY = near.flatMap(yAnchors);

  let x0 = box.x;
  let x1 = right(box);
  let y0 = box.y;
  let y1 = bottom(box);
  const draggedX: number[] = [];
  const draggedY: number[] = [];
  if (handle.includes("e")) x1 += nearest([x1], anchorsX, threshold) ?? 0;
  if (handle.includes("w")) x0 += nearest([x0], anchorsX, threshold) ?? 0;
  if (handle.includes("s")) y1 += nearest([y1], anchorsY, threshold) ?? 0;
  if (handle.includes("n")) y0 += nearest([y0], anchorsY, threshold) ?? 0;
  // Never past the opposite edge.
  if (handle.includes("e")) x1 = Math.max(x1, x0 + MIN_SIZE);
  if (handle.includes("w")) x0 = Math.min(x0, x1 - MIN_SIZE);
  if (handle.includes("s")) y1 = Math.max(y1, y0 + MIN_SIZE);
  if (handle.includes("n")) y0 = Math.min(y0, y1 - MIN_SIZE);
  if (handle.includes("e")) draggedX.push(x1);
  if (handle.includes("w")) draggedX.push(x0);
  if (handle.includes("s")) draggedY.push(y1);
  if (handle.includes("n")) draggedY.push(y0);

  const snapped: Box = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  const lines = [
    ...linesAt(snapped, draggedX, near, eps),
    ...linesAt(transpose(snapped), draggedY, near.map(transpose), eps).map(flipLine),
  ];
  return { box: snapped, guides: { lines, gaps: [] } };
}

/** Whether a snap produced anything to draw. */
export const hasGuides = (guides: SnapGuides) => guides.lines.length > 0 || guides.gaps.length > 0;

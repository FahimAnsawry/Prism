// Align and distribute (properties panel, tools.md §3): lines up the selected elements on one
// edge or center, or spreads them out with equal gaps. Both return the position changes as
// patches, so the editor applies them as one undo step.

import type { BoardElement } from "@prism/shared";
import { type Box, boundsOf, elementBounds } from "./geometry";

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

type Patches = Record<string, Partial<BoardElement>>;

/** Elements these actions move: not locked, and not arrows (they follow what they attach to). */
const movable = (el: BoardElement) =>
  !el.locked && !(el.type === "arrow" && (el.startBinding || el.endBinding));

/** Moves smaller than this (float noise) are not made. */
const EPSILON = 1e-6;

/** The least number of elements distributing makes sense for. */
export const DISTRIBUTE_MIN = 3;

const axisOf = (mode: AlignMode) =>
  mode === "left" || mode === "center" || mode === "right" ? "x" : "y";

/** How far to move `box` to line up with `to`, on `mode`'s edge or center. */
function offset(box: Box, to: Box, mode: AlignMode) {
  switch (mode) {
    case "left":
      return to.x - box.x;
    case "center":
      return to.x + to.width / 2 - (box.x + box.width / 2);
    case "right":
      return to.x + to.width - (box.x + box.width);
    case "top":
      return to.y - box.y;
    case "middle":
      return to.y + to.height / 2 - (box.y + box.height / 2);
    case "bottom":
      return to.y + to.height - (box.y + box.height);
  }
}

/** Moves `el` by (dx, dy) as a patch (a line or arrow moves by its start point). */
const shift = (el: BoardElement, dx: number, dy: number): Partial<BoardElement> => ({
  ...(Math.abs(dx) > EPSILON && { x: el.x + dx }),
  ...(Math.abs(dy) > EPSILON && { y: el.y + dy }),
});

/** Lines the elements up with the edge or center of the box around all of them. */
export function alignPatches(elements: BoardElement[], mode: AlignMode): Patches {
  const items = elements.filter(movable);
  const group = boundsOf(items);
  if (items.length < 2 || !group) return {};
  const patches: Patches = {};
  for (const el of items) {
    const move = offset(elementBounds(el), group, mode);
    const patch = axisOf(mode) === "x" ? shift(el, move, 0) : shift(el, 0, move);
    if (Object.keys(patch).length > 0) patches[el.id] = patch;
  }
  return patches;
}

/**
 * Spreads three or more elements with equal gaps between them, keeping the outermost two where
 * they are. Sorted by position along the axis, so the order doesn't change.
 */
export function distributePatches(elements: BoardElement[], axis: DistributeAxis): Patches {
  const items = elements
    .filter(movable)
    .map((el) => ({ el, box: elementBounds(el) }))
    .sort((a, b) =>
      axis === "horizontal"
        ? a.box.x + a.box.width / 2 - (b.box.x + b.box.width / 2)
        : a.box.y + a.box.height / 2 - (b.box.y + b.box.height / 2),
    );
  if (items.length < DISTRIBUTE_MIN) return {};
  const start = (box: Box) => (axis === "horizontal" ? box.x : box.y);
  const size = (box: Box) => (axis === "horizontal" ? box.width : box.height);
  const first = start(items[0]?.box ?? { x: 0, y: 0, width: 0, height: 0 });
  const end = Math.max(...items.map(({ box }) => start(box) + size(box)));
  const free = end - first - items.reduce((sum, { box }) => sum + size(box), 0);
  const gap = free / (items.length - 1);

  const patches: Patches = {};
  let cursor = first;
  for (const { el, box } of items) {
    const move = cursor - start(box);
    const patch = axis === "horizontal" ? shift(el, move, 0) : shift(el, 0, move);
    if (Object.keys(patch).length > 0) patches[el.id] = patch;
    cursor += size(box) + gap;
  }
  return patches;
}

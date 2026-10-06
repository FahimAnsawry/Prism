// The tool state machine (tools.md §2): on pointer down the active tool starts a gesture, which
// takes the following moves and the release. Each gesture works from the board as it was when it
// started, shows its progress with "preview" (no history) and ends with one "commit", so a whole
// drag or stroke is a single undo step.

import { type BoardElement, type ElementType, mindDescendants, mindStyle } from "@prism/shared";
import type { Dispatch } from "react";
import { type BoardAction, type BoardState, byZ, deleteElements, newElement } from "./board-model";
import {
  angleTo,
  bindingTarget,
  boundsOf,
  type Box,
  boxFromPoints,
  center,
  distance,
  elementBounds,
  fitIntoBox,
  type Handle,
  handleAt,
  hitTest,
  intersects,
  isLinear,
  moveElement,
  type Point,
  resizeBox,
  resizeElement,
  rotateAround,
  routeArrow,
  selectionFrame,
  snapAngle,
  startPoint,
  endPoint,
  topHit,
  updateBindings,
} from "./geometry";
import { type MindToggle, TOGGLE_RADIUS } from "./mind-branches";
import { fitTextBox, fontPx, lineHeightOf } from "./text-layout";
import type { ToolId } from "./tools";

/** Live drawing the canvas shows on top of the elements while a gesture runs. */
export interface Overlay {
  marquee?: Box;
  /** Elements the eraser has touched, shown faded until the release deletes them. */
  erasing?: Set<string>;
  /** The shape an arrow end will attach to. */
  snapTarget?: string;
}

export interface GestureContext {
  /** The board when the gesture started. */
  state: BoardState;
  zoom: number;
  dispatch: Dispatch<BoardAction>;
  setOverlay: (overlay: Overlay | null) => void;
  /** Opens the text editor on an element. `before` is the board to commit the edit against. */
  startEditing: (id: string, before: BoardElement[]) => void;
  /** Switches back to the Select tool after a one-shot tool placed its element. */
  finishTool: () => void;
  /** Converts a pointer event's position (used for coalesced events). */
  toWorld: (event: { clientX: number; clientY: number }) => Point;
  emoji: string | null;
  /** The Lucide icon the Icon tool places. */
  icon: string | null;
  /** Mind map nodes inside folded branches: not shown, so not hit either. */
  hidden: ReadonlySet<string>;
  /** The mind map collapse toggles on screen. */
  toggles: MindToggle[];
}

export interface Gesture {
  move: (p: Point, event: PointerEvent) => void;
  up: (p: Point, event: PointerEvent) => void;
}

/** In screen pixels: how far a press may wander and still count as a click. */
const CLICK_SLOP = 3;
/** In screen pixels: how close the pointer must be to an outline to hit it. */
const HIT_TOLERANCE = 6;
const ERASER_RADIUS = 10;

/** Where a pointer press on the board starts. Returns null when the tool does nothing there. */
export function startGesture(
  tool: ToolId,
  ctx: GestureContext,
  p: Point,
  event: PointerEvent,
): Gesture | null {
  switch (tool) {
    case "select":
      return selectGesture(ctx, p, event);
    case "rect":
    case "ellipse":
    case "diamond":
      return shapeGesture(tool, ctx, p);
    case "line":
    case "arrow":
      return lineGesture(tool, ctx, p);
    case "pencil":
      return pencilGesture(ctx, p);
    case "eraser":
      return eraserGesture(ctx, p);
    case "text":
    case "handwriting":
    case "sticky":
    case "list":
      placeText(tool, ctx, p);
      return null;
    case "emoji":
      if (ctx.emoji) place(ctx, "emoji", p, 72, 72, { text: ctx.emoji });
      return null;
    case "icon":
      if (ctx.icon) place(ctx, "icon", p, 48, 48, { icon: ctx.icon });
      return null;
    case "chart":
      place(ctx, "chart", p, 360, 240);
      return null;
    case "mindmap":
      placeMindRoot(ctx, p);
      return null;
    default:
      return null;
  }
}

const tolerance = (ctx: GestureContext) => HIT_TOLERANCE / ctx.zoom;
const shown = (ctx: GestureContext) => (el: BoardElement) => !ctx.hidden.has(el.id);

/** Adds a `width` × `height` element centered on `p`, selects it and returns to Select. */
function place(
  ctx: GestureContext,
  type: ElementType,
  p: Point,
  width: number,
  height: number,
  fields: Partial<BoardElement> = {},
) {
  const { elements } = ctx.state;
  const el = newElement(type, elements, {
    x: p.x - width / 2,
    y: p.y - height / 2,
    width,
    height,
    ...fields,
  });
  ctx.dispatch({ type: "apply", elements: [...elements, el], select: [el.id] });
  ctx.finishTool();
}

// ── Select ────────────────────────────────────────────────────────────────

function selectGesture(ctx: GestureContext, p: Point, event: PointerEvent): Gesture | null {
  const { elements, selectedIds } = ctx.state;

  // A mind map toggle folds or opens its branch.
  const toggle = ctx.toggles.find((t) => distance(t, p) <= TOGGLE_RADIUS / ctx.zoom);
  if (toggle) {
    ctx.dispatch({ type: "mindToggle", id: toggle.id });
    return null;
  }
  const selected = elements.filter((el) => selectedIds.includes(el.id));

  const handle = handleAt(selectionFrame(selected, ctx.zoom), p, ctx.zoom);
  if (handle) return transformGesture(ctx, selected, handle, p);

  const hit = topHit(byZ(elements), p, tolerance(ctx), shown(ctx));
  if (!hit) {
    // Empty canvas: marquee, adding to the selection with Shift.
    const base = event.shiftKey ? selectedIds : [];
    if (!event.shiftKey) ctx.dispatch({ type: "select", ids: [] });
    return marqueeGesture(ctx, p, base);
  }

  let ids = selectedIds;
  if (event.shiftKey) {
    ids = ids.includes(hit.id) ? ids.filter((id) => id !== hit.id) : [...ids, hit.id];
    ctx.dispatch({ type: "select", ids });
    if (!ids.includes(hit.id)) return null;
  } else if (!ids.includes(hit.id)) {
    ids = [hit.id];
    ctx.dispatch({ type: "select", ids });
  }
  return moveGesture(ctx, p, ids);
}

function moveGesture(ctx: GestureContext, start: Point, ids: string[]): Gesture {
  const before = ctx.state.elements;
  const moving = new Set(
    before.filter((el) => ids.includes(el.id) && !el.locked).map((el) => el.id),
  );
  // A mind map node carries its whole branch along.
  for (const id of mindDescendants(before, moving)) {
    if (!before.find((el) => el.id === id)?.locked) moving.add(id);
  }
  let dragging = false;
  return {
    move(p) {
      if (moving.size === 0) return;
      if (!dragging && distance(p, start) * ctx.zoom < CLICK_SLOP) return;
      dragging = true;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      const next = before.map((el) => {
        if (!moving.has(el.id)) return el;
        const moved = moveElement(el, dx, dy);
        // An arrow dragged away from a shape that stays put lets go of it.
        if (el.type !== "arrow") return moved;
        return {
          ...moved,
          ...(el.startBinding && !moving.has(el.startBinding) && { startBinding: null }),
          ...(el.endBinding && !moving.has(el.endBinding) && { endBinding: null }),
        };
      });
      ctx.dispatch({ type: "preview", elements: updateBindings(next) });
    },
    up() {
      if (dragging) ctx.dispatch({ type: "commit", before });
    },
  };
}

function marqueeGesture(ctx: GestureContext, start: Point, base: string[]): Gesture {
  const ordered = byZ(ctx.state.elements).filter(shown(ctx));
  return {
    move(p) {
      const box = boxFromPoints(start, p);
      ctx.setOverlay({ marquee: box });
      const hits = ordered
        .filter((el) => intersects(elementBounds(el), box))
        .map((el) => el.id)
        .filter((id) => !base.includes(id));
      ctx.dispatch({ type: "select", ids: [...base, ...hits] });
    },
    up() {
      ctx.setOverlay(null);
    },
  };
}

/** Resize, rotate, or drag a line's end, from one of the selection handles. */
function transformGesture(
  ctx: GestureContext,
  selected: BoardElement[],
  handle: Handle,
  start: Point,
): Gesture {
  const before = ctx.state.elements;
  const targets = selected.filter((el) => !el.locked);
  const group = boundsOf(targets);
  const only = targets.length === 1 ? targets[0] : undefined;
  const ordered = byZ(before);

  const finish = (changed: Map<string, BoardElement>) => {
    const next = before.map((el) => {
      const updated = changed.get(el.id);
      return updated ? fitTextBox(updated) : el;
    });
    ctx.dispatch({ type: "preview", elements: updateBindings(next) });
  };

  return {
    move(p, event) {
      const changed = new Map<string, BoardElement>();

      if ((handle === "start" || handle === "end") && only) {
        const fixed = handle === "start" ? endPoint(only) : startPoint(only);
        const point = event.shiftKey ? snapAngle(fixed, p) : p;
        const s = handle === "start" ? point : fixed;
        const e = handle === "end" ? point : fixed;
        let el: BoardElement = { ...only, x: s.x, y: s.y, width: e.x - s.x, height: e.y - s.y };
        if (el.type === "arrow") {
          const key = handle === "start" ? "startBinding" : "endBinding";
          const other = handle === "start" ? only.endBinding : only.startBinding;
          const target = bindingTarget(ordered, p, tolerance(ctx), [
            only.id,
            ...(other ? [other] : []),
          ]);
          el = routeArrow(
            { ...el, [key]: target?.id ?? null },
            new Map(before.map((b) => [b.id, b])),
          );
          ctx.setOverlay(target ? { snapTarget: target.id } : null);
        }
        changed.set(el.id, el);
      } else if (handle === "rotate") {
        if (only) {
          let angle = angleTo(center(only), p);
          if (event.shiftKey) angle = Math.round(angle / 15) * 15;
          changed.set(only.id, rotateAround(only, center(only), angle - only.rotation));
        } else if (group) {
          const origin = { x: group.x + group.width / 2, y: group.y + group.height / 2 };
          let delta = angleTo(origin, p) - angleTo(origin, start);
          if (event.shiftKey) delta = Math.round(delta / 15) * 15;
          for (const el of targets) changed.set(el.id, rotateAround(el, origin, delta));
        }
      } else if (only) {
        changed.set(only.id, resizeElement(only, handle, p, event.shiftKey, start));
      } else if (group) {
        const box = resizeBox(group, handle, p, event.shiftKey);
        // Corners and the top / bottom handles scale text with the group; the sides rewrap it.
        const scaleText = handle !== "e" && handle !== "w";
        for (const el of targets) changed.set(el.id, fitIntoBox(el, group, box, scaleText));
      }

      if (changed.size > 0) finish(changed);
    },
    up() {
      ctx.setOverlay(null);
      ctx.dispatch({ type: "commit", before });
    },
  };
}

// ── Shapes, lines and arrows ──────────────────────────────────────────────

const DEFAULT_SIZES: Record<"rect" | "ellipse" | "diamond", [number, number]> = {
  rect: [160, 100],
  ellipse: [140, 100],
  diamond: [160, 120],
};

/** Rectangle, ellipse, diamond: drag a box (Shift = square / circle), or click for a default. */
function shapeGesture(type: "rect" | "ellipse" | "diamond", ctx: GestureContext, start: Point) {
  const before = ctx.state.elements;
  const el = newElement(type, before, { x: start.x, y: start.y, width: 0, height: 0 });
  let dragged = false;
  ctx.dispatch({ type: "preview", elements: [...before, el], select: [] });

  const boxTo = (p: Point, shift: boolean) => {
    let w = p.x - start.x;
    let h = p.y - start.y;
    if (shift) {
      const side = Math.max(Math.abs(w), Math.abs(h));
      w = side * (Math.sign(w) || 1);
      h = side * (Math.sign(h) || 1);
    }
    return boxFromPoints(start, { x: start.x + w, y: start.y + h });
  };

  return {
    move(p: Point, event: PointerEvent) {
      if (!dragged && distance(p, start) * ctx.zoom < CLICK_SLOP) return;
      dragged = true;
      ctx.dispatch({
        type: "preview",
        elements: [...before, { ...el, ...boxTo(p, event.shiftKey) }],
      });
    },
    up(p: Point, event: PointerEvent) {
      const [w, h] = DEFAULT_SIZES[type];
      // A click (no drag) drops a default-size shape centered on it.
      const box = dragged
        ? boxTo(p, event.shiftKey)
        : { x: start.x - w / 2, y: start.y - h / 2, width: w, height: h };
      ctx.dispatch({ type: "preview", elements: [...before, { ...el, ...box }], select: [el.id] });
      ctx.dispatch({ type: "commit", before });
      ctx.finishTool();
    },
  };
}

/** Line and arrow: drag from start to end (Shift = 15° steps). Arrow ends attach to shapes. */
function lineGesture(type: "line" | "arrow", ctx: GestureContext, start: Point): Gesture {
  const before = ctx.state.elements;
  const ordered = byZ(before);
  const byId = new Map(before.map((el) => [el.id, el]));
  const startTarget =
    type === "arrow" ? bindingTarget(ordered, start, tolerance(ctx), []) : undefined;
  const base = newElement(type, before, {
    x: start.x,
    y: start.y,
    width: 0,
    height: 0,
    ...(startTarget && { startBinding: startTarget.id }),
  });
  let current = base;
  let dragged = false;

  const update = (p: Point, shift: boolean) => {
    const end = shift ? snapAngle(start, p) : p;
    const endTarget =
      type === "arrow"
        ? bindingTarget(ordered, p, tolerance(ctx), [
            base.id,
            ...(startTarget ? [startTarget.id] : []),
          ])
        : undefined;
    current = {
      ...base,
      width: end.x - start.x,
      height: end.y - start.y,
      endBinding: endTarget?.id ?? null,
    };
    if (type === "arrow") current = routeArrow(current, byId);
    ctx.setOverlay(endTarget ? { snapTarget: endTarget.id } : null);
    ctx.dispatch({ type: "preview", elements: [...before, current], select: [] });
  };

  return {
    move(p, event) {
      if (!dragged && distance(p, start) * ctx.zoom < CLICK_SLOP) return;
      dragged = true;
      update(p, event.shiftKey);
    },
    up(p, event) {
      ctx.setOverlay(null);
      if (dragged) {
        update(p, event.shiftKey);
      } else {
        // A click draws a default-length horizontal line.
        current = routeArrow({ ...base, width: 160, height: 0 }, byId);
      }
      if (!current.startBinding) delete current.startBinding;
      if (!current.endBinding) delete current.endBinding;
      ctx.dispatch({ type: "preview", elements: [...before, current], select: [current.id] });
      ctx.dispatch({ type: "commit", before });
      ctx.finishTool();
    },
  };
}

// ── Pencil and eraser ─────────────────────────────────────────────────────

/** Pencil points closer than this (screen pixels) to the previous one are dropped. */
const MIN_POINT_GAP = 2;
const MAX_POINTS = 20_000;

/** Freehand drawing: collects points (coalesced, for smooth fast strokes); stays on Pencil. */
function pencilGesture(ctx: GestureContext, start: Point): Gesture {
  const before = ctx.state.elements;
  const points: Point[] = [start];
  const base = newElement("freehand", before, { x: start.x, y: start.y, width: 0, height: 0 });

  const build = (): BoardElement => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      ...base,
      x,
      y,
      width: Math.max(...xs) - x,
      height: Math.max(...ys) - y,
      points: points.flatMap((p) => [
        Math.round((p.x - x) * 100) / 100,
        Math.round((p.y - y) * 100) / 100,
      ]),
    };
  };
  ctx.dispatch({ type: "preview", elements: [...before, build()], select: [] });

  const add = (p: Point) => {
    const last = points[points.length - 1];
    if (points.length >= MAX_POINTS) return;
    if (last && distance(last, p) * ctx.zoom < MIN_POINT_GAP) return;
    points.push(p);
  };

  return {
    move(p, event) {
      const coalesced = event.getCoalescedEvents?.() ?? [];
      if (coalesced.length > 0) for (const e of coalesced) add(ctx.toWorld(e));
      else add(p);
      ctx.dispatch({ type: "preview", elements: [...before, build()] });
    },
    up(p) {
      add(p);
      ctx.dispatch({ type: "preview", elements: [...before, build()] });
      ctx.dispatch({ type: "commit", before });
    },
  };
}

/** Drag across elements to delete them; all of one drag is one undo step. */
function eraserGesture(ctx: GestureContext, start: Point): Gesture {
  const before = ctx.state.elements;
  const ordered = byZ(before).filter((el) => !el.locked && !ctx.hidden.has(el.id));
  const erasing = new Set<string>();
  const radius = ERASER_RADIUS / ctx.zoom;
  let last = start;

  const sweep = (p: Point) => {
    // Test points along the path, so a fast swipe doesn't skip thin strokes.
    const steps = Math.max(1, Math.ceil(distance(last, p) / (radius / 2)));
    for (let i = 1; i <= steps; i++) {
      const point = {
        x: last.x + ((p.x - last.x) * i) / steps,
        y: last.y + ((p.y - last.y) * i) / steps,
      };
      for (const el of ordered) {
        if (!erasing.has(el.id) && hitTest(el, point, radius)) erasing.add(el.id);
      }
    }
    last = p;
    ctx.setOverlay({ erasing: new Set(erasing) });
  };
  sweep(start);

  return {
    move: sweep,
    up(p) {
      sweep(p);
      ctx.setOverlay(null);
      if (erasing.size > 0) {
        const next = deleteElements(before, erasing);
        ctx.dispatch({ type: "apply", elements: next, select: [] });
      }
    },
  };
}

// ── Text, handwriting, sticky notes and lists ─────────────────────────────

const TEXT_TOOLS = { text: "text", handwriting: "text", sticky: "sticky", list: "list" } as const;

/** Places a text-like element at `p` and opens the editor on it. */
export function placeText(
  tool: keyof typeof TEXT_TOOLS,
  ctx: Pick<GestureContext, "state" | "dispatch" | "startEditing" | "finishTool" | "zoom">,
  p: Point,
) {
  const before = ctx.state.elements;
  const type = TEXT_TOOLS[tool];

  // Clicking existing text of the same kind edits it instead.
  const existing = topHit(byZ(before), p, HIT_TOLERANCE / ctx.zoom, (el) => el.type === type);
  if (existing && !existing.locked) {
    ctx.dispatch({ type: "select", ids: [existing.id] });
    ctx.startEditing(existing.id, before);
    ctx.finishTool();
    return;
  }

  let el: BoardElement;
  if (type === "sticky") {
    el = newElement("sticky", before, { x: p.x - 100, y: p.y - 100, width: 200, height: 200 });
  } else {
    const font = tool === "handwriting" ? "caveat" : "sans";
    const draft = newElement(type, before, { x: p.x, y: p.y, width: 0, height: 0, font });
    const lineHeight = fontPx(draft) * lineHeightOf(draft);
    // The click lands in the middle of the first line.
    el = fitTextBox({ ...draft, y: p.y - lineHeight / 2 });
  }
  ctx.dispatch({ type: "preview", elements: [...before, el], select: [el.id] });
  ctx.startEditing(el.id, before);
  ctx.finishTool();
}

export const isTextual = (el: BoardElement) =>
  el.type === "text" || el.type === "sticky" || el.type === "list" || el.type === "mindnode";

// ── Mind map ──────────────────────────────────────────────────────────────

/** The Mind map tool: a central topic centered on `p`, opened for typing. */
function placeMindRoot(ctx: GestureContext, p: Point) {
  const before = ctx.state.elements;
  const draft = fitTextBox(
    newElement("mindnode", before, {
      x: p.x,
      y: p.y,
      width: 0,
      height: 0,
      text: "",
      font: "sans",
      parentId: null,
      ...mindStyle(0, 0),
      strokeWidth: 2,
    }),
  );
  const el = { ...draft, x: p.x - draft.width / 2, y: p.y - draft.height / 2 };
  ctx.dispatch({ type: "preview", elements: [...before, el], select: [el.id] });
  ctx.startEditing(el.id, before);
  ctx.finishTool();
}

export { isLinear };

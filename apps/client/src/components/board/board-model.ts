// Board elements and the editor reducer. Field names follow tools.md §7 (the schema lives in
// @prism/shared); history keeps whole snapshots, one per user action.

import {
  type BoardElement,
  type ElementOp,
  type ElementType,
  mindChildren,
  mindDepth,
  mindDescendants,
  mindRoot,
  mindStyle,
  tidyMindMap,
} from "@prism/shared";
import { isHandwriting } from "./fonts";
import { updateBindings } from "./geometry";
import { fitTextBox } from "./text-layout";

export type {
  BoardElement,
  ChartData,
  ChartKind,
  ElementType,
  FontFamily,
  FontSize,
  ListItem,
  StrokeStyle,
  TextAlign,
} from "@prism/shared";

export const STROKE_WIDTHS = { thin: 1, medium: 2, thick: 4 } as const;

// Palettes from the Miro frame: slate, bloom, coral, brand, blue, violet, pink, graphite.
export const STROKE_COLORS = [
  "#3d3b4f",
  "#ff6d6d",
  "#ff7f59",
  "#28e99f",
  "#5882ff",
  "#756cf5",
  "#f783a3",
  "#5f5f5f",
];
/** Seafoam, ice, lavender, peach, lime, sage: the fills, and the 6 sticky-note presets. */
export const FILL_COLORS = ["#c5ffd6", "#d1e5ff", "#ffcffe", "#ffbcb3", "#ecffa3", "#c8ead0"];
export const STICKY_DEFAULT = "#ecffa3";

/**
 * The palette's neutral inks are stored as plain hex (they are board data and sync as-is) but
 * drawn through the theme, so a slate outline turns light on the night board instead of
 * vanishing. Accent colors draw as stored. Apply it with `style`: SVG presentation attributes
 * don't resolve var().
 */
const THEMED_INKS: Record<string, string> = {
  "#3d3b4f": "var(--foreground)", // slate
  "#2a2a2a": "var(--ink)", // onyx
  "#5f5f5f": "var(--muted-foreground)", // graphite
};

export function displayColor(color: string) {
  return THEMED_INKS[color.toLowerCase()] ?? color;
}

/** "#abc", "abc", "#aabbcc" or "aabbcc" (any case) as "#aabbcc"; null if it isn't one. */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(raw)) return `#${[...raw].map((ch) => ch + ch).join("")}`;
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  return null;
}

const BASE = {
  rotation: 0,
  stroke: "#3d3b4f",
  fill: null,
  strokeWidth: STROKE_WIDTHS.medium,
  strokeStyle: "solid",
  sketch: false,
  opacity: 1,
  updatedBy: "user",
  version: 1,
} satisfies Partial<BoardElement>;

/** Type-specific starting values for a new element. */
const DEFAULTS: Partial<Record<ElementType, Partial<BoardElement>>> = {
  text: { text: "", font: "sans", fontSize: "M", textAlign: "left", autoWidth: true },
  sticky: { text: "", fill: STICKY_DEFAULT, font: "sans", fontSize: "M", textAlign: "center" },
  list: {
    items: [{ text: "", indent: 0 }],
    font: "sans",
    fontSize: "M",
    textAlign: "left",
    autoWidth: true,
  },
  chart: {
    chart: {
      kind: "bar",
      rows: [
        { label: "Mon", value: 12 },
        { label: "Tue", value: 19 },
        { label: "Wed", value: 8 },
        { label: "Thu", value: 15 },
      ],
    },
  },
};

/** A new element of `type` on top of `elements`, with a fresh id. */
export function newElement(
  type: ElementType,
  elements: BoardElement[],
  fields: Pick<BoardElement, "x" | "y" | "width" | "height"> & Partial<BoardElement>,
): BoardElement {
  return {
    ...BASE,
    ...DEFAULTS[type],
    id: crypto.randomUUID(),
    type,
    z: topZ(elements) + 1,
    ...fields,
  };
}

export const topZ = (elements: BoardElement[]) =>
  elements.reduce((max, el) => Math.max(max, el.z), -1);

export const byZ = (elements: BoardElement[]) => [...elements].sort((a, b) => a.z - b.z);

export interface BoardState {
  past: BoardElement[][];
  elements: BoardElement[];
  future: BoardElement[][];
  selectedIds: string[];
  /** A node the reducer just made and wants typed into (Tab / Enter on a mind map). */
  editRequest?: { id: string; before: BoardElement[] } | undefined;
}

export type LayerMove = "back" | "down" | "up" | "front";

export type BoardAction =
  | { type: "select"; ids: string[] }
  /** A live step of a gesture (drag, draw, typing): shown, but not yet in history. */
  | { type: "preview"; elements: BoardElement[]; select?: string[] }
  /** A live change to one element (typing in the text editor). */
  | { type: "previewElement"; element: BoardElement }
  /** Ends a gesture: one history step from `before`, if anything changed. */
  | { type: "commit"; before: BoardElement[] }
  /** A one-shot change with its own history step. */
  | { type: "apply"; elements: BoardElement[]; select?: string[] }
  /** Puts new elements on top of the current board (uploads and pastes finish at any time). */
  | { type: "add"; elements: BoardElement[]; select?: boolean }
  /** Changes some fields of some elements. Locked ones only accept `locked` itself. */
  | { type: "patch"; patches: Record<string, Partial<BoardElement>> }
  /** Ends text editing: drops the element if it's left empty, then commits from `before`. */
  | { type: "finishEdit"; id: string; before: BoardElement[] }
  | { type: "delete"; ids: string[] }
  | { type: "layer"; ids: string[]; move: LayerMove }
  /** Ops saved by another tab or an AI editor: one history step per batch. */
  | { type: "remote"; ops: ElementOp[] }
  /** Adds a mind map node under `from` (or beside it) and asks for it to be typed into. */
  | { type: "mindAdd"; from: string; sibling: boolean }
  /** Folds a mind map branch away, or opens it again. */
  | { type: "mindToggle"; id: string }
  /** Lays out the mind map that `id` belongs to again. */
  | { type: "mindTidy"; id: string }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 100;

export function initialBoardState(elements: BoardElement[]): BoardState {
  return { past: [], elements, future: [], selectedIds: [] };
}

/** Same elements in the same order (every change replaces the element object). */
export function sameElements(a: BoardElement[], b: BoardElement[]) {
  return a.length === b.length && a.every((el, i) => el === b[i]);
}

function commit(state: BoardState, before: BoardElement[], elements: BoardElement[]): BoardState {
  if (sameElements(before, elements)) return { ...state, elements };
  return {
    ...state,
    past: [...state.past, before].slice(-HISTORY_LIMIT),
    elements,
    future: [],
  };
}

function keepSelection(state: BoardState): BoardState {
  const ids = new Set(state.elements.map((el) => el.id));
  const selectedIds = state.selectedIds.filter((id) => ids.has(id));
  return selectedIds.length === state.selectedIds.length ? state : { ...state, selectedIds };
}

/**
 * The mind maps that `ids` belong to, laid out tidy again (each central topic stays put). Arrows
 * attached to nodes that moved follow them.
 */
export function tidyMindMaps(elements: BoardElement[], ids: Iterable<string>) {
  const roots = new Set<string>();
  const byId = new Map(elements.map((el) => [el.id, el]));
  for (const id of ids) {
    if (byId.get(id)?.type === "mindnode") roots.add(mindRoot(elements, id));
  }
  if (roots.size === 0) return elements;
  let next = elements;
  for (const root of roots) {
    const moves = tidyMindMap(next, root);
    if (moves.size === 0) continue;
    next = next.map((el) => {
      const to = moves.get(el.id);
      return to && (to.x !== el.x || to.y !== el.y) ? { ...el, ...to } : el;
    });
  }
  return next === elements ? elements : updateBindings(next);
}

/** Removes `ids` (unlocked ones), the mind map branches under them and attached arrows. */
export function deleteElements(elements: BoardElement[], ids: Iterable<string>) {
  const doomed = new Set<string>();
  for (const id of ids) {
    const el = elements.find((e) => e.id === id);
    if (el && !el.locked) doomed.add(id);
  }
  if (doomed.size === 0) return elements;
  for (const id of mindDescendants(elements, doomed)) doomed.add(id);
  return elements.filter(
    (el) =>
      !doomed.has(el.id) &&
      !(el.startBinding && doomed.has(el.startBinding)) &&
      !(el.endBinding && doomed.has(el.endBinding)),
  );
}

/** Whether a text-like element has no text left. */
function isEmpty(el: BoardElement) {
  if (el.type === "text") return !el.text?.trim();
  if (el.type === "list") return !el.items?.some((item) => item.text.trim());
  if (el.type === "mindnode") return !el.text?.trim();
  return false;
}

const opId = (op: ElementOp) => (op.op === "create" ? op.element.id : op.id);

/**
 * `elements` with sync ops applied: a create adds (or replaces) the element, an update merges its
 * changes (null clears a field, except `fill`, where null means no fill) and a delete removes it.
 * Ops for elements that aren't there are skipped. Versions are the caller's to check.
 */
export function applyOps(elements: BoardElement[], ops: ElementOp[]): BoardElement[] {
  if (ops.length === 0) return elements;
  const byId = new Map(elements.map((el) => [el.id, el]));
  for (const op of ops) {
    if (op.op === "create") {
      byId.set(op.element.id, op.element);
    } else if (op.op === "update") {
      const el = byId.get(op.id);
      if (!el) continue;
      const next: Record<string, unknown> = { ...el, version: op.version };
      for (const [key, value] of Object.entries(op.changes)) {
        if (value === undefined) continue;
        if (value === null && key !== "fill") delete next[key];
        else next[key] = value;
      }
      byId.set(op.id, next as BoardElement);
    } else {
      byId.delete(op.id);
    }
  }
  return [...byId.values()];
}

/**
 * A new mind map node under `parent`, styled for its level, roughly placed (the tidy layout puts
 * it exactly): after `after` among its siblings, else last. A main branch goes to the emptier side.
 */
function newMindNode(elements: BoardElement[], parent: BoardElement, after?: BoardElement) {
  const siblings = mindChildren(elements).get(parent.id) ?? [];
  const depth = mindDepth(elements, parent.id) + 1;
  const parentCenter = parent.x + parent.width / 2;
  const onRight = (el: BoardElement) => el.x + el.width / 2 >= parentCenter;
  let side: 1 | -1;
  if (after) side = onRight(after) ? 1 : -1;
  else if (depth === 1) {
    const right = siblings.filter(onRight).length;
    side = right <= siblings.length - right ? 1 : -1;
  } else {
    const grand = elements.find((el) => el.id === parent.parentId);
    side = !grand || parent.x + parent.width / 2 >= grand.x + grand.width / 2 ? 1 : -1;
  }
  const style = mindStyle(depth, siblings.length, parent.stroke);
  const bottom = Math.max(parent.y, ...siblings.map((el) => el.y + el.height));
  const node = fitTextBox(
    newElement("mindnode", elements, {
      x: side === 1 ? parent.x + parent.width + 1 : parent.x - 200,
      // Just below `after`, so it sorts right after it.
      y: after ? after.y + after.height / 2 + 0.5 : bottom + 1,
      width: 0,
      height: 0,
      text: "",
      font: parent.font ?? "sans",
      parentId: parent.id,
      ...style,
      // A sub-topic shares its branch's color.
      ...(depth > 1 && { stroke: parent.stroke }),
      strokeWidth: 2,
    }),
  );
  return { ...node, y: after ? after.y + after.height / 2 + 0.5 - node.height / 2 : node.y };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "select":
      return { ...state, selectedIds: action.ids };

    case "preview":
      return {
        ...state,
        elements: action.elements,
        selectedIds: action.select ?? state.selectedIds,
      };

    case "previewElement": {
      const elements = state.elements.map((el) =>
        el.id === action.element.id ? action.element : el,
      );
      // A mind map node growing as it's typed into makes room for itself.
      return {
        ...state,
        elements:
          action.element.type === "mindnode"
            ? tidyMindMaps(elements, [action.element.id])
            : elements,
      };
    }

    case "commit":
      return commit(state, action.before, state.elements);

    case "apply":
      return {
        ...commit(state, state.elements, action.elements),
        selectedIds: action.select ?? state.selectedIds,
      };

    case "add": {
      if (action.elements.length === 0) return state;
      const z = topZ(state.elements) + 1;
      const added = action.elements.map((el, i) => ({ ...el, z: z + i }));
      return {
        ...commit(state, state.elements, updateBindings([...state.elements, ...added])),
        selectedIds: action.select ? added.map((el) => el.id) : state.selectedIds,
      };
    }

    case "patch": {
      let changed = false;
      const next = state.elements.map((el) => {
        const changes = action.patches[el.id];
        if (!changes) return el;
        // Locked elements only accept the unlock itself.
        if (el.locked && !("locked" in changes)) return el;
        changed = true;
        return fitTextBox({ ...el, ...changes });
      });
      if (!changed) return state;
      // A mind map node whose text size changed makes room for itself.
      return commit(
        state,
        state.elements,
        tidyMindMaps(updateBindings(next), Object.keys(action.patches)),
      );
    }

    case "finishEdit": {
      const el = state.elements.find((e) => e.id === action.id);
      let elements =
        el && isEmpty(el) ? state.elements.filter((e) => e.id !== action.id) : state.elements;
      // A mind map node left empty closes the gap it opened.
      if (el?.type === "mindnode" && el.parentId) elements = tidyMindMaps(elements, [el.parentId]);
      return keepSelection(commit({ ...state, elements }, action.before, elements));
    }

    case "delete": {
      const next = deleteElements(state.elements, action.ids);
      if (next === state.elements) return state;
      // Branches that lost a node close up.
      const parents = state.elements
        .filter((el) => action.ids.includes(el.id) && el.parentId)
        .map((el) => el.parentId ?? "");
      return keepSelection(commit(state, state.elements, tidyMindMaps(next, parents)));
    }

    case "mindAdd": {
      const from = state.elements.find((el) => el.id === action.from);
      if (from?.type !== "mindnode") return state;
      const parentId = action.sibling && from.parentId ? from.parentId : from.id;
      const parent = state.elements.find((el) => el.id === parentId);
      if (!parent) return state;
      const node = newMindNode(state.elements, parent, parentId === from.id ? undefined : from);
      // Adding under a folded branch opens it.
      const opened = state.elements.map((el) =>
        el.id === parent.id && el.collapsed ? { ...el, collapsed: false } : el,
      );
      return {
        ...state,
        elements: tidyMindMaps([...opened, node], [node.id]),
        selectedIds: [node.id],
        editRequest: { id: node.id, before: state.elements },
      };
    }

    case "mindToggle": {
      const node = state.elements.find((el) => el.id === action.id);
      if (node?.type !== "mindnode") return state;
      const next = state.elements.map((el) =>
        el.id === node.id ? { ...el, collapsed: !el.collapsed } : el,
      );
      // Selected nodes inside a branch being folded can't stay selected.
      const hidden = node.collapsed ? new Set<string>() : mindDescendants(next, [node.id]);
      return {
        ...commit(state, state.elements, tidyMindMaps(next, [node.id])),
        selectedIds: state.selectedIds.filter((id) => !hidden.has(id)),
      };
    }

    case "mindTidy": {
      const next = tidyMindMaps(state.elements, [action.id]);
      return next === state.elements ? state : commit(state, state.elements, next);
    }

    case "layer": {
      const ordered = byZ(state.elements);
      const moving = new Set(
        action.ids.filter((id) => !state.elements.find((el) => el.id === id)?.locked),
      );
      if (moving.size === 0) return state;
      let next: BoardElement[];
      if (action.move === "front" || action.move === "back") {
        const picked = ordered.filter((el) => moving.has(el.id));
        const rest = ordered.filter((el) => !moving.has(el.id));
        next = action.move === "front" ? [...rest, ...picked] : [...picked, ...rest];
      } else {
        // One step: swap each moving element with its neighbor, unless that one moves too.
        next = [...ordered];
        const up = action.move === "up";
        const indexes = next.map((_, i) => i);
        for (const i of up ? indexes.reverse() : indexes) {
          const j = up ? i + 1 : i - 1;
          const a = next[i];
          const b = next[j];
          if (!a || !b || !moving.has(a.id) || moving.has(b.id)) continue;
          next[i] = b;
          next[j] = a;
        }
      }
      const renumbered = next.map((el, z) => (el.z === z ? el : { ...el, z }));
      return commit(state, state.elements, renumbered);
    }

    case "remote": {
      if (action.ops.length === 0) return state;
      const touched = new Set(action.ops.filter((op) => op.op !== "delete").map(opId));
      // Text an AI editor wrote is measured here, like typed text.
      const next = applyOps(state.elements, action.ops).map((el) =>
        touched.has(el.id) ? fitTextBox(el) : el,
      );
      return keepSelection(commit(state, state.elements, updateBindings(next)));
    }

    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return keepSelection({
        ...state,
        past: state.past.slice(0, -1),
        elements: previous,
        future: [state.elements, ...state.future],
      });
    }

    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return keepSelection({
        ...state,
        past: [...state.past, state.elements],
        elements: next,
        future: rest,
      });
    }
  }
}

const LABELS: Record<ElementType, string> = {
  text: "Text",
  sticky: "Sticky note",
  list: "Bullet list",
  rect: "Rectangle",
  ellipse: "Ellipse",
  diamond: "Diamond",
  line: "Line",
  arrow: "Arrow",
  freehand: "Drawing",
  emoji: "Emoji",
  image: "Image",
  svg: "SVG",
  chart: "Chart",
  frame: "Frame",
  icon: "Icon",
  mindnode: "Mind map node",
};

/** The display name the properties panel uses as its title. */
export function elementLabel(el: BoardElement) {
  if (el.type === "text" && isHandwriting(el.font)) return "Handwriting";
  return LABELS[el.type];
}

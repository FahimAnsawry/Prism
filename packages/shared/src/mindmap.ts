import { z } from "zod";
import type { BoardElement, FontFamily } from "./elements.js";
import type { LayoutElement, TextMeasurer } from "./layout.js";

// Mind maps (tools.md §1, tool 19): "mindnode" elements point at their parent with `parentId`;
// branches aren't stored, they're drawn from each node to its parent. This holds what the board
// and the server share: node sizing, the look of each level, tree walks and the tidy layout.

/** Room between a node's edge and its text. */
export const MIND_PAD_X = 16;
export const MIND_PAD_Y = 10;
/** Text wider than this wraps. */
export const MIND_MAX_TEXT = 240;
/** The narrowest node (an empty one being typed into). */
export const MIND_MIN_WIDTH = 64;
export const MIND_LINE_HEIGHT = 1.3;

/** Gap from a parent to its children: wider after the central topic. */
const GAP_FROM_ROOT = 72;
const GAP_X = 44;
/** Gap between sibling branches. */
const GAP_Y = 14;

/** Branch colors with the light tint their first-level node is filled with. */
export const MIND_BRANCHES: { stroke: string; fill: string }[] = [
  { stroke: "#756cf5", fill: "#e5e2ff" },
  { stroke: "#ff7f59", fill: "#ffe3d9" },
  { stroke: "#1fb985", fill: "#d4f7e7" },
  { stroke: "#f783a3", fill: "#ffe0ea" },
  { stroke: "#5882ff", fill: "#dde7ff" },
  { stroke: "#e5a400", fill: "#fff1c2" },
];

export const MIND_ROOT_COLOR = "#2a2a2a";
export const MIND_TEXT_COLOR = "#3d3b4f";

/** The look of a new node: the central topic, a main branch, or a sub-topic. */
export function mindStyle(depth: number, branch: number, parentStroke?: string) {
  if (depth === 0) {
    return {
      fill: MIND_ROOT_COLOR,
      stroke: MIND_ROOT_COLOR,
      textColor: "#ffffff",
      fontSizePx: 20,
      fontWeight: 700,
    };
  }
  const colors = MIND_BRANCHES[branch % MIND_BRANCHES.length] ?? MIND_BRANCHES[0];
  if (depth === 1) {
    return {
      fill: colors?.fill ?? null,
      stroke: colors?.stroke ?? MIND_TEXT_COLOR,
      textColor: MIND_TEXT_COLOR,
      fontSizePx: 16,
      fontWeight: 600,
    };
  }
  // Sub-topics are plain text underlined in their branch's color.
  return {
    fill: null,
    stroke: parentStroke ?? colors?.stroke ?? MIND_TEXT_COLOR,
    textColor: MIND_TEXT_COLOR,
    fontSizePx: 14,
    fontWeight: 400,
  };
}

/** A node's box for its text, measured with `measureText`. */
export function mindNodeSize(
  text: string,
  style: { font: FontFamily; px: number; weight: number },
  measureText: TextMeasurer,
) {
  const textStyle = { ...style, letterSpacing: 0 };
  const natural = measureText(text, textStyle, null);
  const wraps = natural.width > MIND_MAX_TEXT;
  const measured = wraps ? measureText(text, textStyle, MIND_MAX_TEXT) : natural;
  const textWidth = wraps ? MIND_MAX_TEXT : Math.ceil(natural.width) + 2;
  return {
    width: Math.max(MIND_MIN_WIDTH, textWidth + 2 * MIND_PAD_X),
    height: Math.max(1, measured.lines) * style.px * MIND_LINE_HEIGHT + 2 * MIND_PAD_Y,
  };
}

// ── Tree walks ────────────────────────────────────────────────────────────

type MindLike = Pick<BoardElement, "id" | "type" | "parentId" | "collapsed">;

const isMind = (el: { type: string }) => el.type === "mindnode";

/** Each node's children, by parent id. */
export function mindChildren<T extends MindLike>(elements: T[]) {
  const ids = new Set(elements.filter(isMind).map((el) => el.id));
  const children = new Map<string, T[]>();
  for (const el of elements) {
    if (!isMind(el) || !el.parentId || !ids.has(el.parentId)) continue;
    const list = children.get(el.parentId) ?? [];
    list.push(el);
    children.set(el.parentId, list);
  }
  return children;
}

/** Every node below `ids` (not `ids` themselves), however deep. */
export function mindDescendants<T extends MindLike>(elements: T[], ids: Iterable<string>) {
  const children = mindChildren(elements);
  const found = new Set<string>();
  const stack = [...ids];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    for (const child of children.get(id) ?? []) {
      if (found.has(child.id)) continue;
      found.add(child.id);
      stack.push(child.id);
    }
  }
  return found;
}

/** Nodes inside a collapsed branch, which the board doesn't show. */
export function hiddenMindNodes<T extends MindLike>(elements: T[]) {
  const collapsed = elements.filter((el) => isMind(el) && el.collapsed).map((el) => el.id);
  return collapsed.length > 0 ? mindDescendants(elements, collapsed) : new Set<string>();
}

/** The central topic above `id` (itself if it has no parent). */
export function mindRoot<T extends MindLike>(elements: T[], id: string) {
  const byId = new Map(elements.filter(isMind).map((el) => [el.id, el]));
  let node = byId.get(id);
  const seen = new Set<string>();
  while (node?.parentId && byId.has(node.parentId) && !seen.has(node.id)) {
    seen.add(node.id);
    node = byId.get(node.parentId);
  }
  return node?.id ?? id;
}

/** How many levels below its central topic a node is. */
export function mindDepth<T extends MindLike>(elements: T[], id: string) {
  const byId = new Map(elements.filter(isMind).map((el) => [el.id, el]));
  let depth = 0;
  let node = byId.get(id);
  while (node?.parentId && byId.has(node.parentId) && depth < 100) {
    depth++;
    node = byId.get(node.parentId);
  }
  return depth;
}

// ── Tidy layout ───────────────────────────────────────────────────────────

type MindBox = MindLike & Pick<BoardElement, "x" | "y" | "width" | "height">;

/**
 * New positions for the tree under `rootId`: the central topic stays put, its branches spread
 * to the right and left (each keeps the side it's on), children stack centered beside their
 * parent in their current top-to-bottom order. Nodes in a collapsed branch move with it.
 */
export function tidyMindMap<T extends MindBox>(elements: T[], rootId: string) {
  const children = mindChildren(elements);
  const byId = new Map(elements.filter(isMind).map((el) => [el.id, el]));
  const root = byId.get(rootId);
  const moves = new Map<string, { x: number; y: number }>();
  if (!root) return moves;

  const centerY = (el: T) => el.y + el.height / 2;
  const kidsOf = (el: T) =>
    el.collapsed ? [] : [...(children.get(el.id) ?? [])].sort((a, b) => centerY(a) - centerY(b));

  const spans = new Map<string, number>();
  const span = (el: T): number => {
    const known = spans.get(el.id);
    if (known !== undefined) return known;
    spans.set(el.id, el.height); // a cycle stops here
    const kids = kidsOf(el);
    const total =
      kids.reduce((sum, kid) => sum + span(kid), 0) + GAP_Y * Math.max(0, kids.length - 1);
    const result = Math.max(el.height, total);
    spans.set(el.id, result);
    return result;
  };

  /** Moves `el` (and, if collapsed, its hidden branch along with it). */
  const moveTo = (el: T, x: number, y: number) => {
    moves.set(el.id, { x, y });
    if (!el.collapsed) return;
    const dx = x - el.x;
    const dy = y - el.y;
    for (const id of mindDescendants(elements, [el.id])) {
      const hidden = byId.get(id);
      if (hidden) moves.set(id, { x: hidden.x + dx, y: hidden.y + dy });
    }
  };

  const placed = new Set<string>([root.id]);
  const place = (parent: T, px: number, py: number, kids: T[], side: 1 | -1, gap: number) => {
    const total =
      kids.reduce((sum, kid) => sum + span(kid), 0) + GAP_Y * Math.max(0, kids.length - 1);
    let top = py + parent.height / 2 - total / 2;
    for (const kid of kids) {
      if (placed.has(kid.id)) continue;
      placed.add(kid.id);
      const s = span(kid);
      const x = side === 1 ? px + parent.width + gap : px - gap - kid.width;
      const y = top + s / 2 - kid.height / 2;
      moveTo(kid, x, y);
      place(kid, x, y, kidsOf(kid), side, GAP_X);
      top += s + GAP_Y;
    }
  };

  const rootCenter = root.x + root.width / 2;
  const first = kidsOf(root);
  const right = first.filter((kid) => kid.x + kid.width / 2 >= rootCenter);
  const left = first.filter((kid) => kid.x + kid.width / 2 < rootCenter);
  place(root, root.x, root.y, right, 1, GAP_FROM_ROOT);
  place(root, root.x, root.y, left, -1, GAP_FROM_ROOT);
  return moves;
}

// ── Building a whole map (create_mindmap) ─────────────────────────────────

export interface MindmapInput {
  text: string;
  children?: MindmapInput[] | undefined;
}

export const mindmapInputSchema: z.ZodType<MindmapInput> = z.lazy(() =>
  z.object({
    text: z.string().min(1).max(500).describe("The node's label: a few words."),
    children: z.array(mindmapInputSchema).max(40).optional(),
  }),
);

/** Most nodes one create_mindmap call can make. */
export const MINDMAP_NODES_MAX = 400;

export const countMindNodes = (node: MindmapInput): number =>
  1 + (node.children ?? []).reduce((sum, child) => sum + countMindNodes(child), 0);

/** Where new branches go when they're added to an existing map (create_mindmap with parentId). */
export interface MindmapUnder {
  /** The existing node they hang from. */
  parentId: string;
  /** Its level (0: the central topic) and branch color. */
  depth: number;
  stroke: string;
  /** Its center, and a y past its last child, so the new nodes sort after the old ones. */
  x: number;
  y: number;
  /** Which side its children grow to; under a central topic, the side with fewer branches. */
  side: 1 | -1;
  /** Under a central topic: how many main branches it has (the next color). */
  branches: number;
}

export interface MindmapOptions {
  /** Top-left of the central topic (a new map). */
  x: number;
  y: number;
  font: FontFamily;
  /** Main branches go right only, or alternate right and left. */
  sides: "right" | "both";
  /** Add to an existing map instead: the nodes become children of this node. */
  under?: MindmapUnder | undefined;
}

/** A node to create, with `key` and a `parentId` that refers to the parent's key (or an id). */
export type MindmapElement = LayoutElement & { key: string; parentId: string | null };

/**
 * Nodes as elements, styled by level and sized by `measureText`. A new map (one node, the central
 * topic) comes out laid out tidy; branches added `under` a node get rough positions that keep
 * their side and order, for the caller to tidy together with the rest of the map.
 */
export function buildMindMap(
  nodes: MindmapInput[],
  options: MindmapOptions,
  measureText: TextMeasurer,
): MindmapElement[] {
  const out: MindmapElement[] = [];
  let count = 0;
  const visit = (
    node: MindmapInput,
    parentKey: string | null,
    depth: number,
    branch: number,
    parentStroke: string | undefined,
    side: 1 | -1,
    originX: number,
    originY: number,
  ) => {
    const key = `n${count++}`;
    const style = mindStyle(depth, branch, parentStroke);
    const size = mindNodeSize(
      node.text,
      { font: options.font, px: style.fontSizePx, weight: style.fontWeight },
      measureText,
    );
    out.push({
      key,
      parentId: parentKey,
      type: "mindnode",
      // Rough first positions: only the side and the order matter to the tidy layout.
      x:
        parentKey === null
          ? originX
          : originX + side * (depth * 300 + 1) - (side === 1 ? 0 : size.width),
      y: originY + count,
      ...size,
      text: node.text,
      font: options.font,
      ...style,
      strokeWidth: 2,
    });
    (node.children ?? []).forEach((child, i) => {
      const childSide = depth === 0 ? (options.sides === "both" && i % 2 === 1 ? -1 : 1) : side;
      const childBranch = depth === 0 ? i : branch;
      visit(child, key, depth + 1, childBranch, style.stroke, childSide, originX, originY);
    });
  };

  const under = options.under;
  if (under) {
    nodes.forEach((node, i) => {
      const atRoot = under.depth === 0;
      // Under a central topic, new main branches alternate, starting on the emptier side.
      const side =
        atRoot && options.sides === "both" && i % 2 === 1 ? (-under.side as 1 | -1) : under.side;
      const branch = atRoot ? under.branches + i : 0;
      visit(node, under.parentId, under.depth + 1, branch, under.stroke, side, under.x, under.y);
    });
    return out;
  }

  const root = nodes[0];
  if (!root) return out;
  visit(root, null, 0, 0, undefined, 1, options.x, options.y);
  // Lay out with keys standing in for ids.
  const boxes = out.map((el) => ({ ...el, id: el.key, collapsed: false }));
  const moves = tidyMindMap(boxes, "n0");
  return out.map((el) => ({ ...el, ...moves.get(el.key) }));
}

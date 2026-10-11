// The auto layout behind create_er_diagram (tools.md §1, tool 20): tables in columns by foreign
// key (referenced tables to the left of the tables that point at them), a column much taller than
// the rest split into side-by-side sub-columns, each table moved up or down toward the rows it
// connects to so most relations run straight, and every relation routed through the gaps: its own
// lane in each gap between columns, and a corridor between the tables of any column it passes.
// Pure and deterministic: sizes and edges in, positions and routes out.

export interface ErLayoutNode {
  id: string;
  width: number;
  height: number;
}

/** A relation: `from` holds the foreign key that references `to`; the y's are its rows' middles. */
export interface ErLayoutEdge {
  from: string;
  to: string;
  /** From the top of each table. */
  fromY: number;
  toY: number;
}

interface Point {
  x: number;
  y: number;
}

/** Where a relation runs: both ends, the sides it leaves and enters by, and its lanes. */
export interface ErRoute {
  start: Point;
  end: Point;
  startSide: "left" | "right";
  endSide: "left" | "right";
  /** Absolute x, y, x, … : across to the first x, along to the y, across to the next x, … */
  lanes: number[];
}

export interface ErLayout {
  positions: Map<string, Point>;
  /** Per edge, in order; null for an edge to a table that isn't there. */
  routes: (ErRoute | null)[];
}

/** Least room between columns, and the room an end needs for its crow's foot and badge. */
export const ER_GAP_X = 240;
const END_ROOM = 110;
const LANE_SPACING = 14;
/** Room between tables in one column. */
export const ER_GAP_Y = 56;
/** How far a corridor keeps from the tables it passes, and from other corridors. */
const CORRIDOR_PAD = 14;
const CORRIDOR_SPACING = 9;
/** Ordering and alignment rounds. */
const SWEEPS = 8;
const ALIGN_ROUNDS = 12;
/** The width : height a diagram aims for when it splits tall columns. */
const TARGET_ASPECT = 2;
/** What each extra sub-column costs against the aspect, and the most one rank splits into. */
const COLUMN_COST = 1;
const MAX_SPLIT = 4;

/** How tall columns split: create_er_diagram uses the defaults; a view can fit its own space. */
export interface ErLayoutOptions {
  /** The width : height to aim for (TARGET_ASPECT). */
  aspect?: number;
  /**
   * A space to show the diagram in, in px: instead of aiming for an aspect, columns split only
   * as far as that shows it larger (never past full size).
   */
  fit?: { width: number; height: number };
  /** What each extra sub-column costs (COLUMN_COST); lower splits more readily. */
  columnCost?: number;
  /** The most sub-columns one rank splits into (MAX_SPLIT). */
  maxSplit?: number;
}

export function layoutErDiagram(
  nodes: ErLayoutNode[],
  edges: ErLayoutEdge[],
  options: ErLayoutOptions = {},
): ErLayout {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parents = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();
  const link = (map: Map<string, Set<string>>, a: string, b: string) => {
    const set = map.get(a) ?? new Set<string>();
    set.add(b);
    map.set(a, set);
  };
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue;
    if (edge.from === edge.to) {
      // A table that references itself only needs a loop; it still counts as connected.
      parents.set(edge.from, parents.get(edge.from) ?? new Set());
      continue;
    }
    link(parents, edge.from, edge.to);
    link(children, edge.to, edge.from);
  }
  const neighbors = (id: string) => [...(parents.get(id) ?? []), ...(children.get(id) ?? [])];

  // ── Ranks: one past the deepest table referenced (a cycle stops where it closes) ──
  const rank = new Map<string, number>();
  const visiting = new Set<string>();
  const rankOf = (id: string): number => {
    const known = rank.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let r = 0;
    for (const parent of parents.get(id) ?? []) r = Math.max(r, rankOf(parent) + 1);
    visiting.delete(id);
    rank.set(id, r);
    return r;
  };
  const connected = nodes.filter((node) => parents.has(node.id) || children.has(node.id));
  for (const node of connected) rankOf(node.id);
  // A table that references nothing moves next to the closest table that references it.
  for (const node of connected) {
    if ((parents.get(node.id)?.size ?? 0) > 0 || !children.has(node.id)) continue;
    const below = [...(children.get(node.id) ?? [])].map((id) => rank.get(id) ?? 1);
    rank.set(node.id, Math.max(0, Math.min(...below) - 1));
  }

  const ranks: ErLayoutNode[][] = [];
  for (const node of connected) (ranks[rank.get(node.id) ?? 0] ??= []).push(node);
  const layers = ranks.filter((layer) => layer.length > 0);

  // ── Order each rank by where its neighbors sit (barycenter sweeps) ──
  const stackHeight = (list: ErLayoutNode[]) =>
    list.reduce((sum, node) => sum + node.height, 0) + ER_GAP_Y * Math.max(0, list.length - 1);
  const middle = new Map<string, number>();
  const stack = (columns: ErLayoutNode[][]) => {
    for (const column of columns) {
      let top = -stackHeight(column) / 2;
      for (const node of column) {
        middle.set(node.id, top + node.height / 2);
        top += node.height + ER_GAP_Y;
      }
    }
  };
  stack(layers);
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    let moved = false;
    for (const layer of layers) {
      const bary = (node: ErLayoutNode) => {
        const near = neighbors(node.id)
          .map((id) => middle.get(id))
          .filter((y): y is number => y !== undefined);
        return near.length > 0
          ? near.reduce((a, b) => a + b, 0) / near.length
          : (middle.get(node.id) ?? 0);
      };
      const sorted = layer
        .map((node, i) => ({ node, i, key: bary(node) }))
        .sort((a, b) => a.key - b.key || a.i - b.i)
        .map((entry) => entry.node);
      if (sorted.some((node, i) => node !== layer[i])) moved = true;
      layer.splice(0, layer.length, ...sorted);
    }
    stack(layers);
    if (!moved) break;
  }

  // ── Split ranks much taller than the diagram is wide into sub-columns ──
  const rankIndex = new Map<string, number>();
  layers.forEach((layer, r) => layer.forEach((node) => rankIndex.set(node.id, r)));
  const splits = chooseSplits(layers, stackHeight, options);
  const columns: ErLayoutNode[][] = [];
  layers.forEach((layer, r) => {
    const k = splits[r] ?? 1;
    if (k <= 1) {
      columns.push(layer);
      return;
    }
    // Tables tied to later ranks go right, those tied to earlier ranks left; heights balanced.
    const lean = (node: ErLayoutNode) =>
      neighbors(node.id).reduce((sum, id) => {
        const other = rankIndex.get(id) ?? r;
        return sum + Math.sign(other - r);
      }, 0);
    const ordered = layer
      .map((node, i) => ({ node, i, lean: lean(node) }))
      .sort((a, b) => a.lean - b.lean || a.i - b.i);
    const chunks = balancedChunks(
      ordered.map((entry) => entry.node),
      k,
    );
    for (const chunk of chunks) {
      // Keep the barycenter order inside each sub-column.
      columns.push(chunk.sort((a, b) => layer.indexOf(a) - layer.indexOf(b)));
    }
  });

  const columnOf = new Map<string, number>();
  columns.forEach((column, c) => column.forEach((node) => columnOf.set(node.id, c)));

  // ── Move tables toward the rows they connect to, keeping order and gaps ──
  const top = new Map<string, number>();
  for (const column of columns) {
    let y = -stackHeight(column) / 2;
    for (const node of column) {
      top.set(node.id, y);
      y += node.height + ER_GAP_Y;
    }
  }
  const incident = new Map<string, { other: string; own: number; theirs: number }[]>();
  for (const edge of edges) {
    if (edge.from === edge.to || !columnOf.has(edge.from) || !columnOf.has(edge.to)) continue;
    if (columnOf.get(edge.from) === columnOf.get(edge.to)) continue;
    (incident.get(edge.from) ?? incident.set(edge.from, []).get(edge.from))?.push({
      other: edge.to,
      own: edge.fromY,
      theirs: edge.toY,
    });
    (incident.get(edge.to) ?? incident.set(edge.to, []).get(edge.to))?.push({
      other: edge.from,
      own: edge.toY,
      theirs: edge.fromY,
    });
  }
  for (let round = 0; round < ALIGN_ROUNDS; round++) {
    const order = round % 2 === 0 ? columns : [...columns].reverse();
    for (const column of order) {
      const desired = column.map((node) => {
        const links = incident.get(node.id) ?? [];
        if (links.length === 0) return top.get(node.id) ?? 0;
        const sum = links.reduce((acc, l) => acc + (top.get(l.other) ?? 0) + l.theirs - l.own, 0);
        return sum / links.length;
      });
      // Reorder by where each table wants to be, then place them as close to that as the
      // gaps allow (isotonic regression).
      const entries = column
        .map((node, i) => ({ node, i, want: desired[i] ?? 0 }))
        .sort((a, b) => a.want + a.node.height / 2 - (b.want + b.node.height / 2) || a.i - b.i);
      column.splice(0, column.length, ...entries.map((entry) => entry.node));
      const placed = packColumn(
        entries.map((entry) => entry.node.height),
        entries.map((entry) => entry.want),
      );
      entries.forEach((entry, i) => top.set(entry.node.id, placed[i] ?? 0));
    }
  }

  // ── Routes: which gaps each relation turns in, and corridors through columns ──
  interface Segment {
    gap: number;
    key: string;
    y0: number;
    y1: number;
    /** Rows where it meets the gap's left and right sides (an end, or a corridor going on). */
    left: number[];
    right: number[];
  }
  interface Plan {
    edge: ErLayoutEdge;
    startSide: "left" | "right";
    endSide: "left" | "right";
    startY: number;
    endY: number;
    /** The gap it turns in, or the gaps at both ends of its corridor. */
    gaps: number[];
    corridor: number | null;
  }
  const C = columns.length;
  const segments: Segment[] = [];
  const corridors: Corridor[] = [];
  const freeAt = columns.map((column) =>
    column
      .map((node) => ({
        y0: (top.get(node.id) ?? 0) - CORRIDOR_PAD,
        y1: (top.get(node.id) ?? 0) + node.height + CORRIDOR_PAD,
      }))
      .sort((a, b) => a.y0 - b.y0),
  );
  const segment = (
    gap: number,
    key: string,
    ya: number,
    yb: number,
    left: number[],
    right: number[],
  ) => segments.push({ gap, key, y0: Math.min(ya, yb), y1: Math.max(ya, yb), left, right });
  const plans: (Plan | null)[] = edges.map((edge, index) => {
    const cf = columnOf.get(edge.from);
    const ct = columnOf.get(edge.to);
    if (cf === undefined || ct === undefined) return null;
    const startY = (top.get(edge.from) ?? 0) + edge.fromY;
    const endY = (top.get(edge.to) ?? 0) + edge.toY;
    // Every relation keeps its own lane and corridor (each has its own color, so it can be
    // followed end to end).
    const endKey = `e${index}`;
    if (cf === ct) {
      const gap = cf + 1;
      segment(gap, `${endKey}|${gap}`, startY, endY, [startY, endY], []);
      return {
        edge,
        startSide: "right",
        endSide: "right",
        startY,
        endY,
        gaps: [gap],
        corridor: null,
      };
    }
    const right = ct > cf;
    const startSide = right ? "right" : "left";
    const endSide = right ? "left" : "right";
    if (Math.abs(ct - cf) === 1) {
      const gap = Math.max(cf, ct);
      if (right) segment(gap, `${endKey}|${gap}`, startY, endY, [startY], [endY]);
      else segment(gap, `${endKey}|${gap}`, startY, endY, [endY], [startY]);
      return { edge, startSide, endSide, startY, endY, gaps: [gap], corridor: null };
    }
    const gapS = right ? cf + 1 : cf;
    const gapT = right ? ct : ct + 1;
    const lo = Math.min(cf, ct) + 1;
    const hi = Math.max(cf, ct) - 1;
    const y = findCorridor(freeAt.slice(lo, hi + 1), corridors, lo, hi, startY, endY);
    corridors.push({ y, from: lo, to: hi });
    const out = `${edge.from}|${edge.fromY}|${gapS}|out`;
    if (right) {
      segment(gapS, out, startY, y, [startY], [y]);
      segment(gapT, `${endKey}|${gapT}`, y, endY, [y], [endY]);
    } else {
      segment(gapS, out, startY, y, [y], [startY]);
      segment(gapT, `${endKey}|${gapT}`, y, endY, [endY], [y]);
    }
    return { edge, startSide, endSide, startY, endY, gaps: [gapS, gapT], corridor: y };
  });

  // Lanes: in each gap, one per group (the segments sharing a key), ordered left to right so
  // as few rows as possible cross another group's lane on their way in.
  const laneOf = new Map<string, number>();
  const laneCount = new Array<number>(C + 1).fill(0);
  for (let gap = 0; gap <= C; gap++) {
    const groups = new Map<
      string,
      { key: string; y0: number; y1: number; left: number[]; right: number[] }
    >();
    for (const s of segments) {
      if (s.gap !== gap) continue;
      const g = groups.get(s.key);
      if (g) {
        g.y0 = Math.min(g.y0, s.y0);
        g.y1 = Math.max(g.y1, s.y1);
        g.left.push(...s.left);
        g.right.push(...s.right);
      } else groups.set(s.key, { ...s, left: [...s.left], right: [...s.right] });
    }
    const real = [...groups.values()]
      .filter((g) => {
        // A group with no length (a straight line) doesn't need a lane of its own.
        if (g.y1 - g.y0 >= 0.5) return true;
        laneOf.set(`${gap}|${g.key}`, -1);
        return false;
      })
      .sort((a, b) => a.y0 - b.y0 || a.y1 - b.y1 || (a.key < b.key ? -1 : 1));
    const order = orderLanes(real);
    order.forEach((g, i) => laneOf.set(`${gap}|${g.key}`, i));
    laneCount[gap] = order.length;
  }

  // ── Columns' x: each gap as wide as its lanes need ──
  const gapWidth = (gap: number) =>
    Math.max(ER_GAP_X, 2 * END_ROOM + Math.max(0, (laneCount[gap] ?? 0) - 1) * LANE_SPACING);
  const columnX: number[] = [];
  let left = 0;
  columns.forEach((column, c) => {
    columnX[c] = left;
    left += Math.max(...column.map((node) => node.width)) + gapWidth(c + 1);
  });
  const columnRight = (c: number) =>
    (columnX[c] ?? 0) + Math.max(...(columns[c] ?? []).map((node) => node.width));
  /** A lane's x in a gap: lane 0 beside the gap's left column, the rest spread to its right. */
  const laneX = (gap: number, lane: number) => {
    const start = gap === 0 ? -gapWidth(0) : columnRight(gap - 1);
    const width = gapWidth(gap);
    const count = laneCount[gap] ?? 0;
    if (lane < 0 || count === 0) return start + width / 2;
    const span = (count - 1) * LANE_SPACING;
    return start + (width - span) / 2 + lane * LANE_SPACING;
  };

  const positions = new Map<string, Point>();
  for (const column of columns) {
    for (const node of column) {
      positions.set(node.id, {
        x: columnX[columnOf.get(node.id) ?? 0] ?? 0,
        y: top.get(node.id) ?? 0,
      });
    }
  }

  const routes: (ErRoute | null)[] = plans.map((plan, index) => {
    if (!plan) return null;
    const from = byId.get(plan.edge.from);
    const to = byId.get(plan.edge.to);
    const fromAt = positions.get(plan.edge.from);
    const toAt = positions.get(plan.edge.to);
    if (!from || !to || !fromAt || !toAt) return null;
    const start = {
      x: plan.startSide === "right" ? fromAt.x + from.width : fromAt.x,
      y: plan.startY,
    };
    const end = { x: plan.endSide === "right" ? toAt.x + to.width : toAt.x, y: plan.endY };
    const endKey = `e${index}`;
    let lanes: number[];
    if (plan.corridor === null) {
      const gap = plan.gaps[0] ?? 0;
      lanes = [laneX(gap, laneOf.get(`${gap}|${endKey}|${gap}`) ?? -1)];
    } else {
      const [gapS = 0, gapT = 0] = plan.gaps;
      lanes = [
        laneX(gapS, laneOf.get(`${gapS}|${plan.edge.from}|${plan.edge.fromY}|${gapS}|out`) ?? -1),
        plan.corridor,
        laneX(gapT, laneOf.get(`${gapT}|${endKey}|${gapT}`) ?? -1),
      ];
    }
    return { start, end, startSide: plan.startSide, endSide: plan.endSide, lanes };
  });

  // ── Tables without relations: a grid to the right ──
  const loose = nodes.filter((node) => !parents.has(node.id) && !children.has(node.id));
  if (loose.length > 0) {
    const perRow = Math.max(1, Math.ceil(Math.sqrt(loose.length)));
    let rowTop = Math.min(0, ...[...positions.values()].map((p) => p.y));
    for (let i = 0; i < loose.length; i += perRow) {
      const row = loose.slice(i, i + perRow);
      let x = left;
      for (const node of row) {
        positions.set(node.id, { x, y: rowTop });
        x += node.width + ER_GAP_X / 2;
      }
      rowTop += Math.max(...row.map((node) => node.height)) + ER_GAP_Y;
    }
  }

  // From (0, 0).
  const all = [...positions.values()];
  const minX = Math.min(...all.map((p) => p.x), Infinity);
  const minY = Math.min(...all.map((p) => p.y), Infinity);
  const dx = Number.isFinite(minX) ? -minX : 0;
  const dy = Number.isFinite(minY) ? -minY : 0;
  for (const [id, p] of positions) positions.set(id, { x: p.x + dx, y: p.y + dy });
  for (const route of routes) {
    if (!route) continue;
    route.start = { x: route.start.x + dx, y: route.start.y + dy };
    route.end = { x: route.end.x + dx, y: route.end.y + dy };
    route.lanes = route.lanes.map((v, i) => v + (i % 2 === 0 ? dx : dy));
  }
  return { positions, routes };
}

interface LaneGroup {
  y0: number;
  y1: number;
  left: number[];
  right: number[];
}

/**
 * Lane groups in the left-to-right order with the fewest crossings: a row coming in from the left
 * crosses every lane left of its own that spans it, and one coming in from the right every lane to
 * its right. Built by cheapest insertion, then improved by swapping neighbors.
 */
function orderLanes<T extends LaneGroup>(groups: T[]): T[] {
  const inside = (y: number, g: LaneGroup) => y > g.y0 + 0.5 && y < g.y1 - 0.5;
  /** Crossings between a and b when a is left of b. */
  const pair = (a: LaneGroup, b: LaneGroup) =>
    b.left.filter((y) => inside(y, a)).length + a.right.filter((y) => inside(y, b)).length;
  const total = (list: T[]) => {
    let sum = 0;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) sum += pair(list[i] as T, list[j] as T);
    }
    return sum;
  };
  const order: T[] = [];
  for (const g of groups) {
    let bestAt = order.length;
    let best = Infinity;
    for (let at = 0; at <= order.length; at++) {
      const cost = total([...order.slice(0, at), g, ...order.slice(at)]);
      if (cost < best) {
        best = cost;
        bestAt = at;
      }
    }
    order.splice(bestAt, 0, g);
  }
  for (let pass = 0; pass < order.length; pass++) {
    let improved = false;
    for (let i = 0; i + 1 < order.length; i++) {
      const a = order[i] as T;
      const b = order[i + 1] as T;
      if (pair(b, a) < pair(a, b)) {
        order[i] = b;
        order[i + 1] = a;
        improved = true;
      }
    }
    if (!improved) break;
  }
  return order;
}

/**
 * How many sub-columns each rank becomes: none, unless splitting the tallest ones brings the
 * diagram closer to the aspect (each extra column costs a little, since its relations get longer).
 */
function chooseSplits(
  layers: ErLayoutNode[][],
  stackHeight: (list: ErLayoutNode[]) => number,
  { aspect = TARGET_ASPECT, columnCost = COLUMN_COST, maxSplit = MAX_SPLIT, fit }: ErLayoutOptions,
) {
  const heights = layers.map(stackHeight);
  const widths = layers.map((layer) => Math.max(...layer.map((node) => node.width)));
  const tallestNode = Math.max(0, ...layers.flat().map((node) => node.height));
  const candidates = new Set<number>();
  for (const h of heights)
    for (let k = 1; k <= maxSplit; k++) candidates.add(Math.max(tallestNode, h / k));
  let best = layers.map(() => 1);
  let bestScore = Infinity;
  for (const limit of [...candidates].sort((a, b) => b - a)) {
    const splits = layers.map((layer, r) =>
      Math.min(layer.length, Math.max(1, Math.ceil((heights[r] ?? 0) / limit - 0.05))),
    );
    const count = splits.reduce((a, b) => a + b, 0);
    const width =
      splits.reduce((sum, k, r) => sum + k * (widths[r] ?? 0), 0) + ER_GAP_X * 1.4 * (count - 1);
    const height = Math.max(...splits.map((k, r) => (heights[r] ?? 0) / k));
    const extra = count - layers.length;
    const shape = fit
      ? -Math.log(Math.min(1, fit.width / Math.max(1, width), fit.height / Math.max(1, height)))
      : Math.abs(Math.log(width / Math.max(1, height) / aspect));
    const score = shape + columnCost * extra;
    if (score < bestScore - 1e-9) {
      bestScore = score;
      best = splits;
    }
  }
  return best;
}

/** `list` cut into `k` runs of about the same height, in order. */
function balancedChunks(list: ErLayoutNode[], k: number) {
  const total = list.reduce((sum, node) => sum + node.height + ER_GAP_Y, 0);
  const chunks: ErLayoutNode[][] = [];
  let current: ErLayoutNode[] = [];
  let used = 0;
  list.forEach((node, i) => {
    const target = (total * (chunks.length + 1)) / k;
    const left = list.length - i;
    const chunksLeft = k - chunks.length;
    if (
      current.length > 0 &&
      chunksLeft > 1 &&
      (used + (node.height + ER_GAP_Y) / 2 > target || left < chunksLeft)
    ) {
      chunks.push(current);
      current = [];
    }
    current.push(node);
    used += node.height + ER_GAP_Y;
  });
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Tops for boxes of `heights`, in order, as close to `wanted` as they can be without overlapping
 * (least squares, by pooling adjacent violators).
 */
function packColumn(heights: number[], wanted: number[]) {
  const offsets: number[] = [];
  let acc = 0;
  heights.forEach((h, i) => {
    offsets[i] = acc;
    acc += h + ER_GAP_Y;
  });
  // In terms of q = top - offset, the boxes just need q to never go down.
  const blocks: { sum: number; count: number }[] = [];
  wanted.forEach((w, i) => {
    blocks.push({ sum: w - (offsets[i] ?? 0), count: 1 });
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1];
      const before = blocks[blocks.length - 2];
      if (!last || !before || before.sum / before.count <= last.sum / last.count) break;
      before.sum += last.sum;
      before.count += last.count;
      blocks.pop();
    }
  });
  const out: number[] = [];
  let i = 0;
  for (const block of blocks) {
    const q = block.sum / block.count;
    for (let j = 0; j < block.count; j++, i++) out.push(q + (offsets[i] ?? 0));
  }
  return out;
}

interface Corridor {
  y: number;
  /** The columns it passes through. */
  from: number;
  to: number;
}

/**
 * A y for a corridor through the columns `between` (each a sorted list of blocked y ranges):
 * clear of their tables and of other corridors through the same columns, as close as possible to
 * the relation's two ends.
 */
function findCorridor(
  between: { y0: number; y1: number }[][],
  used: Corridor[],
  lo: number,
  hi: number,
  startY: number,
  endY: number,
) {
  const blocked = between.flat().sort((a, b) => a.y0 - b.y0);
  const clash = (y: number) =>
    blocked.some((b) => y > b.y0 && y < b.y1) ||
    used.some((c) => c.from <= hi && c.to >= lo && Math.abs(c.y - y) < CORRIDOR_SPACING);
  const cost = (y: number) => Math.abs(y - startY) + Math.abs(y - endY);
  const candidates: number[] = [];
  const ideal = Math.min(startY, endY);
  const span = Math.abs(endY - startY);
  // Edges of every free stretch, then steps away from them.
  for (const b of blocked) {
    for (let k = 0; k < 12; k++) {
      candidates.push(b.y0 - k * CORRIDOR_SPACING, b.y1 + k * CORRIDOR_SPACING);
    }
  }
  for (let k = 0; k <= Math.ceil(span / CORRIDOR_SPACING); k++) {
    candidates.push(ideal + k * CORRIDOR_SPACING);
  }
  let best: number | null = null;
  let bestCost = Infinity;
  for (const y of candidates) {
    if (clash(y)) continue;
    const c = cost(y);
    if (c < bestCost - 1e-9 || (Math.abs(c - bestCost) < 1e-9 && best !== null && y < best)) {
      best = y;
      bestCost = c;
    }
  }
  if (best !== null) return best;
  // Everything's taken: go around above all of it.
  const topmost = Math.min(startY, endY, ...blocked.map((b) => b.y0));
  let y = topmost - CORRIDOR_SPACING;
  while (clash(y)) y -= CORRIDOR_SPACING;
  return y;
}

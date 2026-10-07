import type { BoardElement, ElementType } from "./elements.js";

// Boards as code (build_pages, get_screen_code): a frame's elements are flat boxes at x/y, but
// code is nested flex and grid. This rebuilds the nesting a coder needs: what sits inside what
// (containment), which elements are one component (groupId), and how each container lays out
// its children (row, column, grid or overlay, with gap, padding and alignment), so any
// framework's layout primitives (flex, Row/Column, Stack) can be written straight from it.

export type CodeSize = number | "fill" | "hug";

export interface CodeLayout {
  direction: "row" | "column" | "grid" | "overlay";
  /** Space between children in px, when it's even; else `gaps` lists each one. */
  gap?: number;
  gaps?: number[];
  /** Grid only. */
  columns?: number;
  rowGap?: number;
  /** Top, right, bottom, left in px. */
  padding?: [number, number, number, number];
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between";
}

export interface CodeNode {
  /**
   * frame: the screen. box: a painted container. group: an unpainted wrapper (a flex div).
   * component: an instance of a project component. text, icon, image, divider, shape: leaves.
   */
  kind: "frame" | "box" | "group" | "component" | "text" | "icon" | "image" | "divider" | "shape";
  id?: string;
  /** The design's name for it (its groupId without the suffix): "Hero", "Navbar". */
  name?: string;
  role?: string;
  /** Component instance: "Button:primary", "Sidebar > NavItem". */
  component?: string;
  /** Component instance: its text, in reading order (map to the component's props). */
  texts?: string[];
  width: CodeSize;
  height: CodeSize;
  /** px, also given when width/height say fill or hug. */
  box: { width: number; height: number };
  /** In an overlay parent: the offset from its top-left (absolute positioning). */
  at?: { x: number; y: number };
  /** A cross-axis alignment of its own, when it differs from the parent's align. */
  alignSelf?: "start" | "center" | "end" | "stretch";
  /** Paint and text: the element's fields as get_board shows them ($tokens kept). */
  style?: Record<string, unknown>;
  layout?: CodeLayout;
  children?: CodeNode[];
}

/** Element types that aren't part of a coded screen. */
const NOISE = new Set<ElementType>(["sticky", "arrow", "freehand", "mindnode", "emoji"]);
/** Element types that can hold others. */
const CONTAINERS = new Set<ElementType>(["rect", "frame"]);
/** Fields that are geometry or bookkeeping, not style. */
const NOT_STYLE = new Set([
  "id",
  "type",
  "x",
  "y",
  "width",
  "height",
  "z",
  "version",
  "updatedBy",
  "groupId",
  "role",
  "component",
  "autoWidth",
  "rotation",
  "locked",
  "parentId",
  "tokens",
]);

const TOLERANCE = 1;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Item {
  box: Box;
  el: BoardElement | null;
  /** Virtual wrappers have a group name (from a groupId) or none (from the layout). */
  group: string | null;
  kids: Item[];
  z: number;
  /** A wrapper with padding: the box it spans (else it's as big as its content). */
  outer?: Box;
}

const round = (n: number) => Math.round(n * 2) / 2;
const right = (b: Box) => b.x + b.width;
const bottom = (b: Box) => b.y + b.height;
const area = (b: Box) => b.width * b.height;

function contains(outer: Box, inner: Box) {
  return (
    inner.x >= outer.x - TOLERANCE &&
    inner.y >= outer.y - TOLERANCE &&
    right(inner) <= right(outer) + TOLERANCE &&
    bottom(inner) <= bottom(outer) + TOLERANCE
  );
}

function bounds(items: Item[]): Box {
  const x = Math.min(...items.map((i) => i.box.x));
  const y = Math.min(...items.map((i) => i.box.y));
  return {
    x,
    y,
    width: Math.max(...items.map((i) => right(i.box))) - x,
    height: Math.max(...items.map((i) => bottom(i.box))) - y,
  };
}

/** How much of `a` lies inside `b`, 0 to 1. */
function overlapShare(a: Box, b: Box) {
  const w = Math.min(right(a), right(b)) - Math.max(a.x, b.x);
  const h = Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.max(1, area(a)) : 0;
}

/** A groupId without the suffix create_screen adds: "Hero-3-k2j9a" → "Hero". */
export function groupName(groupId: string) {
  return groupId.replace(/-\d+-[a-z0-9]{5}$/, "");
}

const virtual = (kids: Item[], group: string | null): Item => ({
  box: bounds(kids),
  el: null,
  group,
  kids,
  z: Math.min(...kids.map((k) => k.z)),
});

/** Splits items into bands whose projections on one axis don't overlap. */
function bands(items: Item[], axis: "x" | "y") {
  const start = (b: Box) => (axis === "y" ? b.y : b.x);
  const end = (b: Box) => (axis === "y" ? bottom(b) : right(b));
  const sorted = [...items].sort((a, b) => start(a.box) - start(b.box));
  const out: Item[][] = [];
  let reach = -Infinity;
  for (const item of sorted) {
    const current = out[out.length - 1];
    if (current && start(item.box) < reach - TOLERANCE) {
      current.push(item);
      reach = Math.max(reach, end(item.box));
    } else {
      out.push([item]);
      reach = end(item.box);
    }
  }
  return out;
}

function evenGap(gaps: number[]): Pick<CodeLayout, "gap" | "gaps"> {
  if (gaps.length === 0) return {};
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return gaps.every((g) => Math.abs(g - median) <= 1.5)
    ? { gap: round(median) }
    : { gaps: gaps.map(round) };
}

const near = (a: number, b: number, tolerance = 1.5) => Math.abs(a - b) <= tolerance;

/** Where a child sits across `space` on one axis: start, center, end or stretched. */
function placeOn(box: Box, space: Box, axis: "x" | "y") {
  const start = axis === "x" ? box.x - space.x : box.y - space.y;
  const end = axis === "x" ? right(space) - right(box) : bottom(space) - bottom(box);
  const size = axis === "x" ? box.width : box.height;
  const room = axis === "x" ? space.width : space.height;
  if (near(size, room, 2.5)) return "stretch" as const;
  if (near(start, 0)) return "start" as const;
  if (near(start, end, 2)) return "center" as const;
  if (near(end, 0)) return "end" as const;
  return "start" as const;
}

/**
 * The most common placement of the children across `space`, and each child's own where it
 * differs. In a wrapper as big as its content (`sized` false), the children as wide as it
 * fit any alignment, so they don't count.
 */
function crossAlign(kids: Item[], space: Box, axis: "x" | "y", sized: boolean) {
  const each = kids.map((k) => {
    const place = placeOn(k.box, space, axis);
    return !sized && place === "stretch" ? null : place;
  });
  const counts = new Map<string, number>();
  for (const a of each) if (a) counts.set(a, (counts.get(a) ?? 0) + 1);
  const align = ([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    (sized ? "stretch" : "start")) as NonNullable<CodeLayout["align"]>;
  return { align, alignSelf: each.map((a) => (a === null || a === align ? undefined : a)) };
}

interface Laid {
  layout: CodeLayout;
  kids: Item[];
  /** The box the children are laid out in (inside the padding). */
  space: Box;
  /** Whether the parent has a size of its own (a container), so children can fill it. */
  sized: boolean;
  /** Per child: its offset in an overlay, or its own alignment. */
  at: ({ x: number; y: number } | undefined)[];
  alignSelf: (CodeLayout["align"] | undefined)[];
}

/**
 * Consecutive bands of the same count whose items line up in columns (one item of each band
 * per column, like a tab bar's icons over its labels), merged into one.
 */
function mergeColumns(rows: Item[][]) {
  const merged: Item[][] = [];
  for (let i = 0; i < rows.length;) {
    const k = rows[i]!.length;
    let j = i + 1;
    const lineUp = (end: number) => {
      const columns = bands(rows.slice(i, end + 1).flat(), "x");
      return columns.length === k && columns.every((c) => c.length === end + 1 - i);
    };
    while (k > 1 && j < rows.length && rows[j]!.length === k && lineUp(j)) j++;
    merged.push(rows.slice(i, j).flat());
    i = j;
  }
  return merged;
}

/** Padding around `content` in `outer` (top, right, bottom, left), never negative. */
function rawPadding(content: Box, outer: Box): [number, number, number, number] {
  return [
    Math.max(0, content.y - outer.y),
    Math.max(0, right(outer) - right(content)),
    Math.max(0, bottom(outer) - bottom(content)),
    Math.max(0, content.x - outer.x),
  ];
}

/**
 * How `kids` lay out inside `outer` (a container's box, or null for an unpainted wrapper that
 * is as big as its content): cut into horizontal bands (a column, or a grid), else vertical
 * bands (a row), else layered (overlay). Bands with several items become nested wrappers.
 */
function layOut(kids: Item[], outer: Box | null): Laid {
  const content = bounds(kids);
  const sized = outer !== null;
  const raw = outer
    ? rawPadding(content, outer)
    : ([0, 0, 0, 0] as [number, number, number, number]);
  /**
   * Padding for a layout along `main`: the main axis keeps what's there; across it, uneven
   * sides are alignment, so both get the smaller one.
   */
  const paddingFor = (main: "x" | "y"): [number, number, number, number] => {
    const [t, r, b, l] = raw;
    const even = (a: number, c: number) =>
      near(a, c, 3) ? [a, c] : [Math.min(a, c), Math.min(a, c)];
    const [l2, r2] = main === "y" ? even(l, r) : [l, r];
    const [t2, b2] = main === "x" ? even(t, b) : [t, b];
    return [round(t2!), round(r2!), round(b2!), round(l2!)];
  };
  const wrap = (band: Item[]) => (band.length === 1 ? band[0]! : virtual(band, null));
  const flow = (
    layout: CodeLayout,
    items: Item[],
    padding: [number, number, number, number],
    space: Box,
    alignSelf: Laid["alignSelf"],
  ): Laid => ({
    layout: padding.some((p) => p !== 0) ? { ...layout, padding } : layout,
    kids: items,
    space,
    sized,
    at: items.map(() => undefined),
    alignSelf,
  });

  const rows = bands(kids, "y");
  // A grid: every band a row of the same count, with the columns lined up.
  if (rows.length > 1) {
    const counts = rows.map((r) => r.length);
    const columns = counts[0] ?? 0;
    if (columns > 1 && counts.every((c) => c === columns)) {
      const lefts = rows.map((r) => [...r].sort((a, b) => a.box.x - b.box.x).map((i) => i.box.x));
      const aligned = lefts.every((ls) => ls.every((l, i) => near(l, lefts[0]?.[i] ?? l, 2)));
      if (aligned) {
        const first = [...rows[0]!].sort((a, b) => a.box.x - b.box.x);
        const colGaps = first.slice(1).map((k, i) => k.box.x - right(first[i]!.box));
        const rowGaps = rows.slice(1).map((r, i) => bounds(r).y - bottom(bounds(rows[i]!)));
        const ordered = rows.flatMap((r) => [...r].sort((a, b) => a.box.x - b.box.x));
        const padding = paddingFor("y");
        return flow(
          {
            direction: "grid",
            columns,
            ...evenGap(colGaps),
            ...(rowGaps.length > 0 && { rowGap: round(Math.min(...rowGaps)) }),
          },
          ordered,
          padding,
          outer ? inner(outer, padding) : content,
          ordered.map(() => undefined),
        );
      }
    }
  }

  // A column, unless every band merges into one row of columns (then it's a row, below).
  const merged = mergeColumns(rows);
  if (merged.length > 1 || kids.length === 1) {
    const padding = paddingFor("y");
    const space = outer ? inner(outer, padding) : content;
    let items = merged.map(wrap);
    // Several children inset by the same amount next to full-width ones (text under a cover
    // photo in a card) share a padded wrapper.
    if (outer && items.some((k) => near(k.box.width, space.width, 2.5))) {
      const grouped: Item[] = [];
      for (let i = 0; i < items.length;) {
        const inset = items[i]!.box.x - space.x;
        let j = i;
        while (
          inset > 2 &&
          j < items.length &&
          near(items[j]!.box.x - space.x, inset) &&
          right(items[j]!.box) <= right(space) - inset + 1.5
        ) {
          j++;
        }
        const run = items.slice(i, j);
        if (run.length >= 2 && run.some((k) => near(right(space) - right(k.box), inset, 3))) {
          const runBox = bounds(run);
          grouped.push({
            ...virtual(run, null),
            outer: { x: space.x, y: runBox.y, width: space.width, height: runBox.height },
          });
          i = j;
        } else {
          grouped.push(items[i]!);
          i++;
        }
      }
      items = grouped;
    }
    const gaps = items.slice(1).map((k, i) => k.box.y - bottom(items[i]!.box));
    const { align, alignSelf } = crossAlign(items, space, "x", sized);
    return flow({ direction: "column", ...evenGap(gaps), align }, items, padding, space, alignSelf);
  }

  const cols = bands(kids, "x");
  if (cols.length > 1) {
    let items = cols.map(wrap);
    const gapsOf = (list: Item[]) => list.slice(1).map((k, i) => k.box.x - right(list[i]!.box));
    let gaps = gapsOf(items);
    let spread = false;
    // A gap much wider than the others splits the row into clusters pushed apart (a navbar's
    // logo and its actions, a header's title and its bell): space-between.
    const small = Math.min(...gaps);
    const wide = gaps.map((g) => g > 32 && g > Math.max(small, 8) * 3);
    if (wide.some(Boolean) && !wide.every(Boolean)) {
      const clusters: Item[][] = [[items[0]!]];
      gaps.forEach((_, i) => {
        if (wide[i]) clusters.push([items[i + 1]!]);
        else clusters[clusters.length - 1]!.push(items[i + 1]!);
      });
      items = clusters.map(wrap);
      gaps = gapsOf(items);
      spread = true;
    } else if (items.length > 1 && small > 32 && outer && raw[1] <= 2 + raw[3]) {
      spread = true;
    }
    const padding = paddingFor("x");
    const space = outer ? inner(outer, padding) : content;
    const { align, alignSelf } = crossAlign(items, space, "y", sized);
    return flow(
      {
        direction: "row",
        ...(spread ? (items.length === 2 ? {} : evenGap(gaps)) : evenGap(gaps)),
        align,
        ...(spread && { justify: "space-between" as const }),
      },
      items,
      padding,
      space,
      alignSelf,
    );
  }

  // Overlapping: layers placed on the base (the container, or their bounds).
  const base = outer ?? content;
  const ordered = [...kids].sort((a, b) => a.z - b.z);
  return {
    layout: { direction: "overlay" },
    kids: ordered,
    space: base,
    sized,
    at: ordered.map((k) => ({ x: round(k.box.x - base.x), y: round(k.box.y - base.y) })),
    alignSelf: ordered.map(() => undefined),
  };
}

function inner(outer: Box, padding: [number, number, number, number] | undefined): Box {
  const [t, r, b, l] = padding ?? [0, 0, 0, 0];
  return {
    x: outer.x + l,
    y: outer.y + t,
    width: outer.width - l - r,
    height: outer.height - t - b,
  };
}

/** Reading order: top to bottom, then left to right. */
const reading = (a: BoardElement, b: BoardElement) =>
  Math.abs(a.y - b.y) > Math.min(a.height, b.height) / 2 ? a.y - b.y : a.x - b.x;

function leavesOf(item: Item): BoardElement[] {
  return [...(item.el ? [item.el] : []), ...item.kids.flatMap(leavesOf)];
}

/**
 * The frame as a nested tree for code. `describe` gives an element's fields as the AI editor
 * reads them (get_board's view: $tokens kept, image URLs); geometry is left out of `style`.
 */
export function screenTree(
  frame: BoardElement,
  elements: BoardElement[],
  describe: (el: BoardElement) => Record<string, unknown>,
): CodeNode {
  const members = elements
    .filter((el) => el.id !== frame.id && !NOISE.has(el.type))
    .filter((el) => {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      return cx >= frame.x && cx <= right(frame) && cy >= frame.y && cy <= bottom(frame);
    })
    .sort((a, b) => a.z - b.z);

  // Containment: each element's parent is the smallest container under it that holds it.
  const items = new Map<string, Item>();
  const root: Item = { box: frame, el: frame, group: null, kids: [], z: frame.z };
  for (const el of members) items.set(el.id, { box: el, el, group: null, kids: [], z: el.z });
  for (const el of members) {
    const item = items.get(el.id)!;
    let parent = root;
    for (const other of members) {
      if (other === el || other.z >= el.z || !CONTAINERS.has(other.type)) continue;
      if (!contains(other, el) || area(other) <= area(el)) continue;
      if (parent === root || area(other) < area(parent.box)) parent = items.get(other.id)!;
    }
    parent.kids.push(item);
  }

  /** Kids that share a groupId (other than the parent's own) become one wrapper. */
  function groupKids(item: Item): Item[] {
    const own = item.el?.groupId ?? item.group;
    const byGroup = new Map<string, Item[]>();
    const loose: Item[] = [];
    for (const kid of item.kids) {
      const id = kid.el?.groupId;
      if (id && id !== own) byGroup.set(id, [...(byGroup.get(id) ?? []), kid]);
      else loose.push(kid);
    }
    const wrappers: Item[] = [];
    for (const [id, kids] of byGroup) {
      // One element (often a container holding the rest) needs no wrapper.
      if (kids.length === 1) loose.push(kids[0]!);
      else wrappers.push(virtual(kids, id));
    }
    // A group (or element) lying mostly inside another group's area belongs to it: a button
    // group inside the hero, a stat card hanging off the hero's photo.
    const all = [...wrappers, ...loose].sort((a, b) => area(b.box) - area(a.box));
    const top: Item[] = [];
    for (const candidate of all) {
      const host = wrappers
        .filter((w) => w !== candidate && area(w.box) > area(candidate.box))
        .filter((w) => overlapShare(candidate.box, w.box) >= 0.5)
        .sort((a, b) => area(a.box) - area(b.box))[0];
      if (host) {
        host.kids.push(candidate);
        host.z = Math.min(host.z, candidate.z);
      } else top.push(candidate);
    }
    // Hosts grew: their boxes take in what joined them.
    for (const w of wrappers) w.box = bounds(w.kids);
    return top;
  }

  function sizeOf(item: Item, parent: Laid | null, index: number) {
    const el = item.el;
    const text = el?.type === "text" || el?.type === "list";
    const direction = parent?.layout.direction;
    const space = parent?.space;
    let width: CodeSize = round(item.box.width);
    let height: CodeSize = round(item.box.height);
    if (text) height = "hug";
    if (text && el.autoWidth) width = "hug";
    // Only a container with a size of its own has room for a child to fill.
    if (parent?.sized && space && !(text && el.autoWidth)) {
      if (direction === "column" && near(item.box.width, space.width)) width = "fill";
      if (direction === "row" && !text && near(item.box.height, space.height)) height = "fill";
      if (direction === "row" && parent.kids.length > 1) {
        // The widest child of a row that spans its container takes the leftover width.
        const widths = parent.kids.map((k) => k.box.width);
        const gaps = parent.kids
          .slice(1)
          .reduce((sum, k, i) => sum + k.box.x - right(parent.kids[i]!.box), 0);
        const used = widths.reduce((s, w) => s + w, 0) + gaps;
        if (index === widths.indexOf(Math.max(...widths)) && near(used, space.width, 2)) {
          width = "fill";
        }
      }
    }
    // Containers and wrappers take their content's height.
    if ((!el || (CONTAINERS.has(el.type) && item.kids.length > 0)) && height !== "fill") {
      height = "hug";
    }
    return { width, height };
  }

  function toNode(item: Item, parent: Laid | null, index: number, inherited?: string): CodeNode {
    const el = item.el;
    const { width, height } = sizeOf(item, parent, index);
    const base: CodeNode = {
      kind: "group",
      width,
      height,
      box: { width: round(item.box.width), height: round(item.box.height) },
      ...(parent?.at[index] && { at: parent.at[index] }),
      ...(parent?.alignSelf[index] && { alignSelf: parent.alignSelf[index] }),
    };
    const groupId = el?.groupId ?? item.group;
    // Named where a group starts; its parts don't repeat the name.
    const name = groupId ? groupName(groupId) : undefined;
    if (name && name !== inherited) base.name = name;
    if (el?.role) base.role = el.role;
    if (el) base.id = el.id;

    // A component instance: its own parts collapse to the component, its slot content stays.
    const leaves = leavesOf(item);
    const tagged = leaves.filter((l) => l.component);
    // One instance: every part tagged and in one group (two buttons side by side are two).
    const oneGroup = new Set(leaves.map((l) => l.groupId)).size === 1;
    const isInstance =
      (el && el.component) ||
      (!el && tagged.length > 0 && tagged.length === leaves.length && oneGroup);
    if (isInstance && el?.type !== "frame") {
      const tag = [...tagged].sort(
        (a, b) => (a.component?.length ?? 0) - (b.component?.length ?? 0),
      )[0]?.component;
      const texts = tagged
        .filter((l) => l.type === "text" && l.text)
        .sort(reading)
        .map((l) => l.text ?? "");
      const slot = item.kids.filter((k) => leavesOf(k).every((l) => !l.component));
      const node: CodeNode = {
        ...base,
        kind: "component",
        ...(tag && { component: tag }),
        ...(texts.length > 0 && { texts }),
      };
      delete node.id;
      if (slot.length > 0) {
        const laid = layOut(slot, null);
        node.layout = laid.layout;
        node.children = laid.kids.map((k, i) => toNode(k, laid, i, name ?? inherited));
      }
      return node;
    }

    if (el && item.kids.length === 0) return { ...base, ...leaf(el) };

    // A container (or wrapper): its kids, grouped, then laid out.
    const kids = item.el ? groupKids(item) : item.kids;
    const node: CodeNode = el
      ? { ...base, kind: el.type === "frame" ? "frame" : "box", style: styleOf(el) }
      : base;
    if (el?.type === "frame") {
      node.width = round(item.box.width);
      node.height = round(item.box.height);
    }
    if (kids.length === 0) return node;
    const laid = layOut(kids, el ? item.box : (item.outer ?? null));
    node.layout = laid.layout;
    node.children = laid.kids.map((k, i) => toNode(k, laid, i, name ?? inherited));
    return node;
  }

  function styleOf(el: BoardElement) {
    const style: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(describe(el))) {
      if (!NOT_STYLE.has(key)) style[key] = value;
    }
    // A shape without an outline has no border to code.
    if (el.type !== "text" && el.type !== "icon" && el.type !== "line" && !el.strokeWidth) {
      delete style["stroke"];
      delete style["strokeWidth"];
    }
    return style;
  }

  function leaf(el: BoardElement): Pick<CodeNode, "kind" | "style"> {
    const style = styleOf(el);
    switch (el.type) {
      case "text":
      case "list":
        return { kind: "text", style };
      case "icon":
        return { kind: "icon", style };
      case "line":
        return { kind: "divider", style };
      case "image":
      case "svg":
        return { kind: "image", style };
      default:
        return { kind: el.fillImage ? "image" : el.type === "rect" ? "box" : "shape", style };
    }
  }

  return toNode(root, null, 0);
}

/** Text just above a frame (its route or state, by Prism's convention), if any. */
export function frameLabel(frame: BoardElement, elements: BoardElement[]) {
  const above = elements
    .filter(
      (el) =>
        el.type === "text" &&
        el.text &&
        bottom(el) <= frame.y + 2 &&
        bottom(el) >= frame.y - 120 &&
        right(el) > frame.x &&
        el.x < right(frame),
    )
    .sort((a, b) => bottom(b) - bottom(a));
  return above[0]?.text ?? null;
}

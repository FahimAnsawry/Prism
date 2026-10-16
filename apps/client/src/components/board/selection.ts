// What a click, a marquee or Esc selects on a UI board: cards and sections as a whole, then one
// level deeper per double-click (Figma-style). Nothing here is stored on the board or in the
// reducer: containment is worked out from `groupId` and geometry when a selection is made, and
// the level you are at is read back from the selection itself (see `levelOf`).
//
// A card is a rect or frame that holds other elements. An element is held by a card when
//   - it shares the card's groupId and the card is that group's anchor (the largest container
//     with that groupId, as names.ts groupAnchor finds it): this wins over geometry, so a badge
//     hanging outside its card still belongs to it; or
//   - it lies fully inside the card's bounds and is drawn above it: this wins over a different
//     groupId, which is how a nested component (its own groupId) belongs to the outer card.
// Partly overlapping elements with another groupId, and elements below the card, are not held.
// What a card contains is the closure of that relation, so a nested card brings its own members.

import { type BoardElement, hiddenMindNodes } from "@prism/shared";
import { type Box, elementBounds } from "./geometry";

/** Bounds may differ by this much (board px) and still count as inside. */
const SLACK = 0.5;

const isBox = (el: BoardElement) => el.type === "rect" || el.type === "frame";
const area = (box: Box) => box.width * box.height;

interface Index {
  elements: BoardElement[];
  /** Frames and rects that can hold others (not locked, not folded away). */
  containers: BoardElement[];
  containerIds: ReadonlySet<string>;
  /** The largest container of each groupId. */
  anchors: Map<string, BoardElement>;
  hidden: ReadonlySet<string>;
  bounds: Map<string, Box>;
  ancestors: Map<string, BoardElement[]>;
  members: Map<string, string[]>;
  cards: Map<string, boolean>;
  pages: Map<string, boolean>;
}

const indexes = new WeakMap<BoardElement[], Index>();

/** Lookups for one version of the board (the elements array is replaced on every change). */
function indexFor(elements: BoardElement[]): Index {
  const known = indexes.get(elements);
  if (known) return known;
  const hidden = hiddenMindNodes(elements);
  const containers = elements.filter((el) => isBox(el) && !el.locked && !hidden.has(el.id));
  const index: Index = {
    elements,
    containers,
    containerIds: new Set(containers.map((el) => el.id)),
    anchors: new Map(),
    hidden,
    bounds: new Map(),
    ancestors: new Map(),
    members: new Map(),
    cards: new Map(),
    pages: new Map(),
  };
  for (const el of containers) {
    if (!el.groupId) continue;
    const anchor = index.anchors.get(el.groupId);
    if (!anchor || area(boundsOf(index, el)) > area(boundsOf(index, anchor))) {
      index.anchors.set(el.groupId, el);
    }
  }
  indexes.set(elements, index);
  return index;
}

function boundsOf(index: Index, el: BoardElement) {
  let box = index.bounds.get(el.id);
  if (!box) {
    box = elementBounds(el);
    index.bounds.set(el.id, box);
  }
  return box;
}

const within = (inner: Box, outer: Box) =>
  inner.x >= outer.x - SLACK &&
  inner.y >= outer.y - SLACK &&
  inner.x + inner.width <= outer.x + outer.width + SLACK &&
  inner.y + inner.height <= outer.y + outer.height + SLACK;

/** Whether container `c` directly holds `e`. */
function holds(index: Index, c: BoardElement, e: BoardElement) {
  if (c.id === e.id || e.locked || index.hidden.has(e.id)) return false;
  if (c.groupId && e.groupId === c.groupId && index.anchors.get(c.groupId) === c) return true;
  return e.z > c.z && within(boundsOf(index, e), boundsOf(index, c));
}

/** The containers that hold `el`, directly or through others, outermost first. */
function ancestorsOf(index: Index, el: BoardElement): BoardElement[] {
  const known = index.ancestors.get(el.id);
  if (known) return known;
  const found = new Map<string, BoardElement>();
  const queue = [el];
  for (let next = queue.shift(); next; next = queue.shift()) {
    for (const c of index.containers) {
      if (c.id === el.id || found.has(c.id) || !holds(index, c, next)) continue;
      found.set(c.id, c);
      queue.push(c);
    }
  }
  const list = [...found.values()];
  // Stored first: two containers that hold each other (same size, same group) end the recursion.
  index.ancestors.set(el.id, list);
  // Every ancestor of a container is an ancestor of what it holds, so more of them means deeper.
  const sorted = list
    .map((c) => ({ c, depth: ancestorsOf(index, c).length }))
    .sort((a, b) => a.depth - b.depth || a.c.z - b.c.z)
    .map(({ c }) => c);
  index.ancestors.set(el.id, sorted);
  return sorted;
}

/** Whether `c` is a card or section: it holds something and is worth treating as one unit. */
function isCard(index: Index, c: BoardElement) {
  if (!index.containerIds.has(c.id)) return false;
  const known = index.cards.get(c.id);
  if (known !== undefined) return known;
  const marked =
    c.type === "frame" ||
    Boolean(c.role) ||
    Boolean(c.name?.trim()) ||
    Boolean(c.groupId && index.anchors.get(c.groupId) === c);
  // One held element makes a marked container a card; a plain rect needs two (a box with only a
  // label stays a box, as in a flowchart).
  const needed = marked ? 1 : 2;
  let kids = 0;
  for (const e of index.elements) {
    if (holds(index, c, e) && ++kids >= needed) break;
  }
  index.cards.set(c.id, kids >= needed);
  return kids >= needed;
}

/** A shell rect holding this many separate groups is a page background, not a section. */
const SHELL_GROUPS = 3;

/**
 * Whether `c` is a whole screen: a frame, the background rect that fills one, or an ungrouped
 * rect that is only the shell around several components (create_screen's root). A click inside a
 * screen picks the sections and cards on it, not the screen; its own background or label does.
 */
function isPage(index: Index, c: BoardElement) {
  if (c.type === "frame") return true;
  let page = index.pages.get(c.id);
  if (page === undefined) {
    const box = boundsOf(index, c);
    page = ancestorsOf(index, c).some((f) => {
      const frame = boundsOf(index, f);
      return (
        f.type === "frame" && box.width >= frame.width * 0.9 && box.height >= frame.height * 0.9
      );
    });
    if (!page && !c.groupId) {
      const groups = new Set<string>();
      for (const e of index.elements) {
        if (e.groupId && holds(index, c, e)) groups.add(e.groupId);
        if (groups.size >= SHELL_GROUPS) break;
      }
      page = groups.size >= SHELL_GROUPS;
    }
    index.pages.set(c.id, page);
  }
  return page;
}

/** The cards that hold `el`, outermost first. */
const cardsAbove = (index: Index, el: BoardElement) =>
  ancestorsOf(index, el).filter((c) => isCard(index, c));

/** `card` and everything it contains (just `card` when it isn't one). */
function unitOf(index: Index, card: BoardElement) {
  if (!isCard(index, card)) return [card.id];
  let ids = index.members.get(card.id);
  if (!ids) {
    const seen = new Set<string>([card.id]);
    const queue = [card];
    for (let next = queue.shift(); next; next = queue.shift()) {
      for (const e of index.elements) {
        if (seen.has(e.id) || !holds(index, next, e)) continue;
        seen.add(e.id);
        if (index.containerIds.has(e.id)) queue.push(e);
      }
    }
    ids = [...seen];
    index.members.set(card.id, ids);
  }
  return ids;
}

const isInside = (index: Index, el: BoardElement, scope: BoardElement) =>
  ancestorsOf(index, el).includes(scope);

/**
 * The cards `el` can be picked as at a level, outermost first: those inside `scope`, or at the top
 * level all but whole screens (picked by their own background or label).
 */
function unitsAt(index: Index, el: BoardElement, scope: BoardElement | undefined) {
  const chain = isCard(index, el) ? [...cardsAbove(index, el), el] : cardsAbove(index, el);
  return chain.filter((c) =>
    scope ? c !== scope && isInside(index, c, scope) : !isPage(index, c) || c === el,
  );
}

/** The selected elements that no other selected container holds: the outlines worth drawing. */
export function outlineRoots(elements: BoardElement[], selected: BoardElement[]) {
  if (selected.length < 2) return selected;
  const index = indexFor(elements);
  const holders = selected.filter((el) => index.containerIds.has(el.id));
  if (holders.length === 0) return selected;
  return selected.filter((el) => !holders.some((c) => holds(index, c, el)));
}

/**
 * The cards the selection lives in, outermost first (whole screens left out): the level a click picks
 * from. Selecting a top-level card gives none; selecting a button inside it gives that card.
 */
export function levelOf(elements: BoardElement[], selectedIds: string[]) {
  if (selectedIds.length === 0) return [];
  const index = indexFor(elements);
  const chosen = new Set(selectedIds);
  const selected = elements.filter((el) => chosen.has(el.id) && !index.hidden.has(el.id));
  let common: BoardElement[] | null = null;
  for (const root of outlineRoots(elements, selected)) {
    const path = cardsAbove(index, root).filter((c) => !isPage(index, c));
    if (!common) {
      common = path;
      continue;
    }
    let n = 0;
    while (n < common.length && n < path.length && common[n] === path[n]) n++;
    common = common.slice(0, n);
  }
  return common ?? [];
}

export interface Pick {
  /** What the click selects: a card or section, or the single element. */
  target: BoardElement;
  /** `target` and everything it contains. */
  ids: string[];
}

/**
 * What a click on `hit` selects. At the board's top level that is the outermost card or section
 * under the pointer (its contents come with it); inside a card you have drilled into, it is the
 * outermost card or the single element under the pointer within that card. `deep` (Ctrl/Cmd)
 * skips the levels and takes the element itself.
 */
export function pickAt(
  elements: BoardElement[],
  hit: BoardElement,
  selectedIds: string[],
  deep: boolean,
): Pick {
  if (deep) return { target: hit, ids: [hit.id] };
  const index = indexFor(elements);
  // The level stays while the click is inside it; a click outside it goes back up.
  const above = cardsAbove(index, hit);
  let scope: BoardElement | undefined;
  for (const c of levelOf(elements, selectedIds)) {
    if (!above.includes(c)) break;
    scope = c;
  }
  const target = unitsAt(index, hit, scope)[0] ?? hit;
  return { target, ids: unitOf(index, target) };
}

/** `id` and everything it contains (a card's label selects the whole card). */
export function unitIds(elements: BoardElement[], id: string) {
  const index = indexFor(elements);
  const el = elements.find((e) => e.id === id);
  return el ? unitOf(index, el) : [id];
}

/**
 * The selection after a double-click on `hit`, one level deeper than the selected card or
 * section it is in: the nested card or the single element under the pointer. Null when `hit`
 * isn't inside a selected card, or is already at the deepest level.
 */
export function drillInto(elements: BoardElement[], selectedIds: string[], hit: BoardElement) {
  const index = indexFor(elements);
  const chain = isCard(index, hit) ? [...cardsAbove(index, hit), hit] : cardsAbove(index, hit);
  const chosen = new Set(selectedIds);
  const unit = chain.find((c) => chosen.has(c.id));
  if (!unit || unit === hit) return null;
  const target =
    chain.find((c) => c !== unit && isInside(index, c, unit)) ??
    (isInside(index, hit, unit) ? hit : null);
  return target ? unitOf(index, target) : null;
}

/** Esc: the card or section one level up from the selection, or null when it is at the top. */
export function selectionParent(elements: BoardElement[], selectedIds: string[]) {
  const parent = levelOf(elements, selectedIds).at(-1);
  return parent ? unitOf(indexFor(elements), parent) : null;
}

/** The innermost card of `level` that the point is inside: a marquee there stays at its level. */
export function scopeAt(level: BoardElement[], p: { x: number; y: number }) {
  let scope: BoardElement | undefined;
  for (const c of level) {
    const box = elementBounds(c);
    if (p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height) {
      scope = c;
    }
  }
  return scope;
}

/**
 * What a marquee over `box` selects: every element it touches, widened to its card or section at
 * the marquee's level. A frame (a whole screen) is only taken when the marquee encloses it.
 * `shown` is the board bottom layer first, without folded mind map branches.
 */
export function marqueePick(
  elements: BoardElement[],
  shown: BoardElement[],
  box: Box,
  scope: BoardElement | undefined,
) {
  const index = indexFor(elements);
  const picked = new Set<string>();
  for (const el of shown) {
    if (picked.has(el.id)) continue;
    const bounds = boundsOf(index, el);
    const touches =
      bounds.x <= box.x + box.width &&
      box.x <= bounds.x + bounds.width &&
      bounds.y <= box.y + box.height &&
      box.y <= bounds.y + bounds.height;
    if (!touches) continue;
    if (scope && (el === scope || !isInside(index, el, scope))) continue;
    if (!scope && isCard(index, el) && isPage(index, el) && !within(bounds, box)) continue;
    const target = unitsAt(index, el, scope)[0] ?? el;
    for (const id of unitOf(index, target)) picked.add(id);
  }
  return [...picked];
}

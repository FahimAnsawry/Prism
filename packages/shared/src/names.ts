import { frameLabel, groupName } from "./code-tree.js";
import { type BoardElement, NAME_MAX } from "./elements.js";

// Names for the frames, sections and cards of a UI board, so people and AI editors can point at
// "Pricing — Pro plan card" instead of "rect 12". A name is stored on the element (`name`) when
// someone sets it or when an AI editor draws it; for the rest, these functions work one out from
// the structure (what sits inside what) and the content (headings, roles, group names).

const SIZES = { S: 16, M: 22, L: 30, XL: 40 } as const;
const textPx = (el: BoardElement) => el.fontSizePx ?? SIZES[el.fontSize ?? "M"];
const area = (el: BoardElement) => el.width * el.height;

/** Element types that hold others. */
const isContainer = (el: BoardElement) => el.type === "rect" || el.type === "frame";

/** What the same element reads as in a sentence: "pricing-card" → "Pricing card". */
function humanize(raw: string) {
  const spaced = raw.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return "";
  // Names with their own capitals ("FAQ", "Hero CTA") are kept as written.
  return /[A-Z]/.test(spaced) ? spaced : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** One line of text of at most `max` characters, cut at a word. */
function shorten(text: string, max: number) {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.:;—-]+$/, "")}…`;
}

const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface Context {
  elements: BoardElement[];
  /** Frames and rects, smallest first. */
  containers: BoardElement[];
  titles: Map<string, string | null>;
  inside: Map<string, BoardElement[]>;
}

function contextFor(elements: BoardElement[]): Context {
  return {
    elements,
    containers: elements.filter(isContainer).sort((a, b) => area(a) - area(b)),
    titles: new Map(),
    inside: new Map(),
  };
}

/** Whether `el` sits on top of `host` and its center is within it. */
function sitsOn(el: BoardElement, host: BoardElement) {
  if (el.id === host.id || host.z >= el.z || area(host) <= area(el)) return false;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return cx >= host.x && cx <= host.x + host.width && cy >= host.y && cy <= host.y + host.height;
}

/** Everything drawn on top of `host`, inside its box. */
function onTopOf(host: BoardElement, ctx: Context) {
  let found = ctx.inside.get(host.id);
  if (!found) {
    found = ctx.elements.filter((el) => sitsOn(el, host));
    ctx.inside.set(host.id, found);
  }
  return found;
}

/** The containers `el` sits in, the smallest first. */
const hostsOf = (el: BoardElement, ctx: Context) => ctx.containers.filter((c) => sitsOn(el, c));

/** The largest container of `groupId`: the one the group's name belongs to. */
function groupAnchor(groupId: string, ctx: Context) {
  let anchor: BoardElement | undefined;
  for (const el of ctx.elements) {
    if (el.groupId !== groupId || !isContainer(el)) continue;
    if (!anchor || area(el) > area(anchor)) anchor = el;
  }
  return anchor;
}

/** The text that titles a container: the topmost of its larger texts, else null. */
function headingOf(host: BoardElement, ctx: Context) {
  const texts = onTopOf(host, ctx).filter((el) => el.type === "text" && el.text?.trim());
  if (texts.length === 0) return null;
  const biggest = Math.max(...texts.map(textPx));
  const heading = texts
    .filter((el) => textPx(el) >= biggest * 0.6)
    .sort((a, b) => a.y - b.y || a.x - b.x)[0];
  return heading?.text ? shorten(heading.text, 32) : null;
}

const deviceOf = (width: number) =>
  width <= 480 ? "mobile screen" : width <= 1024 ? "tablet screen" : "desktop screen";

/** What a container is called on its own: a group's name, a frame's label or its heading. */
function titleOf(el: BoardElement, ctx: Context): string | null {
  const known = ctx.titles.get(el.id);
  if (known !== undefined) return known;
  let title: string | null = null;
  if (el.groupId && groupAnchor(el.groupId, ctx)?.id === el.id) {
    title = humanize(groupName(el.groupId)) || null;
  }
  if (!title && el.type === "frame") {
    title = frameLabel(el, ctx.elements)?.trim() || null;
  }
  title ??= headingOf(el, ctx);
  ctx.titles.set(el.id, title);
  return title;
}

/** What kind of thing a container is: its role, else by its size and content. */
function kindOf(el: BoardElement, ctx: Context) {
  if (el.role) return humanize(el.role).toLowerCase();
  const frame = hostsOf(el, ctx).find((c) => c.type === "frame");
  if (frame && el.width >= frame.width * 0.8 && el.height >= 80) return "section";
  return onTopOf(el, ctx).length >= 2 ? "card" : "box";
}

/** Whether a frame, section or card is worth a name (a plain background rectangle isn't). */
function worthNaming(el: BoardElement, ctx: Context) {
  if (el.type === "frame") return true;
  if (el.type !== "rect") return false;
  return Boolean(el.role || el.name || onTopOf(el, ctx).length >= 2);
}

function suggest(el: BoardElement, ctx: Context): string | null {
  if (!worthNaming(el, ctx)) return null;
  const own = titleOf(el, ctx);
  if (el.type === "frame") {
    const device = deviceOf(el.width);
    const heading = own ?? headingOf(el, ctx);
    return upperFirst(heading ? `${heading} — ${device}` : device);
  }
  // A group's own name already says what it is.
  if (own && el.groupId && groupAnchor(el.groupId, ctx)?.id === el.id) return upperFirst(own);
  const kind = kindOf(el, ctx);
  // The section it sits in: "Pricing" for the Pro plan card in the pricing section.
  const parent = hostsOf(el, ctx)
    .filter((c) => c.type !== "frame")
    .map((c) => titleOf(c, ctx))
    .find(Boolean);
  const prefix = parent && parent !== own ? `${parent} — ` : "";
  return upperFirst(`${prefix}${own ? `${own} ` : ""}${kind}`).slice(0, NAME_MAX);
}

/**
 * Names for the elements of a board that are worth one and have none, from their structure and
 * content: "Pricing — Pro plan card", "Hero", "Mobile screen". Names are made unique on the
 * board ("Card", "Card 2"). Frames and cards with a `name` already are left alone.
 */
export function suggestNames(elements: BoardElement[]) {
  const ctx = contextFor(elements);
  const taken = new Map<string, number>();
  for (const el of elements) {
    const name = el.name?.trim();
    if (name) taken.set(name, 1);
  }
  const out = new Map<string, string>();
  const unnamed = elements
    .filter((el) => !el.name?.trim() && isContainer(el))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  for (const el of unnamed) {
    const base = suggest(el, ctx);
    if (!base) continue;
    let name = base;
    let n = 1;
    while (taken.has(name)) name = `${base} ${++n}`;
    taken.set(name, 1);
    out.set(el.id, name);
  }
  return out;
}

/** The name one element would get, or null when it isn't a frame, section or card. */
export function suggestName(el: BoardElement, elements: BoardElement[]) {
  if (!isContainer(el)) return null;
  return suggest(el, contextFor(elements));
}

/** Whether `el` is a frame, section or card: something that has (or deserves) a name. */
export function isNameable(el: BoardElement, elements: BoardElement[]) {
  return isContainer(el) && worthNaming(el, contextFor(elements));
}

/** `elements` with the missing names filled in (elements that change get new objects). */
export function withNames(elements: BoardElement[]): BoardElement[] {
  const names = suggestNames(elements);
  if (names.size === 0) return elements;
  return elements.map((el) => {
    const name = names.get(el.id);
    return name ? { ...el, name } : el;
  });
}

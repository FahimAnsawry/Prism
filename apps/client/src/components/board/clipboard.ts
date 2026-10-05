// Copy, paste and duplicate (tools.md §2 "Clipboard", §4). Elements travel as JSON text on the
// system clipboard, so they paste into another board or another tab too.

import { type BoardElement, boardElementSchema } from "@prism/shared";
import { boundsOf, type Point } from "./geometry";

const MARKER = "prism/elements";

const elementsSchema = boardElementSchema.array();

export function serializeElements(elements: BoardElement[]) {
  return JSON.stringify({ type: MARKER, elements });
}

/** The elements in clipboard text, or null if it isn't a Prism copy. */
export function parseElements(text: string) {
  if (!text.includes(MARKER)) return null;
  try {
    const data: unknown = JSON.parse(text);
    if (typeof data !== "object" || data === null || !("type" in data) || data.type !== MARKER) {
      return null;
    }
    const parsed = elementsSchema.safeParse("elements" in data ? data.elements : undefined);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Fresh copies of `elements` with new ids, moved by (dx, dy). Arrow bindings and groups point at
 * the copies; a binding to an element that wasn't copied is dropped.
 */
export function cloneElements(elements: BoardElement[], dx: number, dy: number) {
  const ids = new Map(elements.map((el) => [el.id, crypto.randomUUID()]));
  const groups = new Map<string, string>();
  const remap = (id: string | null | undefined) => (id ? (ids.get(id) ?? null) : null);
  return elements.map((el): BoardElement => {
    const copy: BoardElement = {
      ...el,
      id: ids.get(el.id) ?? crypto.randomUUID(),
      x: el.x + dx,
      y: el.y + dy,
      version: 1,
      updatedBy: "user",
      locked: undefined,
    };
    if (el.groupId) {
      if (!groups.has(el.groupId)) groups.set(el.groupId, crypto.randomUUID());
      copy.groupId = groups.get(el.groupId);
    }
    if (el.type === "arrow") {
      copy.startBinding = remap(el.startBinding);
      copy.endBinding = remap(el.endBinding);
      if (!copy.startBinding) delete copy.startBinding;
      if (!copy.endBinding) delete copy.endBinding;
    }
    if (!copy.locked) delete copy.locked;
    return copy;
  });
}

/** Copies of `elements` centered on `at`. */
export function cloneAt(elements: BoardElement[], at: Point) {
  const box = boundsOf(elements);
  if (!box) return [];
  return cloneElements(elements, at.x - (box.x + box.width / 2), at.y - (box.y + box.height / 2));
}

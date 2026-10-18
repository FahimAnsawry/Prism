import type { BoardElement, ElementChangesReply } from "@prism/shared";

/**
 * Checks that `value` is a list of elements by shape only. The server checked every element when
 * it was saved, and running boardElementsSchema over a big board again took up to half a second
 * of opening it (3,500 elements). Read replies carry no fields the schema would strip.
 */
export function isElementList(value: unknown): value is BoardElement[] {
  return (
    Array.isArray(value) &&
    value.every(
      (el: unknown) =>
        typeof el === "object" &&
        el !== null &&
        typeof (el as { id?: unknown }).id === "string" &&
        typeof (el as { type?: unknown }).type === "string",
    )
  );
}

export const UNEXPECTED_ELEMENTS = "The board's elements came back in an unexpected shape.";

/** Checks a reply to `?since=` by shape only, like isElementList. */
export const elementChangesReply = {
  parse(data: unknown): ElementChangesReply {
    const reply = data as Partial<ElementChangesReply> | null;
    const valid =
      typeof reply?.full === "boolean" &&
      typeof reply.editedAt === "number" &&
      isElementList(reply.elements) &&
      Array.isArray(reply.deleted) &&
      reply.deleted.every(
        (d: unknown) =>
          typeof (d as { id?: unknown } | null)?.id === "string" &&
          typeof (d as { version?: unknown }).version === "number",
      );
    if (!valid) throw new Error(UNEXPECTED_ELEMENTS);
    return reply as ElementChangesReply;
  },
};

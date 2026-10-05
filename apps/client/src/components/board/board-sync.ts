// Loading and saving a board's elements. Saves are debounced: after a pause the editor's elements
// are compared with what the server last accepted, and the difference goes out as one batch of
// create / update / delete ops, each carrying the element's next version (the higher one wins).

import {
  type BoardElement,
  boardElementsSchema,
  type ElementOp,
  saveElementsResultSchema,
} from "@prism/shared";
import { queryOptions } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

const elementsPath = (boardId: string) => `/api/boards/${encodeURIComponent(boardId)}/elements`;

export const boardElementsQuery = (boardId: string) =>
  queryOptions({
    queryKey: ["board-elements", boardId],
    queryFn: () => apiFetch(elementsPath(boardId), boardElementsSchema),
    // The editor owns the elements once loaded; a background refetch must not replace them.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

const SAVE_DELAY = 600;
const RETRY_DELAY = 4_000;

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

/** Fields that never travel as changes. */
const IGNORED = new Set(["id", "version", "type"]);

function sameValue(a: unknown, b: unknown) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The fields of `next` that differ from `prev`; a field that went away becomes null. */
function changesBetween(prev: BoardElement, next: BoardElement) {
  const changes: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    if (IGNORED.has(key)) continue;
    const before = prev[key as keyof BoardElement];
    const after = next[key as keyof BoardElement];
    if (!sameValue(before, after)) changes[key] = after === undefined ? null : after;
  }
  return changes;
}

/** Drops undefined fields so the element passes the schema as JSON. */
const clean = (el: BoardElement) => JSON.parse(JSON.stringify(el)) as BoardElement;

function diff(
  saved: Map<string, BoardElement>,
  current: BoardElement[],
  versions: Map<string, number>,
) {
  const ops: ElementOp[] = [];
  const next = (id: string) => (versions.get(id) ?? 0) + 1;
  for (const el of current) {
    const prev = saved.get(el.id);
    if (!prev) {
      ops.push({
        op: "create",
        element: clean({ ...el, version: next(el.id), updatedBy: "user" }),
      });
    } else if (prev !== el) {
      const changes = changesBetween(prev, el);
      if (Object.keys(changes).length > 0) {
        ops.push({
          op: "update",
          id: el.id,
          version: next(el.id),
          changes: { ...changes, updatedBy: "user" },
        });
      }
    }
  }
  const ids = new Set(current.map((el) => el.id));
  for (const id of saved.keys()) {
    if (!ids.has(id)) ops.push({ op: "delete", id, version: next(id) });
  }
  return ops;
}

/**
 * Keeps the server in step with `elements`. Returns the save status for the top bar, and a flush
 * for leaving the board.
 */
export function useBoardSaver(boardId: string, initial: BoardElement[], elements: BoardElement[]) {
  const saved = useRef(new Map(initial.map((el) => [el.id, el])));
  /** The highest version the server has for each id, deleted ones included. */
  const versions = useRef(new Map(initial.map((el) => [el.id, el.version])));
  const latest = useRef(elements);
  const inFlight = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  /** The elements the server last accepted; anything else on screen is unsaved. */
  const [savedElements, setSavedElements] = useState(initial);
  const [request, setRequest] = useState<"idle" | "saving" | "error">("idle");

  const flushRef = useRef<() => Promise<void>>(async () => {});
  const flush = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      again.current = true;
      return inFlight.current;
    }
    const snapshot = latest.current;
    const ops = diff(saved.current, snapshot, versions.current);
    if (ops.length === 0) {
      setSavedElements(snapshot);
      return;
    }
    setRequest("saving");
    const run = (async () => {
      try {
        const result = await apiFetch(elementsPath(boardId), saveElementsResultSchema, {
          method: "POST",
          body: { ops },
        });
        for (const op of ops) {
          versions.current.set(
            op.op === "create" ? op.element.id : op.id,
            op.op === "create" ? op.element.version : op.version,
          );
        }
        if (result.stale.length > 0) {
          console.warn("[Prism] The server had newer versions of", result.stale);
        }
        saved.current = new Map(snapshot.map((el) => [el.id, el]));
        setSavedElements(snapshot);
        setRequest("idle");
      } catch (error) {
        console.error("[Prism] Couldn't save the board:", error);
        setRequest("error");
        setTimeout(() => void flushRef.current(), RETRY_DELAY);
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    await run;
    if (again.current) {
      again.current = false;
      await flushRef.current();
    }
  }, [boardId]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    latest.current = elements;
    // Nothing to do for the board as it loaded.
    if (elements === initial) return;
    const timer = setTimeout(() => void flush(), SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [elements, initial, flush]);

  // Leaving the board (another route) saves what's pending; closing the tab asks first.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (diff(saved.current, latest.current, versions.current).length > 0) {
        void flush();
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush();
    };
  }, [flush]);

  const status: SaveStatus =
    request === "error"
      ? "error"
      : request === "saving"
        ? "saving"
        : elements === savedElements
          ? "saved"
          : "unsaved";
  return status;
}

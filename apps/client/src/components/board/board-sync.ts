// Loading, saving and live-syncing a board's elements. Saves are debounced: after a pause the
// editor's elements are compared with what the server last accepted, and the difference goes out
// as one batch of create / update / delete ops, each carrying the element's next version (the
// higher one wins). Ops that other tabs and AI editors save arrive over Socket.IO.

import {
  type BoardElement,
  boardElementsSchema,
  type EditRequest,
  type ElementOp,
  type CompareReferenceReply,
  type CompareReferenceRequest,
  type ExportImageReply,
  type ExportImageRequest,
  type LayoutMindmapRequest,
  type LayoutScreenReply,
  type LayoutScreenRequest,
  saveElementsResultSchema,
  SOCKET_ID_HEADER,
} from "@prism/shared";
import { queryOptions } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getSocket } from "@/lib/realtime";
import { applyOps } from "./board-model";
import { compareReference } from "./compare-reference";
import { exportBoardImage } from "./export-image";
import { layoutMindmapOnTab, layoutScreenOnTab } from "./screen-layout";

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

/** Fields that never travel as changes (`updatedBy` is set on every op instead). */
const IGNORED = new Set(["id", "version", "type", "updatedBy"]);

const opId = (op: ElementOp) => (op.op === "create" ? op.element.id : op.id);
const opVersion = (op: ElementOp) => (op.op === "create" ? op.element.version : op.version);

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
 * Keeps the server in step with `elements`. Returns the save status for the top bar, and
 * `receive` / `resync` for ops saved elsewhere: they record those ops as saved and return the
 * ones that are new, for the editor to apply.
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
        const socketId = getSocket().id;
        const result = await apiFetch(elementsPath(boardId), saveElementsResultSchema, {
          method: "POST",
          body: { ops },
          // So the server doesn't echo this tab's own save back to it.
          headers: socketId ? { [SOCKET_ID_HEADER]: socketId } : undefined,
        });
        for (const op of ops) {
          const id = opId(op);
          versions.current.set(id, Math.max(versions.current.get(id) ?? 0, opVersion(op)));
        }
        if (result.stale.length > 0) {
          console.warn("[Prism] The server had newer versions of", result.stale);
        }
        // Only what this save sent: ops that arrived meanwhile stay recorded as saved.
        const sent = new Map(snapshot.map((el) => [el.id, el]));
        for (const op of ops) {
          const el = sent.get(opId(op));
          if (el) saved.current.set(el.id, el);
          else saved.current.delete(opId(op));
        }
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

  /** Records ops saved elsewhere; returns the ones newer than what this tab has. */
  const receive = useCallback((ops: ElementOp[]) => {
    const fresh = ops.filter((op) => opVersion(op) > (versions.current.get(opId(op)) ?? 0));
    if (fresh.length === 0) return fresh;
    for (const op of fresh) versions.current.set(opId(op), opVersion(op));
    const next = applyOps([...saved.current.values()], fresh);
    saved.current = new Map(next.map((el) => [el.id, el]));
    return fresh;
  }, []);

  /**
   * Catches up with the server's elements after (re)joining the board, when ops may have been
   * missed: newer elements come in whole, and elements the server no longer has are deleted.
   */
  const resync = useCallback(
    (server: BoardElement[]) => {
      const ops: ElementOp[] = [];
      const ids = new Set<string>();
      for (const el of server) {
        ids.add(el.id);
        if (el.version > (versions.current.get(el.id) ?? 0)) {
          ops.push({ op: "create", element: el });
        }
      }
      for (const id of saved.current.keys()) {
        if (!ids.has(id)) {
          ops.push({ op: "delete", id, version: (versions.current.get(id) ?? 0) + 1 });
        }
      }
      return receive(ops);
    },
    [receive],
  );

  const status: SaveStatus =
    request === "error"
      ? "error"
      : request === "saving"
        ? "saving"
        : elements === savedElements
          ? "saved"
          : "unsaved";
  return { status, receive, resync };
}

export interface RealtimeHandlers {
  /** Ops another tab or an AI editor saved on this board. */
  onOps: (ops: ElementOp[]) => void;
  /** Joined (or rejoined after a disconnect): time to catch up on missed changes. */
  onJoined: () => void;
  /** An "Ask AI" request on this board was created or changed status. */
  onEdit: (request: EditRequest) => void;
}

/** Joins the board's Socket.IO room for as long as the board is open. */
export function useBoardRealtime(boardId: string, handlers: RealtimeHandlers) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const socket = getSocket();
    const join = () => {
      socket.emit("board:join", boardId, (ok) => {
        if (ok) latest.current.onJoined();
      });
    };
    const onOps = (payload: { boardId: string; ops: ElementOp[] }) => {
      if (payload.boardId === boardId) latest.current.onOps(payload.ops);
    };
    const onEdit = (request: EditRequest) => {
      if (request.boardId === boardId) latest.current.onEdit(request);
    };
    // An AI editor's export_image: this tab draws the board and replies with the picture.
    const onExportImage = (request: ExportImageRequest, ack: (reply: ExportImageReply) => void) => {
      if (request.boardId === boardId) void exportBoardImage(request).then(ack);
    };
    socket.on("connect", join);
    socket.on("element:ops", onOps);
    socket.on("edit:update", onEdit);
    socket.on("export:image", onExportImage);
    // An AI editor's compare_reference: this tab measures a screen against a reference image.
    const onCompareReference = (
      request: CompareReferenceRequest,
      ack: (reply: CompareReferenceReply) => void,
    ) => {
      if (request.boardId === boardId) void compareReference(request).then(ack);
    };
    socket.on("compare:reference", onCompareReference);
    // An AI editor's create_screen: this tab measures the text and lays the screen out.
    const onLayoutScreen = (
      request: LayoutScreenRequest,
      ack: (reply: LayoutScreenReply) => void,
    ) => {
      if (request.boardId === boardId) void layoutScreenOnTab(request).then(ack);
    };
    socket.on("layout:screen", onLayoutScreen);
    const onLayoutMindmap = (
      request: LayoutMindmapRequest,
      ack: (reply: LayoutScreenReply) => void,
    ) => {
      if (request.boardId === boardId) void layoutMindmapOnTab(request).then(ack);
    };
    socket.on("layout:mindmap", onLayoutMindmap);
    if (socket.connected) join();
    return () => {
      socket.off("connect", join);
      socket.off("element:ops", onOps);
      socket.off("edit:update", onEdit);
      socket.off("export:image", onExportImage);
      socket.off("compare:reference", onCompareReference);
      socket.off("layout:screen", onLayoutScreen);
      socket.off("layout:mindmap", onLayoutMindmap);
      socket.emit("board:leave", boardId);
    };
  }, [boardId]);
}

/** Tells the server what this tab has selected, so AI editors can read it (get_selection). */
export function reportSelection(boardId: string, elementIds: string[]) {
  const socket = getSocket();
  if (socket.connected) socket.emit("selection:set", { boardId, elementIds });
}

/** The board's elements as the server has them now (for a resync). */
export function fetchBoardElements(boardId: string) {
  return apiFetch(elementsPath(boardId), boardElementsSchema).then((data) => data.elements);
}

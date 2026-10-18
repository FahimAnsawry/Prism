// Loading, saving and live-syncing a board's elements. Saves are debounced: after a pause the
// editor's elements are compared with what the server last accepted, and the difference goes out
// as one batch of create / update / delete ops, each carrying the element's next version (the
// higher one wins). Ops that other tabs and AI editors save arrive over Socket.IO.

import {
  type BoardElement,
  EDITED_AT_HEADER,
  type EditRequest,
  type ElementChangesReply,
  type ElementOp,
  type CompareReferenceReply,
  type CompareReferenceRequest,
  type ExportImageReply,
  type ExportImageRequest,
  type HtmlScreenReply,
  type HtmlScreenRequest,
  type ImageColorsReply,
  type ImageColorsRequest,
  type LayoutErRequest,
  type LayoutMindmapRequest,
  type LayoutScreenReply,
  type LayoutScreenRequest,
  type Peer,
  saveElementsResultSchema,
  SOCKET_ID_HEADER,
} from "@prism/shared";
import { queryOptions } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { elementChangesReply, isElementList, UNEXPECTED_ELEMENTS } from "@/lib/element-replies";
import { getSocket } from "@/lib/realtime";
import { applyOps } from "./board-model";

// What an AI editor asks an open tab to do (draw, measure, lay out) loads on its first request:
// a hover that fetches a board ahead (fetchBoardElementsAhead) and a board's first paint don't
// need it.
const compareReference = (request: CompareReferenceRequest) =>
  import("./compare-reference").then((m) => m.compareReference(request));
const exportBoardImage = (request: ExportImageRequest) =>
  import("./export-image").then((m) => m.exportBoardImage(request));
const htmlScreenOnTab = (request: HtmlScreenRequest) =>
  import("./html-screen").then((m) => m.htmlScreenOnTab(request));
const imageColorsOnTab = (request: ImageColorsRequest) =>
  import("./image-colors").then((m) => m.imageColorsOnTab(request));
const layoutScreenOnTab = (request: LayoutScreenRequest) =>
  import("./screen-layout").then((m) => m.layoutScreenOnTab(request));
const layoutMindmapOnTab = (request: LayoutMindmapRequest) =>
  import("./screen-layout").then((m) => m.layoutMindmapOnTab(request));
const layoutErOnTab = (request: LayoutErRequest) =>
  import("./screen-layout").then((m) => m.layoutErOnTab(request));

const elementsPath = (boardId: string) => `/api/boards/${encodeURIComponent(boardId)}/elements`;

/**
 * A board's live elements and the board's `editedAt` (ms) they were read at, to ask for what
 * changed since (null when unknown).
 */
export type BoardElementsData = { elements: BoardElement[]; editedAt: number | null };

/** Checks an elements reply's shape only (see isElementList). */
const elementsReply = {
  parse(data: unknown): { elements: BoardElement[] } {
    if (!isElementList((data as { elements?: unknown } | null)?.elements)) {
      throw new Error(UNEXPECTED_ELEMENTS);
    }
    return data as { elements: BoardElement[] };
  },
};

/** A board's live elements now, with the `editedAt` they were read at. */
function fetchElementsData(boardId: string): Promise<BoardElementsData> {
  let editedAt: number | null = null;
  return apiFetch(elementsPath(boardId), elementsReply, {
    onHeaders: (headers) => {
      const stamp = Number(headers.get(EDITED_AT_HEADER));
      editedAt = headers.has(EDITED_AT_HEADER) && Number.isFinite(stamp) ? stamp : null;
    },
  }).then(({ elements }) => ({ elements, editedAt }));
}

/** How long elements fetched ahead (on a hover) may open the board. */
const AHEAD_FRESH_MS = 15_000;
/** Elements fetched ahead of opening a board, each used once by the board's query. */
const ahead = new Map<string, { at: number; reply: Promise<BoardElementsData> }>();
/** Boards with a save on its way: elements read now could miss it. */
const saving = new Set<string>();

/**
 * Fetches a board's elements ahead of opening it (the pointer is on its link). Opening within
 * AHEAD_FRESH_MS uses them, and joining the board's room then catches up on anything newer
 * (resync), as after any reconnect.
 */
export function fetchBoardElementsAhead(boardId: string) {
  const current = ahead.get(boardId);
  if (saving.has(boardId) || (current && Date.now() - current.at < AHEAD_FRESH_MS)) return;
  const reply = fetchElementsData(boardId);
  reply.catch(() => ahead.delete(boardId));
  ahead.set(boardId, { at: Date.now(), reply });
}

/** A board just made (at `editedAt`, ms): it opens with no elements, without asking the server. */
export function seedNewBoardElements(boardId: string, editedAt: number | null) {
  ahead.set(boardId, { at: Date.now(), reply: Promise.resolve({ elements: [], editedAt }) });
}

/** The elements fetched ahead, if still fresh (once: the editor owns them from then on). */
function takeAhead(boardId: string) {
  const entry = ahead.get(boardId);
  ahead.delete(boardId);
  return entry && Date.now() - entry.at < AHEAD_FRESH_MS ? entry.reply : null;
}

export const boardElementsQuery = (boardId: string) =>
  queryOptions({
    queryKey: ["board-elements", boardId],
    queryFn: async () =>
      (await takeAhead(boardId)?.catch(() => null)) ?? fetchElementsData(boardId),
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

/** Where a board tab catches up from after (re)joining: see useBoardSaver's `catchUp`. */
export interface CatchUpSource {
  /** What changed since the board's `editedAt` was `since`. */
  changes: (since: number) => Promise<ElementChangesReply>;
  /** Every live element, for when the changes can't be had. */
  all: () => Promise<BoardElementsData>;
}

/**
 * Keeps the server in step with `elements`. Returns the save status for the top bar, and
 * `receive` / `catchUp` for ops saved elsewhere: they record those ops as saved and return the
 * ones that are new, for the editor to apply. A read-only board (a viewer, a public link) never
 * saves; it only uses `receive` and `catchUp`. `editedAt` is the board's when `initial` was read.
 */
export function useBoardSaver(
  boardId: string,
  initial: BoardElement[],
  elements: BoardElement[],
  { readOnly = false, editedAt = null }: { readOnly?: boolean; editedAt?: number | null } = {},
) {
  const saved = useRef(new Map(initial.map((el) => [el.id, el])));
  /** The highest version the server has for each id, deleted ones included. */
  const versions = useRef(new Map(initial.map((el) => [el.id, el.version])));
  /** The board's `editedAt` this tab has every change up to (null: unknown). */
  const syncedAt = useRef(editedAt);
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
    // Set before the request goes out (a board being left saves as it unmounts).
    saving.add(boardId);
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
        saving.delete(boardId);
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
    // Nothing to do for a board this tab can't change. The board as it loaded is checked too: an
    // undo back to it (the same array) still has the changes since to take back. A flush with
    // nothing to send sends nothing.
    if (readOnly) return;
    const timer = setTimeout(() => void flush(), SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [elements, flush, readOnly]);

  // Leaving the board (another route) saves what's pending; closing the tab asks first.
  useEffect(() => {
    if (readOnly) return;
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
  }, [flush, readOnly]);

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
   * Catches up with all of the server's elements: newer elements come in whole, and elements the
   * server no longer has are deleted.
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

  /** Catches up with what changed on the server: newer elements come in whole, deletions by id. */
  const applyChanges = useCallback(
    (reply: ElementChangesReply) => {
      if (reply.full) return resync(reply.elements);
      const ops: ElementOp[] = [];
      for (const el of reply.elements) {
        if (el.version > (versions.current.get(el.id) ?? 0))
          ops.push({ op: "create", element: el });
      }
      for (const { id, version } of reply.deleted) {
        if (version > (versions.current.get(id) ?? 0)) ops.push({ op: "delete", id, version });
      }
      return receive(ops);
    },
    [receive, resync],
  );

  /**
   * Catches up after (re)joining the board, when ops may have been missed, and returns the new
   * ones. `joinedAt` is the board's `editedAt` the join answered with: the same as this tab's
   * means nothing changed. Otherwise only what changed since is fetched, or everything when that
   * can't be had.
   */
  const catchUp = useCallback(
    async (source: CatchUpSource, joinedAt?: number | null): Promise<ElementOp[]> => {
      const since = syncedAt.current;
      if (since !== null && joinedAt != null && joinedAt === since) return [];
      if (since !== null) {
        try {
          const reply = await source.changes(since);
          syncedAt.current = reply.editedAt;
          return applyChanges(reply);
        } catch (error) {
          console.warn("[Prism] Couldn't fetch the board's changes; fetching all of it:", error);
        }
      }
      const all = await source.all();
      syncedAt.current = all.editedAt;
      return resync(all.elements);
    },
    [applyChanges, resync],
  );

  const status: SaveStatus =
    request === "error"
      ? "error"
      : request === "saving"
        ? "saving"
        : elements === savedElements
          ? "saved"
          : "unsaved";
  return { status, receive, catchUp };
}

export interface RealtimeHandlers {
  /**
   * Ops another tab or an AI editor saved on this board. `staged` is the AI editor building a
   * big batch: show it being built (remote-reveal.ts).
   */
  onOps: (ops: ElementOp[], staged?: Peer) => void;
  /**
   * Joined (or rejoined after a disconnect): time to catch up on missed changes. `editedAt` is
   * the board's once joined (see useBoardSaver's `catchUp`).
   */
  onJoined: (editedAt: number | null) => void;
  /** An "Ask AI" request on this board was created or changed status. */
  onEdit?: (request: EditRequest) => void;
  /** An "Ask AI" request was deleted. */
  onEditDeleted?: (id: string) => void;
  /** This tab lost the board: removed from it, or the public link was turned off or replaced. */
  onRevoked?: () => void;
  /** The user's role on the board changed. */
  onAccessChanged?: () => void;
}

/**
 * Joins the board's Socket.IO room for as long as the board is open: as the signed-in user, or
 * through a public link (`shareToken`), which only receives updates.
 */
export function useBoardRealtime(
  boardId: string,
  handlers: RealtimeHandlers,
  { shareToken }: { shareToken?: string } = {},
) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const socket = getSocket();
    const join = () => {
      const joined = (ok: boolean, editedAt?: number | null) => {
        if (ok) latest.current.onJoined(typeof editedAt === "number" ? editedAt : null);
        else latest.current.onRevoked?.();
      };
      if (shareToken) socket.emit("share:join", shareToken, boardId, joined);
      else socket.emit("board:join", boardId, joined);
    };
    const onRevoked = (payload: { boardId: string }) => {
      if (payload.boardId === boardId) latest.current.onRevoked?.();
    };
    const onAccess = (payload: { boardId: string }) => {
      if (payload.boardId === boardId) latest.current.onAccessChanged?.();
    };
    socket.on("board:revoked", onRevoked);
    socket.on("board:access", onAccess);
    const onOps = (payload: { boardId: string; ops: ElementOp[]; staged?: Peer }) => {
      if (payload.boardId === boardId) latest.current.onOps(payload.ops, payload.staged);
    };
    const onEdit = (request: EditRequest) => {
      if (request.boardId === boardId) latest.current.onEdit?.(request);
    };
    const onEditDeleted = (payload: { boardId: string; id: string }) => {
      if (payload.boardId === boardId) latest.current.onEditDeleted?.(payload.id);
    };
    // An AI editor's export_image: this tab draws the board and replies with the picture.
    const onExportImage = (request: ExportImageRequest, ack: (reply: ExportImageReply) => void) => {
      if (request.boardId === boardId) void exportBoardImage(request).then(ack);
    };
    socket.on("connect", join);
    socket.on("element:ops", onOps);
    socket.on("edit:update", onEdit);
    socket.on("edit:delete", onEditDeleted);
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
    // An AI editor's create_screen with html: this tab renders the page and reads it back.
    const onHtmlScreen = (request: HtmlScreenRequest, ack: (reply: HtmlScreenReply) => void) => {
      if (request.boardId === boardId) void htmlScreenOnTab(request).then(ack);
    };
    socket.on("html:screen", onHtmlScreen);
    // An AI editor's search_images: any open board tab measures photo colors.
    const onImageColors = (request: ImageColorsRequest, ack: (reply: ImageColorsReply) => void) => {
      void imageColorsOnTab(request).then(ack);
    };
    socket.on("image:colors", onImageColors);
    const onLayoutMindmap = (
      request: LayoutMindmapRequest,
      ack: (reply: LayoutScreenReply) => void,
    ) => {
      if (request.boardId === boardId) void layoutMindmapOnTab(request).then(ack);
    };
    socket.on("layout:mindmap", onLayoutMindmap);
    // An AI editor's create_er_diagram: this tab sizes the tables with the board's fonts.
    const onLayoutEr = (request: LayoutErRequest, ack: (reply: LayoutScreenReply) => void) => {
      if (request.boardId === boardId) void layoutErOnTab(request).then(ack);
    };
    socket.on("layout:er", onLayoutEr);
    if (socket.connected) join();
    return () => {
      socket.off("connect", join);
      socket.off("board:revoked", onRevoked);
      socket.off("board:access", onAccess);
      socket.off("element:ops", onOps);
      socket.off("edit:update", onEdit);
      socket.off("edit:delete", onEditDeleted);
      socket.off("export:image", onExportImage);
      socket.off("compare:reference", onCompareReference);
      socket.off("layout:screen", onLayoutScreen);
      socket.off("html:screen", onHtmlScreen);
      socket.off("image:colors", onImageColors);
      socket.off("layout:mindmap", onLayoutMindmap);
      socket.off("layout:er", onLayoutEr);
      socket.emit("board:leave", boardId);
    };
  }, [boardId, shareToken]);
}

/** Tells the server what this tab has selected, so AI editors can read it (get_selection). */
export function reportSelection(boardId: string, elementIds: string[]) {
  const socket = getSocket();
  if (socket.connected) socket.emit("selection:set", { boardId, elementIds });
}

/** The most often a pointer position goes out, in ms. */
const CURSOR_INTERVAL = 40;
let cursorSentAt = 0;
let cursorTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Tells the other tabs on the board where this tab's pointer is (board px), so they can draw
 * its cursor. At most every CURSOR_INTERVAL ms; the newest position always goes out last.
 */
export function reportCursor(boardId: string, point: { x: number; y: number }) {
  const socket = getSocket();
  if (!socket.connected) return;
  const send = () => {
    cursorTimer = undefined;
    cursorSentAt = Date.now();
    socket.volatile.emit("cursor:move", { boardId, x: point.x, y: point.y });
  };
  const wait = CURSOR_INTERVAL - (Date.now() - cursorSentAt);
  if (wait <= 0) {
    clearTimeout(cursorTimer);
    send();
  } else {
    // The pending send reads the latest point.
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(send, wait);
  }
}

/** A signed-in board tab's catch-up source (useBoardSaver's `catchUp`). */
export const boardCatchUpSource = (boardId: string): CatchUpSource => ({
  changes: (since) => apiFetch(`${elementsPath(boardId)}?since=${since}`, elementChangesReply),
  all: () => fetchElementsData(boardId),
});

import type { Server as HttpServer } from "node:http";
import {
  type ClientToServerEvents,
  type EditRequest,
  type ElementOp,
  compareReferenceReplySchema,
  type CompareReferenceRequest,
  exportImageReplySchema,
  type ExportImageRequest,
  htmlScreenReplySchema,
  type HtmlScreenRequest,
  imageColorsReplySchema,
  type ImageColorsRequest,
  type LayoutMindmapRequest,
  type LayoutScreenRequest,
  layoutScreenReplySchema,
  type ServerToClientEvents,
  showBoardReplySchema,
} from "@prism/shared";
import { fromNodeHeaders } from "better-auth/node";
import { Server } from "socket.io";
import { z } from "zod";
import { auth } from "./auth.js";
import { prisma } from "./db/client.js";
import { HttpError } from "./errors.js";
import { accessibleBoardWhere, boardForShareToken } from "./routes/board-access.js";

// Real-time sync (tools.md §2): browsers join one room per board and receive the element ops
// that other tabs and AI editors save. Saves still go through the REST route, which broadcasts
// what it applied; the socket only carries updates out, plus each tab's selection in.
// Public link viewers connect without an account: they join through the link's token and only
// ever receive updates.

interface SocketData {
  /** Null for a public link's viewer (no session). */
  userId: string | null;
  /** Boards this tab joined through a public link, and the link's token. */
  shareRooms: Map<string, string>;
}

type PrismServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

let io: PrismServer | null = null;

const room = (boardId: string) => `board:${boardId}`;

/** What each connected tab has selected, so AI editors can read it (get_selection). */
interface TabSelection {
  userId: string;
  boardId: string;
  elementIds: string[];
  at: number;
}
const selections = new Map<string, TabSelection>();

/** When each connected tab was last focused, so board:show goes to the one the user is using. */
const activeAt = new Map<string, number>();

/** open_board calls waiting for a tab to finish opening their board. */
const joinWaiters = new Set<{ userId: string; boardId: string; resolve: () => void }>();

const selectionPayload = z.object({
  boardId: z.uuid(),
  elementIds: z.array(z.uuid()).max(5_000),
});

export function attachRealtime(server: HttpServer, clientUrl: string) {
  io = new Server(server, {
    cors: { origin: clientUrl, credentials: true },
    // Big element batches (freehand strokes) can exceed the 1 MB default.
    maxHttpBufferSize: 8e6,
  });

  // Signed-in browsers connect with their session; public link viewers without one, and can
  // then only join boards through a link (share:join). AI editors use the REST API instead.
  io.use((socket, next) => {
    auth.api
      .getSession({ headers: fromNodeHeaders(socket.handshake.headers) })
      .then((session) => {
        socket.data.userId = session?.user.id ?? null;
        socket.data.shareRooms = new Map();
        next();
      })
      .catch((error: unknown) => {
        console.error("[Prism] Socket sign-in check failed:", error);
        next(new Error("Couldn't check your session."));
      });
  });

  io.on("connection", (socket) => {
    const { userId } = socket.data;

    socket.on("tab:active", () => {
      activeAt.set(socket.id, Date.now());
    });

    socket.on("board:join", (boardId, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      if (!userId || !z.uuid().safeParse(boardId).success) {
        reply(false);
        return;
      }
      prisma.board
        .findFirst({
          where: { id: boardId, ...accessibleBoardWhere(userId) },
          select: { id: true },
        })
        .then(async (board) => {
          if (!board) {
            reply(false);
            return;
          }
          await socket.join(room(boardId));
          // In as the user now, not through a link.
          socket.data.shareRooms.delete(boardId);
          reply(true);
          for (const waiter of joinWaiters) {
            if (waiter.userId === userId && waiter.boardId === boardId) waiter.resolve();
          }
        })
        .catch((error: unknown) => {
          console.error("[Prism] Couldn't join a board room:", error);
          reply(false);
        });
    });

    // A public link's viewer: read-only, so this tab only receives the board's updates.
    socket.on("share:join", (token, boardId, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      boardForShareToken(token, boardId)
        .then(async (board) => {
          if (!board) {
            reply(false);
            return;
          }
          // A member's own join takes precedence over a link.
          if (!socket.rooms.has(room(board.id))) socket.data.shareRooms.set(board.id, token);
          await socket.join(room(board.id));
          reply(true);
        })
        .catch((error: unknown) => {
          console.error("[Prism] Couldn't join a shared board:", error);
          reply(false);
        });
    });

    socket.on("board:leave", (boardId) => {
      if (typeof boardId !== "string") return;
      void socket.leave(room(boardId));
      socket.data.shareRooms.delete(boardId);
      if (selections.get(socket.id)?.boardId === boardId) selections.delete(socket.id);
    });

    socket.on("selection:set", (payload) => {
      const parsed = selectionPayload.safeParse(payload);
      if (!userId || !parsed.success || !socket.rooms.has(room(parsed.data.boardId))) return;
      selections.set(socket.id, { userId, ...parsed.data, at: Date.now() });
    });

    socket.on("disconnect", () => {
      selections.delete(socket.id);
      activeAt.delete(socket.id);
    });
  });
}

/**
 * Takes boards away from tabs that lost access: a member's tabs (`userId`) or a public link's
 * viewers (`shareToken`). They leave the rooms and are told, so the page can say so.
 */
export function revokeBoardTabs(
  boardIds: string[],
  who: { userId: string } | { shareToken: string },
) {
  if (!io || boardIds.length === 0) return;
  for (const socket of io.sockets.sockets.values()) {
    for (const boardId of boardIds) {
      if (!socket.rooms.has(room(boardId))) continue;
      const viaLink = socket.data.shareRooms.get(boardId);
      const matches =
        "userId" in who
          ? socket.data.userId === who.userId && viaLink === undefined
          : viaLink === who.shareToken;
      if (!matches) continue;
      void socket.leave(room(boardId));
      socket.data.shareRooms.delete(boardId);
      socket.emit("board:revoked", { boardId });
    }
  }
}

/** Tells the user's tabs on these boards that their access changed, so they reload it. */
export function notifyAccessChanged(boardIds: string[], userId: string) {
  if (!io || boardIds.length === 0) return;
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.userId !== userId) continue;
    for (const boardId of boardIds) {
      if (socket.rooms.has(room(boardId))) socket.emit("board:access", { boardId });
    }
  }
}

/** Sends applied ops to every tab on the board except the one that saved them. */
export function broadcastOps(boardId: string, ops: ElementOp[], exceptSocket?: string) {
  if (!io || ops.length === 0) return;
  const target = io.to(room(boardId));
  (exceptSocket ? target.except(exceptSocket) : target).emit("element:ops", { boardId, ops });
}

export function broadcastEdit(request: EditRequest) {
  io?.to(room(request.boardId)).emit("edit:update", request);
}

/**
 * The user's most recently reported selection: on `boardId` if given, else on whichever board
 * they touched last. Null when no tab of theirs has reported one.
 */
export function latestSelection(userId: string, boardId?: string) {
  let latest: TabSelection | null = null;
  for (const selection of selections.values()) {
    if (selection.userId !== userId) continue;
    if (boardId && selection.boardId !== boardId) continue;
    if (!latest || selection.at > latest.at) latest = selection;
  }
  return latest;
}

/** How long a tab gets to draw and send a board image. */
const EXPORT_TIMEOUT_MS = 30_000;

/** The user's tabs open on the board, the one they touched most recently first. */
function boardTabs(userId: string, boardId: string) {
  if (!io) return [];
  const lastActive = (id: string) => selections.get(id)?.at ?? 0;
  return [...io.sockets.sockets.values()]
    .filter((socket) => socket.data.userId === userId && socket.rooms.has(room(boardId)))
    .sort((a, b) => lastActive(b.id) - lastActive(a.id));
}

type TabReply = { ok: true } | { ok: false; error: string };

/**
 * Asks one of the user's open tabs on the board to draw something (`event`) and reply. The tab
 * the user touched most recently is asked first; if it doesn't answer, the next one is.
 */
async function drawOnTab<R extends TabReply>(
  userId: string,
  boardId: string,
  ask: (tab: BoardTab) => Promise<unknown>,
  schema: { parse: (raw: unknown) => R },
): Promise<Extract<R, { ok: true }>> {
  const browser = await showBoardInBrowser(userId, boardId);
  const tabs = boardTabs(userId, boardId);
  if (browser === "asked") {
    throw new HttpError(
      409,
      "The board isn't open in the user's browser, and images are drawn there. Their Prism tab is asking them to open it: tell them, then try again once they have.",
    );
  }
  if (tabs.length === 0) {
    throw new HttpError(
      409,
      "The board isn't open in the user's browser, and images are drawn there. Give the user the board's URL (from open_board), ask them to open it (or to keep Prism open, so boards open by themselves), then try again.",
    );
  }
  for (const tab of tabs) {
    try {
      const reply = schema.parse(await ask(tab));
      if (!reply.ok) throw new HttpError(400, reply.error);
      return reply as Extract<R, { ok: true }>;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.warn("[Prism] A board tab didn't send its image:", error);
    }
  }
  throw new HttpError(
    504,
    "The open board tab didn't send the image in time. Ask the user to keep the board open, then try again.",
  );
}

/** Has one of the user's open tabs on the board draw the requested image (export_image). */
export function requestBoardImage(userId: string, request: ExportImageRequest) {
  return drawOnTab(
    userId,
    request.boardId,
    (tab) => tab.timeout(EXPORT_TIMEOUT_MS).emitWithAck("export:image", request),
    exportImageReplySchema,
  );
}

/** Has one of the user's open tabs measure a screen against a reference image (compare_reference). */
export function requestReferenceComparison(userId: string, request: CompareReferenceRequest) {
  return drawOnTab(
    userId,
    request.boardId,
    (tab) => tab.timeout(EXPORT_TIMEOUT_MS).emitWithAck("compare:reference", request),
    compareReferenceReplySchema,
  );
}

/** How long a tab gets to render an HTML screen: Tailwind, fonts and images load first. */
const HTML_TIMEOUT_MS = 45_000;

/** Has one of the user's open tabs render an HTML screen and read it back (create_screen html). */
export function requestHtmlScreen(userId: string, request: HtmlScreenRequest) {
  return drawOnTab(
    userId,
    request.boardId,
    (tab) => tab.timeout(HTML_TIMEOUT_MS).emitWithAck("html:screen", request),
    htmlScreenReplySchema,
  );
}

/** How long a tab gets to measure photo colors. */
const COLORS_TIMEOUT_MS = 15_000;

/**
 * Has one of the user's open tabs (on any board) measure how colorful each photo is
 * (search_images). Null when no tab is open or none answers.
 */
export async function requestImageColors(userId: string, request: ImageColorsRequest) {
  if (!io) return null;
  const lastActive = (id: string) => selections.get(id)?.at ?? 0;
  const tabs = [...io.sockets.sockets.values()]
    .filter((socket) => socket.data.userId === userId && socket.rooms.size > 1)
    .sort((a, b) => lastActive(b.id) - lastActive(a.id));
  for (const tab of tabs) {
    try {
      const reply = imageColorsReplySchema.parse(
        await tab.timeout(COLORS_TIMEOUT_MS).emitWithAck("image:colors", request),
      );
      if (reply.ok) return new Map(reply.results.map((r) => [r.id, r.saturation]));
      console.warn("[Prism] A board tab couldn't measure photo colors:", reply.error);
    } catch (error) {
      console.warn("[Prism] A board tab didn't measure photo colors:", error);
    }
  }
  return null;
}

/** How long a tab gets to lay out a screen before the server estimates instead. */
const LAYOUT_TIMEOUT_MS = 8_000;

/**
 * Lays a create_screen tree out in one of the user's open tabs on the board, which measures text
 * with the board's real fonts. Null when no tab is open or none answers in time.
 */
export function requestScreenLayout(userId: string, request: LayoutScreenRequest) {
  return askForLayout(userId, request.boardId, (tab) =>
    tab.timeout(LAYOUT_TIMEOUT_MS).emitWithAck("layout:screen", request),
  );
}

/** Sizes create_mindmap nodes in an open board tab; null when none answers. */
export function requestMindmapLayout(userId: string, request: LayoutMindmapRequest) {
  return askForLayout(userId, request.boardId, (tab) =>
    tab.timeout(LAYOUT_TIMEOUT_MS).emitWithAck("layout:mindmap", request),
  );
}

type BoardTab = ReturnType<typeof boardTabs>[number];

async function askForLayout(
  userId: string,
  boardId: string,
  ask: (tab: BoardTab) => Promise<unknown>,
) {
  await showBoardInBrowser(userId, boardId);
  for (const tab of boardTabs(userId, boardId)) {
    try {
      const reply = layoutScreenReplySchema.parse(await ask(tab));
      if (reply.ok) return reply.elements;
      console.warn("[Prism] A board tab couldn't lay out a screen:", reply.error);
    } catch (error) {
      console.warn("[Prism] A board tab didn't send a screen layout:", error);
    }
  }
  return null;
}

/** How long a tab gets to answer board:show. */
const SHOW_TIMEOUT_MS = 5_000;
/** How long a tab that switched gets to load the board and join its room. */
const OPEN_TIMEOUT_MS = 15_000;

/**
 * Where the board is in the user's browser after showBoardInBrowser: already open in a tab,
 * just opened in one, waiting for the user to accept (they were busy), or nowhere because no
 * Prism tab could show it.
 */
export type BrowserBoardState = "open" | "opened" | "asked" | "no-tab";

const onSomeBoard = (socket: { rooms: Set<string> }) =>
  [...socket.rooms].some((name) => name.startsWith("board:"));

/** Resolves when one of the user's tabs joins the board's room, or after `ms`. */
function waitForJoin(userId: string, boardId: string, ms: number) {
  const waiter = { userId, boardId, resolve: () => {} };
  let timer: NodeJS.Timeout | undefined;
  const joined = new Promise<void>((resolve) => {
    waiter.resolve = resolve;
    timer = setTimeout(resolve, ms);
  });
  joinWaiters.add(waiter);
  return {
    joined,
    cancel: () => {
      clearTimeout(timer);
      joinWaiters.delete(waiter);
    },
  };
}

/**
 * Brings the board up in the user's browser: the Prism tab they focused most recently switches
 * to it, and this waits until it has joined the board. open_board may take a tab off another
 * board (`fromOtherBoards`); tools that only need a tab to draw in take one that's on no board
 * (the dashboard), so they never pull the user away from a board they went back to.
 */
export async function showBoardInBrowser(
  userId: string,
  boardId: string,
  { fromOtherBoards = false } = {},
): Promise<BrowserBoardState> {
  if (!io) return "no-tab";
  if (boardTabs(userId, boardId).length > 0) return "open";
  const tabs = [...io.sockets.sockets.values()]
    .filter((socket) => socket.data.userId === userId)
    .filter((socket) => fromOtherBoards || !onSomeBoard(socket))
    .sort((a, b) => (activeAt.get(b.id) ?? 0) - (activeAt.get(a.id) ?? 0));
  if (tabs.length === 0) return "no-tab";
  const board = await prisma.board.findFirst({
    where: { id: boardId, ...accessibleBoardWhere(userId) },
    select: { name: true },
  });
  if (!board) return "no-tab";

  for (const tab of tabs) {
    // Listen before asking: the tab may join before its reply arrives.
    const wait = waitForJoin(userId, boardId, OPEN_TIMEOUT_MS);
    try {
      const reply = showBoardReplySchema.parse(
        await tab.timeout(SHOW_TIMEOUT_MS).emitWithAck("board:show", { boardId, name: board.name }),
      );
      if (reply === "asked") return "asked";
      await wait.joined;
      return boardTabs(userId, boardId).length > 0 ? "opened" : "no-tab";
    } catch (error) {
      console.warn("[Prism] A tab didn't switch to the board:", error);
    } finally {
      wait.cancel();
    }
  }
  return "no-tab";
}

import type { Server as HttpServer } from "node:http";
import {
  type ClientToServerEvents,
  type EditRequest,
  type ElementOp,
  exportImageReplySchema,
  type ExportImageRequest,
  type LayoutMindmapRequest,
  type LayoutScreenRequest,
  layoutScreenReplySchema,
  type ServerToClientEvents,
} from "@prism/shared";
import { fromNodeHeaders } from "better-auth/node";
import { Server } from "socket.io";
import { z } from "zod";
import { auth } from "./auth.js";
import { prisma } from "./db/client.js";
import { HttpError } from "./errors.js";
import { liveBoardWhere } from "./routes/board-access.js";

// Real-time sync (tools.md §2): browsers join one room per board and receive the element ops
// that other tabs and AI editors save. Saves still go through the REST route, which broadcasts
// what it applied; the socket only carries updates out, plus each tab's selection in.

interface SocketData {
  userId: string;
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

  // Only signed-in browsers connect; AI editors use the REST API with a token.
  io.use((socket, next) => {
    auth.api
      .getSession({ headers: fromNodeHeaders(socket.handshake.headers) })
      .then((session) => {
        if (!session) {
          next(new Error("Sign in to continue."));
          return;
        }
        socket.data.userId = session.user.id;
        next();
      })
      .catch((error: unknown) => {
        console.error("[Prism] Socket sign-in check failed:", error);
        next(new Error("Couldn't check your session."));
      });
  });

  io.on("connection", (socket) => {
    const { userId } = socket.data;

    socket.on("board:join", (boardId, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      if (!z.uuid().safeParse(boardId).success) {
        reply(false);
        return;
      }
      prisma.board
        .findFirst({ where: { id: boardId, ...liveBoardWhere(userId) }, select: { id: true } })
        .then(async (board) => {
          if (!board) {
            reply(false);
            return;
          }
          await socket.join(room(boardId));
          reply(true);
        })
        .catch((error: unknown) => {
          console.error("[Prism] Couldn't join a board room:", error);
          reply(false);
        });
    });

    socket.on("board:leave", (boardId) => {
      if (typeof boardId !== "string") return;
      void socket.leave(room(boardId));
      if (selections.get(socket.id)?.boardId === boardId) selections.delete(socket.id);
    });

    socket.on("selection:set", (payload) => {
      const parsed = selectionPayload.safeParse(payload);
      if (!parsed.success || !socket.rooms.has(room(parsed.data.boardId))) return;
      selections.set(socket.id, { userId, ...parsed.data, at: Date.now() });
    });

    socket.on("disconnect", () => {
      selections.delete(socket.id);
    });
  });
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

/**
 * Has one of the user's open tabs on the board draw the requested image (export_image). The tab
 * the user touched most recently is asked first; if it doesn't answer, the next one is.
 */
export async function requestBoardImage(userId: string, request: ExportImageRequest) {
  const tabs = boardTabs(userId, request.boardId);
  if (tabs.length === 0) {
    throw new HttpError(
      409,
      "The board isn't open in the user's browser, and images are drawn there. Give the user the board's URL (from open_board), ask them to open it, then try again.",
    );
  }
  for (const tab of tabs) {
    try {
      const reply = exportImageReplySchema.parse(
        await tab.timeout(EXPORT_TIMEOUT_MS).emitWithAck("export:image", request),
      );
      if (!reply.ok) throw new HttpError(400, reply.error);
      return reply;
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

import type { Server as HttpServer } from "node:http";
import type {
  ClientToServerEvents,
  EditRequest,
  ElementOp,
  ServerToClientEvents,
} from "@prism/shared";
import { fromNodeHeaders } from "better-auth/node";
import { Server } from "socket.io";
import { z } from "zod";
import { auth } from "./auth.js";
import { prisma } from "./db/client.js";
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

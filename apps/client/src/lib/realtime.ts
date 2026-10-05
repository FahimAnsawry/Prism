// The one Socket.IO connection to the server (tools.md §2, Sync). Board tabs join their board's
// room to receive element ops saved by other tabs and by AI editors.

import type { ClientToServerEvents, ServerToClientEvents } from "@prism/shared";
import { io, type Socket } from "socket.io-client";

export type PrismSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: PrismSocket | null = null;

/** The shared connection, opened on first use. It signs in with the session cookie. */
export function getSocket(): PrismSocket {
  socket ??= io(import.meta.env.VITE_SERVER_URL, { withCredentials: true });
  return socket;
}

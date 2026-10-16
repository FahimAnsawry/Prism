// Lets this tab move a peer's cursor itself, without a socket event: the staged reveal of an AI
// editor's big batch (remote-reveal.ts) drives the editor's cursor from the elements it shows.

import type { Peer } from "@prism/shared";

type Listener = (peer: Peer, x: number, y: number) => void;

const listeners = new Set<Listener>();

/** Calls `listener` whenever the reveal moves a cursor; returns the way to stop. */
export function onLocalCursor(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Puts `peer`'s cursor at (x, y) on the board, gliding there. */
export function showCursor(peer: Peer, x: number, y: number) {
  for (const listener of listeners) listener(peer, x, y);
}

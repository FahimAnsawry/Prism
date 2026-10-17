import { useSyncExternalStore } from "react";

/**
 * The landing page's prism flight (components/landing/prism-flight.tsx): the logo's i dot flies
 * into the hero, builds the hero's prism facet by facet, then flies back and lands on the i
 * again. The logo's own mark is there from the start. The hero's note starts typing at takeoff
 * and its rays draw once the prism is built.
 *
 * - `plan` is decided by the hero after the startup loader lifts: "off" right away below xl or
 *   with reduced motion (every piece plays its own entrance), else "flight" the first time the
 *   hero's prism and the logo are both on screen with scrolling stopped. Until then it is
 *   "pending" and the hero holds its first frame.
 * - `heroPlaced` counts the hero's facets placed so far (0-4, in the order of CORNER_FACETS then
 *   CENTER_FACET); `dotAway` is true while the i's dot is out flying.
 * - `landMs` is how long the dot takes to reach the hero's prism, so the hero's connector can
 *   arrive with it.
 * - `done` turns true when the dot is back on the i; `skipped` when a key, press or scroll
 *   finished it early (everything is placed and shows complete).
 *
 * The hero resets it when it unmounts and when the whole hero leaves the window, so a later
 * visit to the landing page, or the hero scrolling back into view, flies again.
 */
export interface PrismFlightState {
  plan: "pending" | "flight" | "off";
  heroPlaced: number;
  dotAway: boolean;
  landMs: number;
  done: boolean;
  skipped: boolean;
}

const INITIAL: PrismFlightState = {
  plan: "pending",
  heroPlaced: 0,
  dotAway: false,
  landMs: 0,
  done: false,
  skipped: false,
};

let state = INITIAL;
const listeners = new Set<() => void>();

export function updateFlight(changes: Partial<PrismFlightState>) {
  state = { ...state, ...changes };
  for (const listener of listeners) listener();
}

export function resetFlight() {
  updateFlight(INITIAL);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePrismFlight() {
  return useSyncExternalStore(subscribe, () => state);
}

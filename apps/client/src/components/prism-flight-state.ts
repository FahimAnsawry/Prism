import { useSyncExternalStore } from "react";

/**
 * The landing page's prism flight (components/landing/prism-flight.tsx): the logo's i dot flies
 * into the hero, builds the hero's prism facet by facet, then flies back and lands on the i
 * again. The logo's own mark is there from the start. The hero's note starts typing at takeoff
 * and its rays draw once the prism is built.
 *
 * - `plan` is decided by the hero when the startup loader lifts: "flight" when the hero's prism
 *   is on screen (xl and up, hero in view, motion allowed), else "off" and every piece plays
 *   its own entrance. Until then it is "pending".
 * - `heroPlaced` counts the hero's facets placed so far (0-4, in the order of CORNER_FACETS then
 *   CENTER_FACET); `dotAway` is true while the i's dot is out flying.
 * - `landMs` is how long the dot takes to reach the hero's prism, so the hero's connector can
 *   arrive with it.
 * - `done` turns true when the dot is back on the i; `skipped` when someone's key or
 *   press finished it early (everything is placed and shows complete).
 *
 * The hero resets it when it unmounts, so a later visit to the landing page flies again.
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

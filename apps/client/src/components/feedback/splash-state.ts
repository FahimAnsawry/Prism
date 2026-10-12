import { useSyncExternalStore } from "react";

/**
 * Whether the startup splash (app-splash.tsx) has finished, so entrance animations can wait for
 * it instead of playing underneath. It flips once per page load: client navigation never shows
 * the splash again, so pages mounted later see it done straight away.
 */
let done = false;
const listeners = new Set<() => void>();

export function finishSplash() {
  if (done) return;
  done = true;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSplashDone() {
  return useSyncExternalStore(subscribe, () => done);
}

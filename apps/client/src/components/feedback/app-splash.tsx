import { useEffect, useLayoutEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PrismLoader } from "./prism-loader";

const SPLASH_MS = 1500;
const FADE_MS = 300;

/**
 * Startup splash: covers the app with the loader for 1.5s on the first load, then fades out.
 * The router renders underneath meanwhile, so the page is ready when the splash lifts. The
 * wrapper is opaque from the first frame, so only the mark itself fades in. Client
 * navigation never remounts it, so it plays once per page load. `skip` drops it entirely.
 *
 * It spans the full window (100vw, scrollbar included) and locks page scroll while shown, so a
 * long page's scrollbar can neither shift the logo off-center nor scroll the app underneath.
 */
export function AppSplash({ skip = false }: { skip?: boolean }) {
  const [phase, setPhase] = useState<"show" | "fade" | "done">(skip ? "done" : "show");

  useEffect(() => {
    if (skip) return;
    const fade = setTimeout(() => setPhase("fade"), SPLASH_MS);
    const done = setTimeout(() => setPhase("done"), SPLASH_MS + FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [skip]);

  // Before paint, so the scrollbar never shows. Released as the fade starts: the page reflows
  // under a still-opaque overlay, and the overlay's 100vw width doesn't move.
  useLayoutEffect(() => {
    if (phase !== "show") return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 z-50 h-dvh w-screen bg-background transition-opacity duration-300 ease-standard",
        phase === "fade" && "pointer-events-none opacity-0",
      )}
    >
      <PrismLoader fullScreen />
    </div>
  );
}

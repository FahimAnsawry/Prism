import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ctaVariants } from "@/components/cta";
import { PrismLogo } from "@/components/prism-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";

/** Past this many pixels, scrolling down tucks the nav away; any upward scroll brings it back. */
const HIDE_AFTER = 240;
/** Ignore jitter smaller than this (trackpads report tiny deltas). */
const MIN_DELTA = 6;

function useNavScroll() {
  const [state, setState] = useState({ hidden: false, scrolled: false });

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < MIN_DELTA) return;
      lastY = y;
      const next = { hidden: delta > 0 && y > HIDE_AFTER, scrolled: y > 8 };
      setState((prev) =>
        prev.hidden === next.hidden && prev.scrolled === next.scrolled ? prev : next,
      );
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}

export function SiteHeader() {
  const { hidden, scrolled } = useNavScroll();

  // Sticky nav: slides in on load, tucks away while scrolling down, returns on scroll up.
  // focus-within keeps it visible for keyboard users tabbing into it.
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-dashed border-border bg-background animate-in fade-in slide-in-from-top-4",
        "transition-[translate,box-shadow] duration-300 ease-decelerate focus-within:translate-y-0",
        hidden && "-translate-y-full",
        scrolled &&
          "shadow-[0_10px_24px_-14px_rgb(42_42_42/0.35)] dark:shadow-[0_10px_24px_-14px_rgb(0_0_0/0.8)]",
      )}
    >
      <nav aria-label="Main">
        <div className={cn(pageContainer, "flex h-[59px] items-center justify-between gap-6")}>
          <PrismLogo compact />

          <div className="flex items-center gap-3">
            <ThemeToggle className="size-[38px] border border-input hover:bg-card" />
            <Link to="/login" className={ctaVariants({ variant: "secondary", size: "sm" })}>
              Log in
            </Link>
            <Link
              to="/signup"
              className={cn(ctaVariants({ variant: "primary", size: "sm" }), "max-sm:hidden")}
            >
              Start a board
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}

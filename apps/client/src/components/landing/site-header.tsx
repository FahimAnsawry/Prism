import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ctaVariants } from "@/components/cta";
import { PrismLogo } from "@/components/prism-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { EASE_CSS, EASE_DECELERATE } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
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

/** The soft shadow under the bar once the page has scrolled, per theme. */
const SHADOW = {
  none: "0px 10px 24px -14px rgba(0, 0, 0, 0)",
  light: "0px 10px 24px -14px rgba(42, 42, 42, 0.35)",
  dark: "0px 10px 24px -14px rgba(0, 0, 0, 0.8)",
};

/** Below this (Tailwind's sm) the links fold into the burger menu. */
const INLINE_NAV_QUERY = "(min-width: 40rem)";

/**
 * The burger menu's open state. It closes on Escape (focus returns to the burger), on a press
 * outside the header, and when the window grows to where the links show inline.
 */
function useMenu() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(INLINE_NAV_QUERY);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onQueryChange = () => {
      if (query.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    query.addEventListener("change", onQueryChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      query.removeEventListener("change", onQueryChange);
    };
  }, [open]);

  return { open, setOpen, headerRef, buttonRef };
}

const loginLink =
  "text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-ink hover:underline";

export function SiteHeader() {
  const { hidden, scrolled } = useNavScroll();
  const { open, setOpen, headerRef, buttonRef } = useMenu();
  const close = () => setOpen(false);
  const { theme } = useTheme();
  const [entered, setEntered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);

  // Sticky nav: slides in on load, tucks away while scrolling down, returns on scroll up (but
  // stays while the menu is open). Focus inside keeps it visible for keyboard users tabbing in.
  const tucked = hidden && !open && !focusWithin;
  return (
    <motion.header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-border bg-background"
      initial={{ opacity: 0, y: -16, boxShadow: SHADOW.none }}
      animate={{
        opacity: 1,
        y: tucked ? "-100%" : 0,
        boxShadow: scrolled ? SHADOW[theme] : SHADOW.none,
      }}
      transition={
        entered ? { duration: 0.3, ease: EASE_DECELERATE } : { duration: 0.15, ease: EASE_CSS }
      }
      onAnimationComplete={() => setEntered(true)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
    >
      <nav aria-label="Main">
        <div className={cn(pageContainer, "flex items-center justify-between gap-6 py-2.5")}>
          {/* The hero's prism flight starts from this logo's i and builds its mark. */}
          <PrismLogo compact flight />

          <div className="flex items-center gap-3 sm:gap-5">
            <ThemeToggle
              className="size-[38px] border border-input"
              hoverBackground="var(--muted)"
            />
            <Link to="/login" className={cn(loginLink, "max-sm:hidden")}>
              Log in
            </Link>
            <Link
              to="/signup"
              className={ctaVariants({
                variant: "primary",
                size: "lg",
                // The bar is 15% shorter than the default button, so its button is too (! beats
                // the size variant's height). Below sm it lives in the burger menu instead.
                className: "ml-3.5 h-[38px]! px-[19px]! max-sm:hidden",
              })}
            >
              Start a board
              <ArrowRight aria-hidden="true" />
            </Link>
            {/* Below sm the links fold into this menu; the theme toggle stays out in the bar. */}
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="site-menu"
              className="inline-flex size-[38px] shrink-0 cursor-pointer items-center justify-center border border-input text-foreground transition-colors duration-150 ease-standard hover:bg-muted sm:hidden"
            >
              {open ? (
                <X aria-hidden="true" className="size-5" />
              ) : (
                <Menu aria-hidden="true" className="size-5" />
              )}
            </button>
          </div>
        </div>

        {open && (
          <motion.div
            id="site-menu"
            className="absolute inset-x-0 top-full border-b border-border bg-background shadow-[0_10px_24px_-14px_rgb(42_42_42/0.35)] sm:hidden dark:shadow-[0_10px_24px_-14px_rgb(0_0_0/0.8)]"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE_CSS }}
          >
            <div className={cn(pageContainer, "flex flex-col items-stretch gap-5 py-5")}>
              <Link to="/login" onClick={close} className={cn(loginLink, "py-1 text-base")}>
                Log in
              </Link>
              <Link
                to="/signup"
                onClick={close}
                className={ctaVariants({ variant: "primary", size: "block" })}
              >
                Start a board
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        )}
      </nav>
    </motion.header>
  );
}

export type Bezier = [number, number, number, number];

/** Tailwind's default transition curve (the old `ease-standard` / `--ease-standard`). */
export const EASE_STANDARD: Bezier = [0.4, 0, 0.2, 1];
/** Things arriving: the old `--ease-decelerate`. */
export const EASE_DECELERATE: Bezier = [0, 0, 0.2, 1];
/** The sun/moon toggle's long, soft landing. */
export const EASE_TOGGLE: Bezier = [0.16, 1, 0.3, 1];
/** The overshoot used by pops (the hero's ray ends, the logo's facets). */
export const EASE_POP: Bezier = [0.34, 1.56, 0.64, 1];
export const EASE_SPRING_OUT: Bezier = [0.22, 1, 0.36, 1];

/** Tailwind's `duration-150`, the length of a hover or focus color change. */
export const HOVER_SECONDS = 0.15;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * For code outside React and imperative `animate()` calls, which `<MotionConfig
 * reducedMotion="user">` (main.tsx) doesn't reach: those skip their movement themselves.
 */
export function prefersReducedMotion() {
  return window.matchMedia(REDUCED_QUERY).matches;
}

/** CSS's default `ease` (what `animate-in` and an unstyled transition use). */
export const EASE_CSS: Bezier = [0.25, 0.1, 0.25, 1];

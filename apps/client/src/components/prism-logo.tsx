import { useState, type AnimationEvent } from "react";
import { Link } from "@tanstack/react-router";
import { usePrismFlight } from "@/components/prism-flight-state";
import {
  CENTER_FACET,
  CORNER_FACETS,
  DOT,
  DOT_OUTLINE_WIDTH,
  OUTLINE_CLASS,
  WING_HAIRLINE,
  WINGS,
} from "@/components/prism-shapes";
import { cn } from "@/lib/utils";

/**
 * The prism mark: one triangle cut into four facets. The corner facets take the svg's fill,
 * which defaults to ink so the mark holds up on the light canvas; the center facet is always
 * brand green. The loader and the status screen animate the facets in their order: top, left,
 * right, center.
 */
export function PrismMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="1.24 2.47 33.53 33.53"
      aria-hidden="true"
      className={cn("size-9 fill-ink", className)}
    >
      {CORNER_FACETS.map((d) => (
        <path key={d} d={d} />
      ))}
      <path className="fill-brand" d={CENTER_FACET} />
    </svg>
  );
}

/** When each facet pops in during the logo animation: as the flying dot lands on it. */
const FACET_POP_DELAYS = [
  "[animation-delay:0.7s]",
  "[animation-delay:1.25s]",
  "[animation-delay:1.8s]",
  "[animation-delay:2.42s]",
];

const FACET_POP = "animate-logo-facet-pop origin-center [transform-box:fill-box]";

/**
 * The mark beside the "prism" wordmark (monoline lowercase whose i is dotted with a green
 * prism), drawn as one svg so the dot can fly into the mark: it grows wings, leaves the i,
 * builds the mark one facet at a time and flies home. That plays on hover or tap only; on
 * mount the logo is simply there, whole. The mark is 60 units of the 77-unit height, so h-9
 * gives the board's 28px mark and `compact` (the dashboard navbar) 25px.
 *
 * With `flight` (the landing page's header), the landing page's prism flight takes the i's dot
 * out to build the hero's prism and brings it back (prism-flight-state.ts); its dot carries
 * `data-flight-target` so the flight can find it.
 */
export function PrismLogo({
  className,
  compact = false,
  flight = false,
}: {
  className?: string;
  compact?: boolean;
  flight?: boolean;
}) {
  const flightState = usePrismFlight();
  const [reducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [replaying, setReplaying] = useState(false);
  // byFlight: the flight has this logo's dot (or is still deciding); flying: it is under way.
  const byFlight = flight && flightState.plan !== "off";
  const flying = byFlight && !flightState.done;
  // Only a hover or tap plays it; reduced-motion users keep the still logo.
  const playing = !reducedMotion && replaying;

  // Pointer enter fires for a mouse hover and for a tap alike. A run always finishes, so
  // leaving mid-flight doesn't snap the dot home.
  function replay() {
    if (playing || flying || reducedMotion) return;
    setReplaying(true);
  }

  // Wing and facet animations end inside the dot or bubble up to it too; only its flight counts.
  function finish(event: AnimationEvent<SVGGElement>) {
    if (event.target !== event.currentTarget) return;
    setReplaying(false);
  }

  const facetClass = (index: number) => cn(playing && FACET_POP, FACET_POP_DELAYS[index]);

  return (
    <Link
      to="/"
      aria-label="Prism home"
      onPointerEnter={replay}
      className={cn("inline-flex items-center text-foreground", className)}
    >
      <svg
        viewBox="0 3 274 77"
        aria-hidden="true"
        className={cn("w-auto overflow-visible", compact ? "h-8" : "h-9")}
      >
        <g transform="translate(0 12) scale(1.7895) translate(-1.24 -2.47)" className="fill-ink">
          {CORNER_FACETS.map((d, i) => (
            <path key={d} d={d} className={facetClass(i)} />
          ))}
          <path d={CENTER_FACET} className={cn("fill-brand", facetClass(3))} />
        </g>
        <g
          transform="translate(80 0)"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 26V74" />
          <circle cx="20" cy="42" r="16" />
          <path d="M52 58V40Q52 26 66 26" />
          <path d="M82 26V58" />
          <path d="M121 31C118 27 114 26 110 26C103 26 99 29 99 34C99 39 104 41 110 42C116 43 122 45 122 50C122 55 117 58 110 58C105 58 100 56 97 53" />
          <path d="M136 26V58M136 40Q136 26 149 26Q162 26 162 40V58M162 40Q162 26 175 26Q188 26 188 40V58" />
        </g>
        {/* The i's dot, which is also the traveler: it turns around its own center (162, 14).
            While the prism flight has it out flying, the one on the i hides. */}
        <g
          onAnimationEnd={finish}
          className={cn(
            playing && "animate-logo-dot-travel origin-[162px_14px] [transform-box:view-box]",
            flying && flightState.dotAway && "opacity-0",
          )}
        >
          {WINGS.map((wing) => (
            <path
              key={wing.d}
              d={wing.d}
              className={cn(
                "fill-brand/85 [transform-box:view-box]",
                WING_HAIRLINE,
                wing.className,
                playing ? "animate-logo-wings" : "opacity-0",
              )}
            />
          ))}
          <path
            d={DOT}
            strokeWidth={DOT_OUTLINE_WIDTH}
            strokeLinejoin="round"
            className={cn(OUTLINE_CLASS, playing && "animate-logo-dot-land")}
          />
          <path
            d={DOT}
            strokeWidth="3"
            strokeLinejoin="round"
            className={cn("fill-brand stroke-brand", playing && "animate-logo-dot-land")}
            data-flight-target={flight ? "logo-dot" : undefined}
          />
        </g>
      </svg>
    </Link>
  );
}

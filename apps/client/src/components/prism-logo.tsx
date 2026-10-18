import { Link } from "@tanstack/react-router";
import {
  animate,
  motion,
  motionValue,
  type MotionValue,
  type ValueAnimationTransition,
} from "motion/react";
import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { usePrismFlight } from "@/components/prism-flight-state";
import { DOT_TRAVEL } from "@/components/prism-logo-keyframes";
import {
  CENTER_FACET,
  CORNER_FACETS,
  DOT,
  DOT_OUTLINE_WIDTH,
  OUTLINE_CLASS,
  WING_HAIRLINE,
  WING_SCALE,
  WINGS,
} from "@/components/prism-shapes";
import { EASE_SPRING_OUT, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Draws one facet of the mark: `index` runs top, left, right, then the green center. */
export type FacetRenderer = (facet: { d: string; index: number; className?: string }) => ReactNode;

const plainFacet: FacetRenderer = ({ d, className }) => <path d={d} className={className} />;

/**
 * The prism mark: one triangle cut into four facets. The corner facets take the svg's fill,
 * which defaults to ink so the mark holds up on the light canvas; the center facet is always
 * brand green. The loader and the status screen animate the facets in their order: top, left,
 * right, center, by drawing them with `renderFacet`. With `fadeIn` the whole mark fades in; a
 * number is how far that fade already is (0-1), to carry on one that started elsewhere.
 */
/** How long the mark takes to fade in (s); index.html's boot loader fades in the same way. */
const MARK_FADE_S = 0.6;

export function PrismMark({
  className,
  renderFacet = plainFacet,
  fadeIn = false,
}: {
  className?: string;
  renderFacet?: FacetRenderer;
  fadeIn?: boolean | number;
}) {
  const fadedIn = fadeIn === true ? 0 : fadeIn === false ? 1 : Math.min(1, Math.max(0, fadeIn));
  return (
    <motion.svg
      viewBox="1.24 2.47 33.53 33.53"
      aria-hidden="true"
      className={cn("size-9 fill-ink", className)}
      initial={fadedIn < 1 ? { opacity: fadedIn } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: MARK_FADE_S * (1 - fadedIn), ease: "easeInOut" }}
    >
      {CORNER_FACETS.map((d, index) => (
        <Fragment key={d}>{renderFacet({ d, index })}</Fragment>
      ))}
      {renderFacet({ d: CENTER_FACET, index: 3, className: "fill-brand" })}
    </motion.svg>
  );
}

/** How long the dot's flight takes, from the first hop out to landing back on the i. */
const FLIGHT_SECONDS = 3.9;
const linear = { duration: FLIGHT_SECONDS, ease: "linear" } as const;

/** When each facet pops in during the logo animation: as the flying dot lands on it. */
const FACET_POP_DELAYS = [0.7, 1.25, 1.8, 2.42];
const FACET_POP = { times: [0, 0.6, 1], duration: 0.5, ease: EASE_SPRING_OUT };

/**
 * The wings show only on the flight out to the mark (2-18%) and the flight home (65-86%);
 * while the dot builds the mark, hopping from facet to facet, they stay folded away.
 */
const WINGS_SHOW = {
  times: [0, 0.02, 0.035, 0.165, 0.18, 0.65, 0.665, 0.845, 0.86, 1],
  opacity: [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
};

/** On each facet landing the dot fades into the facet popping in, and back out at takeoff. */
const DOT_LAND = {
  times: [
    0, 0.175, 0.19, 0.21, 0.225, 0.315, 0.33, 0.35, 0.365, 0.455, 0.47, 0.49, 0.505, 0.615, 0.63,
    0.65, 0.665, 1,
  ],
  opacity: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1],
};

/** The values the dot's flight drives: every piece of the logo that moves while it plays. */
function createFlightValues() {
  return {
    facets: FACET_POP_DELAYS.map(() => ({ opacity: motionValue(1), scale: motionValue(1) })),
    wings: WINGS.map(() => ({ opacity: motionValue(0), rotate: motionValue(0) })),
    dot: {
      x: motionValue(0),
      y: motionValue(0),
      scale: motionValue(1),
      rotate: motionValue(0),
    },
    dotOpacity: motionValue(1),
  };
}

/**
 * Plays the flight while `playing`: the i's dot grows wings, leaves the i, builds the mark one
 * facet at a time and flies home. `onDone` fires when the dot is back; the values then return to
 * the still logo.
 */
function useLogoFlight(
  values: ReturnType<typeof createFlightValues>,
  playing: boolean,
  onDone: () => void,
) {
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const controls: { stop: () => void }[] = [];
    const run = (
      value: MotionValue<number>,
      keyframes: number[],
      transition: ValueAnimationTransition<number>,
    ) => {
      const control = animate(value, keyframes, transition);
      controls.push(control);
      return control;
    };
    const { facets, wings, dot, dotOpacity } = values;

    // Each facet waits hidden until the dot lands on it, then pops in.
    facets.forEach((facet, i) => {
      facet.opacity.set(0);
      facet.scale.set(0);
      const pop = { ...FACET_POP, delay: FACET_POP_DELAYS[i] };
      run(facet.opacity, [0, 1, 1], pop);
      run(facet.scale, [0, 1.12, 1], pop);
    });

    wings.forEach((wing, i) => {
      const { up, down } = WINGS[i] as (typeof WINGS)[number];
      run(wing.opacity, WINGS_SHOW.opacity, { ...linear, times: WINGS_SHOW.times });
      run(wing.rotate, [up, down], {
        duration: 0.32,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "reverse",
      });
    });

    run(dotOpacity, DOT_LAND.opacity, { ...linear, times: DOT_LAND.times });
    const travel = { ...linear, times: DOT_TRAVEL.times };
    run(dot.x, [...DOT_TRAVEL.x], travel);
    run(dot.y, [...DOT_TRAVEL.y], travel);
    run(dot.scale, [...DOT_TRAVEL.scale], travel);
    run(dot.rotate, [...DOT_TRAVEL.rotate], travel).then(() => {
      if (!cancelled) onDone();
    });

    return () => {
      cancelled = true;
      for (const control of controls) control.stop();
      for (const facet of facets) {
        facet.opacity.set(1);
        facet.scale.set(1);
      }
      for (const wing of wings) {
        wing.opacity.set(0);
        wing.rotate.set(0);
      }
      dot.x.set(0);
      dot.y.set(0);
      dot.scale.set(1);
      dot.rotate.set(0);
      dotOpacity.set(1);
    };
  }, [values, playing, onDone]);
}

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
  const [reducedMotion] = useState(prefersReducedMotion);
  const [replaying, setReplaying] = useState(false);
  const [values] = useState(createFlightValues);
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

  const finish = useCallback(() => setReplaying(false), []);
  useLogoFlight(values, playing, finish);

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
          {[...CORNER_FACETS, CENTER_FACET].map((d, i) => (
            <motion.path
              key={d}
              d={d}
              className={cn(i === 3 && "fill-brand")}
              style={{
                opacity: values.facets[i]?.opacity,
                scale: values.facets[i]?.scale,
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
          ))}
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
        <motion.g
          className={cn(flying && flightState.dotAway && "opacity-0")}
          style={{
            ...values.dot,
            transformBox: "view-box",
            originX: "162px",
            originY: "14px",
          }}
        >
          {WINGS.map((wing, i) => (
            <motion.path
              key={wing.d}
              d={wing.d}
              className={cn("fill-brand/85", WING_HAIRLINE)}
              style={{
                opacity: values.wings[i]?.opacity,
                rotate: values.wings[i]?.rotate,
                scale: WING_SCALE,
                transformBox: "view-box",
                originX: wing.originX,
                originY: wing.originY,
              }}
            />
          ))}
          <motion.path
            d={DOT}
            strokeWidth={DOT_OUTLINE_WIDTH}
            strokeLinejoin="round"
            className={OUTLINE_CLASS}
            style={{ opacity: values.dotOpacity }}
          />
          <motion.path
            d={DOT}
            strokeWidth="3"
            strokeLinejoin="round"
            className="fill-brand stroke-brand"
            style={{ opacity: values.dotOpacity }}
            data-flight-target={flight ? "logo-dot" : undefined}
          />
        </motion.g>
      </svg>
    </Link>
  );
}

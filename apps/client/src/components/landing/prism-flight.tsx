import { useEffect, useRef, type Ref } from "react";
import { createPortal } from "react-dom";
import { updateFlight } from "@/components/prism-flight-state";
import {
  DOT,
  DOT_OUTLINE_WIDTH,
  OUTLINE_CLASS,
  WING_HAIRLINE,
  WINGS,
} from "@/components/prism-shapes";

/** Where the traveler is: its center in viewport px, its scale (1 = the i's dot) and rotation. */
interface Pose {
  x: number;
  y: number;
  s: number;
  r: number;
}

/** The dot's drawn width in logo units: 14 wide plus its 3-unit stroke. */
const DOT_DRAWN_WIDTH = 17;
/** Its center sits 8 of its 12 units down (a triangle's centroid). */
const DOT_CENTER_Y = 8 / 12;
/** A rounded facet's center, as a share of its box height: an upward facet's sits lower. */
const FACET_CENTER_Y = { up: 0.616, down: 0.384 };
/** The traveler's svg: a 50-unit square of logo units around the dot's center (162, 14). */
const VIEW = 50;
const VIEW_BOX = `${162 - VIEW / 2} ${14 - VIEW / 2} ${VIEW} ${VIEW}`;

/** Arcs over the page keep their top at least this far below the window's top edge. */
const EDGE = 12;
/** The long flights run along this line, above the header's links and the hero's text. */
const TOP_LANE = EDGE;

const HOP_MS = 336;
const SINK_MS = 128;
const WINGS_FOLD_MS = 160;
/** A long flight leaves this many ghost copies of the dot behind it, each this much later. */
const TRAIL_OPACITY = [0.3, 0.15, 0.07];
const TRAIL_DELAY_MS = 40;
/** The wings beat this many times on a long flight (see `--beat`). */
const WING_BEATS = 2;

const ease = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2; // easeInOutSine
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function target(name: string) {
  const element = document.querySelector(`[data-flight-target="${name}"]`);
  if (!element) throw new Error(`prism flight: no ${name}`);
  return element.getBoundingClientRect();
}

function transform({ x, y, s, r }: Pose) {
  return `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`;
}

type Point = [number, number];

/** A path through points, sampled finely, with the length up to each sample. */
interface Route {
  samples: Point[];
  lengths: number[];
  total: number;
}

const ROUTE_STEPS = 24;

/** A smooth (Catmull-Rom) curve through `points`, sampled so it can be flown at an even speed. */
function makeRoute(points: Point[]): Route {
  const samples: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i] as Point;
    const p0 = points[i - 1] ?? p1;
    const p2 = points[i + 1] as Point;
    const p3 = points[i + 2] ?? p2;
    for (let step = 0; step < ROUTE_STEPS; step++) {
      const t = step / ROUTE_STEPS;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (p2[k] - p0[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3);
      samples.push([at(0), at(1)]);
    }
  }
  samples.push(points[points.length - 1] as Point);
  const lengths = [0];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] as Point;
    const b = samples[i] as Point;
    lengths.push((lengths[i - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { samples, lengths, total: lengths[lengths.length - 1] as number };
}

/** The point `distance` px along the route. */
function pointAlong(route: Route, distance: number): Point {
  const { samples, lengths } = route;
  let i = 1;
  while (i < lengths.length - 1 && (lengths[i] as number) < distance) i++;
  const before = lengths[i - 1] as number;
  const span = (lengths[i] as number) - before || 1;
  const k = clamp((distance - before) / span, 0, 1);
  const a = samples[i - 1] as Point;
  const b = samples[i] as Point;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/**
 * The strip between the hero's text column and its board: long flights run through it and along
 * the top of the window, so nothing ever crosses the headline, the copy or the buttons.
 */
function gutterX(): number {
  const column = document.getElementById("hero-title")?.parentElement?.getBoundingClientRect();
  const board = document.querySelector("[data-flight-board]")?.getBoundingClientRect();
  if (!column || !board) return window.innerWidth / 2;
  return column.right + Math.max(24, board.left - column.right) / 2;
}

/**
 * The route between the logo and the hero's prism: up to the top lane, along it, down the gutter
 * and into the prism (or the reverse).
 */
function longRoute(from: Pose, to: Pose): Route {
  const gutter = gutterX();
  const outbound = from.x < to.x; // logo to hero
  const lane = Math.min(from.y, to.y, TOP_LANE + 8);
  const down = Math.max(from.y, to.y);
  const edge: Point = outbound ? [from.x, from.y] : [to.x, to.y];
  const mid = (a: number, b: number) => (a + b) / 2;
  const toGutter: Point = [mid(edge[0], gutter), lane];
  const downGutter: Point = [gutter, mid(lane, down)];
  return makeRoute(
    outbound
      ? [[from.x, from.y], toGutter, downGutter, [to.x, to.y]]
      : [[from.x, from.y], downGutter, toGutter, [to.x, to.y]],
  );
}

/**
 * A quadratic arc's two cubic control points: its top sits `lift` px above the higher end, but
 * never closer than EDGE px to the top of the window (a quadratic peaks at a quarter of
 * ends + 2 × control).
 */
function arcControls(from: Pose, to: Pose, lift: number): [Point, Point] {
  const qx = (from.x + to.x) / 2;
  const qy = Math.max(Math.min(from.y, to.y) - lift, (4 * EDGE - from.y - to.y) / 2);
  return [
    [from.x + (2 / 3) * (qx - from.x), from.y + (2 / 3) * (qy - from.y)],
    [to.x + (2 / 3) * (qx - to.x), to.y + (2 / 3) * (qy - to.y)],
  ];
}

interface MoveOptions {
  duration: number;
  wings: boolean;
  signal: AbortSignal;
  /** A hop's arc: its top sits this far above the higher end. */
  lift?: number;
  /** A long flight's path; without it the dot arcs over by `lift`. */
  route?: Route;
  ghosts?: HTMLElement[];
}

/**
 * Flies the traveler from one pose to the next along an arc or a route, leaning a few degrees
 * into the turn. The path is sampled into frames played linearly, so it only eases at takeoff and
 * landing.
 */
async function move(
  traveler: HTMLElement,
  from: Pose,
  to: Pose,
  { duration, lift = 0, route, wings, ghosts = [], signal }: MoveOptions,
) {
  const bank = Math.sign(to.x - from.x) * (wings ? 10 : 6);
  const [c1, c2] = arcControls(from, to, lift);
  const steps = Math.max(12, Math.round(duration / 24));
  const frames: Keyframe[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = ease(i / steps);
    let x: number;
    let y: number;
    if (route) {
      [x, y] = pointAlong(route, u * route.total);
    } else {
      const a = (1 - u) ** 3;
      const b = 3 * (1 - u) ** 2 * u;
      const c = 3 * (1 - u) * u ** 2;
      const d = u ** 3;
      x = a * from.x + b * c1[0] + c * c2[0] + d * to.x;
      y = a * from.y + b * c1[1] + c * c2[1] + d * to.y;
    }
    frames.push({
      transform: transform({
        x,
        y,
        s: from.s + (to.s - from.s) * u,
        r: from.r + (to.r - from.r) * u + bank * Math.sin(Math.PI * u),
      }),
    });
  }

  // Wings spread for the long flights and fold just before landing.
  traveler.style.setProperty("--beat", `${duration / WING_BEATS}ms`);
  traveler.dataset.wings = wings ? "on" : "off";
  const fold = wings
    ? window.setTimeout(() => (traveler.dataset.wings = "off"), duration - WINGS_FOLD_MS)
    : 0;
  const animation = traveler.animate(frames, { duration, easing: "linear", fill: "forwards" });
  // The ghosts fly the same path a little later, each fainter than the one before.
  const trail = ghosts.map((ghost, i) => {
    ghost.style.opacity = String(TRAIL_OPACITY[i] ?? 0);
    return ghost.animate(frames, {
      duration,
      delay: TRAIL_DELAY_MS * (i + 1),
      easing: "linear",
      fill: "both",
    });
  });
  const hideGhosts = () => {
    for (const ghost of ghosts) ghost.style.opacity = "0";
  };
  signal.addEventListener(
    "abort",
    () => {
      window.clearTimeout(fold);
      animation.cancel();
      for (const ghost of trail) ghost.cancel();
      hideGhosts();
    },
    { once: true },
  );
  await animation.finished;
  // Keep the end pose as a plain style, so finished animations don't pile up.
  animation.commitStyles();
  animation.cancel();
  // The last ghost lands 120ms after the dot; then they all go.
  await Promise.all(trail.map((ghost) => ghost.finished));
  for (const ghost of trail) ghost.cancel();
  hideGhosts();
  return to;
}

/**
 * A long flight between the logo and the hero, unhurried so the eye can follow it: its length
 * sets its time (1.7s to 2s on a desktop window, just under 1s at least), so the whole intro
 * ends about 5s after the page shows.
 */
function long(route: Route, signal: AbortSignal, ghosts: HTMLElement[]): MoveOptions {
  return {
    duration: clamp(800 + route.total * 0.8, 960, 2000),
    wings: true,
    route,
    ghosts,
    signal,
  };
}

/** A hop from facet to facet, wings folded, arcing about a facet's height. */
function hop(facetHeight: number, signal: AbortSignal): MoveOptions {
  return { duration: HOP_MS, lift: facetHeight * 0.8, wings: false, signal };
}

async function fly(
  traveler: HTMLElement,
  dot: SVGElement,
  ghosts: HTMLElement[],
  signal: AbortSignal,
) {
  const home = target("logo-dot");
  const unit = home.width / 14; // px per logo unit
  const size = VIEW * unit;
  for (const node of [traveler, ...ghosts]) {
    const svg = node.querySelector("svg");
    if (svg)
      Object.assign(svg.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${-size / 2}px`,
        top: `${-size / 2}px`,
      });
  }

  const drawn = DOT_DRAWN_WIDTH * unit;
  const homePose = (turns: number): Pose => {
    const box = target("logo-dot");
    return {
      x: box.left + box.width / 2,
      y: box.top + box.height * DOT_CENTER_Y,
      s: 1,
      r: 360 * turns,
    };
  };
  // The center facet (index 3) points down: the dot flips into it.
  const facetPose = (name: string, index: number, turns: number): Pose & { height: number } => {
    const box = target(name);
    const down = index === 3;
    return {
      x: box.left + box.width / 2,
      y: box.top + box.height * (down ? FACET_CENTER_Y.down : FACET_CENTER_Y.up),
      s: box.width / drawn,
      r: 360 * turns + (down ? 180 : 0),
      height: box.height,
    };
  };

  // The dot sinks into each facet it places, and comes back out as it takes off again.
  const sink = async () => {
    dot.style.opacity = "0";
    await sleep(SINK_MS, signal);
  };
  const rise = () => (dot.style.opacity = "1");

  // Builds the hero's prism: lands on its first facet, then hops to each next one, placing as it
  // goes.
  async function buildHero(from: Pose) {
    let pose = from;
    for (let i = 0; i < 4; i++) {
      const next = facetPose(`hero-${i}`, i, 0);
      rise();
      pose = await move(
        traveler,
        pose,
        next,
        i === 0 ? long(longRoute(pose, next), signal, ghosts) : hop(next.height, signal),
      );
      updateFlight({ heroPlaced: i + 1 });
      await sink();
    }
    return pose;
  }

  // The way back: up and along the top lane, and down onto the i. The logo's mark was there all
  // along; only the hero's prism is built.
  async function returnToLogo(from: Pose) {
    rise();
    const end = homePose(1);
    await move(traveler, from, end, long(longRoute(from, end), signal, ghosts));
  }

  let pose = homePose(0);
  traveler.style.transform = transform(pose);
  traveler.style.opacity = "1";
  // Tell the hero when the dot will land on its prism, so its connector arrives with it.
  const first = facetPose("hero-0", 0, 0);
  const landMs = long(longRoute(pose, first), signal, []).duration;
  updateFlight({ dotAway: true, heroPlaced: 0, landMs });

  pose = await buildHero(pose);
  await returnToLogo(pose);
  updateFlight({ dotAway: false, done: true });
}

/**
 * The landing page's prism flight (see prism-flight-state.ts): while `active`, a winged copy of
 * the logo's i dot flies over the page in a fixed layer, built in the logo's own svg units and
 * scaled to each facet it lands on. Positions are measured from the live page at every leg, so
 * it follows the layout at any window size. Any key or press finishes it at once.
 */
export function PrismFlight({ active }: { active: boolean }) {
  const travelerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const traveler = travelerRef.current;
    const dot = dotRef.current;
    if (!active || !traveler || !dot) return;
    const controller = new AbortController();
    const ghosts = ghostRefs.current.filter((ghost): ghost is HTMLDivElement => !!ghost);
    const finishAtOnce = (changes: Parameters<typeof updateFlight>[0]) =>
      updateFlight({ heroPlaced: 4, dotAway: false, done: true, ...changes });

    // Someone who types or presses has somewhere to be: place everything and stop. Scrolling
    // doesn't count; the dot keeps flying.
    const skip = () => {
      controller.abort();
      finishAtOnce({ skipped: true });
    };
    const skipEvents = ["keydown", "pointerdown"] as const;
    for (const type of skipEvents) window.addEventListener(type, skip, { passive: true });

    fly(traveler, dot, ghosts, controller.signal).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      // Something it needs went missing: finish the build at once rather than leave it half done.
      console.error(error);
      finishAtOnce({});
    });
    return () => {
      controller.abort();
      for (const type of skipEvents) window.removeEventListener(type, skip);
    };
  }, [active]);

  if (!active) return null;
  return createPortal(
    <>
      {/* Ghost copies of the dot, trailing it on the long flights (see `move`). */}
      {TRAIL_OPACITY.map((_, i) => (
        <div
          key={i}
          ref={(node) => {
            ghostRefs.current[i] = node;
          }}
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 z-50 size-0 opacity-0"
        >
          <svg viewBox={VIEW_BOX} className="absolute overflow-visible">
            <DotShape />
          </svg>
        </div>
      ))}
      <div
        ref={travelerRef}
        aria-hidden="true"
        data-wings="off"
        className="group pointer-events-none fixed top-0 left-0 z-50 size-0 opacity-0"
      >
        <svg viewBox={VIEW_BOX} className="absolute overflow-visible">
          {WINGS.map((wing) => (
            <path
              key={wing.d}
              d={wing.d}
              className={`${wing.className} ${WING_HAIRLINE} fill-brand/85 transition-opacity duration-200 [transform-box:view-box] group-data-[wings=off]:opacity-0 group-data-[wings=on]:[animation:logo-wing-beat_var(--beat,0.8s)_ease-in-out_2]`}
            />
          ))}
          <DotShape ref={dotRef} />
        </svg>
      </div>
    </>,
    document.body,
  );
}

/** The dot: brand green over its ink outline (light mode only, see prism-shapes.ts). */
function DotShape({ ref }: { ref?: Ref<SVGGElement> }) {
  return (
    <g ref={ref} className="transition-opacity duration-150">
      <path
        d={DOT}
        strokeWidth={DOT_OUTLINE_WIDTH}
        strokeLinejoin="round"
        className={OUTLINE_CLASS}
      />
      <path d={DOT} strokeWidth="3" strokeLinejoin="round" className="fill-brand stroke-brand" />
    </g>
  );
}

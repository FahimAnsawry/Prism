import { animate, motion, motionValue, type MotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { updateFlight } from "@/components/prism-flight-state";
import {
  DOT,
  DOT_OUTLINE_WIDTH,
  OUTLINE_CLASS,
  WING_HAIRLINE,
  WING_SCALE,
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
/** The wings beat this many times on a long flight. */
const WING_BEATS = 2;
/** The wings fade in and out over this long, and the dot over DOT_FADE_SECONDS. */
const WING_FADE_SECONDS = 0.2;
const DOT_FADE_SECONDS = 0.15;

/** What the traveler's wings and dot do while it flies: each is a motion value. */
interface Rig {
  wings: { opacity: MotionValue<number>; rotate: MotionValue<number> }[];
  dotOpacity: MotionValue<number>;
}

function createRig(): Rig {
  return {
    wings: WINGS.map(() => ({ opacity: motionValue(0), rotate: motionValue(0) })),
    dotOpacity: motionValue(1),
  };
}

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
  rig: Rig;
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
  { duration, lift = 0, route, wings, ghosts = [], signal, rig }: MoveOptions,
) {
  const bank = Math.sign(to.x - from.x) * (wings ? 10 : 6);
  const [c1, c2] = arcControls(from, to, lift);
  const steps = Math.max(12, Math.round(duration / 24));
  const frames: string[] = [];
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
    frames.push(
      transform({
        x,
        y,
        s: from.s + (to.s - from.s) * u,
        r: from.r + (to.r - from.r) * u + bank * Math.sin(Math.PI * u),
      }),
    );
  }

  // Wings spread for the long flights, beat while it lasts and fold just before landing.
  const controls: { stop: () => void }[] = [];
  const track = <T extends { stop: () => void }>(control: T) => {
    controls.push(control);
    return control;
  };
  let fold = 0;
  if (wings) {
    WINGS.forEach((wing, i) => {
      const values = rig.wings[i] as Rig["wings"][number];
      track(animate(values.opacity, 1, { duration: WING_FADE_SECONDS }));
      track(
        animate(values.rotate, [wing.up, wing.down, wing.up], {
          duration: duration / WING_BEATS / 1000,
          ease: "easeInOut",
          repeat: WING_BEATS - 1,
        }),
      );
    });
    fold = window.setTimeout(() => {
      for (const values of rig.wings) {
        track(animate(values.opacity, 0, { duration: WING_FADE_SECONDS }));
      }
    }, duration - WINGS_FOLD_MS);
  }
  const flyFrames = { transform: frames };
  const flight = { duration: duration / 1000, ease: "linear" } as const;
  const animation = track(animate(traveler, flyFrames, flight));
  // The ghosts fly the same path a little later, each fainter than the one before. They wait
  // on the first frame until their turn.
  const trail = ghosts.map((ghost, i) => {
    ghost.style.opacity = String(TRAIL_OPACITY[i] ?? 0);
    ghost.style.transform = frames[0] as string;
    return track(
      animate(ghost, flyFrames, { ...flight, delay: (TRAIL_DELAY_MS * (i + 1)) / 1000 }),
    );
  });
  const hideGhosts = () => {
    for (const ghost of ghosts) ghost.style.opacity = "0";
  };
  // Resolves when the dot lands, and rejects if the flight is aborted first.
  const until = (control: { then: (onResolve: () => void) => unknown }) =>
    new Promise<void>((resolve, reject) => {
      const abort = () => reject(signal.reason);
      if (signal.aborted) return abort();
      signal.addEventListener("abort", abort, { once: true });
      control.then(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      });
    });
  signal.addEventListener(
    "abort",
    () => {
      window.clearTimeout(fold);
      for (const control of controls) control.stop();
      hideGhosts();
    },
    { once: true },
  );
  await until(animation);
  // The last ghost lands 120ms after the dot; then they all go.
  await until({ then: (onResolve) => Promise.all(trail).then(onResolve) });
  hideGhosts();
  return to;
}

/**
 * A long flight between the logo and the hero, unhurried so the eye can follow it: its length
 * sets its time (1.7s to 2s on a desktop window, just under 1s at least), so the whole intro
 * ends about 5s after the page shows.
 */
function long(route: Route, signal: AbortSignal, ghosts: HTMLElement[], rig: Rig): MoveOptions {
  return {
    duration: clamp(800 + route.total * 0.8, 960, 2000),
    wings: true,
    route,
    ghosts,
    signal,
    rig,
  };
}

/** A hop from facet to facet, wings folded, arcing about a facet's height. */
function hop(facetHeight: number, signal: AbortSignal, rig: Rig): MoveOptions {
  return { duration: HOP_MS, lift: facetHeight * 0.8, wings: false, signal, rig };
}

async function fly(traveler: HTMLElement, rig: Rig, ghosts: HTMLElement[], signal: AbortSignal) {
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
    animate(rig.dotOpacity, 0, { duration: DOT_FADE_SECONDS });
    await sleep(SINK_MS, signal);
  };
  const rise = () => {
    animate(rig.dotOpacity, 1, { duration: DOT_FADE_SECONDS });
  };

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
        i === 0 ? long(longRoute(pose, next), signal, ghosts, rig) : hop(next.height, signal, rig),
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
    await move(traveler, from, end, long(longRoute(from, end), signal, ghosts, rig));
  }

  let pose = homePose(0);
  traveler.style.transform = transform(pose);
  traveler.style.opacity = "1";
  // Tell the hero when the dot will land on its prism, so its connector arrives with it.
  const first = facetPose("hero-0", 0, 0);
  const landMs = long(longRoute(pose, first), signal, [], rig).duration;
  updateFlight({ dotAway: true, heroPlaced: 0, landMs });

  pose = await buildHero(pose);
  await returnToLogo(pose);
  updateFlight({ dotAway: false, done: true });
}

/**
 * The landing page's prism flight (see prism-flight-state.ts): while `active`, a winged copy of
 * the logo's i dot flies over the page in a fixed layer, built in the logo's own svg units and
 * scaled to each facet it lands on. Positions are measured from the live page at every leg, so
 * it follows the layout at any window size. Any key, press or scroll finishes it at once.
 */
export function PrismFlight({ active }: { active: boolean }) {
  const travelerRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [rig] = useState(createRig);

  useEffect(() => {
    const traveler = travelerRef.current;
    if (!active || !traveler) return;
    const controller = new AbortController();
    const ghosts = ghostRefs.current.filter((ghost): ghost is HTMLDivElement => !!ghost);
    const finishAtOnce = (changes: Parameters<typeof updateFlight>[0]) =>
      updateFlight({ heroPlaced: 4, dotAway: false, done: true, ...changes });

    // Someone who types or presses has somewhere to be: place everything and stop. So does a
    // scroll (by hand, or the router restoring a reloaded page's position): the dot flies in
    // window coordinates measured at each leg's start, so once the page moves under it, it
    // would land beside the facets it places.
    const skip = () => {
      controller.abort();
      finishAtOnce({ skipped: true });
    };
    const startY = window.scrollY;
    const skipOnScroll = () => {
      if (Math.abs(window.scrollY - startY) > 1) skip();
    };
    const skipEvents = ["keydown", "pointerdown"] as const;
    for (const type of skipEvents) window.addEventListener(type, skip, { passive: true });
    window.addEventListener("scroll", skipOnScroll, { passive: true });

    fly(traveler, rig, ghosts, controller.signal).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      // Something it needs went missing: finish the build at once rather than leave it half done.
      console.error(error);
      finishAtOnce({});
    });
    return () => {
      controller.abort();
      for (const type of skipEvents) window.removeEventListener(type, skip);
      window.removeEventListener("scroll", skipOnScroll);
    };
  }, [active, rig]);

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
        className="pointer-events-none fixed top-0 left-0 z-50 size-0 opacity-0"
      >
        <svg viewBox={VIEW_BOX} className="absolute overflow-visible">
          {WINGS.map((wing, i) => (
            <motion.path
              key={wing.d}
              d={wing.d}
              className={`${WING_HAIRLINE} fill-brand/85`}
              style={{
                opacity: rig.wings[i]?.opacity,
                rotate: rig.wings[i]?.rotate,
                scale: WING_SCALE,
                transformBox: "view-box",
                originX: wing.originX,
                originY: wing.originY,
              }}
            />
          ))}
          <DotShape opacity={rig.dotOpacity} />
        </svg>
      </div>
    </>,
    document.body,
  );
}

/** The dot: brand green over its ink outline (light mode only, see prism-shapes.ts). */
function DotShape({ opacity }: { opacity?: MotionValue<number> }) {
  return (
    <motion.g style={{ opacity }}>
      <path
        d={DOT}
        strokeWidth={DOT_OUTLINE_WIDTH}
        strokeLinejoin="round"
        className={OUTLINE_CLASS}
      />
      <path d={DOT} strokeWidth="3" strokeLinejoin="round" className="fill-brand stroke-brand" />
    </motion.g>
  );
}

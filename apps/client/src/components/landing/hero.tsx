import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type SVGProps,
} from "react";
import { ctaVariants } from "@/components/cta";
import { useSplashDone } from "@/components/feedback/splash-state";
import { resetFlight, updateFlight, usePrismFlight } from "@/components/prism-flight-state";
import { CENTER_FACET, CORNER_FACETS } from "@/components/prism-shapes";
import { cn } from "@/lib/utils";
import {
  InviteCodeArt,
  InviteDatabaseArt,
  InviteFlowchartArt,
  InviteWireframeArt,
} from "./hero-art";
import { pageContainer } from "./page-container";
import { PrismFlight } from "./prism-flight";
import { Reveal } from "./reveal";
import { Sticky } from "./sticky";

const VIEWS: {
  name: string;
  tool: string;
  art: ComponentType<Omit<SVGProps<SVGSVGElement>, "viewBox">>;
}[] = [
  { name: "UI", tool: "create_screen", art: InviteWireframeArt },
  { name: "Flowchart", tool: "create_elements", art: InviteFlowchartArt },
  { name: "Database", tool: "create_er_diagram", art: InviteDatabaseArt },
  { name: "Code", tool: "get_screen_code", art: InviteCodeArt },
];

/** Where each ray lands (the left edge of its card) in the 228×440 drawing. */
const RAYS = [
  { y: 10, stroke: "stroke-brand", fill: "fill-brand" },
  { y: 149.25, stroke: "stroke-blue", fill: "fill-blue" },
  { y: 288.5, stroke: "stroke-violet", fill: "fill-violet" },
  { y: 427.75, stroke: "stroke-coral", fill: "fill-coral" },
];
/** The ray's landing x, and the center of the prism the rays leave from. */
const RAY_END_X = 218.5;
const PRISM_CENTER = { x: 25, y: 219 };
/** The prism's outline in the drawing (its triangle: apex, bottom right, bottom left). */
const PRISM_OUTLINE: [number, number][] = [
  [25, 199],
  [45, 239],
  [5, 239],
];
/** How far past the prism's outline each ray starts. */
const RAY_GAP = 8;

/**
 * Where the ray to `y` starts: RAY_GAP past the point where its line from the prism's center
 * leaves the prism's outline, so every ray stands clear of the prism whatever its angle.
 */
function rayStartPoint(y: number) {
  const dx = RAY_END_X - PRISM_CENTER.x;
  const dy = y - PRISM_CENTER.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  // The nearest crossing with an edge of the outline (the center is inside, so there is one).
  let exit = Infinity;
  PRISM_OUTLINE.forEach(([ax, ay], i) => {
    const [bx, by] = PRISM_OUTLINE[(i + 1) % PRISM_OUTLINE.length] ?? [ax, ay];
    const ex = bx - ax;
    const ey = by - ay;
    const denominator = ux * ey - uy * ex;
    if (denominator === 0) return;
    const t = ((ax - PRISM_CENTER.x) * ey - (ay - PRISM_CENTER.y) * ex) / denominator;
    const s = ((ax - PRISM_CENTER.x) * uy - (ay - PRISM_CENTER.y) * ux) / denominator;
    if (t > 0 && s >= 0 && s <= 1) exit = Math.min(exit, t);
  });
  const distance = exit + RAY_GAP;
  return {
    x: +(PRISM_CENTER.x + ux * distance).toFixed(2),
    y: +(PRISM_CENTER.y + uy * distance).toFixed(2),
  };
}

const NOTE_TEXT = "Let teammates\njoin a board\nwith a role.";

/**
 * One run of the hero's entrance, in ms from its start: the note types out, the connector draws
 * down, the prism pops in, then one view at a time its ray draws and its card slides in, and only
 * then does the next ray start. Each step starts from the one before, so changing one number
 * shifts everything after it. The keyframes are the `.hero-*` classes in index.css. It plays once
 * on every mount of the landing page, and stays finished; below xl only the note types and the view
 * cards reveal on scroll instead.
 *
 * With the prism flight the entrance starts at takeoff (the note types while the dot flies), the
 * connector is timed to arrive as the dot lands (`landMs`), and the rays count from the moment
 * the prism's last facet is placed, so the whole intro ends about 5s after the page shows.
 * Without it the rays follow the prism, 0.2s later.
 */
function makeTimeline(landMs: number, byFlight: boolean) {
  const typeStart = 250;
  const typeSpeed = 26; // per character
  const bylineIn = typeStart + NOTE_TEXT.length * typeSpeed + 100;
  const connectorDraw = 300;
  const connectorIn = Math.max(bylineIn + 60, landMs - connectorDraw);
  const prismIn = connectorIn + connectorDraw;
  const raysIn = byFlight ? 0 : prismIn + 200;
  const rayStart = (i: number) => raysIn + i * (RAY_DRAW + CARD_SLIDE);
  /** When ray `i` lands: its end dot and its card start here. */
  const rayEnd = (i: number) => rayStart(i) + RAY_DRAW;
  return { typeStart, typeSpeed, bylineIn, connectorIn, connectorDraw, prismIn, rayStart, rayEnd };
}
type Timeline = ReturnType<typeof makeTimeline>;
const RAY_DRAW = 240;
const CARD_SLIDE = 240;

/** The board with its rays and prism shows from Tailwind's xl. */
const WIDE_QUERY = "(min-width: 80rem)";

/** Starts a `.hero-*` animation at `delay` ms; `duration` sets how long a stroke draw or card slide takes. */
function at(delay: number, duration?: number): CSSProperties {
  return {
    "--d": `${delay}ms`,
    ...(duration !== undefined && { "--dur": `${duration}ms` }),
  } as CSSProperties;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True from xl up, where the board with its rays shows and the prism flight can run. */
function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

/**
 * When the hero's entrance plays: as soon as the loader is gone (`splashDone`), the hero is on
 * screen and it is `ready`
 * (the prism flight, when there is one,
 * has built the hero's prism). Then it stays finished. Attach `ref` to the section watched.
 */
function useHeroEntrance(splashDone: boolean, ready: boolean) {
  const ref = useRef<HTMLElement>(null);
  // Without IntersectionObserver there is nothing to wait for: treat the hero as in view.
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      // Entries are in time order; the last one is where the hero is now.
      const entry = entries[entries.length - 1];
      if (entry) setInView(entry.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Set while rendering (not in an effect) so the first frame already plays.
  if (!started && splashDone && ready && inView) setStarted(true);

  return { ref, play: started };
}

/**
 * Types `text` out one character every `speed` ms, starting `delay` ms after `play` turns true.
 * With `finished` it shows whole at once.
 * Returns how many characters show and whether the caret does: it appears with the first
 * character and stays until `caretUntil`. With reduced motion the whole text shows at once and
 * there is no caret.
 */
function useTypewriter(
  text: string,
  {
    play,
    finished,
    delay,
    speed,
    caretUntil,
  }: { play: boolean; finished: boolean; delay: number; speed: number; caretUntil: number },
) {
  const [state, setState] = useState(() => ({
    count: prefersReducedMotion() ? text.length : 0,
    caret: false,
  }));

  // Timeouts rather than animation frames: browsers can throttle frames for windows that are
  // visible but not painting. Each tick reads the clock, so a late tick catches up.
  useEffect(() => {
    if (!play || prefersReducedMotion()) return;
    const start = performance.now();
    let timer = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const count = Math.min(text.length, Math.max(0, Math.floor((elapsed - delay) / speed)));
      const caret = elapsed >= delay && elapsed < caretUntil;
      setState((prev) => (prev.count === count && prev.caret === caret ? prev : { count, caret }));
      if (elapsed < caretUntil) timer = window.setTimeout(tick, speed / 2);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [text, play, delay, speed, caretUntil]);

  // Finished (skipped with a key or press): the whole note, no caret.
  return finished ? { count: text.length, caret: false } : state;
}

/**
 * The idea hangs from the sticky note into the prism and splits into one ray per view. With
 * `byFlight` (the prism flight is on) the prism isn't part of the entrance: the flight places
 * its facets one by one (`placed` so far) before the entrance starts.
 */
function Refraction({
  byFlight,
  placed,
  timeline,
  rays,
  className,
}: {
  byFlight: boolean;
  placed: number;
  timeline: Timeline;
  rays: boolean;
  className?: string;
}) {
  const facetClass = (index: number) =>
    byFlight &&
    (index < placed
      ? "animate-logo-facet-pop origin-center [transform-box:fill-box]"
      : "opacity-0");
  return (
    <svg viewBox="0 0 228 440" aria-hidden="true" className={cn("block size-full", className)}>
      <defs>
        <radialGradient id="hero-prism-glow">
          <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0.75" />
          <stop offset="1" stopColor="var(--color-brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M25 97V199"
        pathLength={1}
        strokeWidth="4"
        className="hero-draw stroke-foreground"
        style={at(timeline.connectorIn, timeline.connectorDraw)}
      />
      <g data-rays={rays ? "play" : "wait"}>
        <g strokeWidth="1.6" strokeLinecap="round">
          {RAYS.map((ray, i) => {
            const start = rayStartPoint(ray.y);
            return (
              <path
                key={ray.y}
                d={`M${start.x} ${start.y} ${RAY_END_X} ${ray.y}`}
                pathLength={1}
                className={cn("hero-draw", ray.stroke)}
                style={at(timeline.rayStart(i), RAY_DRAW)}
              />
            );
          })}
        </g>
        {RAYS.map((ray, i) => (
          <circle
            key={ray.y}
            cx={RAY_END_X}
            cy={ray.y}
            r="6.5"
            className={cn("hero-pop", ray.fill)}
            style={at(timeline.rayEnd(i))}
          />
        ))}
      </g>
      {/* A 250ms glow as the flight places the prism's last facet, before the connector and rays. */}
      {byFlight && placed === 4 && (
        <circle
          cx={PRISM_CENTER.x}
          cy={PRISM_CENTER.y + 4}
          r="34"
          fill="url(#hero-prism-glow)"
          className="animate-hero-glow origin-center [transform-box:fill-box]"
        />
      )}
      {/* The pop goes on a wrapper: a CSS transform would replace the transform attribute. */}
      <g className={cn(!byFlight && "hero-pop")} style={at(timeline.prismIn)}>
        <g transform="translate(5 199) scale(1.1111)">
          {CORNER_FACETS.map((d, i) => (
            <path
              key={d}
              d={d}
              className={cn("fill-foreground", facetClass(i))}
              data-flight-target={`hero-${i}`}
            />
          ))}
          <path
            d={CENTER_FACET}
            className={cn("fill-brand", facetClass(3))}
            data-flight-target="hero-3"
          />
        </g>
      </g>
    </svg>
  );
}

function IdeaNote({
  play,
  finished,
  timeline,
  className,
}: {
  play: boolean;
  finished: boolean;
  timeline: Timeline;
  className?: string;
}) {
  const { count, caret } = useTypewriter(NOTE_TEXT, {
    play,
    finished,
    delay: timeline.typeStart,
    speed: timeline.typeSpeed,
    caretUntil: timeline.connectorIn,
  });

  return (
    <Sticky className={cn("hero-fade px-6 pt-5 pb-4", className)}>
      <p className="text-2xl leading-[1.05] whitespace-pre-line">
        <span className="sr-only">{NOTE_TEXT}</span>
        {/* The untyped rest stays in place, invisible, so the note keeps its size while typing. */}
        <span aria-hidden="true">
          {NOTE_TEXT.slice(0, count)}
          {caret && (
            <span className="relative">
              <span
                className={cn(
                  "absolute top-[0.05em] left-0 h-[0.9em] w-0.5 bg-current",
                  count === NOTE_TEXT.length && "hero-caret-blink",
                )}
              />
            </span>
          )}
          <span className="invisible">{NOTE_TEXT.slice(count)}</span>
        </span>
      </p>
      <p
        className="hero-fade mt-4 flex items-center gap-3 font-mono text-[10px] text-graphite"
        style={at(timeline.bylineIn)}
      >
        <img
          src="/landing/avatar-fahim.png"
          alt=""
          width={20}
          height={20}
          className="size-5 rounded-full bg-fog"
        />
        Fahim · the idea
      </p>
    </Sticky>
  );
}

/** A view card: its thumbnail, name and the tool that draws it. */
function ViewLabel({ name, tool }: { name: string; tool: string }) {
  return (
    <div className="min-w-0">
      <h2 className="text-base leading-tight font-semibold text-foreground">{name}</h2>
      <p className="mt-[3px] truncate font-mono text-[11px] text-muted-foreground">{tool}</p>
    </div>
  );
}

/**
 * The board's right half (619.5×538 on the 1440 frame), laid out in percentages so it scales
 * with its column: the sticky note, the ray drawing and four view cards. It sits on the right
 * edge of the page column.
 */
function ViewsBoard({
  play,
  finished,
  rays,
  byFlight,
  placed,
  timeline,
}: {
  play: boolean;
  finished: boolean;
  rays: boolean;
  byFlight: boolean;
  placed: number;
  timeline: Timeline;
}) {
  return (
    <div data-flight-board="" className="relative ml-auto aspect-[619.5/537.75] w-full max-w-155">
      <IdeaNote
        play={play}
        finished={finished}
        timeline={timeline}
        className="absolute top-0 left-0 w-[34.4%]"
      />
      <div className="absolute top-[9.3%] left-[13.16%] h-[81.82%] w-[36.8%]">
        <Refraction byFlight={byFlight} placed={placed} timeline={timeline} rays={rays} />
      </div>
      <ul data-rays={rays ? "play" : "wait"}>
        {VIEWS.map(({ name, tool, art: Art }, i) => (
          <li
            key={name}
            className="hero-slide-in absolute left-[48.43%] flex h-[22.32%] w-[51.57%] items-center gap-[13%] bg-card pl-[3.3%]"
            style={{
              top: `${(i * 139.25 * 100) / 537.75}%`,
              ...at(timeline.rayEnd(i), CARD_SLIDE),
            }}
          >
            <Art className="w-[37.6%] shrink-0" />
            <ViewLabel name={name} tool={tool} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Hero() {
  // The entrance waits for the startup loader to lift and for the hero to be on screen; until
  // then it holds on its first frame. It plays once on each mount and stays finished.
  const splashDone = useSplashDone();
  const wide = useWide();
  const flight = usePrismFlight();
  // With the prism flight, the note starts typing as the dot takes off (not after it has built
  // the prism); the rays wait for the prism's last facet (`rays`, below).
  const ready = flight.plan === "off" || (flight.plan === "flight" && flight.dotAway);
  const { ref, play } = useHeroEntrance(splashDone, ready);

  // As the loader lifts, decide whether the logo's dot flies in to build the prism: only where
  // the prism shows (xl and up), with the hero on screen and motion allowed. Otherwise every
  // piece plays its own entrance.
  useEffect(() => {
    if (!splashDone || flight.plan !== "pending") return;
    const box = ref.current?.getBoundingClientRect();
    const inView = !!box && box.bottom > 0 && box.top < window.innerHeight;
    const logo = document.querySelector('[data-flight-target="logo-dot"]');
    const fly = wide && inView && !!logo && !prefersReducedMotion();
    updateFlight({ plan: fly ? "flight" : "off" });
  }, [splashDone, flight.plan, wide, ref]);

  // A later visit to the landing page flies again.
  useEffect(() => resetFlight, []);

  const byFlight = flight.plan === "flight";
  // Finished early by a key or press: everything shows in its final frame.
  const finished = flight.skipped;
  const rays = play && (!byFlight || flight.heroPlaced === 4 || finished);
  const timeline = useMemo(
    () => makeTimeline(byFlight ? flight.landMs : 0, byFlight),
    [byFlight, flight.landMs],
  );

  return (
    <section ref={ref} aria-labelledby="hero-title" className="border-b border-border">
      <PrismFlight active={flight.plan === "flight" && !flight.done} />
      <div
        className={cn(
          pageContainer,
          "flex flex-col gap-12 pt-12 pb-16 md:gap-16 lg:pt-16 lg:pb-20 xl:flex-row xl:items-start xl:gap-16 min-[1440px]:gap-30",
        )}
      >
        {/* Centered as a stack below xl (title, copy, buttons, note), left-aligned beside the board. */}
        <div className="mx-auto flex w-full max-w-135 flex-col items-center text-center xl:mx-0 xl:w-135 xl:shrink-0 xl:items-start xl:pt-5 xl:text-left">
          <h1
            id="hero-title"
            className="font-display text-4xl leading-[0.95] font-bold tracking-display text-foreground sm:text-7xl xl:text-[5rem]"
          >
            One idea,
            <br />
            broken into
            <br />
            many views.
          </h1>
          <p className="mt-8 max-w-135 text-lg leading-normal text-foreground md:text-xl">
            Sketch it, wireframe it, chart it, model its data. Your team and your AI editor work on
            one live board, and every view turns into code.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4 xl:justify-start">
            <Link to="/signup" className={ctaVariants({ variant: "primary", size: "lg" })}>
              Start a board
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              to="/"
              hash="how-it-works"
              className={ctaVariants({ variant: "secondary", size: "lg" })}
            >
              See it work
            </Link>
          </div>
          <p className="mt-6 font-hand text-2xl leading-[1.1] text-foreground">
            <span aria-hidden="true">↑ </span>no install, just share a link
          </p>
        </div>

        <div
          id="views"
          data-hero={finished ? "skip" : play ? "play" : "wait"}
          className="xl:min-w-0 xl:flex-1"
        >
          <div className="hidden xl:block">
            <ViewsBoard
              play={play}
              finished={finished}
              rays={rays}
              byFlight={byFlight}
              placed={flight.heroPlaced}
              timeline={timeline}
            />
          </div>

          {/* Below xl the board has no room: the idea (centered), then the views as a grid. No
              rays here: the note types and each card reveals as it comes completely into view. */}
          <div className="xl:hidden">
            <IdeaNote
              play={play}
              finished={finished}
              timeline={timeline}
              className="mx-auto w-full max-w-60"
            />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {VIEWS.map(({ name, tool, art: Art }) => (
                <li key={name}>
                  <Reveal whole className="h-full bg-card p-5">
                    <Art className="h-[150px] w-full" />
                    <div className="mt-4">
                      <ViewLabel name={name} tool={tool} />
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

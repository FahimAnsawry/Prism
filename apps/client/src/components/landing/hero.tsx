import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type ComponentType,
  type CSSProperties,
  type SVGProps,
} from "react";
import { ctaVariants } from "@/components/cta";
import { useSplashDone } from "@/components/feedback/splash-state";
import { cn } from "@/lib/utils";
import {
  InviteCodeArt,
  InviteDatabaseArt,
  InviteFlowchartArt,
  InviteWireframeArt,
} from "./hero-art";
import { pageContainer } from "./page-container";
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

const NOTE_TEXT = "Let teammates\njoin a board\nwith a role.";

/**
 * One run of the hero's entrance, in ms from its start: the note types out, the connector draws
 * down, the prism pops in, then one view at a time its ray draws and its card slides in, and only
 * then does the next ray start (5s in all: raysIn + 4 × (RAY_DRAW + CARD_SLIDE)). Each step
 * starts from the one before, so changing one number shifts everything after it. The keyframes
 * are the `.hero-*` classes in index.css. From xl up the run repeats (useReplay); below xl only
 * the note types, once, and the view cards reveal on scroll instead.
 */
const TIMELINE = (() => {
  const typeStart = 250;
  const typeSpeed = 30; // per character
  const bylineIn = typeStart + NOTE_TEXT.length * typeSpeed + 100;
  const connectorIn = bylineIn + 100;
  const connectorDraw = 300;
  const prismIn = connectorIn + connectorDraw;
  const raysIn = prismIn + 200;
  return { typeStart, typeSpeed, bylineIn, connectorIn, connectorDraw, prismIn, raysIn };
})();
const RAY_DRAW = 360;
const CARD_SLIDE = 360;
const rayStart = (i: number) => TIMELINE.raysIn + i * (RAY_DRAW + CARD_SLIDE);
/** When ray `i` lands: its end dot and its card start here. */
const rayEnd = (i: number) => rayStart(i) + RAY_DRAW;

/** Once the whole hero is on screen, it holds its finished frame this long, then fades out and plays again. */
const REPLAY_PAUSE = 1000;
const REPLAY_FADE = 300;
/** The loop only runs where the rays do (Tailwind's xl). */
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

/** True from xl up, where the board with its rays shows and the loop can run. */
function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

/** Share of the hero that counts as "all of it on screen" (a little slack for sub-pixel rounding). */
const COMPLETE_RATIO = 0.95;
/** A hero taller than the window can never be fully in view; filling this much of it counts. */
const FILLS_WINDOW = 0.85;
const OBSERVE_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

/**
 * The hero's entrance and its loop.
 *
 * - The first run starts once the splash is gone (`splashDone`) and the hero is on screen.
 * - From xl up (`loop`) it then repeats: a run, REPLAY_PAUSE on the finished frame, a REPLAY_FADE
 *   fade-out, the next run. A run ends when the last card's animation does (`onAnimationEnd`,
 *   from the element marked `data-hero-last`), so the loop follows the animations' own clock.
 * - Leaving the screen stops it at once and leaves the finished hero (`settled`). It plays again
 *   only after the whole hero is back in view and has stayed there for REPLAY_PAUSE.
 * - Below xl, and with reduced motion, there is no loop: one run, then it stays put.
 *
 * `run` is the key that remounts the animated content (restarting its CSS animations and typing);
 * `leaving` is true during the fade. Attach `ref` to the section being watched.
 */
function useHeroLoop(splashDone: boolean) {
  const ref = useRef<HTMLElement>(null);
  const wide = useWide();
  const loop = wide && !prefersReducedMotion();
  // Without IntersectionObserver there is nothing to wait for: treat the hero as in view.
  const noObserver = typeof IntersectionObserver === "undefined";
  const [state, setState] = useState({
    run: 0,
    started: false,
    inView: noObserver,
    complete: noObserver,
    finished: false,
    leaving: false,
  });

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Entries are in time order; the last one is where the hero is now.
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const inView = entry.isIntersecting;
        const complete =
          entry.intersectionRatio >= COMPLETE_RATIO ||
          entry.intersectionRect.height >= window.innerHeight * FILLS_WINDOW;
        setState((prev) => {
          const next = { ...prev, inView, complete };
          // Out of view mid-run: stop on the finished frame instead of freezing half drawn.
          if (loop && prev.started && !inView && !prev.finished) next.finished = true;
          // No longer all in view during the fade: come back instead of staying blank.
          if (!complete) next.leaving = false;
          return next;
        });
      },
      { threshold: OBSERVE_THRESHOLDS },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loop]);

  // Set while rendering (not in an effect) so the first frame after the splash already plays.
  if (!state.started && splashDone && state.inView)
    setState((prev) => ({ ...prev, started: true }));

  // Two steps: hold the finished frame, then fade out and start the next run. Only while all of
  // the hero is in view, so a replay never plays unseen or half in view.
  useEffect(() => {
    if (!loop || !state.finished || !state.complete) return;
    const timer = state.leaving
      ? window.setTimeout(
          () =>
            setState((prev) => ({ ...prev, run: prev.run + 1, finished: false, leaving: false })),
          REPLAY_FADE,
        )
      : window.setTimeout(() => setState((prev) => ({ ...prev, leaving: true })), REPLAY_PAUSE);
    return () => window.clearTimeout(timer);
  }, [loop, state.finished, state.complete, state.leaving]);

  const onAnimationEnd = (event: AnimationEvent) => {
    if (loop && event.target instanceof Element && event.target.hasAttribute("data-hero-last")) {
      setState((prev) => ({ ...prev, finished: true }));
    }
  };

  return {
    ref,
    play: state.started,
    settled: state.finished,
    run: state.run,
    leaving: state.leaving,
    onAnimationEnd,
  };
}

/**
 * Types `text` out one character every `speed` ms, starting `delay` ms after `play` turns true.
 * Returns how many characters show and whether the caret does: it appears with the first
 * character and stays until `caretUntil`. With reduced motion, or once `settled`, the whole text
 * shows at once and there is no caret.
 */
function useTypewriter(
  text: string,
  {
    play,
    settled,
    delay,
    speed,
    caretUntil,
  }: { play: boolean; settled: boolean; delay: number; speed: number; caretUntil: number },
) {
  const [state, setState] = useState(() => ({
    count: prefersReducedMotion() ? text.length : 0,
    caret: false,
  }));

  // Timeouts rather than animation frames: browsers can throttle frames for windows that are
  // visible but not painting. Each tick reads the clock, so a late tick catches up.
  useEffect(() => {
    if (!play || settled || prefersReducedMotion()) return;
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
  }, [text, play, settled, delay, speed, caretUntil]);

  return settled ? { count: text.length, caret: false } : state;
}

/** The idea hangs from the sticky note into the prism and splits into one ray per view. */
function Refraction({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 228 440" aria-hidden="true" className={cn("block size-full", className)}>
      <path
        d="M25 97V199"
        pathLength={1}
        strokeWidth="4"
        className="hero-draw stroke-foreground"
        style={at(TIMELINE.connectorIn, TIMELINE.connectorDraw)}
      />
      <g strokeWidth="3.2" strokeLinecap="round">
        {RAYS.map((ray, i) => (
          <path
            key={ray.y}
            d={`M25 219 218.5 ${ray.y}`}
            pathLength={1}
            className={cn("hero-draw", ray.stroke)}
            style={at(rayStart(i), RAY_DRAW)}
          />
        ))}
      </g>
      {RAYS.map((ray, i) => (
        <circle
          key={ray.y}
          cx="218.5"
          cy={ray.y}
          r="6.5"
          className={cn("hero-pop", ray.fill)}
          style={at(rayEnd(i))}
        />
      ))}
      {/* The pop goes on a wrapper: a CSS transform would replace the transform attribute. */}
      <g className="hero-pop" style={at(TIMELINE.prismIn)}>
        <g transform="translate(5 199) scale(1.1111)">
          <path className="fill-foreground" d="M18 0 25.86 15.72H10.14Z" />
          <path className="fill-foreground" d="M7.86 20.28 15.72 36H0Z" />
          <path className="fill-foreground" d="M28.14 20.28 36 36H20.28Z" />
          <path className="fill-brand" d="M10.14 18.54h15.72L18 34.26Z" />
        </g>
      </g>
    </svg>
  );
}

function IdeaNote({
  play,
  settled,
  className,
}: {
  play: boolean;
  settled: boolean;
  className?: string;
}) {
  const { count, caret } = useTypewriter(NOTE_TEXT, {
    play,
    settled,
    delay: TIMELINE.typeStart,
    speed: TIMELINE.typeSpeed,
    caretUntil: TIMELINE.connectorIn,
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
        style={at(TIMELINE.bylineIn)}
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
function ViewsBoard({ play, settled }: { play: boolean; settled: boolean }) {
  return (
    <div className="relative ml-auto aspect-[619.5/537.75] w-full max-w-155">
      <IdeaNote play={play} settled={settled} className="absolute top-0 left-0 w-[34.4%]" />
      <div className="absolute top-[9.3%] left-[13.16%] h-[81.82%] w-[36.8%]">
        <Refraction />
      </div>
      <ul>
        {VIEWS.map(({ name, tool, art: Art }, i) => (
          <li
            key={name}
            className="hero-slide-in absolute left-[48.43%] flex h-[22.32%] w-[51.57%] items-center gap-[13%] bg-card pl-[3.3%]"
            style={{ top: `${(i * 139.25 * 100) / 537.75}%`, ...at(rayEnd(i), CARD_SLIDE) }}
            data-hero-last={i === VIEWS.length - 1 || undefined}
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
  // The entrance waits for the startup splash to lift and for the hero to be on screen; until
  // then it holds on its first frame. From xl up it then loops while the hero is in view.
  const splashDone = useSplashDone();
  const { ref, play, settled, run, leaving, onAnimationEnd } = useHeroLoop(splashDone);

  return (
    <section ref={ref} aria-labelledby="hero-title" className="border-b border-border">
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
          data-hero={settled ? "settled" : play ? "play" : "wait"}
          className="xl:min-w-0 xl:flex-1"
        >
          {/* A new key per run remounts everything inside, which replays the entrance. Only the
              board (xl and up) loops, so its last card is the one that ends a run. */}
          <div
            key={run}
            onAnimationEnd={onAnimationEnd}
            className={cn("transition-opacity duration-300 ease-standard", leaving && "opacity-0")}
          >
            <div className="hidden xl:block">
              <ViewsBoard play={play} settled={settled} />
            </div>

            {/* Below xl the board has no room: the idea (centered), then the views as a grid.
                No rays and no loop here: the note types once and each card reveals as it comes
                completely into view. */}
            <div className="xl:hidden">
              <IdeaNote play={play} settled={settled} className="mx-auto w-full max-w-60" />
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
      </div>
    </section>
  );
}

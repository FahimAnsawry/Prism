import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";
import { ArrowMarker, SvgSticky } from "./svg-parts";

// Each view's mini board fragment is 168×112, drawn at 1:1 on desktop so the rays can land on it.

function WireframeArt() {
  return (
    <>
      <rect className="fill-canvas stroke-onyx" x="40" y="12" width="88" height="88" />
      <rect className="fill-silver" x="50" y="22" width="44" height="8" />
      <rect className="fill-fog stroke-rule" x="50" y="38" width="68" height="12" />
      <rect className="fill-fog stroke-rule" x="50" y="56" width="68" height="12" />
      <rect className="fill-brand" x="50" y="76" width="68" height="14" />
    </>
  );
}

function FlowchartArt() {
  const arrowId = `${useId()}-arrow`;
  return (
    <>
      <defs>
        <ArrowMarker id={arrowId} />
      </defs>
      <rect className="fill-canvas stroke-onyx" x="12" y="41" width="40" height="28" />
      <path className="fill-neon stroke-onyx" d="M84 37 102 55 84 73 66 55Z" />
      <ellipse className="fill-canvas stroke-onyx" cx="138" cy="55" rx="18" ry="14" />
      <g className="stroke-onyx" strokeWidth="1.5">
        <line x1="52" y1="55" x2="64" y2="55" markerEnd={`url(#${arrowId})`} />
        <line x1="102" y1="55" x2="118" y2="55" markerEnd={`url(#${arrowId})`} />
      </g>
    </>
  );
}

function NotesArt() {
  return (
    <>
      <SvgSticky
        x={22}
        y={18}
        size={64}
        rotate={-4}
        fill="fill-sky"
        lines={["ship", "Friday?"]}
        fontSize={18}
      />
      <SvgSticky x={94} y={32} size={56} rotate={3} fill="fill-lime" lines={["v2"]} fontSize={20} />
    </>
  );
}

function SketchArt() {
  return (
    <g className="fill-none stroke-onyx" strokeWidth="1.5" strokeLinecap="round">
      <path className="fill-lavender" d="M24 30 86 27 89 82 22 85Z" />
      <path d="M22 28 88 31 86 84 25 82Z" />
      <ellipse cx="126" cy="50" rx="24" ry="21" />
      <ellipse cx="127" cy="49" rx="23" ry="23" transform="rotate(8 127 49)" />
      <path d="M104 92q8-10 16 0t16 0 16 0" />
    </g>
  );
}

function ChartArt() {
  return (
    <>
      {[30, 46, 38, 62].map((height, i) => (
        <rect
          key={height}
          className="fill-peach stroke-onyx"
          x={34 + i * 26}
          y={92 - height}
          width="18"
          height={height}
        />
      ))}
      <line className="stroke-onyx" strokeWidth="1.5" x1="24" y1="92" x2="144" y2="92" />
    </>
  );
}

// Same order and colors as the refraction diagram on the auth screens.
// `exit` is where the view's ray leaves the desktop prism's right face.
const VIEWS: {
  name: string;
  body: string;
  stroke: string;
  text: string;
  exit: readonly [number, number];
  art: ReactNode;
}[] = [
  {
    name: "Wireframe",
    exit: [264, 296],
    body: "Frames and UI blocks that carry a role (button, input, card), so code can read the screen.",
    stroke: "stroke-brand",
    text: "text-brand",
    art: <WireframeArt />,
  },
  {
    name: "Flowchart",
    exit: [270, 310],
    body: "Boxes, ellipses and diamonds, with arrows that stay attached when you move a shape.",
    stroke: "stroke-neon",
    text: "text-neon",
    art: <FlowchartArt />,
  },
  {
    name: "Notes",
    exit: [276, 324],
    body: "Sticky notes, bullet lists, text and handwriting for the thinking around the screen.",
    stroke: "stroke-sky",
    text: "text-sky",
    art: <NotesArt />,
  },
  {
    name: "Sketch",
    exit: [282, 338],
    body: "A freehand pencil, and a sketch mode that gives any shape a hand-drawn look.",
    stroke: "stroke-lavender",
    text: "text-lavender",
    art: <SketchArt />,
  },
  {
    name: "Chart",
    exit: [288, 352],
    body: "Bar, line, pie and donut charts, with the data edited in a side panel.",
    stroke: "stroke-peach",
    text: "text-peach",
    art: <ChartArt />,
  },
];

// Desktop beam: list rows are 112px tall with 16px gaps, so ray i lands at y = 56 + 128i.
const ROW_PITCH = 128;
const DESKTOP_HEIGHT = VIEWS.length * ROW_PITCH - 16;

/** Desktop: the idea enters a prism and each ray lands on its view's board fragment. */
function BeamDesktop() {
  return (
    <svg
      viewBox={`0 0 440 ${DESKTOP_HEIGHT}`}
      width="440"
      height={DESKTOP_HEIGHT}
      aria-hidden="true"
      className="block overflow-visible font-mono text-[13px] max-lg:hidden"
    >
      <line
        className="ray-draw stroke-fog"
        strokeWidth="3"
        pathLength={1}
        x1="0"
        y1="410"
        x2="138"
        y2="338"
      />
      <text className="fill-fog tracking-[0.08em]" x="0" y="440">
        IDEA
      </text>
      {VIEWS.map((view, i) => (
        <line
          key={view.name}
          className={cn("ray-draw", view.stroke)}
          strokeWidth="4"
          pathLength={1}
          x1={view.exit[0]}
          y1={view.exit[1]}
          x2="440"
          y2={56 + i * ROW_PITCH}
        />
      ))}
      <path className="fill-slate stroke-fog" d="M210 170 330 450H90Z" />
      <line className="stroke-fog/40" strokeWidth="2" x1="138" y1="338" x2="276" y2="324" />
    </svg>
  );
}

/** Below lg: a compact fan above the list. */
function BeamCompact() {
  return (
    <svg
      viewBox="0 0 360 128"
      aria-hidden="true"
      className="block h-auto w-full max-w-xl overflow-visible font-mono text-[12px] lg:hidden"
    >
      <line className="stroke-fog" strokeWidth="3" x1="0" y1="96" x2="139" y2="75" />
      <text className="fill-fog tracking-[0.08em]" x="0" y="122">
        IDEA
      </text>
      {VIEWS.map((view, i) => (
        <line
          key={view.name}
          className={view.stroke}
          strokeWidth="3"
          x1={193 + i * 2.6}
          y1={58 + i * 5.6}
          x2="360"
          y2={8 + i * 28}
        />
      ))}
      <path className="fill-slate stroke-fog" d="M170 8 222 120H118Z" />
    </svg>
  );
}

export function ViewsSection() {
  return (
    <section
      id="tools"
      aria-labelledby="tools-title"
      className="scroll-mt-[59px] border-b border-dashed border-fog/15 bg-onyx [--focus-ring:var(--color-fog)]"
    >
      <div className={cn(pageContainer, "pt-16 pb-20 lg:pb-24")}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <h2
            id="tools-title"
            className="max-w-[56rem] font-display text-[2.5rem] leading-[0.95] font-bold tracking-display text-fog md:text-5xl lg:text-[3.375rem] lg:leading-[0.9]"
          >
            Every tool you need to think out loud.
          </h2>
        </div>

        <div className="mt-12 grid gap-10 lg:mt-20 lg:grid-cols-[440px_1fr] lg:gap-0">
          <BeamDesktop />
          <BeamCompact />
          <ul className="grid gap-6 lg:gap-4">
            {VIEWS.map((view) => (
              <li
                key={view.name}
                className="grid grid-cols-[7rem_1fr] items-center gap-4 sm:grid-cols-[168px_1fr] lg:h-28 lg:gap-6"
              >
                <svg
                  viewBox="0 0 168 112"
                  aria-hidden="true"
                  className="block h-auto w-full bg-fog"
                >
                  {view.art}
                </svg>
                <div>
                  <h3
                    className={cn(
                      "font-mono text-[13px] font-bold tracking-[0.08em] uppercase",
                      view.text,
                    )}
                  >
                    {view.name}
                  </h3>
                  <p className="mt-1.5 max-w-[30rem] text-base leading-[1.45] tracking-body text-silver">
                    {view.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

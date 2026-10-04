import { useId } from "react";
import { cn } from "@/lib/utils";
import { ArrowMarker, SvgCursor, SvgSticky } from "./svg-parts";

const TOOLS = ["V", "H", "T", "N", "R", "O", "L", "A", "P", "E"];
const ACTIVE_TOOL = 4;

const AVATARS = [
  { letter: "F", cx: 956, fill: "fill-brand" },
  { letter: "M", cx: 982, fill: "fill-ice" },
  { letter: "C", cx: 1008, fill: "fill-seafoam" },
];

const BARS = [
  { x: 952, height: 56, width: 40, fill: "fill-brand" },
  { x: 1012, height: 80, width: 40, fill: "fill-blue" },
  { x: 1072, height: 104, width: 40, fill: "fill-violet" },
  { x: 1132, height: 88, width: 40, fill: "fill-coral" },
  { x: 1192, height: 116, width: 32, fill: "fill-pink" },
];
const BAR_BASELINE = 272;

/**
 * The live board mock under the hero (1280×640 on the board), drawn as one SVG so the
 * whole composition scales with the page width.
 */
export function BoardPreview() {
  const id = useId();
  const arrowId = `${id}-arrow`;
  const titleId = `${id}-title`;

  return (
    <svg
      viewBox="-6 -6 1292 652"
      role="img"
      aria-labelledby={titleId}
      className="block h-auto w-full overflow-visible font-mono"
    >
      <title id={titleId}>
        A Prism board called Q4 launch plan: a login wireframe, sticky notes, a signups chart and a
        sign-in flowchart, with Fahim, Mo and Claude editing live.
      </title>
      <defs>
        <ArrowMarker id={arrowId} />
      </defs>

      {/* Board window */}
      <rect className="fill-background stroke-ink" x="0" y="0" width="1280" height="640" />

      {/* Top bar */}
      <path
        className="fill-none stroke-ink"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M38 28H24m6-6-6 6 6 6"
      />
      <text className="fill-foreground font-sans text-[17px] font-medium" x="52" y="34">
        Q4 launch plan
      </text>
      {AVATARS.map((a) => (
        <g key={a.letter}>
          <circle className={a.fill} cx={a.cx} cy="28" r="14" />
          <text className="fill-slate text-[12px] font-bold" x={a.cx} y="32" textAnchor="middle">
            {a.letter}
          </text>
        </g>
      ))}
      <rect className="fill-onyx dark:fill-neon" x="1036" y="12" width="120" height="32" />
      <text
        className="fill-neon dark:fill-onyx text-[12px] font-bold tracking-[0.08em]"
        x="1096"
        y="32"
        textAnchor="middle"
      >
        ASK CLAUDE
      </text>
      <rect className="fill-brand" x="1168" y="12" width="96" height="32" />
      <text
        className="fill-slate text-[12px] font-bold tracking-[0.08em]"
        x="1216"
        y="32"
        textAnchor="middle"
      >
        SHARE
      </text>
      <line className="stroke-border" x1="0" y1="56" x2="1280" y2="56" strokeDasharray="4 4" />

      {/* Tool rail */}
      <rect
        className="fill-card stroke-border"
        x="24"
        y="80"
        width="48"
        height="416"
        strokeDasharray="5 5"
      />
      {TOOLS.map((tool, i) => (
        <g key={tool}>
          <rect
            className={i === ACTIVE_TOOL ? "fill-brand" : "fill-card"}
            x="32"
            y={92 + i * 40}
            width="32"
            height="32"
          />
          <text
            className={cn(
              "text-[13px] font-bold",
              i === ACTIVE_TOOL ? "fill-slate" : "fill-foreground",
            )}
            x="48"
            y={113 + i * 40}
            textAnchor="middle"
          >
            {tool}
          </text>
        </g>
      ))}

      {/* Login wireframe frame */}
      <text className="fill-muted-foreground text-[12px] tracking-[0.08em]" x="120" y="100">
        FRAME · LOGIN
      </text>
      <rect className="fill-card stroke-foreground" x="120" y="110" width="340" height="440" />
      <rect className="fill-divider" x="152" y="150" width="200" height="24" />
      <rect className="fill-background stroke-border" x="152" y="200" width="276" height="40" />
      <rect className="fill-background stroke-border" x="152" y="256" width="276" height="40" />
      <rect className="fill-brand" x="152" y="320" width="276" height="44" />
      <rect className="fill-divider" x="152" y="388" width="180" height="12" />
      <rect className="fill-divider" x="152" y="412" width="120" height="12" />
      {/* Mo's selection on the button */}
      <rect
        className="fill-none stroke-blue"
        strokeWidth="1.5"
        x="146"
        y="314"
        width="288"
        height="56"
      />
      <g className="fill-card stroke-blue" strokeWidth="1.5">
        <rect x="142" y="310" width="8" height="8" />
        <rect x="430" y="310" width="8" height="8" />
        <rect x="142" y="366" width="8" height="8" />
        <rect x="430" y="366" width="8" height="8" />
      </g>
      <SvgCursor x={350} y={344} name="Mo" tone="sky" tagWidth={52} />

      {/* Sticky notes */}
      <SvgSticky
        x={520}
        y={112}
        size={168}
        rotate={-2}
        fill="fill-lime"
        lines={["Hero: one", "idea, many", "views"]}
        fontSize={30}
      />
      <SvgSticky
        x={708}
        y={132}
        size={168}
        rotate={2}
        fill="fill-lavender"
        lines={["Google +", "GitHub first"]}
        fontSize={30}
      />
      <SvgSticky
        x={540}
        y={304}
        size={168}
        rotate={1}
        fill="fill-ice"
        lines={["Dot grid on,", "snap on"]}
        fontSize={30}
      />
      <SvgCursor x={680} y={250} name="Fahim" tone="brand" tagWidth={58} />

      {/* Signups chart */}
      <rect
        className="fill-card stroke-border"
        x="920"
        y="112"
        width="320"
        height="180"
        strokeDasharray="5 5"
      />
      <text className="fill-muted-foreground text-[12px] tracking-[0.08em]" x="938" y="142">
        SIGNUPS / WEEK
      </text>
      {BARS.map((bar) => (
        <rect
          key={bar.x}
          className={bar.fill}
          x={bar.x}
          y={BAR_BASELINE - bar.height}
          width={bar.width}
          height={bar.height}
        />
      ))}

      {/* Sign-in flowchart */}
      <rect className="fill-card stroke-ink" x="760" y="380" width="140" height="56" />
      <text className="fill-foreground font-sans text-[15px]" x="830" y="413" textAnchor="middle">
        Visit
      </text>
      <path className="fill-lime stroke-ink" d="M1000 360 1060 408 1000 456 940 408Z" />
      <text className="fill-slate font-sans text-[14px]" x="1000" y="413" textAnchor="middle">
        Signed in?
      </text>
      <rect className="fill-card stroke-ink" x="1100" y="380" width="140" height="56" />
      <text className="fill-foreground font-sans text-[15px]" x="1170" y="413" textAnchor="middle">
        Board
      </text>
      <g className="stroke-ink" strokeWidth="2">
        <line x1="900" y1="408" x2="938" y2="408" markerEnd={`url(#${arrowId})`} />
        <line x1="1060" y1="408" x2="1098" y2="408" markerEnd={`url(#${arrowId})`} />
      </g>
      <SvgCursor x={1170} y={454} name="Claude" tone="onyx" tagWidth={72} />

      {/* Zoom */}
      <rect className="fill-card stroke-border" x="1156" y="584" width="108" height="32" />
      <g className="fill-foreground text-[12px]" textAnchor="middle">
        <text x="1174" y="604">
          −
        </text>
        <text x="1210" y="604">
          100%
        </text>
        <text x="1246" y="604">
          +
        </text>
      </g>
    </svg>
  );
}

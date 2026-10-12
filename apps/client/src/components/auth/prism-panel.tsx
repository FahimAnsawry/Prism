import type { ComponentType, SVGProps } from "react";
import {
  CodeArt,
  DatabaseArt,
  FlowchartArt,
  MindMapArt,
  WireframeArt,
} from "@/components/landing/view-art";

type ArtComponent = ComponentType<
  Omit<SVGProps<SVGSVGElement>, "viewBox"> & { tone?: "theme" | "light" }
>;

/** Each ray leaves the prism at `from` and lands on its card's left edge at y. */
const RAYS: { y: number; from: [number, number]; stroke: string; art: ArtComponent }[] = [
  { y: 166, from: [378, 436], stroke: "stroke-brand", art: WireframeArt },
  { y: 318, from: [378, 436], stroke: "stroke-blue", art: FlowchartArt },
  { y: 470, from: [378, 436], stroke: "stroke-violet", art: DatabaseArt },
  { y: 622, from: [405, 490], stroke: "stroke-pink", art: MindMapArt },
  { y: 774, from: [405, 490], stroke: "stroke-coral", art: CodeArt },
];

/**
 * The dark right half of the login and signup screens (800×900 on the board): one beam enters
 * the prism and splits into five views. Fitted whole (never cropped) and centered, so the
 * cards keep their margins at any window size; the dots and
 * the beam run past the art to fill the rest. `button` is the label in the code card.
 */
export function PrismPanel({ button }: { button: string }) {
  return (
    <aside className="sticky top-0 hidden h-screen overflow-hidden bg-inverse lg:block">
      <svg
        viewBox="0 0 800 900"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="A beam of light enters the Prism mark and splits into a wireframe, a flowchart, a database diagram, a mind map and code."
        className="absolute inset-0 size-full"
      >
        <defs>
          <pattern id="prism-panel-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" className="fill-white/12" />
          </pattern>
        </defs>
        <rect x="-4000" y="-4000" width="8000" height="8900" fill="url(#prism-panel-dots)" />
        <path d="M-4000 -1737 352 468" strokeWidth="3" strokeLinecap="round" className="stroke-fog" />
        <g strokeWidth="3" strokeLinecap="round">
          {RAYS.map(({ y, from, stroke }) => (
            <path key={y} d={`M${from[0]} ${from[1]} 540 ${y}`} className={stroke} />
          ))}
        </g>
        <g transform="translate(306 400) scale(3)">
          <path className="fill-fog" d="M18 0 25.86 15.72H10.14Z" />
          <path className="fill-fog" d="M7.86 20.28 15.72 36H0Z" />
          <path className="fill-fog" d="M28.14 20.28 36 36H20.28Z" />
          <path className="fill-brand" d="M10.14 18.54h15.72L18 34.26Z" />
        </g>
        {RAYS.map(({ y, art: Art }) => (
          <g key={y}>
            <rect x="540" y={y - 62} width="200" height="124" className="fill-fog" />
            {Art === CodeArt ? (
              <CodeArt tone="light" button={button} x="560" y={y - 58.5} width="159" height="117" />
            ) : (
              <Art tone="light" x="560" y={y - 58.5} width="159" height="117" />
            )}
            <circle cx="540" cy={y} r="4" className="fill-fog" />
          </g>
        ))}
      </svg>
    </aside>
  );
}

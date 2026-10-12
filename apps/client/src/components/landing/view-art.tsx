import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The five view thumbnails from the board (204×150 each): wireframe, flowchart, database,
 * mind map and code. `theme` follows light/dark; `light` keeps the day colors, for cards that
 * always sit on a light surface (the auth panel's fog cards).
 */
const PALETTES = {
  theme: {
    ink: "fill-foreground",
    line: "stroke-foreground",
    paper: "fill-white dark:fill-background",
    page: "fill-background",
    field: "fill-white dark:fill-card",
    edge: "stroke-input",
    muted: "fill-muted-foreground",
    code: "fill-inverse",
  },
  light: {
    ink: "fill-slate",
    line: "stroke-slate",
    paper: "fill-white",
    page: "fill-canvas",
    field: "fill-white",
    edge: "stroke-edge",
    muted: "fill-graphite",
    code: "fill-onyx",
  },
} as const;

type Tone = keyof typeof PALETTES;
type ArtProps = Omit<SVGProps<SVGSVGElement>, "viewBox"> & { tone?: Tone };

function Art({ className, children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 204 150" aria-hidden="true" className={cn("block", className)} {...props}>
      {children}
    </svg>
  );
}

export function WireframeArt({ tone = "theme", ...props }: ArtProps) {
  const p = PALETTES[tone];
  return (
    <Art {...props}>
      <rect
        x="52"
        y="6"
        width="100"
        height="138"
        strokeWidth="1.5"
        className={cn(p.page, p.line)}
      />
      <rect x="64" y="20" width="52" height="8" className={p.ink} />
      <rect x="64" y="40" width="76" height="14" className={cn(p.field, p.edge)} />
      <rect x="64" y="62" width="76" height="14" className={cn(p.field, p.edge)} />
      <rect x="64" y="88" width="76" height="16" className="fill-brand" />
      <rect x="76" y="116" width="52" height="5" className={p.muted} />
    </Art>
  );
}

export function FlowchartArt({ tone = "theme", ...props }: ArtProps) {
  const p = PALETTES[tone];
  return (
    <Art {...props}>
      <g strokeWidth="1.5" className={p.line}>
        <rect x="10" y="58" width="54" height="32" className="fill-ice" />
        <path d="M102 46 126 74 102 102 78 74Z" className={p.paper} />
        <rect x="142" y="18" width="54" height="32" className="fill-seafoam" />
        <rect x="142" y="98" width="54" height="32" className="fill-peach" />
        <path d="M64 74H74M126 74H134V34H138M134 74V114H138" fill="none" />
      </g>
      <g className={p.ink}>
        <path d="M72 70 78 74 72 78Z" />
        <path d="M136 30 142 34 136 38Z" />
        <path d="M136 110 142 114 136 118Z" />
      </g>
    </Art>
  );
}

export function DatabaseArt({ tone = "theme", ...props }: ArtProps) {
  const p = PALETTES[tone];
  return (
    <Art {...props}>
      <rect
        x="10"
        y="22"
        width="78"
        height="100"
        strokeWidth="1.5"
        className={cn(p.paper, p.line)}
      />
      <rect x="10" y="22" width="78" height="18" className="fill-violet" />
      <rect x="18" y="52" width="44" height="5" className={p.ink} />
      <rect x="18" y="68" width="36" height="5" className={p.muted} />
      <rect x="18" y="84" width="50" height="5" className={p.muted} />
      <rect x="18" y="100" width="30" height="5" className={p.muted} />
      <rect
        x="116"
        y="42"
        width="78"
        height="80"
        strokeWidth="1.5"
        className={cn(p.paper, p.line)}
      />
      <rect x="116" y="42" width="78" height="18" className="fill-violet" />
      <rect x="124" y="72" width="40" height="5" className={p.ink} />
      <rect x="124" y="88" width="52" height="5" className={p.muted} />
      <rect x="124" y="104" width="34" height="5" className={p.muted} />
      <path
        d="M88 54H116M108 48 116 54 108 60M92 48V60"
        fill="none"
        strokeWidth="1.5"
        className={p.line}
      />
    </Art>
  );
}

export function MindMapArt({ tone = "theme", ...props }: ArtProps) {
  const p = PALETTES[tone];
  return (
    <Art {...props}>
      <g fill="none" strokeWidth="1.5" className={p.line}>
        <path d="M76 70Q60 34 50 34" />
        <path d="M76 80Q60 116 50 116" />
        <path d="M128 70Q144 34 154 34" />
        <path d="M128 80Q144 116 154 116" />
      </g>
      <ellipse
        cx="102"
        cy="75"
        rx="32"
        ry="17"
        strokeWidth="1.5"
        className={cn("fill-pink", p.line)}
      />
      <g strokeWidth="1.5" className={p.line}>
        <rect x="6" y="24" width="46" height="20" className="fill-lavender" />
        <rect x="6" y="106" width="46" height="20" className="fill-ice" />
        <rect x="152" y="24" width="46" height="20" className="fill-lime" />
        <rect x="152" y="106" width="46" height="20" className="fill-seafoam" />
      </g>
    </Art>
  );
}

/** `button` is the label inside the coded <Button>. */
export function CodeArt({
  tone = "theme",
  button = "Create account",
  ...props
}: ArtProps & { button?: string }) {
  const p = PALETTES[tone];
  return (
    <Art {...props}>
      <rect width="204" height="150" className={p.code} />
      <g className="font-mono" fontSize="11">
        <text x="12" y="26" className="fill-coral">
          {"<form>"}
        </text>
        <text x="24" y="46" className="fill-ice">
          {"<Label>Email"}
        </text>
        <text x="24" y="66" className="fill-ice">
          {"<Input type="}
        </text>
        <text x="108" y="66" className="fill-lime">
          "email"
        </text>
        <text x="24" y="86" className="fill-ice">
          {"<Button>"}
        </text>
        <text x="36" y="106" className="fill-fog">
          {button}
        </text>
        <text x="24" y="126" className="fill-ice">
          {"</Button>"}
        </text>
        <text x="12" y="146" className="fill-coral">
          {"</form>"}
        </text>
      </g>
    </Art>
  );
}

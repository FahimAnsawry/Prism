import { use, type ComponentType, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { type Cover, LOOSE_COVERS, ProjectLookContext } from "./dashboard-styles";

/** What a board holds, guessed from its name: each kind has its own sketch. */
type Kind = "auth" | "schema" | "mindmap" | "flow" | "site" | "hero" | "app";

/** Words in a board's name and the kind they suggest. First match wins. */
const KIND_WORDS: [RegExp, Kind][] = [
  [/sign.?in|log.?in|sign.?up|register|auth|password|onboard/, "auth"],
  [/schema|database|\ber\b|tables?\b|erd|data model/, "schema"],
  [/mind|brainstorm|sitemap|\bmap\b|ideas?\b/, "mindmap"],
  [/flow|diagram|architecture|journey|structure|process/, "flow"],
  [/landing|marketing|website|home ?page|\bsite\b|pricing|blog/, "site"],
  [/dashboard|admin|analytic|settings|app\b|portal/, "app"],
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function kindOf(boardId: string, name: string): Kind {
  const lower = name.toLowerCase();
  const kind = KIND_WORDS.find(([words]) => words.test(lower))?.[1];
  // Web pages come in two layouts, so a row of landing pages doesn't repeat one picture. A
  // name that suggests nothing gets one of them or an app screen. Both are picked from its id.
  if (kind === "site") return hash(boardId) % 2 ? "site" : "hero";
  return kind ?? (["site", "hero", "app"] as const)[hash(boardId) % 3] ?? "app";
}

// The sketches share a few looks: white sheets with a hairline, dark heading bars, faint text
// lines, connector wires, and the project's color for the one thing that matters.
const sheet = "fill-background stroke-foreground/25";
const heading = "fill-foreground/70";
const text = "fill-foreground/20";
const wire = "fill-none stroke-foreground/45";

/** Three screens of a sign-in flow: an entry screen, the form with its button, a done screen. */
function AuthSketch({ accent }: { accent: string }) {
  return (
    <>
      <rect x="39" y="40" width="54" height="70" className={sheet} />
      <rect x="47" y="50" width="26" height="4" className={heading} />
      <rect x="47" y="62" width="38" height="11" className="fill-none stroke-foreground/30" />
      <rect x="47" y="80" width="38" height="11" fill={accent} fillOpacity={0.2} />
      <rect x="103" y="16" width="54" height="118" className={sheet} />
      <circle cx="130" cy="38" r="7" fill={accent} />
      <rect x="114" y="52" width="32" height="4" className={heading} />
      <rect x="111" y="66" width="38" height="11" className="fill-none stroke-foreground/30" />
      <rect x="111" y="82" width="38" height="11" className="fill-none stroke-foreground/30" />
      <rect x="111" y="100" width="38" height="11" fill={accent} />
      <rect x="118" y="118" width="24" height="3" className={text} />
      <rect x="167" y="40" width="54" height="70" className={sheet} />
      <rect x="175" y="50" width="26" height="4" className={heading} />
      <rect x="175" y="62" width="38" height="3" className={text} />
      <rect x="175" y="70" width="30" height="3" className={text} />
      <rect x="175" y="88" width="38" height="11" fill={accent} fillOpacity={0.2} />
    </>
  );
}

/** Two tables joined by a relation. */
function SchemaSketch({ accent }: { accent: string }) {
  return (
    <>
      <path d="M112 62H130V92H148M142 86L148 92L142 98" className={wire} />
      <rect x="40" y="34" width="72" height="80" className={sheet} />
      <rect x="40" y="34" width="72" height="15" fill={accent} />
      <rect x="47" y="40" width="30" height="3" className="fill-background" />
      <rect x="47" y="58" width="40" height="3" className="fill-foreground/55" />
      <rect x="47" y="70" width="52" height="3" className={text} />
      <rect x="47" y="82" width="34" height="3" className={text} />
      <rect x="47" y="94" width="46" height="3" className={text} />
      <rect x="148" y="54" width="72" height="66" className={sheet} />
      <rect x="148" y="54" width="72" height="15" fill={accent} fillOpacity={0.2} />
      <rect x="155" y="60" width="30" height="3" fill={accent} />
      <rect x="155" y="78" width="40" height="3" className="fill-foreground/55" />
      <rect x="155" y="90" width="48" height="3" className={text} />
      <rect x="155" y="102" width="30" height="3" className={text} />
    </>
  );
}

/** A central topic with four branches. */
function MindmapSketch({ accent }: { accent: string }) {
  return (
    <>
      <path
        d="M104 75C88 75 90 47 74 47M104 75C88 75 90 103 74 103M156 75C172 75 170 47 186 47M156 75C172 75 170 103 186 103"
        className={wire}
      />
      <rect x="26" y="38" width="48" height="18" className={sheet} />
      <rect x="34" y="45.5" width="26" height="3" className="fill-foreground/55" />
      <rect x="26" y="94" width="48" height="18" className={sheet} />
      <rect x="34" y="101.5" width="30" height="3" className="fill-foreground/55" />
      <rect x="186" y="38" width="48" height="18" fill={accent} fillOpacity={0.2} />
      <rect x="194" y="45.5" width="28" height="3" fill={accent} />
      <rect x="186" y="94" width="48" height="18" className={sheet} />
      <rect x="194" y="101.5" width="22" height="3" className="fill-foreground/55" />
      <rect x="104" y="64" width="52" height="22" fill={accent} />
      <rect x="116" y="73.5" width="28" height="3" className="fill-background" />
    </>
  );
}

/** A start, a decision and three outcomes. */
function FlowSketch({ accent }: { accent: string }) {
  return (
    <>
      <path d="M84 75H108M152 75H166M130 53V44H170M130 97V106H170" className={wire} />
      <rect x="34" y="65" width="50" height="20" rx="10" fill={accent} />
      <rect x="46" y="73" width="26" height="3" className="fill-background" />
      <path d="M130 53L152 75L130 97L108 75Z" className="fill-background stroke-foreground/35" />
      <rect x="122" y="73" width="16" height="3" className="fill-foreground/55" />
      <rect x="170" y="34" width="56" height="20" className={sheet} />
      <rect x="178" y="42" width="34" height="3" className="fill-foreground/55" />
      <rect x="166" y="65" width="60" height="20" fill={accent} fillOpacity={0.2} />
      <rect x="174" y="73" width="38" height="3" fill={accent} />
      <rect x="170" y="96" width="56" height="20" className={sheet} />
      <rect x="178" y="104" width="28" height="3" className="fill-foreground/55" />
    </>
  );
}

/** A web page in a browser window: headline, copy, button, a picture and a row of cards. */
function SiteSketch({ accent }: { accent: string }) {
  return (
    <>
      <rect x="44" y="22" width="172" height="110" className={sheet} />
      <rect x="44" y="22" width="172" height="12" className="fill-foreground/6" />
      <circle cx="52" cy="28" r="2" className="fill-foreground/30" />
      <circle cx="59" cy="28" r="2" className="fill-foreground/30" />
      <circle cx="66" cy="28" r="2" className="fill-foreground/30" />
      <rect x="56" y="46" width="74" height="7" className="fill-foreground/75" />
      <rect x="56" y="58" width="56" height="7" className="fill-foreground/75" />
      <rect x="56" y="72" width="66" height="3" className={text} />
      <rect x="56" y="79" width="54" height="3" className={text} />
      <rect x="56" y="90" width="30" height="10" fill={accent} />
      <rect x="142" y="44" width="62" height="58" fill={accent} fillOpacity={0.2} />
      <rect x="56" y="110" width="44" height="14" className="fill-foreground/6" />
      <rect x="106" y="110" width="44" height="14" className="fill-foreground/6" />
      <rect x="156" y="110" width="48" height="14" className="fill-foreground/6" />
    </>
  );
}

/** A web page with a centered hero: nav, headline, a button and a wide picture under it. */
function HeroSketch({ accent }: { accent: string }) {
  return (
    <>
      <rect x="44" y="22" width="172" height="110" className={sheet} />
      <rect x="54" y="32" width="18" height="4" className="fill-foreground/75" />
      <rect x="158" y="33" width="12" height="2" className={text} />
      <rect x="174" y="33" width="12" height="2" className={text} />
      <rect x="190" y="33" width="16" height="2" className={text} />
      <rect x="82" y="48" width="96" height="7" className="fill-foreground/75" />
      <rect x="98" y="60" width="64" height="7" className="fill-foreground/75" />
      <rect x="94" y="73" width="72" height="3" className={text} />
      <rect x="115" y="82" width="30" height="9" fill={accent} />
      <rect x="56" y="100" width="148" height="32" fill={accent} fillOpacity={0.2} />
    </>
  );
}

/** An app screen: a sidebar, a heading, three stat tiles and a chart. */
function AppSketch({ accent }: { accent: string }) {
  return (
    <>
      <rect x="44" y="22" width="172" height="110" className={sheet} />
      <rect x="44" y="22" width="40" height="110" className="fill-foreground/6" />
      <rect x="50" y="31" width="28" height="7" fill={accent} fillOpacity={0.25} />
      <rect x="52" y="46" width="24" height="3" className={text} />
      <rect x="52" y="56" width="18" height="3" className={text} />
      <rect x="52" y="66" width="22" height="3" className={text} />
      <rect x="94" y="32" width="50" height="6" className="fill-foreground/75" />
      <rect x="94" y="46" width="34" height="24" className="fill-foreground/8" />
      <rect x="134" y="46" width="34" height="24" className="fill-foreground/8" />
      <rect x="174" y="46" width="34" height="24" className="fill-foreground/8" />
      <rect x="94" y="78" width="114" height="44" className="fill-foreground/5" />
      <path
        d="M100 112L120 98L138 104L160 88L182 94L202 84"
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
      />
    </>
  );
}

const SKETCHES = {
  auth: AuthSketch,
  schema: SchemaSketch,
  mindmap: MindmapSketch,
  flow: FlowSketch,
  site: SiteSketch,
  hero: HeroSketch,
  app: AppSketch,
} satisfies Record<Kind, ComponentType<{ accent: string }>>;

/** An empty board: a dashed sheet with a plus. */
function EmptySketch() {
  return (
    <>
      <rect
        x="95"
        y="45"
        width="70"
        height="60"
        strokeDasharray="4 4"
        className="fill-none stroke-foreground/30"
      />
      <path d="M130 66V84M121 75H139" strokeWidth="1.5" className="stroke-foreground/50" />
    </>
  );
}

/**
 * A board's cover: a sketch of what the board holds (picked from its name) on a canvas tinted
 * with its project's color, a faint dot grid behind it. A board outside a project takes a color
 * from its id; an empty board is a dashed sheet on gray. Plain SVG and CSS, so a grid of them
 * costs nothing to draw, and the sketch scales to any size (strokes stay a hairline). Put it in a
 * `group` to lift the sketch on hover.
 */
export function BoardPreview({
  boardId,
  name,
  projectId,
  itemCount,
  className,
}: {
  boardId: string;
  name: string;
  /** The board's project, whose color the cover takes. */
  projectId: string | null;
  itemCount: number;
  className?: string;
}) {
  const empty = itemCount === 0;
  const look = use(ProjectLookContext).get(projectId ?? "");
  const cover: Cover | undefined = look?.cover ?? LOOSE_COVERS[hash(boardId) % LOOSE_COVERS.length];
  const Sketch = SKETCHES[kindOf(boardId, name)];

  return (
    <div
      aria-hidden="true"
      style={{ "--tint": cover?.to } as CSSProperties}
      className={cn(
        "relative overflow-hidden",
        empty
          ? "bg-muted/60"
          : // The tint is strong on a light page and a hint on a dark one.
            "bg-[color:color-mix(in_oklab,var(--tint)_55%,var(--muted))]",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[image:radial-gradient(color-mix(in_oklab,var(--foreground)_12%,transparent)_1px,transparent_1.5px)] bg-size-[14px_14px]" />
      <svg
        viewBox="0 0 260 150"
        preserveAspectRatio="xMidYMid meet"
        className="relative size-full transition-transform duration-200 ease-standard group-hover:-translate-y-0.5 motion-reduce:transition-none [&_*]:[vector-effect:non-scaling-stroke]"
      >
        {empty ? <EmptySketch /> : <Sketch accent={cover?.dots[0] ?? "currentColor"} />}
      </svg>
    </div>
  );
}

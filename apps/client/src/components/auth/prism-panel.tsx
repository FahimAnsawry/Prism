const RAYS = [
  {
    label: "WIREFRAME",
    from: [465, 420],
    to: [630, 330],
    stroke: "stroke-brand",
    fill: "fill-brand",
  },
  {
    label: "FLOWCHART",
    from: [470, 430],
    to: [630, 390],
    stroke: "stroke-neon",
    fill: "fill-neon",
  },
  { label: "NOTES", from: [476, 440], to: [630, 450], stroke: "stroke-sky", fill: "fill-sky" },
  {
    label: "SKETCH",
    from: [481, 450],
    to: [630, 510],
    stroke: "stroke-lavender",
    fill: "fill-lavender",
  },
  { label: "CHART", from: [487, 460], to: [630, 570], stroke: "stroke-peach", fill: "fill-peach" },
] as const;

/** One beam of light (the idea) entering a prism and splitting into five views. */
function PrismDiagram() {
  return (
    <svg
      viewBox="0 280 800 330"
      role="img"
      aria-label="A single beam labelled Idea enters a prism and splits into wireframe, flowchart, notes, sketch and chart."
      className="block h-auto w-full overflow-visible font-mono text-[12px]"
    >
      <line
        className="stroke-inverse-foreground"
        strokeWidth="3"
        x1="60"
        y1="500"
        x2="324"
        y2="440"
      />
      <text className="fill-inverse-foreground" x="60" y="530">
        IDEA
      </text>
      {RAYS.map((ray) => (
        <g key={ray.label}>
          <line
            className={ray.stroke}
            strokeWidth="4"
            x1={ray.from[0]}
            y1={ray.from[1]}
            x2={ray.to[0]}
            y2={ray.to[1]}
          />
          <text className={ray.fill} x="644" y={ray.to[1] + 4}>
            {ray.label}
          </text>
        </g>
      ))}
      <path className="fill-inverse-panel stroke-inverse-foreground" d="M400 300 520 520H280Z" />
    </svg>
  );
}

/** The dark right half of the login and signup screens. */
export function PrismPanel() {
  return (
    <aside className="hidden flex-col bg-inverse px-(--page-gutter) pt-16 pb-14 lg:flex lg:min-h-screen lg:px-20 lg:pt-24">
      <p className="font-display text-[2.25rem] leading-[1.05] font-bold tracking-display text-inverse-foreground sm:text-[2.875rem]">
        One idea broken
        <br />
        into many views.
      </p>
      <div className="-mx-(--page-gutter) mt-4 max-w-[50rem] pr-6 lg:-mx-20 lg:pr-0">
        <PrismDiagram />
      </div>
      <p className="mt-auto pt-10 font-mono text-xs tracking-[0.08em] text-inverse-muted">
        REAL-TIME BOARDS FOR TEAMS AND AGENTS
      </p>
    </aside>
  );
}

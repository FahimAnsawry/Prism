import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";

/** A role chip as the board shows it on a wireframe element. */
function RoleTag({ x, y, role }: { x: number; y: number; role: string }) {
  const width = role.length * 7.4 + 14;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect className="fill-neon" width={width} height="18" />
      <text
        className="fill-slate font-mono text-[11px] font-bold"
        x={width / 2}
        y="13"
        textAnchor="middle"
      >
        {role}
      </text>
    </g>
  );
}

function BoardStage() {
  return (
    <svg
      viewBox="0 0 360 240"
      role="img"
      aria-label="An Auth frame on the board: two inputs and a Log in button, each tagged with its role."
      className="block h-auto w-full bg-fog"
    >
      <text className="fill-slate font-mono text-[11px] tracking-[0.08em]" x="70" y="26">
        AUTH
      </text>
      <rect className="fill-canvas stroke-onyx" x="70" y="34" width="220" height="186" />
      <rect className="fill-silver" x="94" y="56" width="96" height="14" />
      <rect className="fill-fog stroke-rule" x="94" y="88" width="172" height="28" />
      <rect className="fill-fog stroke-rule" x="94" y="128" width="172" height="28" />
      <rect className="fill-brand" x="94" y="172" width="172" height="28" />
      <text
        className="fill-slate font-mono text-[11px] font-bold tracking-[0.08em]"
        x="180"
        y="190"
        textAnchor="middle"
      >
        LOG IN
      </text>
      <RoleTag x={226} y={79} role="input" />
      <RoleTag x={226} y={119} role="input" />
      <RoleTag x={218} y={163} role="button" />
    </svg>
  );
}

function CodePanel({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="m-0 flex flex-col bg-slate lg:aspect-[3/2] font-mono text-[12px] leading-[1.7] sm:text-[13px]">
      <figcaption className="flex h-9 shrink-0 items-center bg-graphite px-4 text-[11px] tracking-[0.08em] text-fog uppercase">
        {caption}
      </figcaption>
      <pre className="m-0 flex-1 overflow-x-auto px-4 py-4 whitespace-pre text-silver sm:px-5">
        {children}
      </pre>
    </figure>
  );
}

function ReferenceStage() {
  return (
    <CodePanel caption="export_reference · Auth">
      <span className="text-fog">reference/</span>
      {"\n  reference.json\n  Auth.png\n  REFERENCE.md\n\n"}
      {"{ "}
      <span className="text-sky">"role"</span>
      {": "}
      <span className="text-brand">"button"</span>
      {",\n  "}
      <span className="text-sky">"text"</span>
      {": "}
      <span className="text-brand">"Log in"</span>
      {" }"}
    </CodePanel>
  );
}

function CodeStage() {
  return (
    <CodePanel caption="Claude Code · login.tsx">
      <span className="text-neon">{"<form>"}</span>
      {"\n  "}
      <span className="text-neon">{"<Input"}</span>
      <span className="text-sky"> type</span>
      {"="}
      <span className="text-brand">"email"</span>
      <span className="text-neon">{" />"}</span>
      {"\n  "}
      <span className="text-neon">{"<Input"}</span>
      <span className="text-sky"> type</span>
      {"="}
      <span className="text-brand">"password"</span>
      <span className="text-neon">{" />"}</span>
      {"\n  "}
      <span className="text-neon">{"<Button>"}</span>
      {"Log in"}
      <span className="text-neon">{"</Button>"}</span>
      {"\n"}
      <span className="text-neon">{"</form>"}</span>
    </CodePanel>
  );
}

const STAGES: { title: string; body: string; art: ReactNode }[] = [
  {
    title: "Draw the screen",
    body: "You and Claude draw on the same board. Elements carry a role, so the board is structure, not pixels.",
    art: <BoardStage />,
  },
  {
    title: "Export a reference",
    body: "Claude writes reference.json, PNGs and REFERENCE.md for the frame you pick.",
    art: <ReferenceStage />,
  },
  {
    title: "Build from it",
    body: "Claude Code reads the package and builds the real UI. Nothing gets retyped.",
    art: <CodeStage />,
  },
];

/** Arrow into a stage: from above while the stages stack, from the left on desktop. */
function StageArrow() {
  return (
    <svg
      viewBox="0 0 40 16"
      aria-hidden="true"
      className="absolute bottom-full left-1/2 mb-4 w-10 -translate-x-1/2 rotate-90 fill-none stroke-slate lg:top-1/2 lg:right-full lg:bottom-auto lg:left-auto lg:mr-2 lg:mb-0 lg:translate-x-0 lg:-translate-y-1/2 lg:rotate-0"
      strokeWidth="2"
    >
      <path d="M0 8h36M29 2l7 6-7 6" />
    </svg>
  );
}

export function LoopSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="loop-title"
      className="scroll-mt-[59px] border-b border-dashed border-rule"
    >
      <div className={cn(pageContainer, "pt-20 pb-20 lg:pb-24")}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <h2
            id="loop-title"
            className="max-w-[56rem] font-display text-[2.5rem] leading-[0.95] font-bold tracking-display text-slate md:text-5xl lg:text-[3.375rem] lg:leading-[0.9]"
          >
            The board is the spec.
          </h2>
          <p className="max-w-[24rem] text-lg leading-[1.45] tracking-body text-graphite lg:mt-2 lg:text-[19px]">
            Sketch the screen with Claude, then hand Claude Code the board itself. Coming with the
            MCP bridge.
          </p>
        </div>

        <ol className="mt-14 grid items-start gap-16 lg:mt-20 lg:grid-cols-3 lg:gap-14">
          {STAGES.map((stage, i) => (
            <li key={stage.title}>
              <div className="relative">
                {i > 0 && <StageArrow />}
                {stage.art}
              </div>
              <h3 className="mt-6 text-[22px] leading-tight font-semibold tracking-heading text-slate lg:text-[24px]">
                {stage.title}
              </h3>
              <p className="mt-2 max-w-[26rem] text-base leading-[1.45] tracking-body text-graphite">
                {stage.body}
              </p>
            </li>
          ))}
        </ol>

        {/* The way back: edit the board, export again. */}
        {/* The U runs from the third stage's center back to the first's (3 columns, two 56px gaps). */}
        <div aria-hidden="true" className="relative mt-10 h-12 max-lg:hidden">
          <div className="absolute inset-y-0 right-[calc((100%-7rem)/6)] left-[calc((100%-7rem)/6)]">
            <div className="absolute inset-0 border-x-2 border-b-2 border-dashed border-slate" />
            <svg viewBox="0 0 16 12" className="absolute -top-3 -left-[7px] w-4 fill-slate">
              <path d="M8 0 16 12H0Z" />
            </svg>
            <p className="absolute -bottom-[18px] left-1/2 -translate-x-1/2 -rotate-2 bg-canvas px-4 font-hand text-[28px] leading-none whitespace-nowrap text-slate">
              change the board, export again
            </p>
          </div>
        </div>
        <p className="mt-8 font-hand text-[26px] leading-none text-slate lg:hidden">
          change the board, export again
        </p>
      </div>
    </section>
  );
}

import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  Database,
  Eye,
  Folder,
  KeyRound,
  Layers,
  Link2,
  Minus,
  Palette,
  Pencil,
  Puzzle,
  Route,
  Ruler,
  RefreshCw,
  ShieldCheck,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { CodePanel, PromptLine } from "./code-panel";
import { headingId } from "./docs-pages";
import type { Block, CalloutIcon, NoteIcon } from "./docs-types";
import { DocFigure } from "./doc-figures";
import { Inline } from "./inline";

/** A block's own fields, without its type tag. */
type Of<T extends Block["type"]> = Omit<Extract<Block, { type: T }>, "type">;

const CALLOUT_ICONS: Record<CalloutIcon, LucideIcon> = {
  key: KeyRound,
  undo: Undo2,
  folder: Folder,
  route: Route,
  shield: ShieldCheck,
  users: Users,
  palette: Palette,
  puzzle: Puzzle,
  eye: Eye,
  ruler: Ruler,
  refresh: RefreshCw,
  database: Database,
  bell: Bell,
};

const NOTE_ICONS: Record<NoteIcon, LucideIcon> = {
  book: BookOpen,
  alert: AlertTriangle,
  layers: Layers,
  pencil: Pencil,
  link: Link2,
  check: Check,
};

/** The tint of a request state's label (Ask AI requests). */
const STATE_TINT: Record<string, string> = {
  Pending: "bg-fog text-slate",
  Paused: "bg-lime text-slate",
  Working: "bg-ice text-slate",
  Done: "bg-seafoam text-slate",
  Failed: "bg-peach text-slate",
};

const mono = "font-mono text-[13px]";
const eyebrow = "font-mono text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase";

function H2({ title, id }: { title: string; id?: string }) {
  return (
    <h2
      id={id ?? headingId(title)}
      className="mt-14 mb-4 scroll-mt-24 font-display text-[1.75rem] leading-tight font-bold tracking-display text-foreground first:mt-0"
    >
      {title}
    </h2>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <p className="my-4 text-base leading-relaxed text-foreground">
      <Inline text={text} />
    </p>
  );
}

function Steps({ steps }: { steps: { title: string; blocks: Block[] }[] }) {
  return (
    <ol className="my-8 space-y-10">
      {steps.map((step, index) => (
        <li
          key={step.title}
          id={headingId(step.title)}
          className="scroll-mt-24 grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-7 items-center justify-center rounded-full border border-foreground font-mono text-xs font-bold"
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <h3 className="text-xl leading-snug font-semibold tracking-display">
              <span className="sr-only">Step {index + 1}: </span>
              {step.title}
            </h3>
            <div className="[&>:first-child]:mt-3">
              <Blocks blocks={step.blocks} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Callout({ icon, title, blocks }: { icon: CalloutIcon; title: string; blocks: Block[] }) {
  const Icon = CALLOUT_ICONS[icon];
  return (
    <aside className="my-8 bg-muted p-5 sm:p-6">
      <p className="flex items-center gap-2.5 text-base font-semibold">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        {title}
      </p>
      <div className="[&>:first-child]:mt-3 [&>:last-child]:mb-0 [&_figure]:mb-0">
        <Blocks blocks={blocks} />
      </div>
    </aside>
  );
}

function Table({ head, rows, mono: monoColumns = [] }: Of<"table">) {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-t border-foreground/80">
            {head.map((label) => (
              <th key={label} scope="col" className={cn(eyebrow, "py-3 pr-6 font-bold")}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")} className="border-t border-border align-top">
              {row.map((cell, column) => (
                <td
                  key={column}
                  className={cn(
                    "py-3 pr-6 leading-relaxed",
                    monoColumns.includes(column) && cn(mono, "whitespace-pre-wrap"),
                  )}
                >
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Defs({ rows }: Of<"defs">) {
  return (
    <dl className="my-6 border-b border-border">
      {rows.map((row) => (
        <div
          key={row.term}
          className="grid gap-x-8 gap-y-1 border-t border-border py-3.5 sm:grid-cols-[14rem_minmax(0,1fr)]"
        >
          <dt className="text-sm">
            {row.badge ? (
              <span
                className={cn(
                  "inline-block px-2 py-0.5 font-mono text-xs font-bold tracking-[0.06em] uppercase",
                  STATE_TINT[row.term] ?? "bg-fog text-slate",
                )}
              >
                {row.term}
              </span>
            ) : (
              <span className={cn(row.mono ? mono : "font-semibold")}>{row.term}</span>
            )}
          </dt>
          <dd className="text-sm leading-relaxed text-muted-foreground">
            <Inline text={row.text} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Matrix({ head, rows }: Of<"matrix">) {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <thead>
          <tr className="border-t border-foreground/80">
            {head.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  eyebrow,
                  "py-3 font-bold",
                  index === 0 ? "pr-6 text-left" : "w-24 text-center",
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <th scope="row" className="py-3.5 pr-6 text-left font-normal">
                {row.label}
              </th>
              {row.allowed.map((yes, column) => (
                <td key={column} className="py-3.5 text-center">
                  {yes ? (
                    <Check
                      aria-label="Yes"
                      role="img"
                      className="mx-auto size-4 text-emerald-600"
                    />
                  ) : (
                    <Minus
                      aria-label="No"
                      role="img"
                      className="mx-auto size-4 text-muted-foreground/70"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Params({ rows }: Of<"params">) {
  const typed = rows.some((row) => row.kind);
  return (
    <div className="my-6 border-t border-foreground/80">
      {rows.map((row) => (
        <div
          key={row.name}
          className={cn(
            "grid gap-x-6 gap-y-1 border-b border-border py-4",
            typed
              ? "sm:grid-cols-[9rem_7.5rem_minmax(0,1fr)]"
              : "sm:grid-cols-[9rem_minmax(0,1fr)]",
          )}
        >
          <div>
            <p className={cn(mono, "font-bold")}>{row.name}</p>
            {row.required ? (
              <p className="text-xs text-destructive">required</p>
            ) : row.hint ? (
              <p className="text-xs text-muted-foreground">{row.hint}</p>
            ) : null}
          </div>
          {typed && <p className={cn(mono, "text-muted-foreground")}>{row.kind}</p>}
          <p className="text-sm leading-relaxed">
            <Inline text={row.text} />
          </p>
        </div>
      ))}
    </div>
  );
}

function Faq({ items }: Of<"faq">) {
  return (
    <div className="my-6 border-b border-border">
      {items.map((item) => (
        <div key={item.q} className="border-t border-border py-5">
          <h3 className="text-base font-semibold">{item.q}</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            <Inline text={item.a} />
          </p>
        </div>
      ))}
    </div>
  );
}

function Notes({ items }: Of<"notes">) {
  return (
    <ul className="my-5 space-y-3.5">
      {items.map((item) => {
        const Icon = NOTE_ICONS[item.icon];
        return (
          <li key={item.text} className="flex gap-3 text-[15px] leading-relaxed">
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <Inline text={item.text} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Checks({ items }: Of<"checks">) {
  return (
    <ul className="my-5 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-base leading-relaxed">
          <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-emerald-600" />
          <span>
            <Inline text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        <Fragment key={index}>{renderBlock(block)}</Fragment>
      ))}
    </>
  );
}

function renderBlock(block: Block) {
  switch (block.type) {
    case "h2":
      return <H2 title={block.title} id={block.id} />;
    case "p":
      return <Prose text={block.text} />;
    case "checks":
      return <Checks items={block.items} />;
    case "steps":
      return <Steps steps={block.steps} />;
    case "command":
      return <CodePanel title={block.title} code={block.command} command />;
    case "code":
      return <CodePanel title={block.title} code={block.code} />;
    case "tabs":
      return <CodePanel title="" code="" tabs={block.tabs} />;
    case "prompt":
      return <PromptLine text={block.text} />;
    case "callout":
      return <Callout icon={block.icon} title={block.title} blocks={block.blocks} />;
    case "table":
      return <Table {...block} />;
    case "defs":
      return <Defs {...block} />;
    case "matrix":
      return <Matrix {...block} />;
    case "params":
      return <Params {...block} />;
    case "faq":
      return <Faq {...block} />;
    case "notes":
      return <Notes {...block} />;
    case "figure":
      return <DocFigure name={block.name} />;
  }
}

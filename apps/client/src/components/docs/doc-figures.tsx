import { ArrowDown, ArrowRight, Link2, Send } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { LiveCursor } from "@/components/live-cursor";
import { Sticky } from "@/components/landing/sticky";
import { cn } from "@/lib/utils";
import type { FigureName } from "./docs-types";

const label = "font-mono text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase";

/** A drawing in the docs: a board-like panel with an accessible description. */
function Figure({
  description,
  className,
  children,
}: {
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure role="img" aria-label={description} className={cn("my-8", className)}>
      {children}
    </figure>
  );
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("dot-grid relative border border-border p-5 sm:p-8", className)}>
      {children}
    </div>
  );
}

/** Boxes joined by arrows: across from md, down below it. */
function Flow({
  nodes,
}: {
  nodes: { eyebrow: string; title: string; note?: string; accent?: boolean; mono?: boolean }[];
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
      {nodes.map((node, index) => (
        <div key={node.eyebrow} className="contents">
          {index > 0 && (
            <>
              <ArrowDown
                aria-hidden="true"
                className="mx-auto size-5 shrink-0 text-muted-foreground md:hidden"
              />
              <ArrowRight
                aria-hidden="true"
                className="hidden size-5 shrink-0 text-muted-foreground md:block"
              />
            </>
          )}
          <div
            className={cn(
              "min-w-0 flex-1 border bg-background p-4",
              node.accent ? "border-foreground" : "border-border",
            )}
          >
            <p className={label}>{node.eyebrow}</p>
            <p
              className={cn(
                "mt-2 font-semibold break-words",
                node.mono ? "font-mono text-[13px]" : "text-base",
              )}
            >
              {node.title}
            </p>
            {node.note && (
              <p className="mt-0.5 text-sm break-words text-muted-foreground">{node.note}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Architecture() {
  return (
    <Figure description="Three parts: the board in your browser, your AI editor drawing through the MCP endpoint, and the code built from the board.">
      <Panel>
        <Flow
          nodes={[
            { eyebrow: "The board", title: "Your browser", note: "Live and shared", accent: true },
            { eyebrow: "AI editor", title: "Claude or Codex", note: "Draws through /mcp" },
            { eyebrow: "The code", title: "Your app", note: "Built from the board" },
          ]}
        />
      </Panel>
    </Figure>
  );
}

function RoundTrip() {
  return (
    <Figure description="Your schema files are drawn on the board with create_er_diagram, then read back as code with get_schema_code.">
      <Panel>
        <Flow
          nodes={[
            { eyebrow: "Your schema", title: "schema.prisma", mono: true },
            { eyebrow: "The board", title: "create_er_diagram", accent: true, mono: true },
            { eyebrow: "Back as code", title: "get_schema_code", mono: true },
          ]}
        />
      </Panel>
    </Figure>
  );
}

function Pipeline() {
  const steps = [
    {
      n: "1",
      eyebrow: "The board",
      title: "Frames and theme",
      note: "Each frame has a route label",
    },
    { n: "2", eyebrow: "Read", title: "get_theme", note: "and get_screen_code" },
    { n: "3", eyebrow: "Build", title: "build_pages", note: "Pages in your app" },
    { n: "4", eyebrow: "Compare", title: "export_image", note: "The frame beside the page" },
  ];
  return (
    <Figure description="The loop: the board, then get_theme and get_screen_code, then build_pages, then export_image to compare.">
      <Panel>
        <ol className="grid gap-3 sm:grid-cols-2">
          {steps.map((step) => (
            <li key={step.n} className="flex gap-3 border border-border bg-background p-4">
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full border border-foreground font-mono text-xs font-bold"
              >
                {step.n}
              </span>
              <div className="min-w-0">
                <p className={label}>{step.eyebrow}</p>
                <p className="mt-1.5 font-semibold">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </Figure>
  );
}

function StartNote() {
  return (
    <Figure description="A sticky note on a board that reads: start with one sticky note.">
      <Panel className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
        <Sticky className="w-56 shrink-0 -rotate-2 p-5">
          <p className="text-[28px] leading-[1.05]">start with one sticky note</p>
        </Sticky>
        <p className="max-w-sm text-base text-foreground">
          Open a board, write the idea down, and send the link. Nothing to install.
        </p>
      </Panel>
    </Figure>
  );
}

function BoardMock() {
  return (
    <Figure description="A sign-up screen with an email field, a password field and a Create account button, drawn on the board by Claude.">
      <Panel className="min-h-72">
        <p className="font-mono text-xs text-muted-foreground">Sign up · mobile</p>
        <div className="relative mx-auto mt-4 w-64 bg-card p-5 shadow-[0_12px_32px_-12px_rgb(61_59_80/0.3)]">
          <p className="text-sm font-semibold">Create your account</p>
          <div className="mt-4 h-8 border border-input" />
          <div className="mt-2.5 h-8 border border-input" />
          <div className="mt-3.5 flex h-8 items-center justify-center bg-secondary text-xs font-bold text-secondary-foreground">
            Create account
          </div>
          <LiveCursor name="Claude" tone="onyx" className="absolute -top-2 -right-10" />
        </div>
        <p className="mt-4 text-center font-hand text-2xl leading-none text-foreground sm:absolute sm:right-8 sm:bottom-6 sm:mt-0 sm:text-left">
          lands on the board
          <br />
          you have open
        </p>
      </Panel>
    </Figure>
  );
}

function TokenManager() {
  const tokens = [
    { name: "Laptop · Claude Code", token: "prism_8fK2xQaT…", used: "2 hours ago" },
    { name: "CI · design check", token: "prism_Wm41pZce…", used: "Yesterday" },
    { name: "Old desktop", token: "prism_c0Lr7NvB…", used: "Never" },
  ];
  return (
    <Figure description="The Access tokens list on the dashboard: three tokens, each with a prefix, when it was last used and a Revoke button.">
      <div className="border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">Access tokens</p>
            <p className="text-sm text-muted-foreground">3 of 20 used</p>
          </div>
          <span className="inline-flex h-9 items-center bg-brand px-3.5 font-mono text-xs font-bold tracking-[0.08em] text-slate uppercase">
            New token
          </span>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead>
              <tr className={label}>
                <th scope="col" className="pb-2 font-bold">
                  Name
                </th>
                <th scope="col" className="pb-2 font-bold">
                  Token
                </th>
                <th scope="col" className="pb-2 font-bold">
                  Last used
                </th>
                <th scope="col" className="pb-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((row) => (
                <tr key={row.name} className="border-t border-border">
                  <td className="py-3 pr-4">{row.name}</td>
                  <td className="py-3 pr-4 font-mono text-[13px]">{row.token}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{row.used}</td>
                  <td className="py-3 text-right text-destructive">Revoke</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Figure>
  );
}

function FrameSizes() {
  const frames = [
    { size: "390 × 844", name: "Mobile", className: "w-10 aspect-[390/844]" },
    { size: "834 × 1194", name: "Tablet", className: "w-[4.5rem] aspect-[834/1194]" },
    { size: "1440 × 900", name: "Desktop app", className: "w-32 aspect-[1440/900]" },
    { size: "1440 × 2400+", name: "Landing page", className: "w-32 aspect-[1440/2400]" },
  ];
  return (
    <Figure description="Frame sizes drawn to scale: mobile 390 by 844, tablet 834 by 1194, desktop app 1440 by 900 and landing page 1440 by 2400 or more.">
      <Panel className="flex flex-wrap items-end gap-x-8 gap-y-6">
        {frames.map((frame) => (
          <div key={frame.name} className="flex flex-col items-start gap-2">
            <div className={cn("border-2 border-foreground/70 bg-background", frame.className)} />
            <p className="font-mono text-xs font-bold">{frame.size}</p>
            <p className="-mt-1.5 text-sm text-muted-foreground">{frame.name}</p>
          </div>
        ))}
      </Panel>
    </Figure>
  );
}

function Swatches() {
  const swatches = [
    ["$background", "#FCFCFD"],
    ["$foreground", "#3D3B4F"],
    ["$primary", "#28E99F"],
    ["$muted", "#EEEEEE"],
    ["$muted-fg", "#5F5F5F"],
    ["$border", "#D6D6D6"],
  ];
  return (
    <Figure description="Six theme color tokens with their light values: background, foreground, primary, muted, muted foreground and border.">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 md:grid-cols-6">
        {swatches.map(([token, hex]) => (
          <div key={token}>
            <div className="h-14 border border-border" style={{ backgroundColor: hex }} />
            <p className="mt-2 font-mono text-xs font-bold">{token}</p>
            <p className="text-sm text-muted-foreground">{hex}</p>
          </div>
        ))}
      </div>
    </Figure>
  );
}

function ComponentVariants() {
  return (
    <Figure description="A primary Button, a ghost Button and a Card with a slot where its children go.">
      <Panel className="flex flex-wrap items-start gap-6 sm:gap-10">
        <div>
          <p className="mb-3 font-mono text-xs">Button · primary</p>
          <span className="inline-flex h-10 items-center bg-brand px-5 text-sm font-semibold text-slate">
            Continue
          </span>
        </div>
        <div>
          <p className="mb-3 font-mono text-xs">Button · ghost</p>
          <span className="inline-flex h-10 items-center border border-input px-5 text-sm font-semibold">
            Cancel
          </span>
        </div>
        <div className="w-full max-w-60 bg-card p-4 shadow-[0_12px_24px_-8px_rgb(61_59_80/0.2)] sm:w-60">
          <p className="mb-3 font-mono text-xs">Card · with slot</p>
          <p className="text-sm font-semibold">{"{{title}}"}</p>
          <div className="mt-3 flex h-12 items-center justify-center border border-dashed border-foreground/50 font-mono text-xs text-muted-foreground">
            slot
          </div>
        </div>
      </Panel>
    </Figure>
  );
}

function SameSite() {
  const page = (tone: string, key: number) => (
    <div key={key} className="w-full border border-border bg-background">
      <div className={cn("h-3", tone)} />
      <div className="space-y-1.5 p-2.5">
        <div className="h-2 w-3/4 bg-foreground/70" />
        <div className="h-1.5 w-full bg-foreground/20" />
        <div className="h-1.5 w-2/3 bg-foreground/20" />
        <div className={cn("mt-2 h-3.5 w-1/3", tone)} />
      </div>
    </div>
  );
  return (
    <Figure description="Two groups of pages. A site that already has screens: new pages keep its language. A new site: the page looks like itself, not like your other sites.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border border-border p-5">
          <p className={label}>Same site</p>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[0, 1, 2].map((key) => page("bg-brand", key))}
          </div>
          <p className="mt-4 font-hand text-2xl leading-none">keeps its language</p>
        </div>
        <div className="border border-border p-5">
          <p className={label}>New site</p>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[0, 1, 2].map((key) => page("bg-violet", key))}
          </div>
          <p className="mt-4 font-hand text-2xl leading-none">looks like itself</p>
        </div>
      </div>
    </Figure>
  );
}

function ShareDialog() {
  const people = [
    { name: "Maya Okafor", email: "maya@harborgym.co", role: "Editor", avatar: "maya" },
    { name: "Jun Park", email: "jun@harborgym.co", role: "Viewer", avatar: "jun" },
  ];
  return (
    <Figure description="The Share dialog for Harbor Gym: Maya is an editor, Jun is a viewer, and anyone with the link can view.">
      <Panel className="flex justify-center">
        <div className="w-full max-w-md border border-border bg-card p-5 shadow-[0_16px_32px_-12px_rgb(61_59_80/0.3)]">
          <p className="text-base font-semibold">Share “Harbor Gym”</p>
          <div className="mt-4 flex gap-2">
            <div className="flex h-9 min-w-0 flex-1 items-center border border-input px-3 text-sm text-muted-foreground">
              Add people by email
            </div>
            <span className="inline-flex h-9 items-center bg-secondary px-3 font-mono text-xs font-bold tracking-[0.08em] text-secondary-foreground uppercase">
              Invite
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {people.map((person) => (
              <li key={person.email} className="flex items-center gap-3">
                <img
                  src={`/landing/avatar-${person.avatar}.png`}
                  alt=""
                  className="size-9 shrink-0 rounded-full bg-muted object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{person.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                </div>
                <span className="border border-input px-2.5 py-1 text-xs font-semibold">
                  {person.role}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
            <span>Anyone with the link can view</span>
            <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs font-bold tracking-[0.08em] uppercase">
              <Link2 aria-hidden="true" className="size-3.5" />
              Copy link
            </span>
          </div>
        </div>
      </Panel>
    </Figure>
  );
}

function AskAi() {
  const cards = [
    ["Yoga", "Mon · 7am"],
    ["Spin", "Tue · 6pm"],
    ["Bring water", ""],
  ];
  return (
    <Figure description="Two class cards selected on a board, with an Ask AI box open: make these cards the same height and add a price to each.">
      <Panel className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          {cards.map(([title, time], index) => (
            <div
              key={title}
              className={cn(
                "w-28 bg-card p-3",
                index < 2 ? "outline-2 outline-offset-2 outline-sky" : "border border-border",
              )}
            >
              <p className="text-sm font-semibold">{title}</p>
              {time && <p className="mt-1 text-xs text-muted-foreground">{time}</p>}
            </div>
          ))}
        </div>
        <div className="w-full max-w-xs border border-border bg-card p-4 shadow-[0_12px_32px_-12px_rgb(61_59_80/0.3)]">
          <p className="text-xs font-semibold text-muted-foreground">Ask AI · 2 selected</p>
          <p className="mt-2 text-sm leading-snug">
            Make these cards the same height and add a price to each
          </p>
          <span className="mt-3 ml-auto flex h-8 w-fit items-center gap-1.5 bg-brand px-3 font-mono text-xs font-bold tracking-[0.08em] text-slate uppercase">
            Send
            <Send aria-hidden="true" className="size-3" />
          </span>
        </div>
      </Panel>
    </Figure>
  );
}

function LightDark() {
  return (
    <Figure description="The same Book a class button drawn with the light and the dark theme.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border border-border bg-background p-5 text-foreground">
          <p className={label}>Light</p>
          <span className="mt-4 inline-flex h-10 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground">
            Book a class
          </span>
        </div>
        {/* A project theme's dark colors, written out: the site itself is light only. */}
        <div className="border border-[#ecebf0]/16 bg-[#1d1c23] p-5 text-[#ecebf0]">
          <p className={cn(label, "text-[#a6a4b2]")}>Dark</p>
          <span className="mt-4 inline-flex h-10 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground">
            Book a class
          </span>
        </div>
      </div>
    </Figure>
  );
}

function ErResult() {
  const table = (name: string, columns: string[][]) => (
    <div className="w-44 shrink-0 border border-foreground/70 bg-card">
      <p className="border-b border-foreground/70 bg-muted px-3 py-1.5 text-sm font-semibold">
        {name}
      </p>
      {columns.map(([column, type]) => (
        <p key={column} className="flex justify-between gap-3 px-3 py-1.5 font-mono text-xs">
          <span>{column}</span>
          <span className="text-muted-foreground">{type}</span>
        </p>
      ))}
    </div>
  );
  return (
    <Figure description="The result on the board: a User table and a Post table joined by a one to many crow's-foot relation.">
      <Panel className="flex flex-wrap items-center justify-center gap-x-4 gap-y-5">
        {table("User", [
          ["id", "uuid"],
          ["email", "text"],
        ])}
        <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span aria-hidden="true" className="h-px w-8 bg-foreground/60 sm:w-12" />
          1 to M
          <span aria-hidden="true" className="h-px w-8 bg-foreground/60 sm:w-12" />
        </p>
        {table("Post", [
          ["id", "uuid"],
          ["authorId", "uuid"],
        ])}
      </Panel>
    </Figure>
  );
}

const FIGURES: Record<FigureName, ComponentType> = {
  architecture: Architecture,
  startNote: StartNote,
  boardMock: BoardMock,
  tokenManager: TokenManager,
  frameSizes: FrameSizes,
  swatches: Swatches,
  componentVariants: ComponentVariants,
  sameSite: SameSite,
  shareDialog: ShareDialog,
  askAi: AskAi,
  lightDark: LightDark,
  roundTrip: RoundTrip,
  erResult: ErResult,
  pipeline: Pipeline,
};

/** The drawing a page asks for by name. */
export function DocFigure({ name }: { name: FigureName }) {
  const Drawing = FIGURES[name];
  return <Drawing />;
}

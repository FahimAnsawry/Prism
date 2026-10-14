import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { ctaVariants } from "@/components/cta";
import { pageContainer } from "@/components/landing/page-container";
import { Reveal } from "@/components/landing/reveal";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Sticky } from "@/components/landing/sticky";
import { cn } from "@/lib/utils";

const mono = "font-mono text-xs font-bold tracking-[0.1em] uppercase";

/** One tool a week, one more copy of the same idea. Each card draws the idea in that tool. */
const WEEK: { day: string; tool: string; outcome: string; art: ReactNode }[] = [
  {
    day: "Mon",
    tool: "Sticky note",
    outcome: "kept: the whole idea",
    art: (
      <Sticky className="-rotate-1 p-3.5">
        <p className="text-2xl leading-[1.05]">
          Let teammates
          <br />
          join a board
          <br />
          with a role.
        </p>
      </Sticky>
    ),
  },
  {
    day: "Tue",
    tool: "Wireframe",
    outcome: "lost: who can edit",
    art: (
      <div className="w-full border border-border bg-card p-3">
        <p className="text-sm font-semibold">Invite people</p>
        <div className="mt-2.5 flex gap-1.5">
          <div className="h-6 flex-1 border border-input" />
          <div className="flex h-6 items-center bg-secondary px-2.5 text-[11px] font-semibold text-secondary-foreground">
            Send
          </div>
        </div>
      </div>
    ),
  },
  {
    day: "Wed",
    tool: "Flowchart",
    outcome: "lost: read-only links",
    art: (
      <div className="flex flex-col items-center text-[11px]">
        {["Invite", "Accept", "Board"].map((step, index) => (
          <div key={step} className="flex flex-col items-center">
            {index > 0 && <ArrowDown aria-hidden="true" className="size-3.5 text-foreground" />}
            <div className="w-24 border border-foreground bg-card px-2 py-1 text-center">
              {step}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    day: "Thu",
    tool: "Ticket",
    outcome: "lost: why it mattered",
    art: (
      <div className="w-full border border-border bg-card p-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono">PRJ-112</span>
          <span className="bg-ice px-1.5 py-0.5 text-slate">To do</span>
        </div>
        <p className="mt-2 text-base font-semibold">Add sharing</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Invite by email.</p>
      </div>
    ),
  },
  {
    day: "Fri",
    tool: "Code",
    outcome: "left: a TODO",
    art: (
      <pre className="w-full overflow-hidden bg-inverse-panel p-3 font-mono text-[11px] leading-relaxed text-fog">
        <span className="text-coral">function</span> <span className="text-neon">share</span>(email){" "}
        {"{"}
        {"\n  "}invite(email);
        {"\n  "}
        <span className="text-ash">{"// TODO: roles?"}</span>
        {"\n}"}
      </pre>
    ),
  },
];

const RULES = [
  {
    title: "The board is the spec.",
    tag: "get_screen_code",
    text: "Every element carries its role, theme tokens and layout, so a screen on the board reads back as code instead of being traced from a picture.",
  },
  {
    title: "Your AI editor sits at the same table.",
    tag: "claude mcp add",
    text: "Claude Code or Codex draws on the board you have open. Its changes arrive live and undo in one step, like a teammate's.",
  },
  {
    title: "Every shape is our own.",
    tag: "react + svg",
    text: "The canvas is React and plain SVG with no drawing library underneath, so every pen stroke, arrow and sticky behaves the way we built it to.",
  },
  {
    title: "A link is enough.",
    tag: "/s/{token}",
    text: "Nothing to install. Invite editors and viewers or share a read-only link; only the owner moves or deletes a board.",
  },
];

const PARTS = [
  ["Canvas", "React and plain SVG, drawn by hand"],
  ["Live sync", "Socket.IO, one batch of changes per save; the higher version wins"],
  ["AI editors", "A remote MCP endpoint at /mcp, signed in with OAuth or a token"],
  ["Themes", "shadcn/ui color tokens, radius and fonts, light and dark"],
  ["Reads back as", "React + Tailwind, CSS variables, Flutter, Prisma, SQL, Drizzle"],
  ["Data", "Postgres for boards, any S3-compatible bucket for images"],
];

function Intro() {
  return (
    <section aria-labelledby="about-title" className="border-b border-border">
      <div className={cn(pageContainer, "py-16 md:py-24 lg:py-28")}>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <Reveal>
            <h1
              id="about-title"
              className="font-display text-[2.75rem] leading-[0.95] font-bold tracking-display text-balance text-foreground sm:text-6xl md:text-7xl xl:text-[5rem]"
            >
              We kept redrawing the same idea.
            </h1>
          </Reveal>
          <Reveal step={1} className="lg:pt-4">
            <p className="text-lg leading-normal text-foreground md:text-xl">
              Prism is a live whiteboard for teams and their AI editors. It started with a week like
              this one: one feature, drawn again in every tool, a little less of it left each time.
            </p>
          </Reveal>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 md:mt-16 lg:grid-cols-3 xl:grid-cols-5">
          {WEEK.map((item, index) => (
            <li key={item.day}>
              <Reveal step={index} className="h-full">
                <div className="flex h-full min-h-64 flex-col border border-border p-4">
                  <p className="font-mono text-xs tracking-[0.1em] text-muted-foreground uppercase">
                    {item.day} · {item.tool}
                  </p>
                  <div className="flex flex-1 items-center justify-center py-6">{item.art}</div>
                  <p className="font-hand text-2xl leading-none text-foreground">{item.outcome}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>

        <Reveal className="mt-10 md:mt-12">
          <p className="max-w-[34rem] text-lg leading-normal text-foreground md:text-xl">
            On Prism the idea is drawn once. The sticky note, the screen, the flow and the schema
            sit on one board, and the code is read from it, not retyped.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Rules() {
  return (
    <section aria-labelledby="rules-title" className="border-b border-border">
      <div
        className={cn(
          pageContainer,
          "grid gap-10 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16 lg:py-28",
        )}
      >
        <Reveal>
          <h2
            id="rules-title"
            className="font-display text-4xl leading-[1.05] font-bold tracking-display text-foreground md:text-5xl"
          >
            What we hold to
          </h2>
          <p className="mt-5 max-w-64 text-lg leading-normal text-foreground">
            Four rules decide what goes into Prism and what stays out.
          </p>
        </Reveal>
        <ul className="border-b border-border">
          {RULES.map((rule, index) => (
            <li key={rule.title} className="border-t border-border py-6">
              <Reveal step={index}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h3 className="text-xl font-semibold tracking-display text-foreground md:text-2xl">
                    {rule.title}
                  </h3>
                  <span className="font-mono text-xs text-muted-foreground">{rule.tag}</span>
                </div>
                <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
                  {rule.text}
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItsMade() {
  return (
    <section aria-labelledby="made-title" className={cn(pageContainer, "pb-16 md:pb-24 lg:pb-28")}>
      <Reveal>
        <div className="grid gap-10 bg-inverse-panel p-6 text-fog sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16 lg:p-14">
          <div>
            <h2
              id="made-title"
              className="font-display text-4xl leading-[1.05] font-bold tracking-display md:text-5xl"
            >
              How it's made
            </h2>
            <p className="mt-5 max-w-64 text-lg leading-normal text-inverse-muted">
              The parts list, for anyone curious about what sits under the board.
            </p>
          </div>
          <dl className="border-b border-fog/15">
            {PARTS.map(([term, text]) => (
              <div
                key={term}
                className="grid gap-x-8 gap-y-1 border-t border-fog/15 py-4 sm:grid-cols-[9rem_minmax(0,1fr)]"
              >
                <dt className={cn(mono, "text-ash")}>{term}</dt>
                <dd className="text-base leading-snug font-medium">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </section>
  );
}

function Founder() {
  return (
    <section aria-labelledby="founder-title" className="border-t border-border">
      <div
        className={cn(
          pageContainer,
          "grid gap-10 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16 lg:py-28",
        )}
      >
        <Reveal>
          <img
            src="/landing/avatar-fahim.png"
            alt="A drawn portrait of Fahim Ansawry"
            width={88}
            height={88}
            className="size-22 rounded-full bg-muted object-cover"
          />
          <h2 id="founder-title" className="mt-4 text-xl font-semibold">
            Fahim Ansawry
          </h2>
          <p className="text-sm text-muted-foreground">Makes Prism</p>
        </Reveal>
        <div>
          <Reveal>
            <p className="max-w-xl text-lg leading-normal text-foreground md:text-xl">
              I built Prism because the space between a whiteboard and a pull request was where my
              ideas went missing. Now the sticky note, the screen and the schema live on one board,
              and the editor that writes the code reads it directly.
            </p>
          </Reveal>
          <Reveal step={1}>
            <p className="mt-6 max-w-xl text-lg leading-normal text-foreground md:text-xl">
              It's young and it changes every week. Draw your next idea once and see how far it
              gets.
            </p>
          </Reveal>
          <Reveal step={2}>
            <p className="mt-6 font-hand text-[2.5rem] leading-none text-foreground">— Fahim</p>
          </Reveal>
          <Reveal step={3} className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link to="/signup" className={ctaVariants({ size: "lg" })}>
              Start a board
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              to="/docs/$"
              params={{ _splat: "connect-claude-code" }}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:text-ink hover:underline"
            >
              Set up your AI editor
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Intro />
        <Rules />
        <HowItsMade />
        <Founder />
      </main>
      <SiteFooter />
    </>
  );
}

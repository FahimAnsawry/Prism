import { Eye, FileCode } from "lucide-react";
import { LiveCursor } from "@/components/live-cursor";
import { cn } from "@/lib/utils";
import { InversePanel } from "./editors-section";
import { pageContainer } from "./page-container";
import { Reveal } from "./reveal";

const CODE_LINES: { text: string; color: string }[] = [
  { text: "export function SignUp() {", color: "text-coral" },
  { text: "  return (", color: "text-fog" },
  { text: '    <form className="flex w-96 flex-col gap-6 p-8">', color: "text-ice" },
  { text: '      <h1 className="text-h3">Create your account</h1>', color: "text-ice" },
  { text: '      <Field label="Name" autoComplete="name" />', color: "text-lime" },
  { text: '      <Field label="Email" type="email" />', color: "text-lime" },
  { text: "      <PasswordField meter />", color: "text-lime" },
  { text: '      <Button className="w-full">Create account</Button>', color: "text-ice" },
  { text: "    </form>", color: "text-ice" },
  { text: "  );", color: "text-fog" },
  { text: "}", color: "text-coral" },
];

const FORMATS = [
  "React + Tailwind",
  "CSS variables",
  "Flutter",
  "Prisma",
  "Postgres SQL",
  "Drizzle",
];

/** A field in the mocked gym app (its own light design, the same in both themes). */
function MockField({ label, value, aside }: { label: string; value: string; aside?: boolean }) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 flex h-11 items-center justify-between rounded-[8px] border border-[#c9c9cf] px-3 text-base">
        {value}
        {aside && <Eye className="size-[18px] text-graphite" />}
      </p>
    </div>
  );
}

/** A mobile sign-up frame on a dotted board, with Claude's cursor on it. */
function BoardFrame() {
  return (
    <div
      role="img"
      aria-label="A mobile sign-up screen on a Prism board: name, email, a password with a strength meter and a Create account button. Claude's cursor sits on the card."
      className="dot-grid relative w-full max-w-135 border border-border px-4 py-16 sm:px-6 sm:py-[92px]"
    >
      <p className="absolute top-5 left-4 font-mono text-xs text-muted-foreground sm:top-14 sm:left-6">
        Sign up · mobile
      </p>
      {/* Centered in the frame; Claude's cursor hangs off the card's right edge */}
      <div className="relative mx-auto max-w-95">
        <div className="rounded-[12px] bg-white p-6 text-[#1f1d2b] sm:p-8 shadow-[0_16px_32px_-12px_rgb(61_59_80/0.25)] dark:shadow-[0_16px_32px_-12px_rgb(0_0_0/0.6)]">
          <p className="text-2xl leading-[1.2] font-semibold">Create your account</p>
          <p className="mt-2 text-sm text-graphite">Book classes and pay at the door.</p>
          <div className="mt-6 space-y-5">
            <MockField label="Name" value="Maya Okafor" />
            <MockField label="Email" value="maya@harborgym.co" />
            <div>
              <MockField label="Password" value="••••••••••••" aside />
              <div className="mt-2 flex items-center gap-1">
                <span className="h-1 flex-1 bg-[#1fa874]" />
                <span className="h-1 flex-1 bg-[#1fa874]" />
                <span className="h-1 flex-1 bg-[#1fa874]" />
                <span className="h-1 flex-1 bg-silver" />
                <span className="ml-1 text-xs font-medium text-graphite">Strong</span>
              </div>
            </div>
          </div>
          <p className="mt-6 flex h-11 items-center justify-center rounded-[8px] bg-slate text-base font-semibold text-fog">
            Create account
          </p>
          <p className="mt-6 text-center text-sm text-graphite">
            Already a member? <span className="font-semibold text-[#1f1d2b]">Log in</span>
          </p>
        </div>
        <LiveCursor
          name="Claude"
          tone="onyx"
          className="absolute top-[33px] left-[calc(100%-38px)] max-sm:hidden"
        />
      </div>
    </div>
  );
}

export function SpecSection() {
  return (
    <section id="code" aria-labelledby="spec-title" className="border-b border-border">
      <div className={cn(pageContainer, "py-16 md:py-24 lg:py-32")}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <Reveal>
            <h2
              id="spec-title"
              className="font-display text-[2.5rem] leading-[1.05] font-bold tracking-display text-foreground sm:text-5xl"
            >
              The board is the spec,
              <br className="max-sm:hidden" /> not a picture of one.
            </h2>
          </Reveal>
          <Reveal step={1}>
            <p className="max-w-140 text-lg leading-normal text-foreground md:text-xl">
              Every element carries a role, its theme tokens and its layout. get_screen_code reads a
              frame back as a nested tree, so your editor builds the real page in your framework,
              with your theme's classes.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 flex flex-col items-center gap-8 md:mt-16 lg:mt-24 lg:flex-row lg:justify-between lg:gap-2.5">
          <Reveal className="w-full max-w-135">
            <BoardFrame />
          </Reveal>
          <Reveal step={1} className="shrink-0">
            <div aria-hidden="true" className="flex flex-col items-center gap-2">
              <p className="font-hand text-2xl leading-[1.1] text-foreground">get_screen_code</p>
              <svg viewBox="0 0 96 24" className="h-6 w-24 stroke-foreground max-lg:rotate-90">
                <path d="M4 12H86" strokeWidth="2" strokeDasharray="6 5" />
                <path d="M82 5 92 12 82 19" fill="none" strokeWidth="2" />
              </svg>
            </div>
          </Reveal>
          <Reveal step={2} className="w-full max-w-145 min-w-0">
            <InversePanel icon={<FileCode aria-hidden="true" />} title="src/routes/sign-up.tsx">
              <pre className="overflow-x-auto font-mono text-sm leading-6">
                <code>
                  {CODE_LINES.map((line, i) => (
                    <span key={i} className={cn("block", line.color)}>
                      {line.text}
                    </span>
                  ))}
                </code>
              </pre>
            </InversePanel>
          </Reveal>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3 md:mt-16">
          <Reveal>
            <p className="text-sm text-muted-foreground">Reads back as</p>
          </Reveal>
          <ul className="flex flex-wrap gap-3">
            {FORMATS.map((format, i) => (
              <li key={format}>
                <Reveal step={i + 1}>
                  <span className="block rounded-hairline border border-divider bg-card px-2.5 py-1.5 font-mono text-xs text-foreground">
                    {format}
                  </span>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

import { Check, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";
import { Reveal } from "./reveal";

/** The server's remote MCP endpoint, so the commands work as pasted. */
const MCP_URL = new URL("/mcp", import.meta.env.VITE_SERVER_URL).toString();

const COMMANDS = [
  { editor: "Claude Code", command: `claude mcp add --transport http prism ${MCP_URL}` },
  { editor: "Codex", command: `codex mcp add prism --url ${MCP_URL}` },
];

const TOOL_CALLS = [
  { tool: "get_design_guide", result: "surface: mobile" },
  { tool: "get_theme", result: "Harbor Gym · 24 tokens" },
  { tool: "create_screen", result: "1 frame · 41 elements · 0 warnings" },
  { tool: "export_image", result: "checked at 390 × 844" },
];

/** A dark title-barred panel (terminal, code file) as drawn on the board. */
export function InversePanel({
  icon,
  title,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("bg-inverse pt-3.5 pb-6 text-fog", className)}>
      <p className="flex items-center gap-2 px-6 font-mono text-xs text-ash [&_svg]:size-4">
        {icon}
        {title}
      </p>
      <div className="mt-3.5 border-t border-fog/15 px-6 pt-6">{children}</div>
    </div>
  );
}

export function EditorsSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="editors-title"
      className="scroll-mt-24 border-b border-border"
    >
      <div
        className={cn(
          pageContainer,
          "grid grid-cols-[minmax(0,1fr)] items-start gap-12 py-16 md:gap-16 md:py-24 lg:grid-cols-[600fr_616fr] lg:py-32",
        )}
      >
        <div>
          <Reveal>
            <h2
              id="editors-title"
              className="font-display text-[2.5rem] leading-[1.05] font-bold tracking-display text-foreground sm:text-5xl"
            >
              Your AI editor draws
              <br className="max-sm:hidden" /> on the same board.
            </h2>
          </Reveal>
          <Reveal step={1}>
            <p className="mt-6 max-w-145 text-lg leading-normal text-foreground md:text-xl">
              Add Prism to Claude Code or Codex in one line, then sign in through your browser. Ask
              for a screen, a flow or a schema, and it lands on the board you have open, as one step
              you can undo.
            </p>
          </Reveal>

          <div className="mt-10 space-y-6 md:mt-14">
            {COMMANDS.map(({ editor, command }, i) => (
              <Reveal key={editor} step={i + 2}>
                <h3 className="font-mono text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase">
                  {editor}
                </h3>
                {/* Wraps at the spaces instead of scrolling sideways; break-words only splits a word
                    (a very long URL) that can't fit on a line by itself. */}
                <p className="mt-2 flex gap-2 bg-inverse px-4 py-3.5 font-mono text-xs leading-relaxed text-fog">
                  <span aria-hidden="true" className="text-brand">
                    $
                  </span>
                  <code className="min-w-0 break-words">{command}</code>
                </p>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal step={2}>
          <InversePanel icon={<Terminal aria-hidden="true" />} title="claude · ~/gym-app">
            <p className="font-mono text-sm text-neon">
              &gt; design the sign-up screen for the gym app
            </p>
            <ul className="mt-5 space-y-3 font-mono text-xs">
              {TOOL_CALLS.map(({ tool, result }) => (
                <li key={tool} className="flex justify-between gap-4">
                  <span className="flex items-center gap-2.5">
                    <Check aria-hidden="true" className="size-3.5 shrink-0 text-brand" />
                    {tool}
                  </span>
                  <span className="text-right text-ash">{result}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-fog/15 pt-5 text-base leading-normal">
              Done. The sign-up frame is on your Harbor Gym board: name, email, a password with a
              strength meter and one Create account button. One undo takes the whole screen back.
            </p>
          </InversePanel>
        </Reveal>
      </div>
    </section>
  );
}

import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";

const TOOL_CALLS = [
  { tool: "create_screen", detail: "frame: Auth, 14 elements" },
  { tool: "update_elements", detail: "3 elements" },
  { tool: "export_image", detail: "Auth.png" },
];

export function ClaudeSection() {
  return (
    <section
      id="claude"
      aria-labelledby="claude-title"
      className="bg-onyx [--focus-ring:var(--color-fog)]"
    >
      <div
        className={cn(
          pageContainer,
          "grid gap-12 py-16 lg:grid-cols-[1fr_40rem] lg:items-stretch lg:gap-20",
        )}
      >
        <div className="flex flex-col items-start">
          <h2
            id="claude-title"
            className="max-w-[33rem] font-display text-[2.5rem] leading-[0.95] font-bold tracking-display text-fog md:text-5xl lg:text-[3.375rem] lg:leading-[0.9]"
          >
            Claude draws with you.
          </h2>
          <p className="mt-8 max-w-[32rem] text-lg leading-[1.45] tracking-body text-silver lg:mt-auto lg:text-xl">
            Connect Claude Code through the Prism MCP bridge. Ask for a flowchart, a wireframe or a
            cleanup, and watch it edit the same board in real time. One request is one undo step.
          </p>
          <p className="mt-8 inline-flex h-8 items-center bg-neon px-4 font-mono text-xs font-bold tracking-[0.08em] text-slate uppercase lg:mt-10">
            Coming soon
          </p>
        </div>

        <figure
          aria-label="Example Claude Code session using the Prism MCP bridge"
          className="m-0 flex min-h-[22rem] flex-col bg-slate font-mono text-[13px] sm:text-[15px]"
        >
          <figcaption className="flex h-10 items-center justify-center bg-graphite px-4 text-xs tracking-[0.08em] text-fog uppercase">
            Claude Code
            <span aria-hidden="true" className="mx-3">
              ·
            </span>
            MCP: Prism
          </figcaption>
          <div className="flex flex-1 flex-col px-6 py-8 sm:px-9">
            <p className="text-silver">&gt; wireframe a login page in the Auth frame</p>
            <dl className="mt-10 grid gap-x-6 gap-y-4 sm:grid-cols-[10.5rem_1fr]">
              {TOOL_CALLS.map((call) => (
                <div key={call.tool} className="contents">
                  <dt className="text-neon">{call.tool}</dt>
                  <dd className="text-silver max-sm:-mt-3">{call.detail}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-auto pt-10 text-brand">
              Done. Split login with Google, GitHub, email.
            </p>
          </div>
        </figure>
      </div>
    </section>
  );
}

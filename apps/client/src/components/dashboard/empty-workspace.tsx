import { FolderPlus, Plus, Sparkles, Link2 } from "lucide-react";
import { PrismMark } from "@/components/prism-logo";
import { CLAUDE_COMMAND, CODEX_COMMAND } from "@/lib/ai";
import { outlineButton } from "./dashboard-styles";
import { InviteLinkForm } from "./invite-link-form";
import type { CreateKind } from "./item-dialog";

/** A board in miniature: a sticky note, a screen and a phone joined by dashed lines. */
function FirstBoardSketch() {
  return (
    <div
      aria-hidden="true"
      className="flex h-[180px] items-center justify-center gap-0 border-b border-divider bg-background bg-[radial-gradient(var(--color-divider)_1.2px,transparent_1.2px)] bg-size-[14px_14px] sm:h-[230px]"
    >
      <div className="hidden w-24 flex-col gap-2 bg-lime p-3 sm:flex">
        <span className="h-1 w-14 bg-slate" />
        <span className="h-1 w-16 bg-slate" />
        <span className="h-1 w-10 bg-slate" />
      </div>
      <span className="hidden w-6 border-t-2 border-dashed border-input sm:block" />
      <div className="relative w-[min(16rem,60vw)] border border-input bg-card">
        <div className="h-4 border-b border-divider bg-background" />
        <div className="flex flex-col gap-2 p-3">
          <span className="h-2 w-3/5 bg-divider" />
          <span className="h-2 w-2/5 bg-divider" />
          <span className="mt-1 h-3.5 w-16 bg-brand" />
          <div className="mt-1 flex gap-2">
            <span className="h-9 flex-1 border border-divider bg-background" />
            <span className="h-9 flex-1 border border-divider bg-background" />
          </div>
        </div>
        <PrismMark className="absolute top-1/2 right-4 size-12 -translate-y-1/2 fill-ink" />
      </div>
      <span className="w-6 border-t-2 border-dashed border-input" />
      <div className="flex w-16 flex-col gap-1.5 border-2 border-dashed border-input bg-card p-2">
        <span className="h-1 w-8 bg-divider" />
        <span className="h-4 bg-ice" />
        <span className="h-1 w-10 bg-divider" />
        <span className="h-1 w-7 bg-divider" />
        <span className="mt-2 h-2 bg-brand" />
      </div>
    </div>
  );
}

/** First run: nothing in the workspace yet, and nothing shared. */
export function EmptyWorkspace({
  onCreate,
  onConnectAi,
}: {
  onCreate: (kind: CreateKind) => void;
  onConnectAi: () => void;
}) {
  return (
    <div className="mt-8">
      <section
        aria-labelledby="empty-workspace-title"
        className="border border-divider bg-card text-center"
      >
        <FirstBoardSketch />
        <div className="px-6 pt-8 pb-10">
          <h2
            id="empty-workspace-title"
            className="font-display text-[26px] leading-8 font-bold tracking-[-0.02em] text-ink"
          >
            Your first board starts here
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Boards are open whiteboards for UI references, wireframes and diagrams. Draw one
            yourself, or let an AI editor draw it while you watch.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onCreate("whiteboard")}
              className="inline-flex h-[42px] items-center gap-2 bg-brand px-5 text-[13px] font-bold text-slate transition-colors duration-150 ease-standard hover:bg-brand/80 max-sm:w-full max-sm:justify-center [&_svg]:size-4"
            >
              <Plus aria-hidden="true" strokeWidth={2.5} />
              New whiteboard
            </button>
            <button
              type="button"
              onClick={() => onCreate("project")}
              className={`${outlineButton} h-[42px] max-sm:w-full`}
            >
              <FolderPlus aria-hidden="true" />
              New project
            </button>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="flex flex-col border border-divider bg-card p-5">
          <h2 className="flex items-center gap-3 text-[15px] font-bold text-foreground">
            <span className="flex size-8 items-center justify-center bg-seafoam text-slate">
              <Sparkles aria-hidden="true" className="size-4" />
            </span>
            Let an AI editor draw it
          </h2>
          <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
            Add Prism to Claude Code or Codex once, then ask for a screen. It appears on your board
            as it is drawn.
          </p>
          <pre className="mt-4 bg-slate break-all whitespace-pre-wrap px-4 py-3 font-mono text-2xs leading-5 text-fog dark:bg-black/40">
            {CLAUDE_COMMAND}
            {"\n"}
            {CODEX_COMMAND}
          </pre>
          <button
            type="button"
            onClick={onConnectAi}
            className="mt-3 self-start text-[13px] font-bold text-foreground underline-offset-4 hover:underline"
          >
            More ways to connect →
          </button>
        </section>
        <section className="border border-divider bg-card p-5">
          <h2 className="flex items-center gap-3 text-[15px] font-bold text-foreground">
            <span className="flex size-8 items-center justify-center bg-lime text-slate">
              <Link2 aria-hidden="true" className="size-4" />
            </span>
            Have an invite link?
          </h2>
          <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
            Paste it to join a board or project someone shared with you. It will show up under
            Shared with you.
          </p>
          <InviteLinkForm className="mt-4" />
        </section>
      </div>
    </div>
  );
}

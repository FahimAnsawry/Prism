import type { BoardSummary } from "@prism/shared";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Grid2x2,
  Minus,
  Plus,
  Redo2,
  Share2,
  Sparkles,
  Undo2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { BoardTitle } from "./board-title";
import type { SaveStatus } from "./board-sync";

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Saving…",
  saving: "Saving…",
  error: "Couldn't save · retrying",
};

const iconButton =
  "flex size-8 items-center justify-center transition-colors duration-150 ease-standard hover:bg-background disabled:pointer-events-none";

export function BoardTopBar({
  board,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  grid,
  onToggleGrid,
  zoom,
  onZoomOut,
  onZoomIn,
  onZoomReset,
  onShowShortcuts,
}: {
  /** Undefined while it loads. */
  board: BoardSummary | undefined;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveStatus: SaveStatus;
  grid: boolean;
  onToggleGrid: () => void;
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomReset: () => void;
  onShowShortcuts: () => void;
}) {
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-divider bg-card pr-4 pl-4 md:pr-6">
      <div className="flex min-w-0 items-center">
        <Link
          to="/dashboard"
          aria-label="Back to dashboard"
          className={cn(iconButton, "text-foreground")}
        >
          <ArrowLeft aria-hidden="true" className="size-[18px]" />
        </Link>
        <BoardTitle board={board} />
        <div className="ml-6 flex shrink-0 gap-1">
          <button
            type="button"
            aria-label="Undo (Ctrl+Z)"
            title="Undo · Ctrl+Z"
            disabled={!canUndo}
            onClick={onUndo}
            className={cn(iconButton, "text-muted-foreground disabled:text-input")}
          >
            <Undo2 aria-hidden="true" className="size-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Redo (Ctrl+Shift+Z)"
            title="Redo · Ctrl+Shift+Z"
            disabled={!canRedo}
            onClick={onRedo}
            className={cn(iconButton, "text-muted-foreground disabled:text-input")}
          >
            <Redo2 aria-hidden="true" className="size-[18px]" />
          </button>
        </div>
        <p
          role="status"
          className={cn(
            "ml-3 hidden font-mono text-3xs whitespace-nowrap uppercase lg:block",
            saveStatus === "error" ? "text-coral" : "text-muted-foreground",
          )}
        >
          {SAVE_LABELS[saveStatus]}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label="Dot grid"
          aria-pressed={grid}
          title="Dot grid"
          onClick={onToggleGrid}
          className={cn(
            "hidden size-9 items-center justify-center border border-chrome text-foreground transition-colors duration-150 ease-standard md:flex",
            grid
              ? "bg-card hover:bg-background"
              : "bg-background text-muted-foreground hover:bg-divider",
          )}
        >
          <Grid2x2 aria-hidden="true" className="size-[18px]" />
        </button>

        <div className="hidden h-9 items-stretch border border-chrome bg-card text-foreground md:flex">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={onZoomOut}
            className="flex w-9 items-center justify-center hover:bg-background"
          >
            <Minus aria-hidden="true" className="size-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Reset zoom to 100%"
            title="Reset to 100%"
            onClick={onZoomReset}
            className="w-20 font-mono text-xs tabular-nums hover:bg-background"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={onZoomIn}
            className="flex w-9 items-center justify-center hover:bg-background"
          >
            <Plus aria-hidden="true" className="size-[18px]" />
          </button>
        </div>

        {/* Shortcuts are for a keyboard and mouse, so phones don't get the button. */}
        <button
          type="button"
          aria-label="Keyboard shortcuts (?)"
          aria-haspopup="dialog"
          title="Keyboard shortcuts · ?"
          onClick={onShowShortcuts}
          className="hidden size-9 items-center justify-center border border-chrome bg-card font-mono text-sm font-bold text-foreground transition-colors duration-150 ease-standard hover:bg-background sm:flex"
        >
          ?
        </button>

        <ThemeToggle className="size-9 border border-chrome bg-card" />

        {/* AI, Export and Share are visual only until "Ask Claude", exports and rooms exist. */}
        <button
          type="button"
          title="Ask Claude about the selection"
          className="flex h-9 w-16 items-center justify-center gap-1.5 bg-seafoam font-mono text-xs font-bold text-slate transition-colors duration-150 ease-standard hover:bg-sage"
        >
          <Sparkles aria-hidden="true" className="size-4" />
          AI
        </button>

        <button
          type="button"
          className="hidden h-9 w-24 items-center justify-center gap-1 border border-chrome bg-card font-mono text-xs text-foreground transition-colors duration-150 ease-standard hover:bg-background sm:flex"
        >
          <Download aria-hidden="true" className="size-4" />
          Export
          <ChevronDown aria-hidden="true" className="size-3.5" />
        </button>

        <button
          type="button"
          aria-label="Share"
          className="flex h-9 w-9 items-center justify-center gap-1.5 bg-brand font-mono text-xs font-bold text-onyx transition-colors duration-150 ease-standard hover:bg-brand/80 sm:w-[88px]"
        >
          <Share2 aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>
    </header>
  );
}

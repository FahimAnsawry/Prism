import { Menu } from "@base-ui/react/menu";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { popupMotion, usePopupExit } from "@/components/popup-motion";
import { TurningChevron } from "@/components/motion-parts";
import type { BoardSummary } from "@prism/shared";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  Eye,
  Grid2x2,
  Hand,
  Minus,
  MousePointer2,
  Pencil,
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

/** Edit changes the board; View only looks at it (an ER diagram opens as its focus view). */
export type BoardMode = "edit" | "view";
/** What a left drag does in View mode on a board that isn't an ER diagram. */
export type ViewTool = "select" | "hand";

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  unsaved: "Saving…",
  saving: "Saving…",
  error: "Couldn't save · retrying",
};

const MODES = [
  { id: "edit", label: "Edit", hint: "Change the board", Icon: Pencil },
  { id: "view", label: "View", hint: "Look around, read only", Icon: Eye },
] as const;

/** The Edit / View switch: a dropdown showing the current mode. */
export function ModeMenu({
  mode,
  onChange,
}: {
  mode: BoardMode;
  onChange: (mode: BoardMode) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { actionsRef, onExitComplete } = usePopupExit(menuOpen);
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];
  return (
    <Menu.Root open={menuOpen} onOpenChange={setMenuOpen} actionsRef={actionsRef}>
      <Menu.Trigger
        aria-label={`Mode: ${current.label}`}
        className="flex h-9 items-center gap-2 border border-chrome bg-card px-3 text-xs font-medium text-foreground select-none transition-colors duration-150 ease-standard hover:bg-hover data-popup-open:bg-hover"
      >
        <current.Icon aria-hidden="true" className="size-3.5" />
        {current.label}
        <TurningChevron turned={menuOpen} className="size-3.5" />
      </Menu.Trigger>
      <AnimatePresence>
        {menuOpen && (
          <Menu.Portal keepMounted>
            <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50 outline-none">
              <Menu.Popup
                className="w-56 origin-(--transform-origin) border border-input bg-popover shadow-lg p-1 outline-none"
                render={<motion.div {...popupMotion} onAnimationComplete={onExitComplete} />}
              >
                <Menu.RadioGroup value={mode} onValueChange={(next: BoardMode) => onChange(next)}>
                  {MODES.map(({ id, label, hint, Icon }) => (
                    <Menu.RadioItem
                      key={id}
                      value={id}
                      closeOnClick
                      className="grid h-11 cursor-default grid-cols-[1rem_1fr_1rem] items-center gap-2 px-2.5 text-[13px] text-foreground outline-none select-none data-checked:font-bold data-highlighted:bg-seafoam dark:data-highlighted:bg-seafoam/12"
                    >
                      <Icon aria-hidden="true" className="size-3.5" />
                      <span className="min-w-0">
                        <span className="block leading-4">{label}</span>
                        <span className="block text-3xs leading-4 font-normal text-muted-foreground">
                          {hint}
                        </span>
                      </span>
                      <Menu.RadioItemIndicator>
                        <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                      </Menu.RadioItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        )}
      </AnimatePresence>
    </Menu.Root>
  );
}

const iconButton =
  "flex size-8 items-center justify-center transition-colors duration-150 ease-standard hover:bg-hover disabled:pointer-events-none";

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
  onShare,
  mode,
  onModeChange,
  viewTool,
  onViewTool,
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
  /** Opens the Share dialog; only the owner gets it. Others see who shared the board. */
  onShare: (() => void) | undefined;
  mode: BoardMode;
  onModeChange: (mode: BoardMode) => void;
  /** The pointer tool View mode shows; undefined when there's none to pick (an ER diagram). */
  viewTool: ViewTool | undefined;
  onViewTool: (tool: ViewTool) => void;
}) {
  const viewing = mode === "view";
  const canvasControls = !viewing || viewTool !== undefined;
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
        {!viewing && (
          <>
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
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <ModeMenu mode={mode} onChange={onModeChange} />

        {viewing && viewTool && (
          <div className="flex h-9 items-stretch border border-chrome bg-card text-foreground">
            <button
              type="button"
              aria-label="Select / Inspect (V)"
              title="Select · V"
              onClick={() => onViewTool("select")}
              className={cn(
                "flex w-9 items-center justify-center transition-colors duration-150 ease-standard hover:bg-hover",
                viewTool === "select" && "bg-background text-ink",
              )}
            >
              <MousePointer2 aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Hand / Pan (H)"
              title="Pan · H"
              onClick={() => onViewTool("hand")}
              className={cn(
                "flex w-9 items-center justify-center border-l border-chrome transition-colors duration-150 ease-standard hover:bg-hover",
                viewTool === "hand" && "bg-background text-ink",
              )}
            >
              <Hand aria-hidden="true" className="size-4" />
            </button>
          </div>
        )}

        {/* An ER diagram in View mode is the focus view, which has its own zoom. */}
        {canvasControls && (
          <>
            <button
              type="button"
              aria-label="Dot grid"
              aria-pressed={grid}
              title="Dot grid"
              onClick={onToggleGrid}
              className={cn(
                "hidden size-9 items-center justify-center border border-chrome text-foreground transition-colors duration-150 ease-standard md:flex",
                grid
                  ? "bg-card hover:bg-hover"
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
                className="flex w-9 items-center justify-center hover:bg-hover"
              >
                <Minus aria-hidden="true" className="size-[18px]" />
              </button>
              <button
                type="button"
                aria-label="Reset zoom to 100%"
                title="Reset to 100%"
                onClick={onZoomReset}
                className="w-20 font-mono text-xs tabular-nums hover:bg-hover"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={onZoomIn}
                className="flex w-9 items-center justify-center hover:bg-hover"
              >
                <Plus aria-hidden="true" className="size-[18px]" />
              </button>
            </div>
          </>
        )}

        {/* Shortcuts are for a keyboard and mouse, so phones don't get the button. */}
        <button
          type="button"
          aria-label="Keyboard shortcuts (?)"
          aria-haspopup="dialog"
          title="Keyboard shortcuts · ?"
          onClick={onShowShortcuts}
          className="hidden size-9 items-center justify-center border border-chrome bg-card font-mono text-sm font-bold text-foreground transition-colors duration-150 ease-standard hover:bg-hover sm:flex"
        >
          ?
        </button>

        <ThemeToggle className="size-9 border border-chrome bg-card" />

        {/* AI and Export are visual only until "Ask Claude" and exports exist. */}
        {!viewing && (
          <button
            type="button"
            title="Ask Claude about the selection"
            className="flex h-9 w-16 items-center justify-center gap-1.5 bg-seafoam font-mono text-xs font-bold text-slate transition-colors duration-150 ease-standard hover:bg-sage"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            AI
          </button>
        )}

        <button
          type="button"
          className="hidden h-9 w-24 items-center justify-center gap-1 border border-chrome bg-card font-mono text-xs text-foreground transition-colors duration-150 ease-standard hover:bg-hover sm:flex"
        >
          <Download aria-hidden="true" className="size-4" />
          Export
          <ChevronDown aria-hidden="true" className="size-3.5" />
        </button>

        <ShareControl board={board} onShare={onShare} />
      </div>
    </header>
  );
}

/** The Share button for the owner; everyone else sees who shared the board. */
export function ShareControl({
  board,
  onShare,
}: {
  board: BoardSummary | undefined;
  onShare: (() => void) | undefined;
}) {
  if (onShare) {
    return (
      <button
        type="button"
        aria-label="Share"
        aria-haspopup="dialog"
        onClick={onShare}
        className="flex h-9 w-9 items-center justify-center gap-1.5 bg-brand font-mono text-xs font-bold text-onyx transition-colors duration-150 ease-standard hover:bg-brand/80 sm:w-[88px]"
      >
        <Share2 aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Share</span>
      </button>
    );
  }
  return (
    board && (
      <p
        title={`Shared with you by ${board.ownerName}`}
        className="hidden h-9 max-w-40 items-center gap-1.5 border border-chrome px-3 font-mono text-3xs font-bold text-muted-foreground uppercase sm:flex"
      >
        <Share2 aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{board.ownerName}</span>
      </p>
    )
  );
}

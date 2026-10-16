import { Menu } from "@base-ui/react/menu";
import type { BoardElement } from "@prism/shared";
import { Check, Download, FileText, ImageIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { popupMotion, usePopupExit } from "@/components/popup-motion";
import { TurningChevron } from "@/components/motion-parts";
import { cn } from "@/lib/utils";
import { BoardExportError, type ExportFormat, exportBoard, type ImageScale } from "./board-export";
import { type ExportJob, ExportOverlay } from "./export-overlay";

type Scope = "selection" | "board";

const FORMATS = [
  { id: "png", label: "PNG", hint: (scale: ImageScale) => `Image at ${scale}x`, Icon: ImageIcon },
  {
    id: "jpg",
    label: "JPG",
    hint: (scale: ImageScale) => `Image at ${scale}x · smaller, faster`,
    Icon: ImageIcon,
  },
  { id: "pdf", label: "PDF", hint: () => "One page per frame", Icon: FileText },
] as const;

const SCALES: ImageScale[] = [1, 2, 4];
const SCALE_KEY = "prism:export-scale";

function savedScale(): ImageScale {
  try {
    const saved = Number(localStorage.getItem(SCALE_KEY));
    return SCALES.find((scale) => scale === saved) ?? 2;
  } catch {
    return 2;
  }
}

const itemClass =
  "grid h-11 cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-2.5 text-[13px] text-foreground outline-none select-none data-disabled:opacity-50 data-highlighted:bg-seafoam dark:data-highlighted:bg-seafoam/12";

/** The Export dropdown: the selection or the whole board as PNG, JPG or PDF. */
export function ExportMenu({
  elements,
  selectedIds,
  boardName,
  className,
}: {
  elements: BoardElement[];
  selectedIds: string[];
  /** Names the files. */
  boardName: string;
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { actionsRef, onExitComplete } = usePopupExit(menuOpen);
  const [scope, setScope] = useState<Scope>("board");
  const [scale, setScale] = useState<ImageScale>(savedScale);
  const [job, setJob] = useState<ExportJob | null>(null);
  /** The last export asked for, so "Try again" repeats it exactly. */
  const lastRun = useRef<{ format: ExportFormat; ids: string[] | null } | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  /** Stops the running export (Cancel, or leaving the board). */
  const running = useRef<AbortController | null>(null);
  const busy = job?.phase === "working";
  const hasSelection = selectedIds.length > 0;
  const chosen: Scope = hasSelection ? scope : "board";

  useEffect(
    () => () => {
      window.clearTimeout(hideTimer.current);
      running.current?.abort();
    },
    [],
  );

  const open = (next: boolean) => {
    if (next) setScope(hasSelection ? "selection" : "board");
    setMenuOpen(next);
  };

  const run = async (format: ExportFormat, ids: string[] | null) => {
    if (busy) return;
    lastRun.current = { format, ids };
    window.clearTimeout(hideTimer.current);
    setMenuOpen(false);
    const { label, Icon } = FORMATS.find((entry) => entry.id === format)!;
    const what = ids ? `${ids.length} selected` : "Whole board";
    const how = format === "pdf" ? "One page per frame" : `${scale}x`;
    setJob({
      label,
      Icon,
      detail: `${what} · ${how}`,
      startedAt: Date.now(),
      progress: null,
      phase: "working",
      error: null,
    });
    const controller = new AbortController();
    running.current = controller;
    const { signal } = controller;
    try {
      await exportBoard(elements, ids, format, boardName, {
        scale,
        signal,
        onProgress: (progress) => {
          if (!signal.aborted) setJob((current) => current && { ...current, progress });
        },
      });
      setJob((current) => current && { ...current, phase: "done" });
      hideTimer.current = window.setTimeout(() => setJob(null), 900);
    } catch (failure) {
      // Cancelled: the progress screen is already gone.
      if (signal.aborted) return;
      if (!(failure instanceof BoardExportError)) console.error("[Prism] Export failed:", failure);
      const error =
        failure instanceof BoardExportError
          ? failure.message
          : "The export didn't work. Try a smaller area or a lower image size.";
      setJob((current) => ({
        ...(current ?? {
          label,
          Icon,
          detail: what,
          startedAt: Date.now(),
          progress: null,
        }),
        phase: "failed",
        error,
      }));
    } finally {
      if (running.current === controller) running.current = null;
    }
  };

  const closeJob = useCallback(() => setJob(null), []);
  const cancel = useCallback(() => {
    running.current?.abort();
    running.current = null;
    setJob(null);
  }, []);
  const retry = () => {
    if (lastRun.current) void run(lastRun.current.format, lastRun.current.ids);
  };

  return (
    <>
      <ExportOverlay job={job} onClose={closeJob} onRetry={retry} onCancel={cancel} />
      <Menu.Root open={menuOpen} onOpenChange={open} actionsRef={actionsRef}>
        <Menu.Trigger
          className={cn(
            "h-9 items-center justify-center gap-1 border border-chrome bg-card px-3 font-mono text-xs text-foreground select-none transition-colors duration-150 ease-standard hover:bg-hover data-popup-open:bg-hover",
            className,
          )}
        >
          <Download aria-hidden="true" className="size-4" />
          Export
          <TurningChevron turned={menuOpen} className="size-3.5" />
        </Menu.Trigger>
        <AnimatePresence>
          {menuOpen && (
            <Menu.Portal keepMounted>
              <Menu.Positioner
                side="bottom"
                align="end"
                sideOffset={6}
                className="z-50 outline-none"
              >
                <Menu.Popup
                  className="w-64 origin-(--transform-origin) border border-input bg-popover p-1 shadow-lg outline-none"
                  render={<motion.div {...popupMotion} onAnimationComplete={onExitComplete} />}
                >
                  <Menu.Group>
                    <Menu.GroupLabel className="px-2.5 pt-1.5 pb-2 font-mono text-3xs font-bold text-muted-foreground uppercase">
                      Export
                    </Menu.GroupLabel>
                    <Menu.RadioGroup value={chosen} onValueChange={(next: Scope) => setScope(next)}>
                      <Menu.RadioItem
                        value="selection"
                        disabled={!hasSelection}
                        className={cn(itemClass, "h-9")}
                      >
                        <Menu.RadioItemIndicator>
                          <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                        </Menu.RadioItemIndicator>
                        <span className="col-start-2">
                          Selection
                          {hasSelection && (
                            <span className="ml-1.5 font-mono text-3xs text-muted-foreground">
                              {selectedIds.length}
                            </span>
                          )}
                        </span>
                      </Menu.RadioItem>
                      <Menu.RadioItem value="board" className={cn(itemClass, "h-9")}>
                        <Menu.RadioItemIndicator>
                          <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                        </Menu.RadioItemIndicator>
                        <span className="col-start-2">Whole board</span>
                      </Menu.RadioItem>
                    </Menu.RadioGroup>
                  </Menu.Group>
                  <Menu.Group className="flex items-center gap-2 px-2.5 pt-1.5 pb-1">
                    <Menu.GroupLabel className="flex-1 font-mono text-3xs font-bold text-muted-foreground uppercase">
                      Image size
                    </Menu.GroupLabel>
                    <Menu.RadioGroup
                      value={scale}
                      onValueChange={(next: ImageScale) => {
                        setScale(next);
                        try {
                          localStorage.setItem(SCALE_KEY, String(next));
                        } catch {
                          // Not remembered; the choice still applies now.
                        }
                      }}
                      className="flex border border-chrome"
                    >
                      {SCALES.map((option) => (
                        <Menu.RadioItem
                          key={option}
                          value={option}
                          className="h-7 w-9 cursor-default content-center text-center font-mono text-xs text-muted-foreground outline-none select-none not-first:border-l not-first:border-chrome data-checked:bg-seafoam data-checked:text-foreground data-disabled:opacity-50 data-highlighted:bg-hover dark:data-checked:bg-seafoam/12"
                        >
                          {option}x
                        </Menu.RadioItem>
                      ))}
                    </Menu.RadioGroup>
                  </Menu.Group>
                  <Menu.Separator className="my-1 h-px bg-divider" />
                  {FORMATS.map(({ id, label, hint, Icon }) => (
                    <Menu.Item
                      key={id}
                      disabled={busy}
                      onClick={() => void run(id, chosen === "selection" ? selectedIds : null)}
                      className={itemClass}
                    >
                      <Icon aria-hidden="true" className="size-3.5" />
                      <span className="min-w-0">
                        <span className="block leading-4 font-medium">{label}</span>
                        <span className="block truncate text-3xs leading-4 text-muted-foreground">
                          {hint(scale)}
                        </span>
                      </span>
                    </Menu.Item>
                  ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          )}
        </AnimatePresence>
      </Menu.Root>
    </>
  );
}

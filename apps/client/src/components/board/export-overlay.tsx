import { Check, type LucideIcon, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { backdropMotion, popupMotion } from "@/components/popup-motion";
import { EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { ExportProgress } from "./board-export";

/** A running (or just finished) export, as the progress screen shows it. */
export interface ExportJob {
  /** "PNG", "PDF (vector)", … */
  label: string;
  Icon: LucideIcon;
  /** What's exported and how: "Whole board · 2x". */
  detail: string;
  startedAt: number;
  progress: ExportProgress | null;
  phase: "working" | "done" | "failed";
  error: string | null;
}

/** Seconds since `startedAt`, ticking while `running`. */
function useElapsed(startedAt: number, running: boolean) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [running]);
  return Math.max(0, (now - startedAt) / 1000);
}

function ExportCard({
  job,
  onClose,
  onRetry,
  onCancel,
}: {
  job: ExportJob;
  onClose: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const { Icon, progress, phase } = job;
  const elapsed = useElapsed(job.startedAt, phase === "working");
  const share =
    phase === "done" ? 1 : progress ? Math.min(1, progress.done / Math.max(1, progress.total)) : 0;
  const percent = Math.round(share * 100);
  const failed = phase === "failed";
  const step = failed
    ? job.error
    : phase === "done"
      ? "Done · your download has started"
      : (progress?.step ?? "Getting ready");

  return (
    <motion.div
      {...popupMotion}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="export-title"
      aria-describedby="export-step"
      className="w-[min(22rem,calc(100vw-2rem))] border border-chrome bg-card p-5 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center border border-chrome",
            failed ? "bg-peach/60" : "bg-seafoam",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={phase}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18, ease: EASE_STANDARD }}
            >
              {phase === "done" ? (
                <Check aria-hidden="true" className="size-4.5" strokeWidth={2.5} />
              ) : failed ? (
                <TriangleAlert aria-hidden="true" className="size-4.5 text-danger" />
              ) : (
                <Icon aria-hidden="true" className="size-4.5" />
              )}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="min-w-0 flex-1">
          <p id="export-title" className="truncate text-sm font-medium text-foreground">
            {failed
              ? "Export failed"
              : phase === "done"
                ? `${job.label} ready`
                : `Exporting ${job.label}`}
          </p>
          <p className="truncate font-mono text-2xs text-muted-foreground">{job.detail}</p>
        </div>
        {!failed && (
          <span className="font-mono text-xs text-foreground tabular-nums">{percent}%</span>
        )}
      </div>

      {!failed && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`Exporting ${job.label}`}
          className="relative mt-5 h-1.5 overflow-hidden bg-divider"
        >
          <motion.div
            className="absolute inset-y-0 left-0 bg-brand"
            initial={{ width: "0%" }}
            animate={{ width: `${Math.max(percent, 4)}%` }}
            transition={{ duration: 0.35, ease: EASE_STANDARD }}
          />
          {phase === "working" && (
            // A sheen sliding across, so a long step still looks alive (in CSS: it keeps
            // moving while the page is busy drawing).
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1/3 animate-sheen bg-linear-to-r from-transparent via-white/50 to-transparent will-change-transform"
            />
          )}
        </div>
      )}

      <div
        className={cn("flex items-baseline gap-3", failed ? "mt-3" : "mt-2.5")}
        aria-live="polite"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={step}
            id="export-step"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15, ease: EASE_STANDARD }}
            className={cn(
              "min-w-0 flex-1 text-xs",
              failed ? "text-danger" : "truncate text-muted-foreground",
            )}
          >
            {step}
          </motion.p>
        </AnimatePresence>
        {!failed && (
          <span className="font-mono text-2xs text-muted-foreground tabular-nums">
            {elapsed.toFixed(1)}s
          </span>
        )}
      </div>

      {phase === "working" && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="h-8 border border-chrome bg-card px-3 font-mono text-xs text-foreground transition-colors duration-150 ease-standard hover:bg-hover"
          >
            Cancel
          </button>
        </div>
      )}

      {failed && (
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-chrome bg-card px-3 font-mono text-xs text-foreground transition-colors duration-150 ease-standard hover:bg-hover"
          >
            Close
          </button>
          <button
            type="button"
            autoFocus
            onClick={onRetry}
            className="h-8 border border-ink bg-ink px-3 font-mono text-xs text-background transition-opacity duration-150 ease-standard hover:opacity-85"
          >
            Try again
          </button>
        </div>
      )}
    </motion.div>
  );
}

/**
 * The full-page progress screen of an export: what's being made, the current step, a progress
 * bar and the time so far. The page underneath can't be used until the export ends.
 */
export function ExportOverlay({
  job,
  onClose,
  onRetry,
  onCancel,
}: {
  job: ExportJob | null;
  onClose: () => void;
  onRetry: () => void;
  /** Stops the running export; nothing is saved. */
  onCancel: () => void;
}) {
  // Escape cancels a running export, or closes the error.
  const phase = job?.phase;
  useEffect(() => {
    if (phase !== "failed" && phase !== "working") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (phase === "working") onCancel();
      else onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, onClose, onCancel]);

  return createPortal(
    <AnimatePresence>
      {job && (
        <motion.div
          key="export-overlay"
          {...backdropMotion}
          className="fixed inset-0 z-100 grid place-items-center bg-background/70 px-4 backdrop-blur-sm"
        >
          <ExportCard job={job} onClose={onClose} onRetry={onRetry} onCancel={onCancel} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

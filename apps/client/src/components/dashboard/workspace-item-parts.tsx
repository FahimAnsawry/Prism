import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { exactTime, shownDate, timeAgo, type SortKey, type WorkspaceItem } from "./workspace-data";

// Pieces shared by the grid card and the list row.

/**
 * A board's dotted canvas, marked "EMPTY" when nothing is on it yet. `children` (the drawn
 * preview) sit on top of the dots.
 */
export function CanvasPreview({
  empty = false,
  className,
  children,
}: {
  empty?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-background bg-[radial-gradient(var(--color-divider)_1.2px,transparent_1.2px)] bg-size-[14px_14px]",
        className,
      )}
    >
      {empty && (
        <span className="border border-divider bg-card px-2 py-0.5 font-mono text-3xs text-muted-foreground">
          EMPTY
        </span>
      )}
      {children}
    </div>
  );
}

export function KindBadge({
  kind,
  className,
}: {
  kind: WorkspaceItem["kind"];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center px-[15px] font-mono text-3xs leading-none font-bold text-slate",
        kind === "project" ? "bg-lime" : "bg-ice",
        className,
      )}
    >
      {kind === "project" ? "PROJECT" : "BOARD"}
    </span>
  );
}

export function ItemDate({
  item,
  sort,
  className,
}: {
  item: WorkspaceItem;
  sort: SortKey;
  className?: string;
}) {
  const { label, iso } = shownDate(item, sort);
  return (
    <time
      dateTime={iso}
      title={`${label} ${exactTime(iso)}`}
      className={cn(
        "shrink-0 font-mono text-2xs whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      {/* The last edit is the default, so only the creation date is labelled on screen. */}
      <span className={label === "Edited" ? "sr-only" : undefined}>{label} </span>
      {timeAgo(iso)}
    </time>
  );
}

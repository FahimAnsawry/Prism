import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Building blocks of the profile page's panels.

/** One panel of the profile page, with its heading and a line under it. */
export function Panel({
  id,
  title,
  description,
  action,
  tone = "default",
  children,
}: {
  id: string;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "default" | "danger";
  children?: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        "scroll-mt-24 border bg-card p-5 sm:p-6",
        tone === "danger" ? "border-destructive" : "border-divider",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={`${id}-title`}
            className={cn(
              "font-display text-xl leading-7 font-bold tracking-[-0.02em]",
              tone === "danger" ? "text-destructive" : "text-ink",
            )}
          >
            {title}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A row in a panel's list: icon, name and detail, then badges and buttons on the right. */
export function PanelRow({
  Icon,
  iconClass,
  title,
  detail,
  children,
}: {
  Icon?: ComponentType<{ className?: string }>;
  /** The icon tile's colors (an editor's tile is tinted). */
  iconClass?: string;
  title: ReactNode;
  detail: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-divider py-4 first:border-t-0">
      {Icon && (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center border border-divider bg-background text-foreground",
            iconClass,
          )}
        >
          <Icon className="size-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{title}</p>
        <p className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">{detail}</p>
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-3 max-sm:w-full max-sm:justify-end">
          {children}
        </div>
      )}
    </li>
  );
}

/** A small mono status: CONNECTED, VERIFIED, OAUTH, TOKEN. */
export function StatusBadge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "blue" | "gray";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center px-2 font-mono text-3xs leading-none font-bold text-slate",
        tone === "green" && "bg-seafoam",
        tone === "blue" && "bg-ice",
        tone === "gray" && "bg-divider text-foreground",
      )}
    >
      {children}
    </span>
  );
}

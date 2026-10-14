import type { Workspace } from "@prism/shared";
import { LayoutGrid, List } from "lucide-react";
import { motion } from "motion/react";
import { type ComponentType, type ReactNode, use, useLayoutEffect, useRef, useState } from "react";
import { EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { DashboardPrefs } from "./dashboard-prefs";
import { ProjectLookContext } from "./dashboard-styles";
import type { ItemAction } from "./item-actions-menu";
import type { CreateKind } from "./item-dialog";
import type { ViewMode, WorkspaceItem } from "./workspace-data";

// Small pieces every dashboard page uses.

const LOGO_SIZES = {
  xs: "size-4 [&_svg]:size-2.5",
  sm: "size-5 [&_svg]:size-3",
  md: "size-6 [&_svg]:size-3.5",
  lg: "size-8 [&_svg]:size-4.5",
} as const;

/**
 * A project's logo: its icon on its color. A board outside any project gets an empty gray tile.
 */
export function ProjectLogo({
  projectId,
  size = "sm",
  pulse = false,
  className,
}: {
  projectId: string | null | undefined;
  size?: keyof typeof LOGO_SIZES;
  /** Breathes (fades down and back, every 2s) while something is being drawn. */
  pulse?: boolean;
  className?: string;
}) {
  const look = use(ProjectLookContext).get(projectId ?? "");
  return (
    <motion.span
      aria-hidden="true"
      animate={pulse ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
      transition={
        pulse
          ? { duration: 2, ease: [0.4, 0, 0.6, 1], times: [0, 0.5, 1], repeat: Infinity }
          : { duration: 0 }
      }
      className={cn(
        "inline-flex shrink-0 items-center justify-center [&_svg]:stroke-[2.25]",
        LOGO_SIZES[size],
        look ? [look.bg, look.fg] : "border border-dashed border-input",
        className,
      )}
    >
      {look && <look.Icon />}
    </motion.span>
  );
}

/** EDITOR / VIEWER on an item someone else owns. */
export function RoleBadge({ item, className }: { item: WorkspaceItem; className?: string }) {
  if (item.access === "owner") return null;
  const editor = item.access === "editor";
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center px-2 font-mono text-3xs leading-none font-bold text-slate",
        editor ? "bg-seafoam" : "bg-ice",
        className,
      )}
    >
      {editor ? "EDITOR" : "VIEWER"}
    </span>
  );
}

/** A person's initial in a circle (the workspace knows owners by name only). */
export function NameAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border border-divider bg-card font-mono text-[13px] font-bold text-foreground uppercase",
        className,
      )}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

/** A page's title row: heading, mono summary under it, and the page's main action. */
export function PageHeader({
  title,
  summary,
  action,
}: {
  title: string;
  summary?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="font-display text-[32px] leading-10 font-bold tracking-[-0.03em] text-ink sm:text-[40px] sm:leading-12">
          {title}
        </h1>
        {summary ? (
          <p className="mt-1 min-h-4 font-mono text-2xs text-muted-foreground">{summary}</p>
        ) : null}
      </div>
      {action && <div className="sm:mt-1.5 max-sm:w-full">{action}</div>}
    </div>
  );
}

/** A section heading inside a page, with an optional count beside it. */
export function SectionTitle({
  id,
  children,
  count,
}: {
  id?: string;
  children: ReactNode;
  count?: number;
}) {
  return (
    <h2
      id={id}
      className="flex items-baseline gap-3 font-display text-[22px] leading-8 font-bold tracking-[-0.02em] text-ink"
    >
      {children}
      {count !== undefined && (
        <span className="font-mono text-2xs font-normal tracking-normal text-muted-foreground">
          {count}
        </span>
      )}
    </h2>
  );
}

/**
 * A row of options, one picked. The picked one's fill slides over to the next pick, measured from
 * the buttons, so it follows their widths at every breakpoint.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const [fill, setFill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const node = group.current;
    if (!node) return;
    const measure = () => {
      const active = node.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (active) setFill({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div
      ref={group}
      role="group"
      aria-label={label}
      className={cn("relative flex max-w-full border border-divider bg-card p-[3px]", className)}
    >
      {fill && (
        <motion.span
          aria-hidden="true"
          className="absolute top-[3px] bottom-[3px] left-0 bg-secondary"
          initial={false}
          animate={{ width: fill.width, x: fill.left }}
          transition={{ duration: 0.25, ease: EASE_STANDARD }}
        />
      )}
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "relative flex h-8 min-w-0 flex-1 items-center justify-center gap-2 px-3 text-[13px] whitespace-nowrap transition-colors duration-250 ease-standard sm:flex-none sm:px-3.5",
            value === option.id
              ? "font-bold text-secondary-foreground"
              : "text-foreground hover:bg-hover",
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span
              className={cn(
                "font-mono text-2xs",
                value === option.id ? "text-secondary-foreground" : "text-muted-foreground",
              )}
            >
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

const VIEWS: { id: ViewMode; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: "grid", label: "Grid view", Icon: LayoutGrid },
  { id: "list", label: "List view", Icon: List },
];

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div role="group" aria-label="View" className="flex">
      {VIEWS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "flex size-[38px] items-center justify-center border transition-colors duration-150 ease-standard",
            value === id
              ? "border-secondary bg-secondary text-secondary-foreground"
              : "border-divider bg-card text-foreground hover:bg-hover",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      ))}
    </div>
  );
}

/** "Show 8 more" under a list cut short. */
export function ShowMore({
  shown,
  total,
  step,
  noun,
  onMore,
}: {
  shown: number;
  total: number;
  step: number;
  noun: string;
  onMore: () => void;
}) {
  if (shown >= total) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="font-mono text-2xs text-muted-foreground">
        Showing {shown} of {total} {noun}
      </p>
      <button
        type="button"
        onClick={onMore}
        className="h-[38px] border border-input bg-card px-4 text-[13px] font-bold text-foreground transition-colors duration-150 ease-standard hover:bg-hover max-sm:w-full"
      >
        Show {Math.min(step, total - shown)} more
      </button>
    </div>
  );
}

/** What the route hands every dashboard page. */
export type ViewProps = {
  workspace: Workspace;
  /** The search, deferred: lists follow it without holding up typing. */
  query: string;
  prefs: DashboardPrefs;
  onPrefsChange: (changes: Partial<DashboardPrefs>) => void;
  onAction: (action: ItemAction, item: WorkspaceItem) => void;
  /** `projectId` puts a new whiteboard straight into that project. */
  onCreate: (kind: CreateKind, projectId?: string) => void;
};

/** Nothing matched the search. */
export function NoMatches({ query }: { query: string }) {
  return (
    <p className="mt-16 text-center text-sm text-muted-foreground">
      Nothing matches “{query.trim()}”. Try another name, or clear the search.
    </p>
  );
}

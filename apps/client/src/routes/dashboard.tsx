import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { NewMenu } from "@/components/dashboard/new-menu";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import { WORKSPACE, type WorkspaceItem } from "@/components/dashboard/workspace-data";
import { requireSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Prism" }] }),
  beforeLoad: requireSession,
  component: DashboardPage,
});

type Filter = "all" | "project" | "board";

const FILTERS: { id: Filter; label: string; count: number; width: string }[] = [
  {
    id: "all",
    label: "All",
    count: WORKSPACE.projectCount + WORKSPACE.boardCount,
    width: "w-[100px]",
  },
  { id: "project", label: "Projects", count: WORKSPACE.projectCount, width: "w-[124px]" },
  { id: "board", label: "Whiteboards", count: WORKSPACE.boardCount, width: "w-[148px]" },
];

// 1440px frame: a 1200px column with 120px margins.
const column = "mx-auto w-full max-w-[calc(75rem+2*var(--page-gutter))] px-(--page-gutter)";

function matches(item: WorkspaceItem, filter: Filter, query: string) {
  if (filter !== "all" && item.kind !== filter) return false;
  const q = query.trim().toLowerCase();
  return !q || `${item.title} ${item.description}`.toLowerCase().includes(q);
}

function DashboardPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const items = WORKSPACE.items.filter((item) => matches(item, filter, query));

  return (
    <div className="min-h-dvh bg-background">
      <DashboardHeader query={query} onQueryChange={setQuery} />

      <main className={cn(column, "pt-8 pb-26")}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-[40px] leading-14 font-bold text-ink">Your workspace</h1>
            <p className="mt-0.5 font-mono text-[13px] leading-[19px] text-muted-foreground">
              {WORKSPACE.projectCount} projects · {WORKSPACE.boardCount} boards
            </p>
          </div>
          <div className="mt-1.5">
            <NewMenu />
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4">
          <div
            role="group"
            aria-label="Show"
            className="flex max-w-full gap-2 border border-divider bg-card p-[3px] max-sm:w-full"
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "flex h-8 shrink-0 items-center justify-center gap-2 text-[13px] transition-colors duration-150 ease-standard",
                  f.width,
                  "max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:px-2",
                  filter === f.id
                    ? "bg-secondary font-bold text-secondary-foreground"
                    : "bg-card text-foreground hover:bg-background",
                )}
              >
                {f.label}
                <span>{f.count}</span>
              </button>
            ))}
          </div>

          {/* Visual only for now: the sort menu and the list view aren't designed yet. */}
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 font-mono text-xs text-foreground hover:text-ink"
            >
              Last edited
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </button>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed="true"
                className="flex size-8 items-center justify-center bg-secondary text-secondary-foreground"
              >
                <LayoutGrid aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed="false"
                className="flex size-8 items-center justify-center border border-divider bg-card text-foreground hover:bg-background"
              >
                <List aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {items.length > 0 ? (
          <ul className="mt-8 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <WorkspaceCard item={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-16 text-center text-sm text-muted-foreground">
            Nothing matches “{query.trim()}”. Try another name, or clear the search.
          </p>
        )}
      </main>
    </div>
  );
}

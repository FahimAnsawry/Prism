import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, List } from "lucide-react";
import { useState, type ComponentType } from "react";
import { ctaVariants } from "@/components/cta";
import { DeleteItemDialog } from "@/components/dashboard/delete-item-dialog";
import type { ItemAction } from "@/components/dashboard/item-actions-menu";
import {
  ItemDialog,
  type CreateKind,
  type ItemDialogTarget,
} from "@/components/dashboard/item-dialog";
import {
  readDashboardPrefs,
  storeDashboardPrefs,
  type DashboardPrefs,
} from "@/components/dashboard/dashboard-prefs";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyWorkspace } from "@/components/dashboard/empty-workspace";
import { NewMenu } from "@/components/dashboard/new-menu";
import { ProjectDialog } from "@/components/dashboard/project-dialog";
import { SortMenu } from "@/components/dashboard/sort-menu";
import { WorkspaceCard } from "@/components/dashboard/workspace-card";
import {
  itemsFor,
  matchesQuery,
  plural,
  sortItems,
  type Filter,
  type ViewMode,
  type WorkspaceItem,
} from "@/components/dashboard/workspace-data";
import { WorkspaceListHeader, WorkspaceRow } from "@/components/dashboard/workspace-row";
import { PrismLoader } from "@/components/feedback/prism-loader";
import { apiErrorMessage } from "@/lib/api";
import { requireSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { workspaceQuery } from "@/lib/workspace";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - Prism" }] }),
  beforeLoad: requireSession,
  component: DashboardPage,
});

const FILTERS: { id: Filter; label: string; width: string }[] = [
  { id: "all", label: "All", width: "w-[100px]" },
  { id: "project", label: "Projects", width: "w-[124px]" },
  { id: "board", label: "Whiteboards", width: "w-[148px]" },
];

const VIEWS: { id: ViewMode; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: "grid", label: "Grid view", Icon: LayoutGrid },
  { id: "list", label: "List view", Icon: List },
];

// 1440px frame: a 1200px column with 120px margins.
const column = "mx-auto w-full max-w-[calc(75rem+2*var(--page-gutter))] px-(--page-gutter)";

function DashboardPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [prefs, setPrefs] = useState(readDashboardPrefs);
  // Each dialog keeps its target after closing, so it doesn't go blank while fading out.
  const [itemDialog, setItemDialog] = useState<{ open: boolean; target: ItemDialogTarget }>({
    open: false,
    target: { mode: "create", kind: "whiteboard" },
  });
  const [projectView, setProjectView] = useState<{ open: boolean; projectId: string | null }>({
    open: false,
    projectId: null,
  });
  const [deleting, setDeleting] = useState<{ open: boolean; item: WorkspaceItem | null }>({
    open: false,
    item: null,
  });
  const workspace = useQuery(workspaceQuery);

  const updatePrefs = (changes: Partial<DashboardPrefs>) => {
    const next = { ...prefs, ...changes };
    setPrefs(next);
    storeDashboardPrefs(next);
  };
  const openCreate = (kind: CreateKind) =>
    setItemDialog({ open: true, target: { mode: "create", kind } });
  const onItemAction = (action: ItemAction, item: WorkspaceItem) => {
    if (action === "open") setProjectView({ open: true, projectId: item.id });
    else if (action === "edit") setItemDialog({ open: true, target: { mode: "edit", item } });
    else setDeleting({ open: true, item });
  };

  const data = workspace.data;
  const isEmpty = data !== undefined && data.projects.length === 0 && data.boards.length === 0;
  const items = data
    ? sortItems(
        itemsFor(data, filter).filter((item) => matchesQuery(item, query)),
        prefs.sort,
      )
    : [];

  const viewedProject = data?.projects.find((p) => p.id === projectView.projectId);
  const viewedBoards = data
    ? sortItems(
        itemsFor(data, "board").filter(
          (b) => b.kind === "board" && b.projectId === projectView.projectId,
        ),
        prefs.sort,
      )
    : [];

  return (
    <div className="min-h-dvh bg-background">
      <DashboardHeader query={query} onQueryChange={setQuery} />

      <main className={cn(column, "pt-8 pb-26")}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-[40px] leading-14 font-bold text-ink">Your workspace</h1>
            <p className="mt-0.5 h-[19px] font-mono text-[13px] leading-[19px] text-muted-foreground">
              {data &&
                `${plural(data.projects.length, "project")} · ${plural(data.boards.length, "board")}`}
            </p>
          </div>
          <div className="mt-1.5">
            <NewMenu onCreate={openCreate} />
          </div>
        </div>

        {!isEmpty && (
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
                  {data && <span>{itemsFor(data, f.id).length}</span>}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <SortMenu value={prefs.sort} onChange={(sort) => updatePrefs({ sort })} />
              <div role="group" aria-label="View" className="flex gap-1">
                {VIEWS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={label}
                    aria-pressed={prefs.view === id}
                    onClick={() => updatePrefs({ view: id })}
                    className={cn(
                      "flex size-8 items-center justify-center transition-colors duration-150 ease-standard",
                      prefs.view === id
                        ? "bg-secondary text-secondary-foreground"
                        : "border border-divider bg-card text-foreground hover:bg-background",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {workspace.isPending ? (
          <PrismLoader label="Loading your workspace" className="mt-24" />
        ) : workspace.isError ? (
          <div role="alert" className="mt-16 flex flex-col items-center gap-5 text-center">
            <p className="max-w-md text-sm text-foreground">{apiErrorMessage(workspace.error)}</p>
            <button
              type="button"
              onClick={() => void workspace.refetch()}
              disabled={workspace.isFetching}
              className={ctaVariants({ variant: "secondary", size: "sm" })}
            >
              {workspace.isFetching ? "Retrying…" : "Try again"}
            </button>
          </div>
        ) : isEmpty ? (
          <EmptyWorkspace onCreate={openCreate} />
        ) : items.length === 0 ? (
          <NoMatches
            query={query}
            filter={filter}
            onCreate={() => openCreate(filter === "project" ? "project" : "whiteboard")}
          />
        ) : prefs.view === "grid" ? (
          <ul className="mt-8 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <WorkspaceCard item={item} sort={prefs.sort} onAction={onItemAction} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 border border-divider bg-card">
            <WorkspaceListHeader sort={prefs.sort} />
            <ul className="divide-y divide-divider">
              {items.map((item) => (
                <WorkspaceRow key={item.id} item={item} sort={prefs.sort} onAction={onItemAction} />
              ))}
            </ul>
          </div>
        )}
      </main>

      <ItemDialog
        open={itemDialog.open}
        target={itemDialog.target}
        onOpenChange={(open) => setItemDialog((d) => ({ ...d, open }))}
        projects={data?.projects ?? []}
      />
      <ProjectDialog
        open={projectView.open}
        project={viewedProject}
        boards={viewedBoards}
        projects={data?.projects ?? []}
        sort={prefs.sort}
        onOpenChange={(open) => setProjectView((v) => ({ ...v, open }))}
      />
      <DeleteItemDialog
        open={deleting.open}
        item={deleting.item}
        onOpenChange={(open) => setDeleting((d) => ({ ...d, open }))}
      />
    </div>
  );
}

/** An empty search, or a filter with nothing in it yet. */
function NoMatches({
  query,
  filter,
  onCreate,
}: {
  query: string;
  filter: Filter;
  onCreate: () => void;
}) {
  if (query.trim()) {
    return (
      <p className="mt-16 text-center text-sm text-muted-foreground">
        Nothing matches “{query.trim()}”. Try another name, or clear the search.
      </p>
    );
  }
  return (
    <div className="mt-16 flex flex-col items-center gap-5 text-center">
      <p className="text-sm text-muted-foreground">
        {filter === "project" ? "No projects yet." : "No boards yet."}
      </p>
      <button type="button" onClick={onCreate} className={ctaVariants({ size: "sm" })}>
        {filter === "project" ? "New project" : "New whiteboard"}
      </button>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LayoutGrid, List } from "lucide-react";
import {
  useDeferredValue,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
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
  sharedItemsFor,
  sortItems,
  type Filter,
  type ViewMode,
  type WorkspaceItem,
} from "@/components/dashboard/workspace-data";
import { WorkspaceListHeader, WorkspaceRow } from "@/components/dashboard/workspace-row";
import { PrismLoader } from "@/components/feedback/prism-loader";
import { LeaveDialog } from "@/components/share/leave-dialog";
import { ShareDialog } from "@/components/share/share-dialog";
import { apiErrorMessage } from "@/lib/api";
import { requireSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { claimPendingInvite } from "@/lib/sharing";
import { allProjects, workspaceQuery } from "@/lib/workspace";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - Prism" }] }),
  beforeLoad: async ({ preload }) => {
    const session = await requireSession();
    // Signed in from an invite link: finish accepting it (on the visit itself, not a hover).
    const invite = preload ? null : claimPendingInvite();
    if (invite) throw redirect({ to: "/invite/$token", params: { token: invite } });
    return session;
  },
  // The workspace loads alongside the page's code instead of after it. Cached data shows at
  // once, and the page refreshes it itself.
  loader: ({ context: { queryClient } }) => {
    if (!queryClient.getQueryData(workspaceQuery.queryKey)) {
      void queryClient.prefetchQuery(workspaceQuery);
    }
  },
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
  const [sharing, setSharing] = useState<{ open: boolean; item: WorkspaceItem | null }>({
    open: false,
    item: null,
  });
  const [leaving, setLeaving] = useState<{ open: boolean; item: WorkspaceItem | null }>({
    open: false,
    item: null,
  });
  const workspace = useQuery(workspaceQuery);
  // The switches answer at once (their highlight slides over); the grid follows as a deferred,
  // interruptible render, so a slow one never holds up the click.
  const shownFilter = useDeferredValue(filter);
  const shownView = useDeferredValue(prefs.view);
  const [animateGrid, setAnimateGrid] = useState(false);

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
    else if (action === "share") setSharing({ open: true, item });
    else if (action === "leave") setLeaving({ open: true, item });
    else setDeleting({ open: true, item });
  };

  const data = workspace.data;
  const ownEmpty = data !== undefined && data.projects.length === 0 && data.boards.length === 0;
  const sharedCount = data ? data.shared.projects.length + data.shared.boards.length : 0;
  const isEmpty = ownEmpty && sharedCount === 0;
  const items = data
    ? sortItems(
        itemsFor(data, shownFilter).filter((item) => matchesQuery(item, query)),
        prefs.sort,
      )
    : [];
  const sharedItems = data
    ? sortItems(
        sharedItemsFor(data, shownFilter).filter((item) => matchesQuery(item, query)),
        prefs.sort,
      )
    : [];

  const viewedProject = data && allProjects(data).find((p) => p.id === projectView.projectId);
  const viewedBoards = data
    ? sortItems(
        [...itemsFor(data, "board"), ...sharedItemsFor(data, "board")].filter(
          (b) => b.kind === "board" && b.projectId === projectView.projectId,
        ),
        prefs.sort,
      )
    : [];

  // A new filter or view mounts the list again, so its entrance plays (only after a switch: not
  // when the dashboard opens or comes back from a board).
  const listKey = `${shownFilter}:${shownView}`;
  // A slide only: cards stay opaque, so the grid never goes blank between two filters.
  const enter = animateGrid
    ? "motion-safe:animate-in motion-safe:slide-in-from-bottom-2 fill-mode-both duration-250 ease-(--ease-decelerate)"
    : undefined;

  const itemList = (list: WorkspaceItem[]): ReactNode =>
    shownView === "grid" ? (
      <ul key={listKey} className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((item, i) => (
          <li
            key={item.id}
            className={cn("min-w-0", enter)}
            // Staggered, capped so a long grid doesn't keep its last cards waiting.
            style={enter ? { animationDelay: `${Math.min(i, 6) * 25}ms` } : undefined}
          >
            <WorkspaceCard item={item} sort={prefs.sort} onAction={onItemAction} />
          </li>
        ))}
      </ul>
    ) : (
      <div key={listKey} className={cn("mt-8 border border-divider bg-card", enter)}>
        <WorkspaceListHeader sort={prefs.sort} />
        <ul className="divide-y divide-divider">
          {list.map((item) => (
            <WorkspaceRow key={item.id} item={item} sort={prefs.sort} onAction={onItemAction} />
          ))}
        </ul>
      </div>
    );

  return (
    <div className="min-h-dvh bg-background">
      <DashboardHeader query={query} onQueryChange={setQuery} />

      <main className={cn(column, "pt-6 pb-16 sm:pt-8 sm:pb-26")}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[32px] leading-10 font-bold text-ink sm:text-[40px] sm:leading-14">
              Your workspace
            </h1>
            <p className="mt-0.5 h-[19px] font-mono text-[13px] leading-[19px] text-muted-foreground">
              {data &&
                `${plural(data.projects.length, "project")} · ${plural(data.boards.length, "board")}`}
            </p>
          </div>
          <div className="mt-1.5 max-sm:w-full">
            <NewMenu onCreate={openCreate} />
          </div>
        </div>

        {!isEmpty && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 sm:mt-14">
            <FilterSwitch
              value={filter}
              counts={data && ((id) => itemsFor(data, id).length)}
              onChange={(next) => {
                setAnimateGrid(true);
                setFilter(next);
              }}
            />

            <div className="ml-auto flex items-center gap-3">
              <SortMenu value={prefs.sort} onChange={(sort) => updatePrefs({ sort })} />
              <div role="group" aria-label="View" className="flex gap-1">
                {VIEWS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={label}
                    aria-pressed={prefs.view === id}
                    onClick={() => {
                      setAnimateGrid(true);
                      updatePrefs({ view: id });
                    }}
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
        ) : isEmpty || (ownEmpty && !query.trim()) ? (
          <EmptyWorkspace onCreate={openCreate} />
        ) : items.length === 0 ? (
          // With only shared items, a search that matches some of them needs no "nothing here".
          sharedItems.length > 0 && query.trim() ? null : (
            <NoMatches
              query={query}
              filter={shownFilter}
              onCreate={() => openCreate(shownFilter === "project" ? "project" : "whiteboard")}
            />
          )
        ) : (
          itemList(items)
        )}

        {sharedItems.length > 0 && (
          <section aria-labelledby="shared-heading" className="mt-14 sm:mt-20">
            <h2 id="shared-heading" className="text-[26px] leading-8 font-bold text-ink">
              Shared with you
            </h2>
            <p className="mt-1 font-mono text-[13px] leading-[19px] text-muted-foreground">
              {plural(sharedItems.length, "item")} others invited you to
            </p>
            {itemList(sharedItems)}
          </section>
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
      {sharing.item && (
        <ShareDialog
          kind={sharing.item.kind}
          id={sharing.item.id}
          name={sharing.item.name}
          open={sharing.open}
          onOpenChange={(open) => setSharing((d) => ({ ...d, open }))}
        />
      )}
      <LeaveDialog
        open={leaving.open}
        item={leaving.item}
        onOpenChange={(open) => setLeaving((d) => ({ ...d, open }))}
      />
    </div>
  );
}

/**
 * All / Projects / Whiteboards. The active one's fill slides over to the one picked, measured
 * from the buttons, so it follows their widths at every breakpoint.
 */
function FilterSwitch({
  value,
  counts,
  onChange,
}: {
  value: Filter;
  /** How many items each filter shows, once the workspace has loaded. */
  counts: ((filter: Filter) => number) | undefined;
  onChange: (filter: Filter) => void;
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
      aria-label="Show"
      className="relative flex max-w-full gap-2 border border-divider bg-card p-[3px] max-sm:w-full"
    >
      {fill && (
        <span
          aria-hidden="true"
          className="absolute top-[3px] bottom-[3px] left-0 bg-secondary transition-[translate,width] duration-250 ease-standard motion-reduce:transition-none"
          style={{ width: fill.width, translate: `${fill.left}px 0` }}
        />
      )}
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-pressed={value === f.id}
          onClick={() => onChange(f.id)}
          className={cn(
            "relative flex h-8 shrink-0 items-center justify-center gap-2 text-[13px] transition-colors duration-250 ease-standard",
            f.width,
            "max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:px-2",
            value === f.id
              ? "font-bold text-secondary-foreground"
              : "text-foreground hover:bg-background",
          )}
        >
          {f.label}
          {counts && <span>{counts(f.id)}</span>}
        </button>
      ))}
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

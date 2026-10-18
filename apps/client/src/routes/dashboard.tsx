import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { type ComponentType, useDeferredValue, useEffect, useMemo, useState } from "react";
import { ctaVariants } from "@/components/cta";
import { AllWorkView } from "@/components/dashboard/all-work-view";
import { BoardsView } from "@/components/dashboard/boards-view";
import type { ViewProps } from "@/components/dashboard/dashboard-parts";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  readDashboardPrefs,
  storeDashboardPrefs,
  type DashboardPrefs,
} from "@/components/dashboard/dashboard-prefs";
import { DeleteItemDialog } from "@/components/dashboard/delete-item-dialog";
import type { ItemAction } from "@/components/dashboard/item-actions-menu";
import {
  ItemDialog,
  type CreateKind,
  type ItemDialogTarget,
} from "@/components/dashboard/item-dialog";
import { ProjectDialog } from "@/components/dashboard/project-dialog";
import { ProjectsView } from "@/components/dashboard/projects-view";
import { SharedView } from "@/components/dashboard/shared-view";
import {
  boardItems,
  SECTIONS,
  sortItems,
  type Section,
  type WorkspaceItem,
} from "@/components/dashboard/workspace-data";
import { PrismLoader } from "@/components/feedback/prism-loader";
import { LeaveDialog } from "@/components/share/leave-dialog";
import { ShareDialog } from "@/components/share/share-dialog";
import { apiErrorMessage } from "@/lib/api";
import { requireSession } from "@/lib/auth-client";
import { claimPendingInvite } from "@/lib/sharing";
import { allProjects, fetchWorkspace, workspaceQuery } from "@/lib/workspace";

type DashboardSearch = {
  view?: Exclude<Section, "all">;
  /** A search typed on another page (the profile), carried over once. */
  q?: string;
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - Prism" }] }),
  // The sidebar's section lives in the URL, so back and forward move between sections.
  validateSearch: (search: Record<string, unknown>): DashboardSearch => {
    const view = SECTIONS.find((s) => s !== "all" && s === search.view);
    const q = typeof search.q === "string" && search.q ? search.q : undefined;
    return { ...(view && view !== "all" && { view }), ...(q && { q }) };
  },
  beforeLoad: async ({ preload, context: { queryClient } }) => {
    // The workspace starts loading alongside the session check. It joins the query cache only
    // once the user is known to be signed in: a signed-out visit's 401 is expected, not an error
    // to report.
    const early = queryClient.getQueryData(workspaceQuery.queryKey) ? null : fetchWorkspace();
    early?.catch(() => {});
    const session = await requireSession();
    // No retries of this one request: the page's own query retries with fresh ones.
    if (early)
      void queryClient.prefetchQuery({ ...workspaceQuery, queryFn: () => early, retry: false });
    // Signed in from an invite link: finish accepting it (on the visit itself, not a hover).
    const invite = preload ? null : claimPendingInvite();
    if (invite) throw redirect({ to: "/invite/$token", params: { token: invite } });
    return session;
  },
  // The workspace loads alongside the page's code instead of after it (if beforeLoad didn't
  // start it). Cached data shows at once, and the page refreshes it itself.
  loader: ({ context: { queryClient } }) => {
    if (!queryClient.getQueryData(workspaceQuery.queryKey)) {
      void queryClient.prefetchQuery(workspaceQuery);
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const search = Route.useSearch();
  const section: Section = search.view ?? "all";
  const navigate = useNavigate({ from: Route.fullPath });
  const [query, setQuery] = useState(search.q ?? "");
  const [carriedSearch] = useState(search.q !== undefined);
  // A carried-over search is taken once, then dropped from the URL.
  useEffect(() => {
    if (search.q !== undefined) {
      void navigate({ search: (prev) => ({ ...prev, q: undefined }), replace: true });
    }
  }, [search.q, navigate]);
  // Typing answers at once; the lists follow as a deferred, interruptible render.
  const shownQuery = useDeferredValue(query);
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
  const data = workspace.data;

  const updatePrefs = (changes: Partial<DashboardPrefs>) => {
    const next = { ...prefs, ...changes };
    setPrefs(next);
    storeDashboardPrefs(next);
  };
  const openCreate = (kind: CreateKind, projectId?: string) =>
    setItemDialog({ open: true, target: { mode: "create", kind, projectId } });
  const onItemAction = (action: ItemAction, item: WorkspaceItem) => {
    if (action === "open") setProjectView({ open: true, projectId: item.id });
    else if (action === "edit") setItemDialog({ open: true, target: { mode: "edit", item } });
    else if (action === "share") setSharing({ open: true, item });
    else if (action === "leave") setLeaving({ open: true, item });
    else setDeleting({ open: true, item });
  };

  const viewedProject = data && allProjects(data).find((p) => p.id === projectView.projectId);
  const viewedBoards = useMemo(
    () =>
      data
        ? sortItems(
            boardItems(data).filter((b) => b.projectId === projectView.projectId),
            prefs.sort,
          )
        : [],
    [data, projectView.projectId, prefs.sort],
  );

  const View: ComponentType<ViewProps> =
    section === "projects"
      ? ProjectsView
      : section === "boards"
        ? BoardsView
        : section === "shared"
          ? SharedView
          : AllWorkView;

  return (
    <DashboardShell
      section={section}
      query={query}
      onQueryChange={setQuery}
      autoFocusSearch={carriedSearch}
      onOpenProject={(projectId) => setProjectView({ open: true, projectId })}
      onNewProject={() => openCreate("project")}
    >
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
      ) : (
        <View
          workspace={workspace.data}
          query={shownQuery}
          prefs={prefs}
          onPrefsChange={updatePrefs}
          onAction={onItemAction}
          onCreate={openCreate}
        />
      )}

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
    </DashboardShell>
  );
}

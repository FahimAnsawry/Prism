import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { allProjects, workspaceQuery } from "@/lib/workspace";
import { AiAccessDialog } from "./ai-access-dialog";
import { DashboardHeader } from "./dashboard-header";
import { DashboardSidebar, type SidebarProps } from "./dashboard-sidebar";
import { ConnectAiContext, ProjectLookContext, projectLooks } from "./dashboard-styles";
import { sharedItemsFor, type Section } from "./workspace-data";

/**
 * The signed-in pages' frame: header with search, the sidebar (a drawer on phones) and the
 * "Connect AI tools" dialog. It reads the cached workspace for the sidebar's counts and projects, so it
 * adds no request of its own.
 */
export function DashboardShell({
  section,
  query,
  onQueryChange,
  onOpenProject,
  onNewProject,
  autoFocusSearch,
  children,
}: {
  /** The sidebar section to highlight; null on pages outside them (the profile). */
  section: Section | null;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenProject?: (projectId: string) => void;
  onNewProject?: () => void;
  autoFocusSearch?: boolean;
  children: ReactNode;
}) {
  const [aiOpen, setAiOpen] = useState(false);
  const data = useQuery(workspaceQuery).data;

  const counts = useMemo(() => {
    if (!data) return undefined;
    const projects = data.projects.length + data.shared.projects.length;
    const boards = data.boards.length + data.shared.boards.length;
    return {
      all: projects + boards,
      projects,
      boards,
      shared: sharedItemsFor(data, "all").length,
    };
  }, [data]);
  const looks = useMemo(() => projectLooks(data ? allProjects(data) : []), [data]);

  const nav: SidebarProps = {
    section,
    counts,
    projects: data?.projects ?? [],
    onOpenProject,
    onNewProject,
  };
  const connectAi = () => setAiOpen(true);

  return (
    <ProjectLookContext value={looks}>
      <div className="min-h-dvh bg-background">
        <DashboardHeader
          query={query}
          onQueryChange={onQueryChange}
          onConnectAi={connectAi}
          nav={nav}
          autoFocusSearch={autoFocusSearch}
        />
        <div className="flex">
          <DashboardSidebar {...nav} onConnectAi={connectAi} />
          <main className="min-w-0 flex-1 px-4 pt-6 pb-16 sm:px-8 sm:pt-10 sm:pb-24 xl:px-12">
            <div className="mx-auto w-full max-w-[75rem]">
              <ConnectAiContext value={connectAi}>{children}</ConnectAiContext>
            </div>
          </main>
        </div>
        <AiAccessDialog open={aiOpen} onOpenChange={setAiOpen} />
      </div>
    </ProjectLookContext>
  );
}

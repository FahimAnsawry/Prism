import { FolderPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { NoMatches, PageHeader, Segmented, type ViewProps } from "./dashboard-parts";
import { primaryButton } from "./dashboard-styles";
import { ProjectRow } from "./project-card";
import { SortMenu } from "./sort-menu";
import { matchesQuery, plural, projectItems, sortItems, type Owner } from "./workspace-data";

/** Every project, one row each: what it is, who it's from, and its latest boards. */
export function ProjectsView({
  workspace,
  query,
  prefs,
  onPrefsChange,
  onAction,
  onCreate,
}: ViewProps) {
  const [owner, setOwner] = useState<Owner>("all");
  const all = useMemo(() => projectItems(workspace), [workspace]);
  const projects = useMemo(
    () =>
      sortItems(
        projectItems(workspace, owner).filter((p) => matchesQuery(p, query)),
        prefs.sort,
      ),
    [workspace, owner, query, prefs.sort],
  );
  const boardCount = all.reduce((sum, p) => sum + p.boardCount, 0);
  const newProject = () => onCreate("project");

  return (
    <>
      <PageHeader
        title="Projects"
        summary={`${plural(all.length, "project")} · ${plural(boardCount, "board")} · one design language per project`}
        action={
          <button type="button" onClick={newProject} className={primaryButton}>
            <FolderPlus aria-hidden="true" />
            New project
          </button>
        }
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Whose projects"
          value={owner}
          onChange={setOwner}
          options={[
            { id: "all", label: "All", count: all.length },
            { id: "mine", label: "Owned by you", count: workspace.projects.length },
            { id: "shared", label: "Shared", count: workspace.shared.projects.length },
          ]}
          className="max-sm:w-full"
        />
        <SortMenu value={prefs.sort} onChange={(sort) => onPrefsChange({ sort })} />
      </div>

      {projects.length === 0 ? (
        query.trim() ? (
          <NoMatches query={query} />
        ) : (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            {owner === "shared"
              ? "Nobody has shared a project with you yet."
              : "No projects yet. A project keeps a set of boards together."}
          </p>
        )
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectRow
                project={project}
                onAction={onAction}
                onNewBoard={(p) => onCreate("whiteboard", p.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {owner !== "shared" && (
        <button
          type="button"
          onClick={newProject}
          className={cn(
            "mt-4 flex w-full items-center gap-3 border border-dashed border-input bg-card px-5 py-4 text-left transition-colors duration-150 ease-standard hover:bg-hover",
          )}
        >
          <FolderPlus aria-hidden="true" className="size-4 shrink-0 text-foreground" />
          <span className="text-[13px] font-bold text-foreground">New project</span>
          <span className="truncate text-[13px] text-muted-foreground max-sm:hidden">
            Boards in a project share one theme and one set of components.
          </span>
        </button>
      )}
    </>
  );
}

import { useMemo } from "react";
import { BoardGrid } from "./board-card";
import { NameAvatar, NoMatches, PageHeader, type ViewProps } from "./dashboard-parts";
import { ProjectRow } from "./project-card";
import {
  matchesQuery,
  plural,
  sharedItemsFor,
  sortItems,
  type BoardItem,
  type ProjectItem,
} from "./workspace-data";

type OwnerGroup = { owner: string; projects: ProjectItem[]; boards: BoardItem[]; latest: number };

/** What other people shared with the user, grouped by who shared it. */
export function SharedView({ workspace, query, prefs, onAction, onCreate }: ViewProps) {
  const all = useMemo(() => sharedItemsFor(workspace, "all"), [workspace]);
  const groups = useMemo(() => {
    const byOwner = new Map<string, OwnerGroup>();
    for (const item of sortItems(
      all.filter((i) => matchesQuery(i, query)),
      prefs.sort,
    )) {
      const group = byOwner.get(item.ownerName) ?? {
        owner: item.ownerName,
        projects: [],
        boards: [],
        latest: 0,
      };
      if (item.kind === "project") group.projects.push(item);
      else group.boards.push(item);
      group.latest = Math.max(group.latest, Date.parse(item.editedAt));
      byOwner.set(item.ownerName, group);
    }
    return [...byOwner.values()].toSorted((a, b) => b.latest - a.latest);
  }, [all, query, prefs.sort]);
  const people = new Set(all.map((i) => i.ownerName)).size;

  return (
    <>
      <PageHeader
        title="Shared with me"
        summary={
          all.length === 0
            ? "Nothing shared yet"
            : `${plural(all.length, "item")} from ${plural(people, "person", "people")}`
        }
      />

      {all.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Boards and projects people share with you show up here.
        </p>
      )}

      {all.length > 0 && groups.length === 0 && <NoMatches query={query} />}

      {groups.map((group) => (
        <section key={group.owner} aria-label={`From ${group.owner}`} className="mt-10">
          <div className="flex items-center gap-3">
            <NameAvatar name={group.owner} />
            <h2 className="truncate font-display text-lg font-bold tracking-[-0.02em] text-ink">
              {group.owner}
            </h2>
            <span className="font-mono text-2xs whitespace-nowrap text-muted-foreground max-sm:hidden">
              shared {sharedSummary(group)} with you
            </span>
          </div>
          {group.projects.length > 0 && (
            <ul className="mt-4 flex flex-col gap-4">
              {group.projects.map((project) => (
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
          {group.boards.length > 0 && (
            <BoardGrid
              boards={group.boards}
              sort={prefs.sort}
              onAction={onAction}
              className="mt-4"
            />
          )}
        </section>
      ))}
    </>
  );
}

function sharedSummary({ projects, boards }: OwnerGroup) {
  return [
    projects.length > 0 && plural(projects.length, "project"),
    boards.length > 0 && plural(boards.length, "board"),
  ]
    .filter(Boolean)
    .join(" and ");
}

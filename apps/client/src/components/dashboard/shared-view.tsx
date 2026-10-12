import { Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { BoardGrid } from "./board-card";
import { NameAvatar, NoMatches, PageHeader, type ViewProps } from "./dashboard-parts";
import { outlineButton } from "./dashboard-styles";
import { InviteLinkForm } from "./invite-link-form";
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
  const [pasting, setPasting] = useState(false);
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
        title="Shared with you"
        summary={
          all.length === 0
            ? "Nothing shared yet"
            : `${plural(all.length, "item")} from ${plural(people, "person", "people")}`
        }
        action={
          // With nothing shared yet, the form below is already open.
          all.length > 0 && (
            <button
              type="button"
              aria-expanded={pasting}
              onClick={() => setPasting((open) => !open)}
              className={`${outlineButton} h-11 max-sm:w-full`}
            >
              <Link2 aria-hidden="true" />
              Paste an invite link
            </button>
          )
        }
      />

      {(pasting || all.length === 0) && (
        <section className="mt-8 border border-divider bg-card p-5">
          <h2 className="text-[15px] font-bold text-foreground">Have an invite link?</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Paste it to join a board or project. It shows up here once you accept.
          </p>
          <InviteLinkForm className="mt-4 max-w-xl" autoFocus={pasting} />
        </section>
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

      <aside className="mt-12 border border-divider bg-card p-5 sm:p-6">
        <h2 className="text-[15px] font-bold text-foreground">What your role allows</h2>
        <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 text-[13px]">
          <dt>
            <span className="inline-flex h-5 items-center bg-seafoam px-2 font-mono text-3xs font-bold text-slate">
              EDITOR
            </span>
          </dt>
          <dd className="text-foreground">
            Change content and add boards. A board you add to a shared project belongs to its owner.
          </dd>
          <dt>
            <span className="inline-flex h-5 items-center bg-ice px-2 font-mono text-3xs font-bold text-slate">
              VIEWER
            </span>
          </dt>
          <dd className="text-foreground">
            Read only. Open the board, export an image or copy its code.
          </dd>
        </dl>
        <p className="mt-4 border-t border-divider pt-4 text-[13px] text-muted-foreground">
          Only the owner shares, moves or deletes. Leaving removes it from your workspace, and the
          owner can invite you again.
        </p>
      </aside>
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

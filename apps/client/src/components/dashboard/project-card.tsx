import { Link } from "@tanstack/react-router";
import { LogOut, Plus } from "lucide-react";
import { BoardPreview } from "./board-preview";
import { ProjectLogo, RoleBadge } from "./dashboard-parts";
import { ItemActionsMenu, type ItemAction } from "./item-actions-menu";
import { exactTime, plural, timeAgo, type ProjectItem, type WorkspaceItem } from "./workspace-data";

type OnAction = (action: ItemAction, item: WorkspaceItem) => void;

/** The server sends a project's three latest boards; a fourth slot counts the rest or adds one. */
const TILES = 3;

function Edited({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={`Edited ${exactTime(iso)}`}>
      edited {timeAgo(iso)}
    </time>
  );
}

/**
 * A project on "Home": a stack of boards (two sheets peek out above), its latest boards as
 * tiles, and its name. The card opens the project's board list; each tile opens its board.
 */
export function ProjectCard({ project, onAction }: { project: ProjectItem; onAction: OnAction }) {
  const shown = project.boards.slice(0, TILES);
  const more = project.boardCount - shown.length;
  const empties = Math.max(0, TILES - shown.length) + (more > 0 ? 0 : 1);

  return (
    <article className="group relative mt-3.5 h-[calc(100%-0.875rem)]">
      <div
        aria-hidden="true"
        className="absolute inset-x-5 -top-3.5 h-3.5 border border-divider bg-background"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-2.5 -top-[7px] h-3.5 border border-divider bg-card"
      />
      <div className="relative flex h-full flex-col border border-divider bg-card shadow-sm transition-colors duration-150 ease-standard group-has-[>button:hover]:border-input">
        <div className="grid h-[150px] shrink-0 grid-cols-2 grid-rows-2 gap-1.5 p-1.5">
          {shown.map((board) => (
            <div key={board.id} className="relative min-h-0 border border-divider">
              <BoardPreview
                boardId={board.id}
                name={board.name}
                projectId={project.id}
                itemCount={board.itemCount}
                className="absolute inset-0"
              />
              <span className="absolute inset-x-0 top-0 truncate bg-card/85 px-2 py-0.5 text-[11px] leading-4 font-bold text-foreground">
                {board.name}
              </span>
            </div>
          ))}
          {more > 0 && (
            <div className="flex items-center justify-center bg-secondary font-mono text-xs font-bold text-secondary-foreground">
              +{more} more
            </div>
          )}
          {Array.from({ length: empties }, (_, i) => (
            <div
              key={`empty-${i}`}
              aria-hidden="true"
              className="flex items-center justify-center border border-divider bg-card text-muted-foreground"
            >
              {i === 0 && shown.length === 0 ? (
                <span className="font-mono text-3xs">NO BOARDS YET</span>
              ) : (
                i === 0 && <Plus className="size-4" />
              )}
            </div>
          ))}
        </div>
        <div className="px-4 pt-2.5 pb-3.5">
          <h3 className="flex items-center gap-2 pr-9">
            <ProjectLogo projectId={project.id} />
            <span className="truncate font-display text-[17px] leading-6 font-bold tracking-[-0.02em] text-foreground">
              {project.name}
            </span>
          </h3>
          <p className="mt-1.5 flex items-center gap-2.5 font-mono text-2xs text-muted-foreground">
            {project.access === "owner" ? (
              <span className="inline-flex h-5 items-center bg-lime px-2 text-3xs font-bold text-slate">
                PROJECT
              </span>
            ) : (
              <RoleBadge item={project} />
            )}
            <span className="truncate">
              {plural(project.boardCount, "board")} · <Edited iso={project.editedAt} />
            </span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAction("open", project)}
        aria-label={`Open ${project.name}`}
        aria-haspopup="dialog"
        className="absolute inset-0 cursor-pointer"
      />
      <ItemActionsMenu
        item={project}
        onAction={onAction}
        className="absolute right-2.5 bottom-3 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
      />
    </article>
  );
}

/**
 * A project on the Projects and Shared pages: its name, description, owner and size on the left,
 * its latest boards as tiles on the right, then a slot that adds a board or counts the rest.
 */
export function ProjectRow({
  project,
  onAction,
  onNewBoard,
}: {
  project: ProjectItem;
  onAction: OnAction;
  onNewBoard: (project: ProjectItem) => void;
}) {
  const shown = project.boards.slice(0, TILES);
  const more = project.boardCount - shown.length;
  const canAdd = project.access !== "viewer";
  const owned = project.access === "owner";
  // Four slots in all: the tiles, the "+N more" or "New board" slot, then blanks.
  const fillers = 4 - shown.length - (more > 0 || canAdd ? 1 : 0);

  return (
    <article className="grid gap-5 border border-divider bg-card p-4 shadow-sm sm:p-5 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-6">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onAction("open", project)}
              aria-haspopup="dialog"
              className="flex max-w-full items-center gap-2.5 text-left hover:underline"
            >
              <ProjectLogo projectId={project.id} size="md" />
              <span className="truncate font-display text-xl leading-7 font-bold tracking-[-0.02em] text-ink">
                {project.name}
              </span>
            </button>
          </h3>
          {owned && (
            <ItemActionsMenu
              item={project}
              onAction={onAction}
              className="-mt-0.5 border-transparent bg-transparent"
            />
          )}
        </div>
        {project.description && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
            {project.description}
          </p>
        )}
        <div className="mt-auto pt-4">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-mono text-2xs text-muted-foreground">
            <RoleBadge item={project} />
            <span>
              {plural(project.boardCount, "board")} · <Edited iso={project.editedAt} />
            </span>
          </p>
          {!owned && (
            <button
              type="button"
              onClick={() => onAction("leave", project)}
              className="mt-3 inline-flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-destructive"
            >
              <LogOut aria-hidden="true" className="size-3.5" />
              Leave project
            </button>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shown.map((board) => (
          <li key={board.id} className="min-w-0">
            <Link to="/board/$boardId" params={{ boardId: board.id }} className="group/tile block">
              <BoardPreview
                boardId={board.id}
                name={board.name}
                projectId={project.id}
                itemCount={board.itemCount}
                className="aspect-[16/10] border border-divider transition-colors duration-150 ease-standard group-hover/tile:border-input"
              />
              <span className="mt-1.5 block truncate text-xs font-bold text-foreground">
                {board.name}
              </span>
            </Link>
          </li>
        ))}
        {more > 0 ? (
          <li className="min-w-0">
            <button
              type="button"
              onClick={() => onAction("open", project)}
              aria-haspopup="dialog"
              className="flex aspect-[16/10] w-full items-center justify-center bg-secondary font-mono text-xs font-bold text-secondary-foreground transition-opacity hover:opacity-90"
            >
              +{more} more
            </button>
            <span className="mt-1.5 block truncate text-xs text-muted-foreground">Every board</span>
          </li>
        ) : (
          canAdd && (
            <li className="min-w-0">
              <button
                type="button"
                onClick={() => onNewBoard(project)}
                aria-label={`New whiteboard in ${project.name}`}
                className="flex aspect-[16/10] w-full items-center justify-center border border-input text-muted-foreground transition-colors duration-150 ease-standard hover:bg-hover hover:text-ink"
              >
                <Plus aria-hidden="true" className="size-5" />
              </button>
              <span className="mt-1.5 block truncate text-xs text-muted-foreground">New board</span>
            </li>
          )
        )}
        {Array.from({ length: Math.max(0, fillers) }, (_, i) => (
          <li
            key={`filler-${i}`}
            aria-hidden="true"
            className="aspect-[16/10] border border-divider max-sm:hidden"
          />
        ))}
      </ul>
    </article>
  );
}

import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { BoardPreview } from "./board-preview";
import { ProjectLogo, RoleBadge } from "./dashboard-parts";
import { ItemActionsMenu, type ItemAction } from "./item-actions-menu";
import {
  editedGroup,
  exactTime,
  shownDate,
  timeAgo,
  type BoardItem,
  type SortKey,
  type WorkspaceItem,
} from "./workspace-data";
import { BOARD_PRELOAD_DELAY } from "@/lib/workspace";

type OnAction = (action: ItemAction, item: WorkspaceItem) => void;

/** "Quarto CMS" with its color, or "Unfiled" for a board outside any project. */
export function BoardProject({ board, className }: { board: BoardItem; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <ProjectLogo projectId={board.projectName ? board.projectId : null} size="xs" />
      <span className="truncate">{board.projectName ?? "Unfiled"}</span>
    </span>
  );
}

function BoardDate({ board, sort }: { board: BoardItem; sort: SortKey }) {
  const { label, iso } = shownDate(board, sort);
  return (
    <time dateTime={iso} title={`${label} ${exactTime(iso)}`} className="whitespace-nowrap">
      <span className={label === "Edited" ? "sr-only" : undefined}>{label} </span>
      {timeAgo(iso)}
    </time>
  );
}

/** A whiteboard in the grid: its picture, name, project and size. */
export function BoardCard({
  board,
  sort,
  onAction,
}: {
  board: BoardItem;
  sort: SortKey;
  onAction: OnAction;
}) {
  return (
    <div className="group relative h-full">
      <Link
        to="/board/$boardId"
        params={{ boardId: board.id }}
        preloadDelay={BOARD_PRELOAD_DELAY}
        className="flex h-full flex-col border border-divider bg-card shadow-sm transition-colors duration-150 ease-standard hover:border-input"
      >
        <BoardPreview
          boardId={board.id}
          name={board.name}
          projectId={board.projectId}
          itemCount={board.itemCount}
          className="h-[132px] shrink-0 border-b border-divider"
        />
        <div className="flex min-w-0 flex-1 flex-col px-4 pt-3 pb-3.5">
          <h3 className="truncate text-[15px] leading-[21px] font-bold text-foreground">
            {board.name}
          </h3>
          <BoardProject board={board} className="mt-1 text-[13px] text-muted-foreground" />
          <p className="mt-2 flex items-center gap-2 font-mono text-2xs text-muted-foreground">
            <RoleBadge item={board} />
            <span className="truncate">
              <BoardDate board={board} sort={sort} />
            </span>
          </p>
        </div>
      </Link>
      {/* A sibling of the link, since a button can't sit inside one. */}
      <ItemActionsMenu
        item={board}
        onAction={onAction}
        className="absolute top-2 right-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
      />
    </div>
  );
}

/** The first card of the Whiteboards grid: a blank cover that starts a new board. */
function NewBoardCard({ onCreate }: { onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className="flex h-full w-full cursor-pointer flex-col border border-divider bg-card text-left shadow-sm transition-colors duration-150 ease-standard hover:border-input"
    >
      <BoardPreview
        boardId="new"
        name=""
        projectId={null}
        itemCount={0}
        className="h-[132px] shrink-0 border-b border-divider"
      />
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-3 pb-3.5">
        <h3 className="flex items-center gap-2 text-[15px] leading-[21px] font-bold text-foreground">
          <Plus aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
          New whiteboard
        </h3>
        <p className="mt-1 text-[13px] text-muted-foreground">Start from a blank canvas</p>
      </div>
    </button>
  );
}

export function BoardGrid({
  boards,
  sort,
  onAction,
  onCreate,
  className,
}: {
  boards: BoardItem[];
  sort: SortKey;
  onAction: OnAction;
  /** Puts a "New whiteboard" card before the boards. */
  onCreate?: () => void;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-[minmax(0,1fr)] gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {onCreate && (
        <li className="min-w-0">
          <NewBoardCard onCreate={onCreate} />
        </li>
      )}
      {boards.map((board) => (
        <li key={board.id} className="min-w-0">
          <BoardCard board={board} sort={sort} onAction={onAction} />
        </li>
      ))}
    </ul>
  );
}

const columns =
  "grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[3.5rem_minmax(0,1fr)_11rem_6rem_6.5rem]";

/**
 * The list view: one row per board under column headings. Sorted by last edit, the rows group
 * under "Today", "Earlier this week" and so on.
 */
export function BoardTable({
  boards,
  sort,
  onAction,
  onCreate,
  className,
}: {
  boards: BoardItem[];
  sort: SortKey;
  onAction: OnAction;
  /** Puts a "New whiteboard" row before the boards. */
  onCreate?: () => void;
  className?: string;
}) {
  const dateLabel = sort === "created" ? "Created" : "Edited";
  return (
    <div className={cn("border border-divider bg-card shadow-sm", className)}>
      <div
        aria-hidden="true"
        className="flex h-9 items-center border-b border-divider font-mono text-3xs font-bold tracking-[0.06em] text-muted-foreground uppercase max-md:hidden"
      >
        <div className={cn(columns, "flex-1 px-4")}>
          <span className="col-start-2">Name</span>
          <span>Project</span>
          <span>Elements</span>
          <span>{dateLabel}</span>
        </div>
        <span className="w-12 shrink-0" />
      </div>
      <ul>
        {onCreate && (
          <li className="border-b border-divider">
            <button
              type="button"
              onClick={onCreate}
              className={cn(
                columns,
                "w-full cursor-pointer py-2 pr-4 pl-4 text-left transition-colors duration-150 ease-standard hover:bg-hover focus-visible:-outline-offset-2",
              )}
            >
              <BoardPreview
                boardId="new"
                name=""
                projectId={null}
                itemCount={0}
                className="h-9 w-14 border border-divider"
              />
              <span className="flex min-w-0 items-center gap-2 text-[14px] leading-5 font-bold text-foreground">
                <Plus aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
                <span className="truncate">New whiteboard</span>
              </span>
              <span className="text-[13px] text-muted-foreground max-md:hidden md:col-span-3">
                Start from a blank canvas
              </span>
            </button>
          </li>
        )}
        {boards.map((board, i) => {
          const group = sort === "edited" ? editedGroup(board.editedAt) : undefined;
          const previous = boards[i - 1];
          const newGroup = group && (!previous || editedGroup(previous.editedAt) !== group);
          return (
            <Fragment key={board.id}>
              {newGroup && (
                <li
                  aria-hidden="true"
                  className="flex h-8 items-center border-b border-divider bg-background px-4 font-mono text-3xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
                >
                  {group}
                </li>
              )}
              <li className="group flex items-center border-b border-divider last:border-b-0">
                <Link
                  to="/board/$boardId"
                  params={{ boardId: board.id }}
                  preloadDelay={BOARD_PRELOAD_DELAY}
                  className={cn(
                    columns,
                    "min-w-0 flex-1 py-2 pl-4 transition-colors duration-150 ease-standard hover:bg-hover focus-visible:-outline-offset-2",
                  )}
                >
                  <BoardPreview
                    boardId={board.id}
                    name={board.name}
                    projectId={board.projectId}
                    itemCount={board.itemCount}
                    className="h-9 w-14 border border-divider"
                  />
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[14px] leading-5 font-bold text-foreground">
                        {board.name}
                      </span>
                      <RoleBadge item={board} />
                    </span>
                    <BoardProject
                      board={board}
                      className="mt-0.5 text-xs text-muted-foreground md:hidden"
                    />
                  </span>
                  <BoardProject
                    board={board}
                    className="text-[13px] text-muted-foreground max-md:hidden"
                  />
                  <span className="font-mono text-2xs text-foreground max-md:hidden">
                    {board.itemCount}
                    {board.itemCount === 0 && " · empty"}
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground">
                    <BoardDate board={board} sort={sort} />
                  </span>
                </Link>
                <div className="flex w-12 shrink-0 justify-center">
                  <ItemActionsMenu
                    item={board}
                    onAction={onAction}
                    className="border-transparent bg-transparent"
                  />
                </div>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}

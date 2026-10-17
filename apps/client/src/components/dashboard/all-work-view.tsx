import { Link } from "@tanstack/react-router";
import { ArrowRight, FolderPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { BoardGrid, BoardProject, BoardTable } from "./board-card";
import { BoardPreview } from "./board-preview";
import {
  NoMatches,
  PageHeader,
  RoleBadge,
  SectionTitle,
  Segmented,
  ShowMore,
  ViewToggle,
  type ViewProps,
} from "./dashboard-parts";
import { outlineButton } from "./dashboard-styles";
import { EmptyWorkspace } from "./empty-workspace";
import { NewMenu } from "./new-menu";
import { ProjectCard } from "./project-card";
import { SortMenu } from "./sort-menu";
import {
  boardItems,
  exactTime,
  matchesQuery,
  projectItems,
  sectionSearch,
  sortItems,
  timeAgo,
  type BoardItem,
  type Owner,
} from "./workspace-data";

/** Boards the grid shows before "Show more", and how many more each click adds. */
const BOARD_PAGE = 8;
/** Projects on this page; the Projects page lists them all. */
const PROJECT_CARDS = 3;
/** Boards in the "Also recent" list beside the latest one. */
const RECENT = 4;

const newestFirst = (a: BoardItem, b: BoardItem) => Date.parse(b.editedAt) - Date.parse(a.editedAt);

/** "Home": the latest board to pick up, projects at a glance, then every whiteboard. */
export function AllWorkView({
  workspace,
  query,
  prefs,
  onPrefsChange,
  onAction,
  onCreate,
}: ViewProps) {
  const [owner, setOwner] = useState<Owner>("all");
  const [limit, setLimit] = useState(BOARD_PAGE);
  const searching = query.trim() !== "";

  const allBoards = useMemo(() => boardItems(workspace), [workspace]);
  const recent = useMemo(() => allBoards.toSorted(newestFirst).slice(0, RECENT + 1), [allBoards]);
  const projects = useMemo(
    () =>
      sortItems(
        projectItems(workspace).filter((p) => matchesQuery(p, query)),
        prefs.sort,
      ),
    [workspace, query, prefs.sort],
  );
  const boards = useMemo(
    () =>
      sortItems(
        allBoards.filter(
          (b) =>
            (owner === "all" || (owner === "mine") === (b.access === "owner")) &&
            matchesQuery(b, query),
        ),
        prefs.sort,
      ),
    [allBoards, owner, query, prefs.sort],
  );

  const ownCount = workspace.boards.length;
  const sharedCount = workspace.shared.projects.length + workspace.shared.boards.length;
  const isEmpty = workspace.projects.length === 0 && allBoards.length === 0 && sharedCount === 0;
  const [latest, ...alsoRecent] = recent;

  return (
    <>
      <PageHeader
        title="Your workspace"
        summary={isEmpty ? "Nothing here yet" : undefined}
        action={<NewMenu onCreate={(kind) => onCreate(kind)} />}
      />

      {isEmpty ? (
        <EmptyWorkspace onCreate={(kind) => onCreate(kind)} />
      ) : (
        <>
          <SectionTabs
            counts={{
              all: projects.length + allBoards.length,
              projects: projects.length,
              boards: allBoards.length,
            }}
          />

          {!searching && latest && (
            <section aria-labelledby="resume-heading" className="mt-8 sm:mt-12">
              <SectionTitle id="resume-heading">Pick up where you left off</SectionTitle>
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <ResumeCard board={latest} />
                <RecentPanel boards={alsoRecent} />
              </div>
            </section>
          )}

          {(projects.length > 0 || !searching) && (
            <section aria-labelledby="projects-heading" className="mt-12 sm:mt-14">
              <div className="flex items-center justify-between gap-4">
                <SectionTitle id="projects-heading" count={projects.length}>
                  Projects
                </SectionTitle>
                {projects.length > PROJECT_CARDS ? (
                  <Link
                    to="/dashboard"
                    search={sectionSearch("projects")}
                    className="inline-flex items-center gap-1.5 text-[13px] font-bold text-foreground hover:underline"
                  >
                    View all
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCreate("project")}
                    className={cn(outlineButton, "max-sm:hidden")}
                  >
                    <FolderPlus aria-hidden="true" />
                    New project
                  </button>
                )}
              </div>
              {projects.length > 0 ? (
                <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
                  {projects.slice(0, PROJECT_CARDS).map((project) => (
                    <li key={project.id} className="min-w-0">
                      <ProjectCard project={project} onAction={onAction} />
                    </li>
                  ))}
                </ul>
              ) : (
                <button
                  type="button"
                  onClick={() => onCreate("project")}
                  className="mt-4 flex w-full items-center gap-3 border border-dashed border-input bg-card px-5 py-4 text-left transition-colors hover:bg-hover"
                >
                  <FolderPlus aria-hidden="true" className="size-4 shrink-0 text-foreground" />
                  <span className="text-[13px] font-bold text-foreground">New project</span>
                  <span className="truncate text-[13px] text-muted-foreground max-sm:hidden">
                    Boards in a project share one theme and one set of components.
                  </span>
                </button>
              )}
            </section>
          )}

          <section aria-labelledby="boards-heading" className="mt-12 sm:mt-14">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <SectionTitle id="boards-heading" count={boards.length}>
                Whiteboards
              </SectionTitle>
              <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
                <Segmented
                  label="Whose boards"
                  value={owner}
                  onChange={(next) => {
                    setOwner(next);
                    setLimit(BOARD_PAGE);
                  }}
                  options={[
                    { id: "all", label: "All", count: allBoards.length },
                    { id: "mine", label: "Mine", count: ownCount },
                    { id: "shared", label: "Shared", count: allBoards.length - ownCount },
                  ]}
                  className="max-sm:w-full"
                />
                <div className="flex items-center gap-2 max-sm:ml-auto">
                  <SortMenu value={prefs.sort} onChange={(sort) => onPrefsChange({ sort })} />
                  <ViewToggle value={prefs.view} onChange={(view) => onPrefsChange({ view })} />
                </div>
              </div>
            </div>

            {boards.length === 0 ? (
              searching ? (
                projects.length === 0 && <NoMatches query={query} />
              ) : (
                <p className="mt-10 text-center text-sm text-muted-foreground">
                  {owner === "shared"
                    ? "Nobody has shared a board with you yet."
                    : "No boards yet."}
                </p>
              )
            ) : prefs.view === "grid" ? (
              <BoardGrid
                boards={boards.slice(0, limit)}
                sort={prefs.sort}
                onAction={onAction}
                className="mt-4"
              />
            ) : (
              <BoardTable
                boards={boards.slice(0, limit)}
                sort={prefs.sort}
                onAction={onAction}
                className="mt-4"
              />
            )}
            <ShowMore
              shown={Math.min(limit, boards.length)}
              total={boards.length}
              step={BOARD_PAGE}
              noun="whiteboards"
              onMore={() => setLimit((n) => n + BOARD_PAGE)}
            />
          </section>
        </>
      )}
    </>
  );
}

/** On phones and tablets the sidebar is in the menu, so the sections show as tabs here too. */
function SectionTabs({ counts }: { counts: { all: number; projects: number; boards: number } }) {
  const tabs = [
    { id: "all" as const, label: "All", count: counts.all },
    { id: "projects" as const, label: "Projects", count: counts.projects },
    { id: "boards" as const, label: "Boards", count: counts.boards },
  ];
  return (
    <nav
      aria-label="Sections"
      className="mt-6 flex border border-divider bg-card p-[3px] lg:hidden"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to="/dashboard"
          search={sectionSearch(tab.id)}
          aria-current={tab.id === "all" ? "page" : undefined}
          className={cn(
            "flex h-9 flex-1 items-center justify-center gap-2 text-[13px]",
            tab.id === "all"
              ? "bg-secondary font-bold text-secondary-foreground"
              : "text-foreground hover:bg-hover",
          )}
        >
          {tab.label}
          <span className="font-mono text-2xs opacity-70">{tab.count}</span>
        </Link>
      ))}
    </nav>
  );
}

/** The board edited last, large, with a way straight back into it. */
function ResumeCard({ board }: { board: BoardItem }) {
  return (
    <article className="group relative flex min-w-0 flex-col border border-divider bg-card shadow-sm transition-colors duration-150 ease-standard hover:border-input">
      <BoardPreview
        boardId={board.id}
        name={board.name}
        projectId={board.projectId}
        itemCount={board.itemCount}
        className="h-[200px] border-b border-divider sm:h-[260px]"
      />
      <div className="flex flex-wrap items-end justify-between gap-4 p-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl leading-7 font-bold tracking-[-0.02em] text-ink">
            {board.name}
          </h3>
          <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-2xs text-muted-foreground">
            {board.access === "owner" ? (
              <span className="inline-flex h-5 items-center bg-ice px-2 text-3xs font-bold text-slate">
                BOARD
              </span>
            ) : (
              <RoleBadge item={board} />
            )}
            <BoardProject board={board} className="font-sans text-[13px]" />
            <time dateTime={board.editedAt} title={`Edited ${exactTime(board.editedAt)}`}>
              · edited {timeAgo(board.editedAt)}
            </time>
          </p>
        </div>
        <Link
          to="/board/$boardId"
          params={{ boardId: board.id }}
          className="inline-flex h-10 shrink-0 items-center gap-2 bg-secondary px-4 text-[13px] font-bold text-secondary-foreground transition-colors duration-150 ease-standard after:absolute after:inset-0 hover:bg-secondary/85 max-sm:w-full max-sm:justify-center"
        >
          Open board
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </article>
  );
}

/** The next few boards by last edit. */
function RecentPanel({ boards }: { boards: BoardItem[] }) {
  return (
    <aside
      aria-labelledby="recent-heading"
      className="flex min-w-0 flex-col border border-divider bg-card p-4 shadow-sm sm:p-5"
    >
      <h3 id="recent-heading" className="font-display text-base font-bold text-ink">
        Also recent
      </h3>
      {boards.length > 0 ? (
        <ul className="mt-2 divide-y divide-divider">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                to="/board/$boardId"
                params={{ boardId: board.id }}
                className="-mx-2 flex items-center gap-3 px-2 py-2.5 transition-colors duration-150 ease-standard hover:bg-hover"
              >
                <BoardPreview
                  boardId={board.id}
                  name={board.name}
                  projectId={board.projectId}
                  itemCount={board.itemCount}
                  className="h-9 w-14 shrink-0 border border-divider"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-foreground">
                    {board.name}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 font-mono text-3xs text-muted-foreground">
                    <BoardProject board={board} className="min-w-0" />
                    <span className="shrink-0">· {timeAgo(board.editedAt)}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">
          Your other boards show up here as you edit them.
        </p>
      )}
    </aside>
  );
}

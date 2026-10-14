import { Menu } from "@base-ui/react/menu";
import { AnimatePresence, motion } from "motion/react";
import { popupMotion, usePopupExit } from "@/components/popup-motion";
import { TurningChevron } from "@/components/motion-parts";
import { Check, Folder, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { BoardGrid, BoardTable } from "./board-card";
import {
  NoMatches,
  PageHeader,
  ProjectLogo,
  Segmented,
  ShowMore,
  ViewToggle,
  type ViewProps,
} from "./dashboard-parts";
import { primaryButton } from "./dashboard-styles";
import { SortMenu } from "./sort-menu";
import { boardItems, matchesQuery, sortItems, type Owner } from "./workspace-data";

/** Rows (or cards) before "Show more", and how many more each click adds. */
const PAGE = 12;

/** "all", "none" (boards outside any project), or a project's id. */
type ProjectFilter = string;

/** Every whiteboard, filtered by owner and project, as a grid or a table grouped by day. */
export function BoardsView({
  workspace,
  query,
  prefs,
  onPrefsChange,
  onAction,
  onCreate,
}: ViewProps) {
  const [owner, setOwner] = useState<Owner>("all");
  const [project, setProject] = useState<ProjectFilter>("all");
  const [limit, setLimit] = useState(PAGE);

  const all = useMemo(() => boardItems(workspace), [workspace]);
  const projects = useMemo(
    () => [...workspace.projects, ...workspace.shared.projects],
    [workspace],
  );
  const boards = useMemo(
    () =>
      sortItems(
        all.filter(
          (b) =>
            (owner === "all" || (owner === "mine") === (b.access === "owner")) &&
            (project === "all" ||
              (project === "none" ? !b.projectName : b.projectId === project)) &&
            matchesQuery(b, query),
        ),
        prefs.sort,
      ),
    [all, owner, project, query, prefs.sort],
  );
  const shown = boards.slice(0, limit);
  const filter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setLimit(PAGE);
    };

  return (
    <>
      <PageHeader
        title="Whiteboards"
        action={
          <button type="button" onClick={() => onCreate("whiteboard")} className={primaryButton}>
            <Plus aria-hidden="true" strokeWidth={2.5} />
            New whiteboard
          </button>
        }
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <Segmented
            label="Whose boards"
            value={owner}
            onChange={filter(setOwner)}
            options={[
              { id: "all", label: "All", count: all.length },
              { id: "mine", label: "Mine", count: workspace.boards.length },
              { id: "shared", label: "Shared", count: workspace.shared.boards.length },
            ]}
            className="max-sm:w-full"
          />
          <ProjectMenu value={project} projects={projects} onChange={filter(setProject)} />
        </div>
        <div className="flex items-center gap-2 max-sm:ml-auto">
          <SortMenu value={prefs.sort} onChange={(sort) => onPrefsChange({ sort })} />
          <ViewToggle value={prefs.view} onChange={(view) => onPrefsChange({ view })} />
        </div>
      </div>

      {boards.length === 0 ? (
        query.trim() ? (
          <NoMatches query={query} />
        ) : (
          <p className="mt-12 text-center text-sm text-muted-foreground">No boards here yet.</p>
        )
      ) : prefs.view === "grid" ? (
        <BoardGrid boards={shown} sort={prefs.sort} onAction={onAction} className="mt-4" />
      ) : (
        <BoardTable boards={shown} sort={prefs.sort} onAction={onAction} className="mt-4" />
      )}
      <ShowMore
        shown={shown.length}
        total={boards.length}
        step={PAGE}
        noun="whiteboards"
        onMore={() => setLimit((n) => n + PAGE)}
      />
    </>
  );
}

const menuItem =
  "grid h-9 cursor-default grid-cols-[1rem_1rem_1fr] items-center gap-2 px-2.5 text-[13px] text-foreground outline-none select-none data-checked:font-bold data-highlighted:bg-seafoam dark:data-highlighted:bg-seafoam/12";

function ProjectMenu({
  value,
  projects,
  onChange,
}: {
  value: ProjectFilter;
  projects: { id: string; name: string }[];
  onChange: (value: ProjectFilter) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { actionsRef, onExitComplete } = usePopupExit(menuOpen);
  const label =
    value === "all"
      ? "All projects"
      : value === "none"
        ? "Unfiled"
        : (projects.find((p) => p.id === value)?.name ?? "All projects");

  return (
    <Menu.Root open={menuOpen} onOpenChange={setMenuOpen} actionsRef={actionsRef}>
      <Menu.Trigger
        aria-label={`Project: ${label}`}
        className="inline-flex h-[38px] max-w-56 items-center gap-2 border border-divider bg-card px-3 text-[13px] text-foreground transition-colors select-none hover:bg-hover data-popup-open:border-input"
      >
        <Folder aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
        <TurningChevron turned={menuOpen} className="size-3.5 shrink-0" />
      </Menu.Trigger>
      <AnimatePresence>
        {menuOpen && (
          <Menu.Portal keepMounted>
            <Menu.Positioner
              side="bottom"
              align="start"
              sideOffset={6}
              className="z-50 outline-none"
            >
              <Menu.Popup
                className="max-h-80 w-60 origin-(--transform-origin) overflow-y-auto border border-input bg-popover shadow-lg p-1 outline-none"
                render={<motion.div {...popupMotion} onAnimationComplete={onExitComplete} />}
              >
                <Menu.RadioGroup value={value} onValueChange={(next: string) => onChange(next)}>
                  <Menu.GroupLabel className="px-2.5 pt-1.5 pb-2 font-mono text-3xs font-bold text-muted-foreground">
                    PROJECT
                  </Menu.GroupLabel>
                  {[
                    { id: "all", name: "All projects", swatch: undefined },
                    { id: "none", name: "Unfiled", swatch: null },
                    ...projects.map((p) => ({ id: p.id, name: p.name, swatch: p.id })),
                  ].map((option) => (
                    <Menu.RadioItem
                      key={option.id}
                      value={option.id}
                      closeOnClick
                      className={menuItem}
                    >
                      <Menu.RadioItemIndicator className="col-start-1">
                        <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                      </Menu.RadioItemIndicator>
                      <span className="col-start-2 flex">
                        {option.swatch !== undefined && (
                          <ProjectLogo projectId={option.swatch} size="xs" />
                        )}
                      </span>
                      <span className="col-start-3 truncate">{option.name}</span>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        )}
      </AnimatePresence>
    </Menu.Root>
  );
}

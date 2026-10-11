import { Menu } from "@base-ui/react/menu";
import { NAME_MAX_LENGTH, type BoardSummary } from "@prism/shared";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { DeleteItemDialog } from "@/components/dashboard/delete-item-dialog";
import { ItemDialog, type ItemDialogTarget } from "@/components/dashboard/item-dialog";
import type { WorkspaceItem } from "@/components/dashboard/workspace-data";
import { cn } from "@/lib/utils";
import { allBoards, allProjects, useUpdateBoard, workspaceQuery } from "@/lib/workspace";

const titleText = "text-[15px] leading-[21px]";
const itemClass =
  "flex h-9 cursor-default items-center gap-2.5 px-2.5 text-[13px] text-foreground outline-none select-none data-highlighted:bg-seafoam dark:data-highlighted:bg-seafoam/12 [&_svg]:size-3.5 [&_svg]:shrink-0";
/** The edit and delete icons at the right of each board in the menu. */
const rowActionClass =
  "flex size-9 shrink-0 cursor-default items-center justify-center text-muted-foreground outline-none transition-colors duration-150 ease-standard select-none data-highlighted:bg-seafoam dark:data-highlighted:bg-seafoam/12 [&_svg]:size-3.5";

/** "Project ▾ / Board": the board's project (with a menu of its boards), then its editable name. */
export function BoardTitle({ board }: { board: BoardSummary | undefined }) {
  return (
    <div className="ml-2 flex min-w-0 items-center">
      {board?.projectId && <ProjectSwitcher board={board} projectId={board.projectId} />}
      <h1 className="min-w-0">
        <BoardName board={board} />
      </h1>
    </div>
  );
}

/** Click to rename. Enter or leaving the field saves; Escape cancels. */
function BoardName({ board }: { board: BoardSummary | undefined }) {
  const updateBoard = useUpdateBoard();
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  // While a rename is saving, show the new name; if it fails, the old one comes back.
  const name = updateBoard.isPending ? updateBoard.variables.name : (board?.name ?? "");

  const finish = () => {
    const next = draft?.trim() ?? "";
    setDraft(null);
    if (cancelled.current || !board || !next || next === board.name) return;
    updateBoard.mutate({
      id: board.id,
      name: next,
      description: board.description ?? "",
      projectId: board.projectId ?? "",
    });
  };

  if (draft !== null) {
    return (
      <input
        aria-label="Board name"
        autoComplete="off"
        maxLength={NAME_MAX_LENGTH}
        size={Math.max(8, draft.length)}
        value={draft}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            cancelled.current = event.key === "Escape";
            event.currentTarget.blur();
          }
        }}
        className={cn(
          titleText,
          "h-8 max-w-[min(24rem,50vw)] min-w-24 border border-foreground bg-card px-1.5 font-bold text-ink outline-none field-sizing-content",
        )}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`Rename board ${name}`}
      title="Rename"
      disabled={!board}
      onClick={() => {
        cancelled.current = false;
        setDraft(name);
      }}
      className={cn(
        titleText,
        "block h-8 max-w-full truncate border border-transparent px-1.5 text-left font-bold text-ink transition-colors duration-150 ease-standard hover:bg-background",
      )}
    >
      {name}
    </button>
  );
}

/**
 * The project's name, opening a menu of every board in it (each with edit and delete) plus
 * "New board".
 */
function ProjectSwitcher({ board, projectId }: { board: BoardSummary; projectId: string }) {
  const navigate = useNavigate();
  const workspace = useQuery(workspaceQuery);
  // Targets stay set while their dialog animates closed.
  const [itemDialog, setItemDialog] = useState<{ open: boolean; target: ItemDialogTarget }>({
    open: false,
    target: { mode: "create", kind: "whiteboard", projectId },
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: WorkspaceItem | null }>({
    open: false,
    item: null,
  });

  const project = workspace.data && allProjects(workspace.data).find((p) => p.id === projectId);
  if (!workspace.data || !project) return null;

  const boards = allBoards(workspace.data)
    .filter((b) => b.projectId === projectId)
    .toSorted((a, b) => a.name.localeCompare(b.name));
  // Only the owner moves boards between projects; members of a shared project don't get the choice.
  const owned = project.access === "owner";
  const projects = owned ? workspace.data.projects.map(({ id, name }) => ({ id, name })) : [];
  const itemFor = (b: BoardSummary) => ({
    kind: "board" as const,
    ...b,
    projectName: project.name,
  });

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`Project ${project.name}: switch board`}
          className={cn(
            titleText,
            "flex h-8 max-w-24 min-w-0 shrink items-center gap-1 px-1.5 text-muted-foreground transition-colors duration-150 ease-standard hover:bg-background hover:text-ink data-popup-open:bg-background data-popup-open:text-ink sm:max-w-48",
          )}
        >
          <span className="truncate">{project.name}</span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50 outline-none">
            <Menu.Popup className="max-h-[min(24rem,var(--available-height))] w-72 origin-(--transform-origin) overflow-y-auto border border-input bg-popover p-1 outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
              <Menu.Group>
                <Menu.GroupLabel className="truncate px-2.5 pt-1.5 pb-2 font-mono text-3xs font-bold text-muted-foreground uppercase">
                  {project.name}
                </Menu.GroupLabel>
                <Menu.RadioGroup
                  value={board.id}
                  onValueChange={(boardId: string) =>
                    void navigate({ to: "/board/$boardId", params: { boardId } })
                  }
                >
                  {boards.map((b) => (
                    <div key={b.id} className="flex items-center">
                      <Menu.RadioItem
                        value={b.id}
                        closeOnClick
                        className={cn(itemClass, "min-w-0 flex-1")}
                      >
                        <span className="flex size-3.5 shrink-0 items-center justify-center">
                          <Menu.RadioItemIndicator>
                            <Check aria-hidden="true" />
                          </Menu.RadioItemIndicator>
                        </span>
                        <span className="truncate">{b.name}</span>
                      </Menu.RadioItem>
                      {b.access !== "viewer" && (
                        <Menu.Item
                          aria-label={`Edit ${b.name}`}
                          title="Edit"
                          onClick={() =>
                            setItemDialog({
                              open: true,
                              target: { mode: "edit", item: itemFor(b) },
                            })
                          }
                          className={cn(rowActionClass, "hover:text-ink data-highlighted:text-ink")}
                        >
                          <Pencil aria-hidden="true" />
                        </Menu.Item>
                      )}
                      {b.access === "owner" && (
                        <Menu.Item
                          aria-label={`Delete ${b.name}`}
                          title="Delete"
                          onClick={() => setDeleteDialog({ open: true, item: itemFor(b) })}
                          className={cn(
                            rowActionClass,
                            "hover:text-destructive data-highlighted:text-destructive",
                          )}
                        >
                          <Trash2 aria-hidden="true" />
                        </Menu.Item>
                      )}
                    </div>
                  ))}
                </Menu.RadioGroup>
              </Menu.Group>
              {project.access !== "viewer" && (
                <>
                  <Menu.Separator className="my-1 h-px bg-divider" />
                  <Menu.Item
                    onClick={() =>
                      setItemDialog({
                        open: true,
                        target: { mode: "create", kind: "whiteboard", projectId },
                      })
                    }
                    className={itemClass}
                  >
                    <Plus aria-hidden="true" />
                    New board
                  </Menu.Item>
                </>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <span aria-hidden="true" className={cn(titleText, "shrink-0 px-0.5 text-input")}>
        /
      </span>

      {/* A new board goes into this project and opens. Editing can also move a board out. */}
      <ItemDialog
        open={itemDialog.open}
        onOpenChange={(open) => setItemDialog((d) => ({ ...d, open }))}
        target={itemDialog.target}
        projects={projects}
      />
      <DeleteItemDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}
        item={deleteDialog.item}
        onDeleted={() => {
          // The open board's page is gone with it, so go back to the dashboard.
          if (deleteDialog.item?.id === board.id)
            void navigate({ to: "/dashboard", replace: true });
        }}
      />
    </>
  );
}

import { Dialog } from "@base-ui/react/dialog";
import type { ProjectSummary } from "@prism/shared";
import { Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ctaVariants } from "@/components/cta";
import { DeleteItemDialog } from "./delete-item-dialog";
import { ItemActionsMenu, type ItemAction } from "./item-actions-menu";
import { ItemDialog, type ItemDialogTarget } from "./item-dialog";
import { ProjectIcon } from "./new-menu";
import { CanvasPreview, ItemDate } from "./workspace-item-parts";
import { itemMeta, plural, type SortKey, type WorkspaceItem } from "./workspace-data";

/** Shows on row hover or keyboard focus; always on touch screens. */
const revealOnHover =
  "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100";

/**
 * Every board in one project, in the dashboard's sort order: "+" adds one, and each board (and the
 * project itself) can be edited or deleted. Those dialogs open nested on top, so this list stays
 * open behind them and updates when they finish. `project` stays set while the dialog closes.
 */
export function ProjectDialog({
  open,
  project,
  boards,
  projects,
  sort,
  onOpenChange,
}: {
  open: boolean;
  project: ProjectSummary | undefined;
  /** This project's boards, already sorted. */
  boards: WorkspaceItem[];
  /** Every project, for moving a board elsewhere. */
  projects: { id: string; name: string }[];
  sort: SortKey;
  onOpenChange: (open: boolean) => void;
}) {
  const [itemDialog, setItemDialog] = useState<{ open: boolean; target: ItemDialogTarget }>({
    open: false,
    target: { mode: "create", kind: "whiteboard" },
  });
  const [deleting, setDeleting] = useState<{ open: boolean; item: WorkspaceItem | null }>({
    open: false,
    item: null,
  });

  const onAction = (action: ItemAction, item: WorkspaceItem) => {
    if (action === "edit") setItemDialog({ open: true, target: { mode: "edit", item } });
    else if (action === "delete") setDeleting({ open: true, item });
  };
  const createBoard = () => {
    if (project) {
      setItemDialog({
        open: true,
        target: { mode: "create", kind: "whiteboard", projectId: project.id },
      });
    }
  };

  return (
    // A deleted project has nothing left to show, so the dialog closes with it.
    <Dialog.Root open={open && project !== undefined} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate/40 transition-opacity duration-150 ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(28.8rem,calc(100dvh-2rem))] w-[40rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col border border-input bg-popover outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-nested-dialog-open:opacity-60 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          {project && (
            <>
              <div className="flex shrink-0 items-start gap-4 border-b border-divider p-6 sm:px-8">
                <ProjectIcon />
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="truncate text-[26px] leading-8 font-bold text-ink">
                    {project.name}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 truncate text-sm text-muted-foreground">
                    {project.description ?? plural(project.boardCount, "board")}
                  </Dialog.Description>
                </div>
                <div className="-mt-0.5 flex shrink-0 items-center gap-1">
                  <ItemActionsMenu item={{ kind: "project", ...project }} onAction={onAction} />
                  <Dialog.Close
                    aria-label="Close"
                    className="-mr-2 flex size-9 items-center justify-center text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </Dialog.Close>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3 sm:px-8">
                <h3 className="font-mono text-3xs font-bold text-muted-foreground">
                  BOARDS · {boards.length}
                </h3>
                <button
                  type="button"
                  onClick={createBoard}
                  aria-label={`New whiteboard in ${project.name}`}
                  title="New whiteboard"
                  className="flex size-9 items-center justify-center bg-brand text-slate transition-colors duration-150 ease-standard hover:bg-brand/80"
                >
                  <Plus aria-hidden="true" className="size-4" strokeWidth={2.5} />
                </button>
              </div>

              {boards.length > 0 ? (
                // The list scrolls; the header and "+" stay put.
                <ul className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 sm:px-8">
                  {boards.map((board) => (
                    <li
                      key={board.id}
                      className="group flex items-center gap-2 border-t border-divider first:border-t-0"
                    >
                      <Link
                        to="/board/$boardId"
                        params={{ boardId: board.id }}
                        className="-ml-2 flex min-w-0 flex-1 items-center gap-4 py-3 pr-2 pl-2 transition-colors duration-150 ease-standard hover:bg-background focus-visible:-outline-offset-2"
                      >
                        <CanvasPreview
                          empty={board.kind === "board" && board.itemCount === 0}
                          className="h-12 w-20 shrink-0 border border-divider"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] leading-[21px] font-bold text-foreground">
                            {board.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[13px] leading-[19px] text-muted-foreground">
                            {board.description ?? itemMeta(board)}
                          </span>
                        </span>
                        <ItemDate item={board} sort={sort} />
                      </Link>
                      <ItemActionsMenu item={board} onAction={onAction} className={revealOnHover} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-5 px-6 pt-6 pb-10 text-center">
                  <p className="text-sm text-muted-foreground">No boards in this project yet.</p>
                  <button
                    type="button"
                    onClick={createBoard}
                    className={ctaVariants({ size: "sm" })}
                  >
                    New whiteboard
                  </button>
                </div>
              )}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>

      {/* Inside this Root, so Base UI stacks them as nested dialogs. */}
      <ItemDialog
        open={itemDialog.open}
        target={itemDialog.target}
        onOpenChange={(next) => setItemDialog((d) => ({ ...d, open: next }))}
        projects={projects}
      />
      <DeleteItemDialog
        open={deleting.open}
        item={deleting.item}
        onOpenChange={(next) => setDeleting((d) => ({ ...d, open: next }))}
      />
    </Dialog.Root>
  );
}

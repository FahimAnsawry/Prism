import { apiErrorMessage } from "@/lib/api";
import { useDeleteBoard, useDeleteProject } from "@/lib/workspace";
import { ConfirmDialog } from "./confirm-dialog";
import { plural, type WorkspaceItem } from "./workspace-data";

/**
 * Asks before permanently deleting a project (with its boards) or a whiteboard.
 * `item` stays set while the dialog animates closed.
 */
export function DeleteItemDialog({
  open,
  item,
  onOpenChange,
  onDeleted,
}: {
  open: boolean;
  item: WorkspaceItem | null;
  onOpenChange: (open: boolean) => void;
  /** Runs once the server has deleted it, e.g. to leave the deleted board's page. */
  onDeleted?: () => void;
}) {
  const deleteProject = useDeleteProject();
  const deleteBoard = useDeleteBoard();
  const mutation = item?.kind === "project" ? deleteProject : deleteBoard;

  const changeOpen = (next: boolean) => {
    // A new question starts without the last one's error.
    deleteProject.reset();
    deleteBoard.reset();
    onOpenChange(next);
  };

  if (!item) return null;

  const isProject = item.kind === "project";
  const contents = isProject
    ? item.boardCount > 0 && `its ${plural(item.boardCount, "board")}`
    : item.itemCount > 0 && `its ${plural(item.itemCount, "item")}`;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={changeOpen}
      title={isProject ? "Delete project?" : "Delete whiteboard?"}
      description={
        <>
          <strong className="font-bold text-foreground">“{item.name}”</strong>
          {contents
            ? ` and ${contents} will be deleted permanently`
            : " will be deleted permanently"}
          {isProject && item.boardCount > 0 && ", along with everything on them"}. This can't be
          undone.
        </>
      }
      confirmLabel={
        mutation.isPending ? "Deleting…" : isProject ? "Delete project" : "Delete board"
      }
      tone="danger"
      pending={mutation.isPending}
      error={mutation.isError ? apiErrorMessage(mutation.error) : undefined}
      onConfirm={() =>
        mutation.mutate(item.id, {
          onSuccess: () => {
            changeOpen(false);
            onDeleted?.();
          },
        })
      }
    />
  );
}

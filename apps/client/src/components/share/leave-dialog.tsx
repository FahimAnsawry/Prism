import type { WorkspaceItem } from "@/components/dashboard/workspace-data";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { apiErrorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useLeaveShare } from "@/lib/sharing";

/** Leaving a board or project someone shared with the user. `item` stays set while it closes. */
export function LeaveDialog({
  open,
  item,
  onOpenChange,
  onLeft,
}: {
  open: boolean;
  item: WorkspaceItem | null;
  onOpenChange: (open: boolean) => void;
  onLeft?: () => void;
}) {
  const session = authClient.useSession();
  const leave = useLeaveShare();
  const kind = item?.kind === "project" ? "project" : "board";
  const userId = session.data?.user.id;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Leave “${item?.name ?? ""}”?`}
      description={`You lose access to this ${kind}${kind === "project" ? " and its boards" : ""}. ${item?.ownerName ?? "The owner"} can invite you again.`}
      confirmLabel="Leave"
      tone="danger"
      pending={leave.isPending}
      error={leave.error ? apiErrorMessage(leave.error) : undefined}
      onConfirm={() => {
        if (!item || !userId) return;
        leave.mutate(
          { kind, id: item.id, userId },
          {
            onSuccess: () => {
              onOpenChange(false);
              onLeft?.();
            },
          },
        );
      }}
    />
  );
}

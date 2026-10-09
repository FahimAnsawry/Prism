import { Menu } from "@base-ui/react/menu";
import { Ellipsis, LogOut, Pencil, Share2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceItem } from "./workspace-data";

/** "open" is a project card or row click; the menu offers the rest. */
export type ItemAction = "open" | "edit" | "share" | "delete" | "leave";

/**
 * What the menu offers for an item: the owner edits, shares and deletes it; an editor of a board
 * can edit (rename) it; someone it's shared with directly can leave it.
 */
export function menuActions(item: WorkspaceItem, { canLeave = true } = {}): ItemAction[] {
  if (item.access === "owner") return ["edit", "share", "delete"];
  const actions: ItemAction[] = [];
  if (item.access === "editor" && item.kind === "board") actions.push("edit");
  if (canLeave) actions.push("leave");
  return actions;
}

/** The "⋯" button on a card or row. Renders nothing when there's nothing to offer. */
export function ItemActionsMenu({
  item,
  onAction,
  className,
  canLeave = true,
}: {
  item: WorkspaceItem;
  onAction: (action: ItemAction, item: WorkspaceItem) => void;
  className?: string;
  /** False for a board reached through a shared project: it can only be left with the project. */
  canLeave?: boolean;
}) {
  const kind = item.kind === "project" ? "project" : "whiteboard";
  const actions = menuActions(item, { canLeave });
  const itemClass =
    "flex h-9 cursor-default items-center gap-2.5 px-2.5 text-[13px] outline-none select-none data-highlighted:bg-seafoam dark:data-highlighted:bg-seafoam/12 [&_svg]:size-3.5";
  if (actions.length === 0) return null;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Actions for ${item.name}`}
        className={cn(
          "flex size-8 items-center justify-center border border-divider bg-card text-foreground transition-colors duration-150 ease-standard hover:border-input hover:text-ink data-popup-open:border-input data-popup-open:text-ink",
          className,
        )}
      >
        <Ellipsis aria-hidden="true" className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-[60] outline-none">
          <Menu.Popup className="w-48 origin-(--transform-origin) border border-input bg-popover p-1 outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            {actions.includes("edit") && (
              <Menu.Item
                onClick={() => onAction("edit", item)}
                className={cn(itemClass, "text-foreground")}
              >
                <Pencil aria-hidden="true" />
                Edit {kind}
              </Menu.Item>
            )}
            {actions.includes("share") && (
              <Menu.Item
                onClick={() => onAction("share", item)}
                className={cn(itemClass, "text-foreground")}
              >
                <Share2 aria-hidden="true" />
                Share…
              </Menu.Item>
            )}
            {actions.includes("delete") && (
              <>
                <Menu.Separator className="my-1 h-px bg-divider" />
                <Menu.Item
                  onClick={() => onAction("delete", item)}
                  className={cn(itemClass, "text-destructive")}
                >
                  <Trash2 aria-hidden="true" />
                  Delete {kind}…
                </Menu.Item>
              </>
            )}
            {actions.includes("leave") && (
              <>
                {actions.length > 1 && <Menu.Separator className="my-1 h-px bg-divider" />}
                <Menu.Item
                  onClick={() => onAction("leave", item)}
                  className={cn(itemClass, "text-destructive")}
                >
                  <LogOut aria-hidden="true" />
                  Leave {kind}…
                </Menu.Item>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

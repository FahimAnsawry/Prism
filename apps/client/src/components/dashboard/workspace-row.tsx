import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ItemActionsMenu, type ItemAction } from "./item-actions-menu";
import { ItemDate, KindBadge } from "./workspace-item-parts";
import { itemMeta, sharedLabel, type SortKey, type WorkspaceItem } from "./workspace-data";

// List view: one row per item. Desktop lines the fields up in columns under a header;
// on phones the badge, count and date wrap under the name.
const columns = "sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_6.5rem] sm:gap-6";
/** The trailing cell that holds the actions button; the header leaves the same gap. */
const actionsCell = "flex w-12 shrink-0 justify-center";

export function WorkspaceListHeader({ sort }: { sort: SortKey }) {
  const dateLabel = sort === "created" ? "Created" : "Edited";
  return (
    <div
      aria-hidden="true"
      className="hidden h-9 items-center border-b border-divider font-mono text-3xs font-bold text-muted-foreground uppercase sm:flex"
    >
      <div className={cn("grid flex-1 items-center pr-2 pl-5", columns)}>
        <span>Name</span>
        <span>Type</span>
        <span>Contents</span>
        <span className="text-right">{dateLabel}</span>
      </div>
      <span className={actionsCell} />
    </div>
  );
}

export function WorkspaceRow({
  item,
  sort,
  onAction,
}: {
  item: WorkspaceItem;
  sort: SortKey;
  onAction: (action: ItemAction, item: WorkspaceItem) => void;
}) {
  const shared = sharedLabel(item);
  const description = shared
    ? `Shared by ${shared}`
    : item.kind === "board" && item.projectName
      ? [item.projectName, item.description].filter(Boolean).join(" · ")
      : item.description;

  const content = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-[15px] leading-[21px] font-bold text-foreground">
          {item.name}
        </span>
        {description && (
          <span className="mt-0.5 block truncate text-[13px] leading-[19px] text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2.5 max-sm:mt-2 sm:contents">
        <KindBadge kind={item.kind} className="sm:justify-self-start" />
        <span className="text-xs text-muted-foreground">{itemMeta(item)}</span>
        <ItemDate item={item} sort={sort} className="max-sm:ml-auto sm:text-right" />
      </span>
    </>
  );

  return (
    <li className="flex items-center">
      {rowShell(item, content, onAction)}
      <div className={actionsCell}>
        <ItemActionsMenu item={item} onAction={onAction} />
      </div>
    </li>
  );
}

function rowShell(
  item: WorkspaceItem,
  content: ReactNode,
  onAction: (action: ItemAction, item: WorkspaceItem) => void,
) {
  const className = cn(
    "grid min-w-0 flex-1 items-center py-3.5 pr-2 pl-5 text-left transition-colors duration-150 ease-standard hover:bg-background focus-visible:-outline-offset-2",
    columns,
  );
  // A board row opens the board; a project row lists the project's boards.
  if (item.kind === "project") {
    return (
      <button
        type="button"
        onClick={() => onAction("open", item)}
        aria-haspopup="dialog"
        className={cn(className, "cursor-pointer")}
      >
        {content}
      </button>
    );
  }
  return (
    <Link to="/board/$boardId" params={{ boardId: item.id }} className={className}>
      {content}
    </Link>
  );
}

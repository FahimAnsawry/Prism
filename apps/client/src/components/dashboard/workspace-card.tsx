import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ItemActionsMenu, type ItemAction } from "./item-actions-menu";
import { CanvasPreview, ItemDate, KindBadge } from "./workspace-item-parts";
import { itemMeta, type SortKey, type WorkspaceItem } from "./workspace-data";

/** Project folders show three boards; the fourth slot counts the rest or stays an empty slot. */
const VISIBLE_TILES = 3;

export function WorkspaceCard({
  item,
  sort,
  onAction,
}: {
  item: WorkspaceItem;
  sort: SortKey;
  onAction: (action: ItemAction, item: WorkspaceItem) => void;
}) {
  const body = (
    <>
      <div className="h-[175px] shrink-0 border-b border-divider">
        {item.kind === "board" ? (
          <CanvasPreview empty={item.itemCount === 0} className="size-full" />
        ) : (
          <ProjectTiles item={item} />
        )}
      </div>

      <div className="px-5 pt-3.5">
        <h3 className="truncate pr-9 text-[17px] leading-6 font-bold text-foreground">
          {item.name}
        </h3>
        <p className="mt-0.5 truncate text-[13px] leading-[19px] text-muted-foreground">
          {item.kind === "board" && item.projectName ? (
            <>
              <span className="font-bold text-foreground">{item.projectName}</span>
              {item.description && ` · ${item.description}`}
            </>
          ) : (
            (item.description ?? "No description")
          )}
        </p>
        <div className="mt-2.5 flex items-center">
          <KindBadge kind={item.kind} />
          <span className="ml-2.5 text-xs text-muted-foreground">{itemMeta(item)}</span>
          <ItemDate item={item} sort={sort} className="ml-auto" />
        </div>
      </div>
    </>
  );

  // Beside the title. A sibling of the card link, since a button can't sit inside a link.
  const actions = (
    <ItemActionsMenu
      item={item}
      onAction={onAction}
      className="absolute top-[185px] right-3 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
    />
  );

  if (item.kind === "board") {
    return (
      <div className="group relative">
        <Link
          to="/board/$boardId"
          params={{ boardId: item.id }}
          className="flex h-[280px] flex-col border border-divider bg-card transition-colors duration-150 ease-standard hover:border-input"
        >
          {body}
        </Link>
        {actions}
      </div>
    );
  }

  // Projects read as a stack of boards: two sheets peek out above the card. The whole card is
  // one button (stretched over it) that lists every board; the actions menu sits above it.
  return (
    <article className="group relative">
      <div
        aria-hidden="true"
        className="absolute inset-x-6 -top-3.5 h-3.5 border border-divider bg-background"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-3 -top-[7px] h-3.5 border border-divider bg-card"
      />
      <div className="relative flex h-[280px] flex-col border border-divider bg-card transition-colors duration-150 ease-standard group-has-[>button:hover]:border-input">
        {body}
      </div>
      <button
        type="button"
        onClick={() => onAction("open", item)}
        aria-label={`Open ${item.name}`}
        aria-haspopup="dialog"
        className="absolute inset-0 cursor-pointer"
      />
      {actions}
    </article>
  );
}

/** Previews of the project's latest boards. Clicking the card lists them all. */
function ProjectTiles({ item }: { item: Extract<WorkspaceItem, { kind: "project" }> }) {
  const shown = item.boards.slice(0, VISIBLE_TILES);
  const more = item.boardCount - shown.length;
  const emptySlots = Math.max(0, VISIBLE_TILES - shown.length) + (more > 0 ? 0 : 1);

  return (
    <div className="grid size-full grid-cols-2 grid-rows-2 gap-2 p-2">
      {shown.map((board) => (
        <div key={board.id} className="relative min-h-0 border border-divider">
          <CanvasPreview className="absolute inset-0" />
          <span className="absolute inset-x-0 top-0 truncate bg-card/85 px-2 py-1 text-[11px] leading-4 font-bold text-foreground">
            {board.name}
          </span>
        </div>
      ))}
      {more > 0 && (
        <div className="flex items-center justify-center bg-secondary font-mono text-[13px] font-bold text-secondary-foreground">
          +{more} more
        </div>
      )}
      {Array.from({ length: emptySlots }, (_, i) => (
        <div
          key={`empty-${i}`}
          aria-hidden="true"
          className={cn(
            "border border-dashed border-input bg-card",
            // A project with no boards yet says so in its first slot.
            shown.length === 0 &&
              i === 0 &&
              "flex items-center justify-center font-mono text-3xs text-muted-foreground",
          )}
        >
          {shown.length === 0 && i === 0 && "NO BOARDS YET"}
        </div>
      ))}
    </div>
  );
}

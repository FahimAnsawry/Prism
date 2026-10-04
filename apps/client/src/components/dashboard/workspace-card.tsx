import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BOARD_THUMB, PROJECT_TILE, type WorkspaceItem } from "./workspace-data";
import { Sketch } from "./sketch";

/** Project folders show three boards; the fourth slot counts the rest or stays an empty slot. */
const VISIBLE_TILES = 3;

export function WorkspaceCard({ item }: { item: WorkspaceItem }) {
  const body = (
    <>
      <div className="h-[175px] shrink-0 border-b border-divider">
        {item.kind === "board" ? (
          <div className="size-full bg-background">
            <Sketch {...BOARD_THUMB} shapes={item.thumbnail} />
          </div>
        ) : (
          <ProjectTiles item={item} />
        )}
      </div>

      <div className="px-5 pt-3.5">
        <h3 className="truncate text-[17px] leading-6 font-bold text-foreground">{item.title}</h3>
        <p className="mt-0.5 truncate text-[13px] leading-[19px] text-muted-foreground">
          {item.description}
        </p>
        <div className="mt-2.5 flex items-center">
          <span
            className={cn(
              "inline-flex h-5 items-center px-[15px] font-mono text-3xs leading-none font-bold text-slate",
              item.kind === "project" ? "bg-lime" : "bg-ice",
            )}
          >
            {item.kind === "project" ? "PROJECT" : "BOARD"}
          </span>
          <span className="ml-2.5 text-xs text-muted-foreground">
            {item.kind === "project" ? `${item.boardCount} boards` : `${item.itemCount} items`}
          </span>
          <span className="ml-auto font-mono text-2xs text-muted-foreground">{item.edited}</span>
        </div>
      </div>
    </>
  );

  if (item.kind === "board") {
    // TEMP: every board opens the one demo board until boards have ids and data.
    return (
      <Link
        to="/board"
        className="flex h-[280px] flex-col border border-divider bg-card transition-colors duration-150 ease-standard hover:border-input"
      >
        {body}
      </Link>
    );
  }

  // Projects read as a stack of boards: two sheets peek out above the card.
  return (
    <article className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-x-6 -top-3.5 h-3.5 border border-divider bg-background"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-3 -top-[7px] h-3.5 border border-divider bg-card"
      />
      <div className="relative flex h-[280px] flex-col border border-divider bg-card">{body}</div>
    </article>
  );
}

function ProjectTiles({ item }: { item: Extract<WorkspaceItem, { kind: "project" }> }) {
  const shown = item.tiles.slice(0, VISIBLE_TILES);
  const more = item.boardCount - shown.length;

  return (
    <div className="grid size-full grid-cols-2 grid-rows-2 gap-2 p-2">
      {shown.map((shapes, i) => (
        <div key={i} className="min-h-0 border border-divider bg-background">
          <Sketch {...PROJECT_TILE} shapes={shapes} />
        </div>
      ))}
      {more > 0 ? (
        <div className="flex items-center justify-center bg-secondary font-mono text-[13px] font-bold text-secondary-foreground">
          +{more} more
        </div>
      ) : (
        <div aria-hidden="true" className="border border-dashed border-input bg-card" />
      )}
    </div>
  );
}

import { arrowRelation, relationKind } from "@prism/shared";
import { cn } from "@/lib/utils";
import { type BoardElement, displayColor } from "./board-model";
import { Row } from "./properties-panel";

// A table's details card (tools.md §1, tool 20): shown on the right while a table is hovered.

/** One relation of a table, as its details card lists it. */
interface TableLink {
  arrow: BoardElement;
  /** The table at the other end (the same table for a relation to itself). */
  other: BoardElement;
  /** This table's foreign key column, or the other table's that points here. */
  ownColumn: string | null;
  otherColumn: string | null;
  /** Read from this table: User to Account is "1 To M", Account to User "M To 1". */
  kind: string | null;
}

/**
 * A hovered table's details: its name, description and size, and every relation it takes part
 * in, both its own foreign keys (references) and other tables' keys that point at it (referenced
 * by). A relation or table name selects it on the board, which opens it in the properties panel.
 */
export function TableDetails({
  table,
  board,
  onSelect,
}: {
  table: BoardElement;
  board: BoardElement[];
  onSelect: (ids: string[]) => void;
}) {
  const byId = new Map(board.map((el) => [el.id, el]));
  const references: TableLink[] = [];
  const referencedBy: TableLink[] = [];
  for (const arrow of board) {
    if (arrow.type !== "arrow") continue;
    if (arrow.startBinding !== table.id && arrow.endBinding !== table.id) continue;
    const relation = arrowRelation(arrow, byId);
    if (!relation) continue;
    const ends = [arrow.startBinding, arrow.endBinding].map((id) =>
      id ? byId.get(id) : undefined,
    );
    const own = relation.from.table === table.table?.name;
    const otherName = own ? relation.to.table : relation.from.table;
    const other = ends.find((el) => el?.table?.name === otherName) ?? table;
    const link = {
      arrow,
      other,
      ownColumn: own ? relation.from.column : relation.to.column,
      otherColumn: own ? relation.to.column : relation.from.column,
      kind: own
        ? relationKind(relation.fromHead, relation.toHead)
        : relationKind(relation.toHead, relation.fromHead),
    };
    (own ? references : referencedBy).push(link);
  }
  const columns = table.table?.columns.length ?? 0;
  const link = (item: TableLink, outgoing: boolean) => (
    <li key={item.arrow.id} className="flex items-start gap-2">
      <span
        aria-hidden="true"
        className="mt-1.5 size-2 shrink-0 rounded-full"
        style={{ backgroundColor: displayColor(item.arrow.stroke) }}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onSelect([item.other.id])}
          className="max-w-full truncate text-left text-xs font-semibold text-ink hover:underline"
        >
          {item.other.table?.name ?? "table"}
        </button>
        <button
          type="button"
          onClick={() => onSelect([item.arrow.id])}
          title="Select this relation"
          className="block max-w-full truncate text-left font-mono text-3xs text-muted-foreground hover:text-ink"
        >
          {/* Read from this table, like the pill: its column first, the arrow pointing the way
              the foreign key points (User: "id ← Account.userId", Account: "userId → User.id"). */}
          {`${item.ownColumn ?? "—"} ${outgoing ? "→" : "←"} ${item.other.table?.name ?? "table"}.${item.otherColumn ?? "—"}`}
        </button>
      </div>
      {item.kind && (
        <button
          type="button"
          title={`${table.table?.name ?? "table"} ${item.kind} ${item.other.table?.name ?? "table"}`}
          onClick={() => onSelect([item.arrow.id])}
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-3xs font-bold"
          style={{
            backgroundColor: displayColor(item.arrow.stroke),
            // Themed inks turn light on the night board, so their text takes the page color.
            color: displayColor(item.arrow.stroke).startsWith("var(")
              ? "var(--background)"
              : "#ffffff",
          }}
        >
          {item.kind}
        </button>
      )}
    </li>
  );
  return (
    <section aria-label="Table details" className="flex flex-col gap-3 px-4 pt-3.5 pb-5">
      <div>
        <p className="truncate text-sm font-bold text-ink">{table.table?.name}</p>
        <p className="font-mono text-3xs text-muted-foreground">
          {columns} {columns === 1 ? "column" : "columns"} ·{" "}
          {references.length + referencedBy.length}{" "}
          {references.length + referencedBy.length === 1 ? "relation" : "relations"}
        </p>
      </div>
      <p
        className={cn(
          "text-xs leading-relaxed whitespace-pre-line",
          table.table?.description ? "text-foreground" : "text-muted-foreground italic",
        )}
      >
        {table.table?.description || "No description"}
      </p>
      {references.length + referencedBy.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No relations yet. Draw an arrow from a column&rsquo;s row to another table.
        </p>
      ) : (
        <>
          {references.length > 0 && (
            <Row label="References">
              <ul className="flex flex-col gap-2">{references.map((item) => link(item, true))}</ul>
            </Row>
          )}
          {referencedBy.length > 0 && (
            <Row label="Referenced by">
              <ul className="flex flex-col gap-2">
                {referencedBy.map((item) => link(item, false))}
              </ul>
            </Row>
          )}
        </>
      )}
    </section>
  );
}

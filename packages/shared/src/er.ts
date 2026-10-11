import { z } from "zod";
import {
  type BoardElement,
  type Cardinality,
  cardinalitySchema,
  type ConnectorRoute,
  type ConnectorSide,
  type FontFamily,
  TABLE_COLUMNS_MAX,
  TABLE_DESCRIPTION_MAX,
  type TableColumn,
  type TableData,
} from "./elements.js";
import { layoutErDiagram } from "./er-layout.js";
import type { LayoutElement, TextMeasurer } from "./layout.js";

// ER diagrams (tools.md §1, tool 20): "table" elements hold a database table's name and columns;
// a relation is an arrow bound to two tables, each end at a column's row, with crow's-foot heads.
// This holds what the board and the server share: table sizing, where a relation meets a table,
// elbow routing, reading a diagram back as a schema, and building one for create_er_diagram.

export const TABLE_HEADER_HEIGHT = 36;
export const TABLE_ROW_HEIGHT = 28;
/** Room between a table's edge and its text. */
export const TABLE_PAD_X = 12;
/** Room for the key / link icon before a column's name. */
export const TABLE_ICON_SPACE = 20;
export const TABLE_ICON_SIZE = 13;
/** Least room between a column's name and its type. */
export const TABLE_TYPE_GAP = 24;
export const TABLE_MIN_WIDTH = 160;
/** Text sizes: the table's name, column names, column types (in the mono font). */
export const TABLE_TITLE_PX = 14;
export const TABLE_TEXT_PX = 13;
export const TABLE_TYPE_PX = 12;
export const TABLE_TEXT_COLOR = "#3d3b4f";

/** What a new table looks like, on the board and from create_er_diagram. */
export const TABLE_STYLE = {
  stroke: "#5882ff",
  fill: null,
  strokeWidth: 1,
  font: "sans",
  shadow: "sm",
} as const satisfies Partial<BoardElement>;
/** What a new relation looks like (create_er_diagram colors it after the table it points at). */
export const RELATION_STYLE = {
  stroke: "#5f5f5f",
  strokeWidth: 1.5,
} as const satisfies Partial<BoardElement>;

/** A relation's color when the palette has none to give. */
export const ER_NEUTRAL = "#5f5f5f";

/**
 * The colors create_er_diagram gives relations, one each, so every line can be told apart and
 * followed. Mid-tones that hold up on the light and the dark board.
 */
export const ER_COLORS = [
  "#3e63dd",
  "#e5484d",
  "#12a594",
  "#f76b15",
  "#8e4ec6",
  "#d6409f",
  "#46a758",
  "#a07553",
  "#0797b9",
  "#b8860b",
  "#5b5bd6",
];

/**
 * A color for each relation: the first in ER_COLORS that no other relation at either of its tables
 * has yet (else the least used of those), so lines meeting at a table always differ.
 */
export function relationColors(relations: { from: { table: string }; to: { table: string } }[]) {
  const atTable = new Map<string, string[]>();
  const uses = new Map<string, number>();
  return relations.map((relation) => {
    const near = new Set([
      ...(atTable.get(relation.from.table) ?? []),
      ...(atTable.get(relation.to.table) ?? []),
    ]);
    const free = ER_COLORS.find((color) => !near.has(color));
    const color =
      free ??
      [...ER_COLORS].sort((a, b) => (uses.get(a) ?? 0) - (uses.get(b) ?? 0))[0] ??
      ER_NEUTRAL;
    uses.set(color, (uses.get(color) ?? 0) + 1);
    for (const table of new Set([relation.from.table, relation.to.table])) {
      atTable.set(table, [...(atTable.get(table) ?? []), color]);
    }
    return color;
  });
}

/** How each cardinality reads on its badge. */
export const CARDINALITY_LABELS: Record<Cardinality, string> = {
  one: "1",
  "zero-or-one": "0..1",
  many: "N",
  "zero-or-many": "0..N",
  "one-or-many": "1..N",
};

/** The text a column's type shows: "String?" when nullable, "· unique" when unique. */
export function columnTypeLabel(column: TableColumn) {
  const nullable = column.nullable && !column.type.endsWith("?") ? "?" : "";
  const unique = column.unique && !column.pk ? " · unique" : "";
  return `${column.type}${nullable}${unique}`;
}

/**
 * The columns a table shows, with their index among all its columns: every one, or with
 * `keysOnly` its primary and foreign keys, followed by a "+N more" row for the `hidden` rest.
 */
export function tableRows(table: TableData | undefined, keysOnly = false) {
  const columns = table?.columns ?? [];
  const all = columns.map((column, index) => ({ column, index }));
  if (!keysOnly) return { shown: all, hidden: 0 };
  const shown = all.filter(({ column }) => column.pk || column.fk);
  return { shown, hidden: columns.length - shown.length };
}

/** The "+N more" row of a keys-only table. */
export const moreColumnsLabel = (hidden: number) => `+${hidden} more`;

/** A table's height: the header and one row per row it shows (one empty row when it has none). */
export const tableHeight = (table: TableData | undefined, keysOnly = false) => {
  const { shown, hidden } = tableRows(table, keysOnly);
  return TABLE_HEADER_HEIGHT + Math.max(1, shown.length + (hidden > 0 ? 1 : 0)) * TABLE_ROW_HEIGHT;
};

/** A table's box for the rows it shows, measured with `measureText`. */
export function tableSize(
  table: TableData,
  font: FontFamily,
  measureText: TextMeasurer,
  keysOnly = false,
) {
  const width = (text: string, px: number, weight: number, family: FontFamily) =>
    text ? measureText(text, { font: family, px, weight, letterSpacing: 0 }, null).width : 0;
  const { shown, hidden } = tableRows(table, keysOnly);
  let widest = width(table.name, TABLE_TITLE_PX, 700, font);
  for (const { column } of shown) {
    const name = width(column.name, TABLE_TEXT_PX, column.pk ? 600 : 400, font);
    const type = width(columnTypeLabel(column), TABLE_TYPE_PX, 400, "mono");
    widest = Math.max(widest, TABLE_ICON_SPACE + name + (type ? TABLE_TYPE_GAP + type : 0));
  }
  if (hidden > 0) {
    widest = Math.max(
      widest,
      TABLE_ICON_SPACE + width(moreColumnsLabel(hidden), TABLE_TEXT_PX, 400, font),
    );
  }
  return {
    width: Math.max(TABLE_MIN_WIDTH, Math.ceil(widest) + 2 * TABLE_PAD_X + 2),
    height: tableHeight(table, keysOnly),
  };
}

// ── Where relations meet tables ───────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

type TableBox = Box & Pick<BoardElement, "rotation" | "table" | "keysOnly">;

/** The index of `column` in the table, or -1. */
export const columnIndex = (table: TableData | undefined, column: string | null | undefined) =>
  column ? (table?.columns.findIndex((c) => c.name === column) ?? -1) : -1;

/**
 * How far below a table's top an end at `column` meets it: the middle of that column's row, of
 * the "+N more" row when a keys-only table hides it, or of the header when there's no such column.
 */
export function columnRowY(
  table: TableData | undefined,
  column: string | null | undefined,
  keysOnly = false,
) {
  const index = columnIndex(table, column);
  if (index < 0) return TABLE_HEADER_HEIGHT / 2;
  const { shown } = tableRows(table, keysOnly);
  const row = shown.findIndex((r) => r.index === index);
  return TABLE_HEADER_HEIGHT + ((row < 0 ? shown.length : row) + 0.5) * TABLE_ROW_HEIGHT;
}

/** Where an end at `column` meets the table's left or right edge (columnRowY). */
export function tableAnchor(
  table: TableBox,
  column: string | null | undefined,
  side: "left" | "right",
): Point {
  const y = table.y + columnRowY(table.table, column, !!table.keysOnly);
  const point = { x: side === "left" ? table.x : table.x + table.width, y };
  if (!table.rotation) return point;
  const cx = table.x + table.width / 2;
  const cy = table.y + table.height / 2;
  const rad = (table.rotation * Math.PI) / 180;
  const dx = point.x - cx;
  const dy = point.y - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/**
 * The side of `table` a relation to `other` leaves through: toward the other table, or the right
 * when they overlap side by side (one above the other) or it's the same table.
 */
export function tableSide(table: Box, other: Box, same = false): "left" | "right" {
  if (same) return "right";
  if (other.x + other.width <= table.x) return "left";
  return "right";
}

/** Both ends of a relation from `from`'s `fromColumn` to `to`'s `toColumn`, and their sides. */
export function relationRoute(
  from: TableBox,
  fromColumn: string | null | undefined,
  to: TableBox,
  toColumn: string | null | undefined,
  same = false,
) {
  const startSide = tableSide(from, to, same);
  const endSide = tableSide(to, from, same);
  return {
    start: tableAnchor(from, fromColumn, startSide),
    end: tableAnchor(to, toColumn, endSide),
    startSide,
    endSide,
  };
}

// ── Elbow routing ─────────────────────────────────────────────────────────

/** How far an elbow line runs straight out of a side before it turns. */
export const ELBOW_STUB = 28;

const DIRECTION: Record<ConnectorSide, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

const isHorizontal = (side: ConnectorSide) => side === "left" || side === "right";

/** The side an unattached elbow end at `from` goes out of: the one facing the other end. */
function facingSide(from: Point, to: Point): ConnectorSide {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

/** Drops repeated points and the middle of three in a straight line. */
function simplify(points: Point[]) {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue;
    const before = out[out.length - 2];
    if (
      before &&
      last &&
      ((Math.abs(before.x - last.x) < 0.01 && Math.abs(last.x - p.x) < 0.01) ||
        (Math.abs(before.y - last.y) < 0.01 && Math.abs(last.y - p.y) < 0.01))
    ) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

/**
 * Right-angle points from `start` (leaving through `startSide`) to `end` (entering through
 * `endSide`). Lines facing each other turn once in a channel between them (the middle for close
 * shapes, beside the end for far ones, where columns of tables leave a gap); lines leaving the
 * same way go around past the farther end; lines facing away step around through the middle.
 */
export function elbowPoints(
  start: Point,
  end: Point,
  startSide: ConnectorSide = facingSide(start, end),
  endSide: ConnectorSide = facingSide(end, start),
): Point[] {
  const ds = DIRECTION[startSide];
  const de = DIRECTION[endSide];
  const p1 = { x: start.x + ds.x * ELBOW_STUB, y: start.y + ds.y * ELBOW_STUB };
  const p2 = { x: end.x + de.x * ELBOW_STUB, y: end.y + de.y * ELBOW_STUB };
  let middle: Point[];

  if (isHorizontal(startSide) && isHorizontal(endSide)) {
    if (ds.x !== de.x) {
      const room = ds.x > 0 ? p1.x <= p2.x : p1.x >= p2.x;
      if (room) {
        const x = Math.abs(end.x - start.x) < 200 ? (start.x + end.x) / 2 : p2.x;
        middle = [
          { x, y: start.y },
          { x, y: end.y },
        ];
      } else {
        const y = (start.y + end.y) / 2;
        middle = [p1, { x: p1.x, y }, { x: p2.x, y }, p2];
      }
    } else {
      const x = ds.x > 0 ? Math.max(p1.x, p2.x) : Math.min(p1.x, p2.x);
      middle = [
        { x, y: start.y },
        { x, y: end.y },
      ];
    }
  } else if (!isHorizontal(startSide) && !isHorizontal(endSide)) {
    if (ds.y !== de.y) {
      const room = ds.y > 0 ? p1.y <= p2.y : p1.y >= p2.y;
      if (room) {
        const y = Math.abs(end.y - start.y) < 200 ? (start.y + end.y) / 2 : p2.y;
        middle = [
          { x: start.x, y },
          { x: end.x, y },
        ];
      } else {
        const x = (start.x + end.x) / 2;
        middle = [p1, { x, y: p1.y }, { x, y: p2.y }, p2];
      }
    } else {
      const y = ds.y > 0 ? Math.max(p1.y, p2.y) : Math.min(p1.y, p2.y);
      middle = [
        { x: start.x, y },
        { x: end.x, y },
      ];
    }
  } else if (isHorizontal(startSide)) {
    // One turn where the line can enter the end straight; else around through both stubs.
    const corner = { x: end.x, y: start.y };
    const ahead = (corner.x - start.x) * ds.x > 0 && (corner.y - end.y) * de.y > 0;
    middle = ahead ? [corner] : [p1, { x: p1.x, y: p2.y }, p2];
  } else {
    const corner = { x: start.x, y: end.y };
    const ahead = (corner.y - start.y) * ds.y > 0 && (corner.x - end.x) * de.x > 0;
    middle = ahead ? [corner] : [p1, { x: p2.x, y: p1.y }, p2];
  }
  return simplify([start, ...middle, end]);
}

/**
 * An elbow route through `lanes` (x, y, x, … offsets from `start`, an odd count): across to the
 * first x, along to the y, across to the next x, …, along to the end's row, then into the end.
 */
export function lanePoints(start: Point, end: Point, lanes: number[]): Point[] {
  const points = [start];
  let at = start;
  lanes.forEach((value, i) => {
    at = i % 2 === 0 ? { x: start.x + value, y: at.y } : { x: at.x, y: start.y + value };
    points.push(at);
  });
  points.push({ x: at.x, y: end.y }, end);
  return simplify(points);
}

/** A line or arrow's points: its two ends, or the elbow route between them. */
export function connectorPoints(
  el: Pick<
    BoardElement,
    "x" | "y" | "width" | "height" | "type" | "route" | "startSide" | "endSide" | "lanes"
  >,
): Point[] {
  const start = { x: el.x, y: el.y };
  const end = { x: el.x + el.width, y: el.y + el.height };
  if (el.type !== "arrow" || el.route !== "elbow") return [start, end];
  if (el.lanes && el.lanes.length % 2 === 1) return lanePoints(start, end, el.lanes);
  return elbowPoints(start, end, el.startSide ?? undefined, el.endSide ?? undefined);
}

// ── Reading relations ─────────────────────────────────────────────────────

const MANY = new Set<Cardinality>(["many", "zero-or-many", "one-or-many"]);
export const isMany = (head: Cardinality | null | undefined) => !!head && MANY.has(head);

/**
 * What a relation is, read from its first end to its second: "1 To 1", "1 To M", "M To M" or
 * "M To 1" (one: one or zero-or-one; M: any many). Null without both heads.
 */
export function relationKind(
  fromHead: Cardinality | null | undefined,
  toHead: Cardinality | null | undefined,
) {
  if (!fromHead || !toHead) return null;
  return `${isMany(fromHead) ? "M" : "1"} To ${isMany(toHead) ? "M" : "1"}`;
}

/** One ER relation: `from` holds the foreign key column that references `to`. */
export interface ErRelation {
  from: { table: string; column: string | null };
  to: { table: string; column: string | null };
  fromHead: Cardinality | null;
  toHead: Cardinality | null;
  /** The arrow that draws it. */
  id?: string;
}

/** "Post.authorId → User.id (M To 1)". */
export function relationText(relation: ErRelation) {
  const end = (e: ErRelation["from"]) => (e.column ? `${e.table}.${e.column}` : e.table);
  const kind = relationKind(relation.fromHead, relation.toHead);
  return `${end(relation.from)} → ${end(relation.to)}${kind ? ` (${kind})` : ""}`;
}

/**
 * The relation an arrow between two tables draws, its foreign key end first: the end whose column
 * is marked fk, else a "many" end, else the arrow's start. Null when it isn't between two tables.
 */
export function arrowRelation(
  arrow: BoardElement,
  byId: Map<string, BoardElement>,
): ErRelation | null {
  if (arrow.type !== "arrow") return null;
  const a = arrow.startBinding ? byId.get(arrow.startBinding) : undefined;
  const b = arrow.endBinding ? byId.get(arrow.endBinding) : undefined;
  if (a?.type !== "table" || b?.type !== "table" || !a.table || !b.table) return null;
  const column = (table: TableData, name: string | null | undefined) =>
    name && table.columns.some((c) => c.name === name) ? name : null;
  const start = {
    end: { table: a.table.name, column: column(a.table, arrow.startColumn) },
    head: arrow.startHead ?? null,
  };
  const end = {
    end: { table: b.table.name, column: column(b.table, arrow.endColumn) },
    head: arrow.endHead ?? null,
  };
  const score = (side: typeof start, table: TableData) =>
    (table.columns.find((c) => c.name === side.end.column)?.fk ? 2 : 0) +
    (isMany(side.head) ? 1 : 0);
  const [from, to] = score(end, b.table) > score(start, a.table) ? [end, start] : [start, end];
  return { from: from.end, to: to.end, fromHead: from.head, toHead: to.head, id: arrow.id };
}

/** A diagram's tables and relations, as get_schema_code and create_er_diagram see them. */
export interface ErSchema {
  tables: TableData[];
  relations: ErRelation[];
}

/**
 * The ER diagram on a board: every table (or those in `ids`, with the relations between them,
 * and the tables at both ends of relations in `ids`), and the arrows that join two of them.
 */
export function erSchemaOf(elements: BoardElement[], ids?: Iterable<string>): ErSchema {
  const byId = new Map(elements.map((el) => [el.id, el]));
  let picked: Set<string> | null = null;
  if (ids) {
    picked = new Set(ids);
    for (const id of [...picked]) {
      const el = byId.get(id);
      if (el?.type !== "arrow") continue;
      if (el.startBinding) picked.add(el.startBinding);
      if (el.endBinding) picked.add(el.endBinding);
    }
  }
  const tables = elements.filter(
    (el) => el.type === "table" && el.table && (!picked || picked.has(el.id)),
  );
  const tableIds = new Set(tables.map((el) => el.id));
  const relations = elements.flatMap((el) => {
    if (el.type !== "arrow" || !el.startBinding || !el.endBinding) return [];
    if (!tableIds.has(el.startBinding) || !tableIds.has(el.endBinding)) return [];
    const relation = arrowRelation(el, byId);
    return relation ? [relation] : [];
  });
  return { tables: tables.flatMap((el) => (el.table ? [el.table] : [])), relations };
}

// ── Building a diagram (create_er_diagram) ────────────────────────────────

const columnInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .describe('The column\'s name as in the database, e.g. "authorId".'),
  type: z
    .string()
    .max(64)
    .describe(
      'Its type as the source writes it: "String", "Int", "DateTime", "uuid", "varchar(255)", an enum name.',
    ),
  pk: z.boolean().optional().describe("Part of the primary key."),
  fk: z
    .boolean()
    .optional()
    .describe("A foreign key. Columns at the from end of a relation are marked fk anyway."),
  nullable: z.boolean().optional().describe("Can be NULL (Prisma's `String?`)."),
  unique: z.boolean().optional().describe("Has a unique constraint of its own."),
});

export const erTableInputSchema = z.object({
  name: z.string().min(1).max(64).describe('The table (or model) name, e.g. "User".'),
  description: z
    .string()
    .max(TABLE_DESCRIPTION_MAX)
    .optional()
    .describe(
      "What the table holds, in a sentence (from the schema's comments when it has them). Shown in the table's details card.",
    ),
  columns: z
    .array(columnInputSchema)
    .max(TABLE_COLUMNS_MAX)
    .describe(
      "Database columns, top to bottom (primary key first). Scalar columns only: a Prisma relation field (author User) is a relation, not a column.",
    ),
});

const relationEnd = z.object({
  table: z.string().min(1).max(64),
  column: z.string().min(1).max(64),
});

export const erRelationInputSchema = z.object({
  from: relationEnd.describe(
    'The foreign key: { table: "Post", column: "authorId" }. For a many-to-many, draw the join table and one relation from each of its foreign keys.',
  ),
  to: relationEnd.describe('The column it references: { table: "User", column: "id" }.'),
  fromHead: cardinalitySchema
    .optional()
    .describe(
      'How many from-rows one to-row has: "zero-or-many" (default), "one-or-many", "many", "zero-or-one" (a unique foreign key: one-to-one) or "one".',
    ),
  toHead: cardinalitySchema
    .optional()
    .describe(
      'How many to-rows one from-row points at: "one" (default) or "zero-or-one" (the default when the foreign key is nullable).',
    ),
});

export type ErTableInput = z.infer<typeof erTableInputSchema>;
export type ErRelationInput = z.infer<typeof erRelationInputSchema>;

/** Most tables and relations one create_er_diagram call can draw. */
export const ER_TABLES_MAX = 80;
export const ER_RELATIONS_MAX = 300;

/** What's wrong with a diagram's input: repeated names, relations to tables or columns not given. */
export function erInputProblems(tables: ErTableInput[], relations: ErRelationInput[]) {
  const problems: string[] = [];
  const byName = new Map<string, ErTableInput>();
  for (const table of tables) {
    if (byName.has(table.name)) problems.push(`The table "${table.name}" is given twice.`);
    byName.set(table.name, table);
    const seen = new Set<string>();
    for (const column of table.columns) {
      if (seen.has(column.name)) problems.push(`${table.name}.${column.name} is given twice.`);
      seen.add(column.name);
    }
  }
  relations.forEach((relation, i) => {
    for (const end of [relation.from, relation.to]) {
      const table = byName.get(end.table);
      if (!table) problems.push(`relations[${i}]: no table "${end.table}" in tables.`);
      else if (!table.columns.some((c) => c.name === end.column)) {
        problems.push(`relations[${i}]: ${end.table} has no column "${end.column}".`);
      }
    }
  });
  return problems;
}

export interface ErDiagramOptions {
  /** Top-left of the diagram. */
  x: number;
  y: number;
  font: FontFamily;
  route: ConnectorRoute;
  /** Tables show only their key columns (and "+N more"). */
  compact?: boolean | undefined;
}

/** A diagram element to create: a table or a relation, with keys standing in for ids. */
export type ErElement = LayoutElement & { key: string };

/**
 * A diagram's tables (sized by `measureText`, laid out and routed by foreign key: layoutErDiagram)
 * and its relations (arrows bound to the tables, each end at its column's row, with crow's-foot
 * heads), drawn under the tables. Columns at a relation's from end are marked fk. Each relation
 * gets its own color (relationColors).
 */
export function buildErDiagram(
  tables: ErTableInput[],
  relations: ErRelationInput[],
  options: ErDiagramOptions,
  measureText: TextMeasurer,
): ErElement[] {
  const keysOnly = !!options.compact;
  const foreign = new Set(relations.map((r) => `${r.from.table}\u0000${r.from.column}`));
  const data: TableData[] = tables.map((table) => ({
    name: table.name,
    ...(table.description?.trim() && { description: table.description.trim() }),
    columns: table.columns.map((column) => {
      const out: TableColumn = { name: column.name, type: column.type };
      if (column.pk) out.pk = true;
      if (column.fk ?? foreign.has(`${table.name}\u0000${column.name}`)) out.fk = true;
      if (column.nullable) out.nullable = true;
      if (column.unique) out.unique = true;
      return out;
    }),
  }));
  const byName = new Map(data.map((table) => [table.name, table]));
  const sizes = data.map((table) => tableSize(table, options.font, measureText, keysOnly));
  const layout = layoutErDiagram(
    data.map((table, i) => ({ id: table.name, ...(sizes[i] ?? { width: 0, height: 0 }) })),
    relations.map((r) => ({
      from: r.from.table,
      to: r.to.table,
      fromY: columnRowY(byName.get(r.from.table), r.from.column, keysOnly),
      toY: columnRowY(byName.get(r.to.table), r.to.column, keysOnly),
    })),
  );

  const colors = relationColors(relations);

  const keyOf = new Map(data.map((table, i) => [table.name, `table:${i}`]));
  const boxes = new Map<string, TableBox>();
  const tableElements: ErElement[] = data.map((table, i) => {
    const size = sizes[i] ?? { width: TABLE_MIN_WIDTH, height: tableHeight(table, keysOnly) };
    const at = layout.positions.get(table.name) ?? { x: 0, y: 0 };
    const box = { x: options.x + at.x, y: options.y + at.y, ...size, rotation: 0, table, keysOnly };
    boxes.set(table.name, box);
    return {
      key: keyOf.get(table.name) ?? `table:${i}`,
      type: "table",
      ...TABLE_STYLE,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      table,
      autoWidth: true,
      ...(keysOnly && { keysOnly: true }),
    };
  });

  const lines: ErElement[] = [];
  relations.forEach((relation, i) => {
    const from = boxes.get(relation.from.table);
    const to = boxes.get(relation.to.table);
    if (!from || !to) return;
    const column = byName
      .get(relation.from.table)
      ?.columns.find((c) => c.name === relation.from.column);
    const planned = layout.routes[i];
    const route =
      planned && options.route === "elbow"
        ? {
            start: { x: options.x + planned.start.x, y: options.y + planned.start.y },
            end: { x: options.x + planned.end.x, y: options.y + planned.end.y },
            startSide: planned.startSide,
            endSide: planned.endSide,
          }
        : relationRoute(
            from,
            relation.from.column,
            to,
            relation.to.column,
            relation.from.table === relation.to.table,
          );
    // The lanes, from the start (the layout's are from the diagram's corner).
    const lanes =
      planned && options.route === "elbow"
        ? planned.lanes.map((v, j) =>
            j % 2 === 0 ? options.x + v - route.start.x : options.y + v - route.start.y,
          )
        : null;
    lines.push({
      key: `relation:${i}`,
      type: "arrow",
      ...RELATION_STYLE,
      stroke: colors[i] ?? RELATION_STYLE.stroke,
      x: route.start.x,
      y: route.start.y,
      width: route.end.x - route.start.x,
      height: route.end.y - route.start.y,
      startBinding: keyOf.get(relation.from.table) ?? null,
      endBinding: keyOf.get(relation.to.table) ?? null,
      startColumn: relation.from.column,
      endColumn: relation.to.column,
      startHead: relation.fromHead ?? (column?.unique ? "zero-or-one" : "zero-or-many"),
      endHead: relation.toHead ?? (column?.nullable ? "zero-or-one" : "one"),
      route: options.route,
      ...(options.route === "elbow" && { startSide: route.startSide, endSide: route.endSide }),
      ...(lanes && { lanes }),
    });
  });
  // Relations under the tables: their ends tuck under the table edges.
  return [...lines, ...tableElements];
}

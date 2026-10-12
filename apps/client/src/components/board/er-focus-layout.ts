import { arrowRelation, columnRowY, type ErLayoutEdge, layoutErDiagram } from "@prism/shared";
import type { BoardElement } from "./board-model";
import { erFocus, routeArrow } from "./geometry";
import { fitTextBox } from "./text-layout";

// The focus view's own layout: a table and the tables it's related to, packed together by
// layoutErDiagram (the create_er_diagram layout) instead of where they sit on the board, which
// can be far apart. Only copies move: the board keeps its own positions.

/** Each extra sub-column costs little here: showing the group larger matters more. */
const COLUMN_COST = 0.05;
const MAX_SPLIT = 8;

/**
 * The table `focusId`, the tables it's related to and the relations between it and them, laid
 * out and routed on their own, bottom layer first: relations under tables, as create_er_diagram
 * draws them. When `focusId` is null, all tables and relations in `elements` are laid out.
 * Tall columns split as far as that shows the group larger in `view` (the space it's shown in, px).
 * With `keysOnly` every table but the focused one shows only its key columns.
 * Null when `focusId` isn't a table or no tables exist.
 */
export function focusLayout(
  elements: BoardElement[],
  focusId: string | null,
  { keysOnly = false, view }: { keysOnly?: boolean; view?: { width: number; height: number } } = {},
): BoardElement[] | null {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const focused = focusId ? byId.get(focusId) : null;
  if (focusId && focused?.type !== "table") return null;
  const focus = focusId ? (erFocus(elements, [focusId]) ?? new Set([focusId])) : null;

  const tables = elements
    .filter((el) => el.type === "table" && (!focus || focus.has(el.id)))
    .map((el) => {
      // Upright, and sized to the rows it shows here.
      const table: BoardElement = { ...el, rotation: 0 };
      if (keysOnly && el.id !== focusId) table.keysOnly = true;
      return fitTextBox(table);
    });
  if (tables.length === 0) return null;
  const sized = new Map(tables.map((el) => [el.id, el]));
  // Only relations between the tables shown: an arrow to some other shape stays on the board.
  const arrows = elements.filter(
    (el) =>
      el.type === "arrow" &&
      (!focus || focus.has(el.id)) &&
      !!el.startBinding &&
      !!el.endBinding &&
      sized.has(el.startBinding) &&
      sized.has(el.endBinding),
  );

  // The layout puts referenced tables left of the ones holding the foreign key, so each edge
  // runs from the foreign key's end; `fromStart` says whether that's the arrow's start.
  const edges = arrows.map((arrow) => {
    const relation = arrowRelation(arrow, byId);
    const start = sized.get(arrow.startBinding ?? "");
    const end = sized.get(arrow.endBinding ?? "");
    const fromStart = !relation || start === end || relation.from.table === start?.table?.name;
    const [from, to] = fromStart ? [start, end] : [end, start];
    const [fromColumn, toColumn] = fromStart
      ? [arrow.startColumn, arrow.endColumn]
      : [arrow.endColumn, arrow.startColumn];
    const edge: ErLayoutEdge = {
      from: from?.id ?? "",
      to: to?.id ?? "",
      fromY: columnRowY(from?.table, fromColumn, !!from?.keysOnly),
      toY: columnRowY(to?.table, toColumn, !!to?.keysOnly),
    };
    return { arrow, edge, fromStart };
  });

  const layout = layoutErDiagram(
    tables.map((el) => ({ id: el.id, width: el.width, height: el.height })),
    edges.map((e) => e.edge),
    { ...(view && { fit: view }), columnCost: COLUMN_COST, maxSplit: MAX_SPLIT },
  );
  const placed = tables.map((el) => {
    const at = layout.positions.get(el.id) ?? { x: el.x, y: el.y };
    return { ...el, x: at.x, y: at.y };
  });
  const placedById = new Map(placed.map((el) => [el.id, el]));

  const routed = edges.map(({ arrow, fromStart }, i) => {
    const route = layout.routes[i];
    const elbow: BoardElement = { ...arrow, route: "elbow" };
    if (!route) return routeArrow({ ...elbow, lanes: null }, placedById);
    // The layout's route runs from the foreign key's end; an arrow drawn the other way takes it
    // reversed (lane values back to front, since x and y lanes alternate around an odd count).
    const [start, end] = fromStart ? [route.start, route.end] : [route.end, route.start];
    const [startSide, endSide] = fromStart
      ? [route.startSide, route.endSide]
      : [route.endSide, route.startSide];
    const lanes = fromStart ? route.lanes : [...route.lanes].reverse();
    return {
      ...elbow,
      x: start.x,
      y: start.y,
      width: end.x - start.x,
      height: end.y - start.y,
      startSide,
      endSide,
      // Stored from the arrow's start (the layout's are absolute).
      lanes: lanes.map((v, j) => (j % 2 === 0 ? v - start.x : v - start.y)),
    };
  });
  return [...routed, ...placed];
}

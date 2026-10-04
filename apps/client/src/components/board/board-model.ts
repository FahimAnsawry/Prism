// Board elements and the editor reducer. Field names follow tools.md §7; this is a local,
// single-user stand-in until the sync engine and the database exist.

export type ElementType = "text" | "sticky" | "rect" | "diamond" | "arrow";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type FontFamily = "sans" | "caveat" | "mono";
export type FontSize = "S" | "M" | "L" | "XL";
export type TextAlign = "left" | "center" | "right";

export interface BoardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z: number;
  stroke: string;
  fill: string | null;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  sketch: boolean;
  opacity: number;
  locked?: boolean;
  // text, sticky
  text?: string;
  font?: FontFamily;
  fontSize?: FontSize;
  fontWeight?: "normal" | "bold";
  textAlign?: TextAlign;
  // arrow: drawn from (x, y) to (x + width, y + height)
  startBinding?: string;
  endBinding?: string;
}

/** Pixel sizes behind S / M / L / XL, per font (Caveat runs small, so it steps up). */
export const FONT_SIZES: Record<FontFamily, Record<FontSize, number>> = {
  sans: { S: 16, M: 22, L: 30, XL: 40 },
  caveat: { S: 20, M: 26, L: 34, XL: 44 },
  mono: { S: 14, M: 18, L: 24, XL: 32 },
};

export const STROKE_WIDTHS = { thin: 1, medium: 2, thick: 4 } as const;

/**
 * The palette's neutral inks are stored as plain hex (they are board data and sync as-is) but
 * drawn through the theme, so a slate outline turns light on the night board instead of
 * vanishing. Accent colors draw as stored. Apply it with `style`: SVG presentation attributes
 * don't resolve var().
 */
const THEMED_INKS: Record<string, string> = {
  "#3d3b4f": "var(--foreground)", // slate
  "#2a2a2a": "var(--ink)", // onyx
  "#5f5f5f": "var(--muted-foreground)", // graphite
};

export function displayColor(color: string) {
  return THEMED_INKS[color.toLowerCase()] ?? color;
}

const base = {
  rotation: 0,
  stroke: "#3d3b4f",
  fill: null,
  strokeWidth: STROKE_WIDTHS.medium,
  strokeStyle: "solid",
  sketch: false,
  opacity: 1,
} satisfies Partial<BoardElement>;

/** "Test Board" from the Miro frame "10 Board · Drawing + selection", in canvas coordinates. */
export const DEMO_ELEMENTS: BoardElement[] = [
  {
    ...base,
    id: "title",
    type: "text",
    x: 360,
    y: 98,
    width: 159,
    height: 31,
    z: 0,
    stroke: "#2a2a2a",
    text: "Sign-in flow",
    font: "sans",
    fontSize: "M",
    fontWeight: "bold",
    textAlign: "left",
  },
  { ...base, id: "start", type: "rect", x: 360, y: 184, width: 240, height: 140, z: 1 },
  { ...base, id: "decision", type: "diamond", x: 760, y: 174, width: 200, height: 160, z: 2 },
  {
    ...base,
    id: "link",
    type: "arrow",
    x: 600,
    y: 254,
    width: 160,
    height: 0,
    z: 3,
    startBinding: "start",
    endBinding: "decision",
  },
  {
    ...base,
    id: "note",
    type: "sticky",
    x: 400,
    y: 404,
    width: 199,
    height: 228,
    z: 4,
    fill: "#ecffa3",
    text: "Add OAuth buttons first",
    font: "sans",
    fontSize: "M",
    textAlign: "center",
  },
  {
    ...base,
    id: "aside",
    type: "text",
    x: 680,
    y: 438,
    width: 384,
    height: 37,
    z: 5,
    text: "draw the error state next",
    font: "caveat",
    fontSize: "M",
    textAlign: "left",
  },
];

export interface BoardState {
  past: BoardElement[][];
  elements: BoardElement[];
  future: BoardElement[][];
  selectedId: string | null;
}

export type LayerMove = "back" | "down" | "up" | "front";

export type BoardAction =
  | { type: "select"; id: string | null }
  | { type: "update"; id: string; changes: Partial<BoardElement> }
  | { type: "delete"; id: string }
  | { type: "layer"; id: string; move: LayerMove }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 100;

export const initialBoardState: BoardState = {
  past: [],
  elements: DEMO_ELEMENTS,
  future: [],
  selectedId: "start",
};

function commit(state: BoardState, elements: BoardElement[]): BoardState {
  return {
    ...state,
    past: [...state.past, state.elements].slice(-HISTORY_LIMIT),
    elements,
    future: [],
  };
}

function keepSelection(state: BoardState): BoardState {
  const exists = state.elements.some((el) => el.id === state.selectedId);
  return exists ? state : { ...state, selectedId: null };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "select":
      return { ...state, selectedId: action.id };

    case "update": {
      const target = state.elements.find((el) => el.id === action.id);
      if (!target) return state;
      // Locked elements only accept the unlock itself.
      if (target.locked && !("locked" in action.changes)) return state;
      return commit(
        state,
        state.elements.map((el) => (el.id === action.id ? { ...el, ...action.changes } : el)),
      );
    }

    case "delete": {
      const target = state.elements.find((el) => el.id === action.id);
      if (!target || target.locked) return state;
      // Arrows attached to the deleted element go with it.
      const next = state.elements.filter(
        (el) => el.id !== action.id && el.startBinding !== action.id && el.endBinding !== action.id,
      );
      return { ...commit(state, next), selectedId: null };
    }

    case "layer": {
      const ordered = [...state.elements].sort((a, b) => a.z - b.z);
      const from = ordered.findIndex((el) => el.id === action.id);
      const moving = ordered[from];
      if (!moving || moving.locked) return state;
      const to = {
        back: 0,
        down: Math.max(0, from - 1),
        up: Math.min(ordered.length - 1, from + 1),
        front: ordered.length - 1,
      }[action.move];
      if (to === from) return state;
      ordered.splice(from, 1);
      ordered.splice(to, 0, moving);
      return commit(
        state,
        ordered.map((el, z) => ({ ...el, z })),
      );
    }

    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return keepSelection({
        ...state,
        past: state.past.slice(0, -1),
        elements: previous,
        future: [state.elements, ...state.future],
      });
    }

    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return keepSelection({
        ...state,
        past: [...state.past, state.elements],
        elements: next,
        future: rest,
      });
    }
  }
}

/** The display name the properties panel uses as its title. */
export function elementLabel(el: BoardElement) {
  switch (el.type) {
    case "text":
      return el.font === "caveat" ? "Handwriting" : "Text";
    case "sticky":
      return "Sticky note";
    case "rect":
      return "Rectangle";
    case "diamond":
      return "Diamond";
    case "arrow":
      return "Arrow";
  }
}

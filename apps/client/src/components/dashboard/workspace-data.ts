import type { SketchShape } from "./sketch";

// Placeholder workspace copied from the Miro frame "13 Dashboard · All". No API yet.

const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
): SketchShape => ({ kind: "rect", x, y, w, h, fill, stroke });
const line = (x1: number, y1: number, x2: number, y2: number): SketchShape => ({
  kind: "line",
  x1,
  y1,
  x2,
  y2,
});

/** Board cards: a 382×175 preview. */
export const BOARD_THUMB = { width: 382, height: 175 } as const;
/** Project cards: up to three 180×76 board tiles. */
export const PROJECT_TILE = { width: 180, height: 76 } as const;

const titleBar = rect(23, 17, 99, 12, "fill-slate");
const tileTitle = rect(11, 8, 47, 8, "fill-slate");
const fogRow = "fill-fog";

const thumbs = {
  schema: [
    titleBar,
    line(92, 99, 122, 99),
    line(183, 99, 214, 99),
    line(275, 99, 298, 99),
    rect(31, 84, 61, 30, "fill-ice", "stroke-slate"),
    rect(122, 84, 61, 30, "fill-sage", "stroke-slate"),
    rect(214, 84, 61, 30, "fill-lavender", "stroke-slate"),
    rect(298, 84, 61, 30, "fill-ice", "stroke-slate"),
    rect(122, 136, 61, 24, "fill-peach", "stroke-slate"),
    line(153, 114, 153, 136),
  ],
  notes: [
    titleBar,
    rect(46, 56, 38, 38, "fill-lime"),
    rect(122, 53, 38, 38, "fill-lavender"),
    rect(199, 63, 38, 38, "fill-ice"),
    rect(84, 109, 38, 38, "fill-peach"),
    rect(168, 112, 38, 38, "fill-seafoam"),
    rect(267, 70, 38, 38, "fill-lime"),
  ],
  journey: [
    titleBar,
    rect(23, 45, 99, 14, "fill-ice"),
    rect(23, 66, 99, 23, fogRow, "stroke-silver"),
    rect(23, 96, 99, 23, fogRow, "stroke-silver"),
    rect(23, 126, 99, 23, fogRow, "stroke-silver"),
    rect(137, 45, 99, 14, "fill-lime"),
    rect(137, 66, 99, 23, fogRow, "stroke-silver"),
    rect(137, 96, 99, 23, fogRow, "stroke-silver"),
    rect(252, 45, 99, 14, "fill-seafoam"),
    rect(252, 66, 99, 23, fogRow, "stroke-silver"),
    rect(252, 96, 99, 23, fogRow, "stroke-silver"),
    rect(252, 126, 99, 23, fogRow, "stroke-silver"),
  ],
  wireframe: [
    titleBar,
    rect(76, 42, 229, 119, "fill-fog", "stroke-edge"),
    rect(76, 42, 229, 14, "fill-silver"),
    rect(95, 68, 115, 14, "fill-slate"),
    rect(95, 92, 82, 8, "fill-silver"),
    rect(95, 113, 57, 14, "fill-brand"),
    rect(219, 68, 69, 60, "fill-ice"),
  ],
} satisfies Record<string, SketchShape[]>;

const tiles = {
  flow: [
    tileTitle,
    line(43, 43, 58, 43),
    line(86, 43, 101, 43),
    line(130, 43, 140, 43),
    rect(14, 36, 29, 13, "fill-ice", "stroke-slate"),
    rect(58, 36, 29, 13, "fill-sage", "stroke-slate"),
    rect(101, 36, 29, 13, "fill-lavender", "stroke-slate"),
    rect(140, 36, 29, 13, "fill-ice", "stroke-slate"),
    rect(58, 59, 29, 10, "fill-peach", "stroke-slate"),
    line(72, 49, 72, 59),
  ],
  columns: [
    tileTitle,
    rect(11, 20, 47, 8, "fill-ice"),
    rect(11, 29, 47, 10, fogRow, "stroke-silver"),
    rect(11, 42, 47, 10, fogRow, "stroke-silver"),
    rect(11, 55, 47, 10, fogRow, "stroke-silver"),
    rect(65, 20, 47, 8, "fill-lime"),
    rect(65, 29, 47, 10, fogRow, "stroke-silver"),
    rect(65, 42, 47, 10, fogRow, "stroke-silver"),
    rect(119, 20, 47, 8, "fill-seafoam"),
    rect(119, 29, 47, 10, fogRow, "stroke-silver"),
    rect(119, 42, 47, 10, fogRow, "stroke-silver"),
    rect(119, 55, 47, 10, fogRow, "stroke-silver"),
  ],
  chart: [
    tileTitle,
    rect(18, 35, 22, 30, "fill-steel"),
    rect(47, 24, 22, 42, "fill-ice"),
    rect(76, 43, 22, 23, "fill-lavender"),
    rect(104, 29, 22, 36, "fill-seafoam"),
    line(11, 65, 137, 65),
    rect(144, 23, 25, 8, "fill-peach"),
    rect(144, 35, 25, 8, "fill-lime"),
  ],
  stickies: [
    tileTitle,
    rect(22, 24, 17, 17, "fill-lime"),
    rect(58, 23, 17, 17, "fill-lavender"),
    rect(94, 27, 17, 17, "fill-ice"),
    rect(40, 47, 17, 17, "fill-peach"),
    rect(79, 49, 17, 17, "fill-seafoam"),
    rect(126, 30, 17, 17, "fill-lime"),
  ],
  window: [
    tileTitle,
    rect(36, 18, 108, 52, "fill-fog", "stroke-edge"),
    rect(36, 18, 108, 8, "fill-silver"),
    rect(45, 30, 54, 8, "fill-slate"),
    rect(45, 40, 39, 8, "fill-silver"),
    rect(45, 49, 27, 8, "fill-brand"),
    rect(103, 30, 32, 26, "fill-ice"),
  ],
} satisfies Record<string, SketchShape[]>;

export type WorkspaceItem =
  | {
      kind: "project";
      id: string;
      title: string;
      description: string;
      boardCount: number;
      edited: string;
      /** Previews of the first three boards. */
      tiles: SketchShape[][];
    }
  | {
      kind: "board";
      id: string;
      title: string;
      description: string;
      itemCount: number;
      edited: string;
      thumbnail: SketchShape[];
    };

export const WORKSPACE = {
  projectCount: 2,
  boardCount: 14,
  items: [
    {
      kind: "project",
      id: "q4-launch",
      title: "Q4 Launch",
      description: "Plan, research and user flows",
      boardCount: 6,
      edited: "2h ago",
      tiles: [tiles.flow, tiles.columns, tiles.chart],
    },
    {
      kind: "board",
      id: "database-schema",
      title: "Database Schema",
      description: "Core tables and relationships",
      itemCount: 26,
      edited: "6d ago",
      thumbnail: thumbs.schema,
    },
    {
      kind: "board",
      id: "kickoff-notes",
      title: "Kickoff Meeting Notes",
      description: "Notes from the project kickoff",
      itemCount: 30,
      edited: "6d ago",
      thumbnail: thumbs.notes,
    },
    {
      kind: "board",
      id: "onboarding-journey",
      title: "Onboarding Journey",
      description: "Steps from signup to activation",
      itemCount: 14,
      edited: "7d ago",
      thumbnail: thumbs.journey,
    },
    {
      kind: "project",
      id: "user-research",
      title: "User Research",
      description: "Interviews and synthesis",
      boardCount: 3,
      edited: "1d ago",
      tiles: [tiles.stickies, tiles.window, tiles.chart],
    },
    {
      kind: "board",
      id: "landing-wireframe",
      title: "Landing Wireframe",
      description: "Hero, features and pricing",
      itemCount: 144,
      edited: "7d ago",
      thumbnail: thumbs.wireframe,
    },
  ] satisfies WorkspaceItem[] as WorkspaceItem[],
};

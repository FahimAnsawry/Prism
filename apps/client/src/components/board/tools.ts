import {
  ArrowRight,
  ChartColumn,
  Circle,
  Diamond,
  Eraser,
  FileCode,
  Hand,
  Image,
  List,
  type LucideIcon,
  Minus,
  MousePointer2,
  Network,
  PenTool,
  Pencil,
  Smile,
  Shapes,
  Square,
  StickyNote,
  Type,
} from "lucide-react";

export type ToolId =
  | "select"
  | "hand"
  | "text"
  | "handwriting"
  | "sticky"
  | "list"
  | "rect"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "pencil"
  | "eraser"
  | "emoji"
  | "icon"
  | "image"
  | "svg"
  | "chart"
  | "mindmap";

export interface Tool {
  id: ToolId;
  label: string;
  shortcut: string;
  icon: LucideIcon;
}

/** The left toolbar, in the order and groups of the Miro frame "09 Board · Empty" (tools.md §1). */
export const TOOL_GROUPS: Tool[][] = [
  [
    { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
    { id: "hand", label: "Hand", shortcut: "H", icon: Hand },
  ],
  [
    { id: "text", label: "Text", shortcut: "T", icon: Type },
    { id: "handwriting", label: "Handwriting", shortcut: "W", icon: PenTool },
    { id: "sticky", label: "Sticky note", shortcut: "N", icon: StickyNote },
    { id: "list", label: "Bullet list", shortcut: "B", icon: List },
  ],
  [
    { id: "rect", label: "Rectangle", shortcut: "R", icon: Square },
    { id: "ellipse", label: "Ellipse", shortcut: "O", icon: Circle },
    { id: "diamond", label: "Diamond", shortcut: "D", icon: Diamond },
    { id: "line", label: "Line", shortcut: "L", icon: Minus },
    { id: "arrow", label: "Arrow", shortcut: "A", icon: ArrowRight },
  ],
  [
    { id: "pencil", label: "Pencil", shortcut: "P", icon: Pencil },
    { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
  ],
  [
    { id: "emoji", label: "Emoji", shortcut: "M", icon: Smile },
    { id: "icon", label: "Icon", shortcut: "K", icon: Shapes },
    { id: "image", label: "Image", shortcut: "I", icon: Image },
    { id: "svg", label: "SVG", shortcut: "S", icon: FileCode },
    { id: "chart", label: "Chart", shortcut: "C", icon: ChartColumn },
  ],
  [{ id: "mindmap", label: "Mind map", shortcut: "G", icon: Network }],
];

export const TOOLS_BY_SHORTCUT = new Map(
  TOOL_GROUPS.flat().map((tool) => [tool.shortcut.toLowerCase(), tool.id]),
);

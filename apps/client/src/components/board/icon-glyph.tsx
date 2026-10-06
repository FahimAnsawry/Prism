import { Icon } from "lucide-react";
import { useIconData } from "./icons";

/** A Lucide icon drawn into a box on the board (or any SVG). */
export function IconGlyph({
  name,
  x,
  y,
  width,
  height,
  color,
  fill,
  strokeWidth,
}: {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The icon's color; can be a CSS var(). */
  color: string;
  fill?: string;
  /** Line weight in the icon's 24px grid (Lucide's default is 2). */
  strokeWidth: number;
}) {
  const data = useIconData(name);
  if (!data) {
    // Loading, or an unknown name: a faint dashed box keeps the element visible and selectable.
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={Math.min(width, height) / 6}
        fill="none"
        strokeDasharray="4 3"
        style={{ stroke: "var(--divider)" }}
        strokeWidth={1}
      />
    );
  }
  return (
    <Icon
      icon={data}
      x={x}
      y={y}
      width={width}
      height={height}
      strokeWidth={strokeWidth}
      // Icon colors are theme-aware like other inks, and SVG attributes don't resolve var().
      style={{ color, fill: fill ?? "none" }}
      overflow="visible"
      aria-hidden="true"
    />
  );
}

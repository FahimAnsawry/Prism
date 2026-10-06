import { type BoardElement, mindChildren, mindDescendants } from "@prism/shared";
import { displayColor } from "./board-model";

// Mind map branches (tools.md §1, tool 19) aren't stored: each node draws a curve to its parent,
// so they follow every move, and the collapse toggles sit at the end of a node's branch.

const center = (el: BoardElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

/** 1 when `child` sits to the right of `parent`, else -1. */
const sideOf = (parent: BoardElement, child: BoardElement) =>
  center(child).x >= center(parent).x ? 1 : -1;

/**
 * Where a branch meets a node on one side: mid-height on a filled node, the underline's end on an
 * underlined one (sub-topics).
 */
function port(el: BoardElement, side: 1 | -1) {
  return {
    x: side === 1 ? el.x + el.width : el.x,
    y: el.fill ? el.y + el.height / 2 : el.y + el.height,
  };
}

/** The curves from each shown node to its shown parent, drawn under the nodes. */
export function MindBranches({ elements }: { elements: BoardElement[] }) {
  const nodes = new Map(
    elements.filter((el) => el.type === "mindnode").map((el) => [el.id, el] as const),
  );
  if (nodes.size === 0) return null;
  return (
    <g fill="none" strokeLinecap="round">
      {[...nodes.values()].map((child) => {
        const parent = child.parentId ? nodes.get(child.parentId) : undefined;
        if (!parent) return null;
        const side = sideOf(parent, child);
        const a = port(parent, side);
        const b = port(child, side === 1 ? -1 : 1);
        const bend = (b.x - a.x) / 2;
        // Main branches (from the central topic) are a little heavier.
        const width = parent.parentId ? child.strokeWidth : child.strokeWidth + 1;
        return (
          <path
            key={child.id}
            d={`M${a.x},${a.y} C${a.x + bend},${a.y} ${b.x - bend},${b.y} ${b.x},${b.y}`}
            strokeWidth={width}
            opacity={child.opacity}
            style={{ stroke: displayColor(child.stroke) }}
          />
        );
      })}
    </g>
  );
}

export interface MindToggle {
  id: string;
  x: number;
  y: number;
  collapsed: boolean;
  /** Nodes folded away (shown on a collapsed toggle). */
  count: number;
  color: string;
}

/**
 * The collapse toggles to show: on collapsed nodes, and on active (selected or hovered) nodes that
 * have children. A toggle sits just past the node, on the side away from its parent (a central
 * topic has none).
 */
export function mindToggles(
  elements: BoardElement[],
  shown: BoardElement[],
  activeIds: string[],
): MindToggle[] {
  const children = mindChildren(elements);
  const byId = new Map(elements.map((el) => [el.id, el] as const));
  const toggles: MindToggle[] = [];
  for (const el of shown) {
    if (el.type !== "mindnode" || !el.parentId || !children.has(el.id)) continue;
    if (!el.collapsed && !activeIds.includes(el.id)) continue;
    const parent = byId.get(el.parentId);
    if (!parent) continue;
    const side = sideOf(parent, el);
    const p = port(el, side);
    toggles.push({
      id: el.id,
      x: p.x + side * 12,
      y: p.y,
      collapsed: Boolean(el.collapsed),
      count: el.collapsed ? mindDescendants(elements, [el.id]).size : 0,
      color: el.stroke,
    });
  }
  return toggles;
}

/** A toggle's radius on screen, in px. */
export const TOGGLE_RADIUS = 9;

export function MindToggles({ toggles, zoom }: { toggles: MindToggle[]; zoom: number }) {
  const r = TOGGLE_RADIUS / zoom;
  return (
    <g>
      {toggles.map((t) => (
        <g key={t.id}>
          <circle
            cx={t.x}
            cy={t.y}
            r={r}
            strokeWidth={1.5 / zoom}
            className="fill-card"
            style={{ stroke: displayColor(t.color) }}
          />
          {t.collapsed ? (
            <text
              x={t.x}
              y={t.y}
              fontSize={10 / zoom}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground font-sans"
            >
              {t.count > 99 ? "99+" : t.count}
            </text>
          ) : (
            <line
              x1={t.x - r / 2}
              x2={t.x + r / 2}
              y1={t.y}
              y2={t.y}
              strokeWidth={1.5 / zoom}
              strokeLinecap="round"
              style={{ stroke: displayColor(t.color) }}
            />
          )}
        </g>
      ))}
    </g>
  );
}

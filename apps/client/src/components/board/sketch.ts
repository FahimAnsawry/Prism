// The hand-drawn look (tools.md §2, "Sketch renderer"), in place of roughjs: each edge becomes a
// slightly bowed curve with jittered ends, drawn twice. The random numbers are seeded with the
// element id, so the wobble stays the same on every render.

import type { Point } from "./geometry";

/** Mulberry32: a tiny seeded generator returning numbers in [0, 1). */
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const n = (value: number) => Math.round(value * 100) / 100;

/** How far points may wander, growing a little with the stroke width. */
const roughness = (strokeWidth: number) => 1.2 + strokeWidth * 0.4;

function wobblyEdge(a: Point, b: Point, rand: () => number, r: number) {
  const jitter = () => (rand() * 2 - 1) * r;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  // Bow the middle sideways by up to ~2% of the edge.
  const bow = (rand() * 2 - 1) * Math.min(r * 2, length * 0.02 + r);
  const nx = length ? -(b.y - a.y) / length : 0;
  const ny = length ? (b.x - a.x) / length : 0;
  const t = 0.5 + (rand() - 0.5) * 0.2;
  const mid = { x: a.x + (b.x - a.x) * t + nx * bow, y: a.y + (b.y - a.y) * t + ny * bow };
  return `M${n(a.x + jitter())},${n(a.y + jitter())} Q${n(mid.x)},${n(mid.y)} ${n(b.x + jitter())},${n(b.y + jitter())}`;
}

/** A closed polygon's outline, sketched. */
export function sketchPolygon(points: Point[], seed: string, strokeWidth: number) {
  const rand = seededRandom(hash(seed));
  const r = roughness(strokeWidth);
  const paths: string[] = [];
  for (let pass = 0; pass < 2; pass++) {
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      if (b) paths.push(wobblyEdge(a, b, rand, r));
    });
  }
  return paths.join(" ");
}

/** An open line, sketched. */
export function sketchLine(a: Point, b: Point, seed: string, strokeWidth: number) {
  const rand = seededRandom(hash(seed));
  const r = roughness(strokeWidth);
  return `${wobblyEdge(a, b, rand, r)} ${wobblyEdge(a, b, rand, r)}`;
}

/** An ellipse, sketched: points around it with a jittered radius, smoothed, drawn twice. */
export function sketchEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: string,
  strokeWidth: number,
) {
  const rand = seededRandom(hash(seed));
  const r = roughness(strokeWidth);
  const count = 18;
  const paths: string[] = [];
  for (let pass = 0; pass < 2; pass++) {
    const start = rand() * Math.PI * 2;
    // A little overshoot past the start, like a pen that doesn't quite close the loop.
    const sweep = Math.PI * 2 * (1.04 + rand() * 0.05);
    const points: Point[] = [];
    for (let i = 0; i <= count; i++) {
      const angle = start + (sweep * i) / count;
      const wobble = 1 + ((rand() * 2 - 1) * r) / Math.max(rx, ry, 1);
      points.push({ x: cx + Math.cos(angle) * rx * wobble, y: cy + Math.sin(angle) * ry * wobble });
    }
    paths.push(smoothPath(points));
  }
  return paths.join(" ");
}

/**
 * A smooth path through `points` (tools.md §1, tool 12): quadratic curves whose control points are
 * the input points and whose ends are the midpoints between them.
 */
export function smoothPath(points: Point[]) {
  const first = points[0];
  if (!first) return "";
  if (points.length === 1) return `M${n(first.x)},${n(first.y)} l0.01,0`;
  if (points.length === 2) {
    const last = points[1] as Point;
    return `M${n(first.x)},${n(first.y)} L${n(last.x)},${n(last.y)}`;
  }
  let d = `M${n(first.x)},${n(first.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i] as Point;
    const next = points[i + 1] as Point;
    d += ` Q${n(p.x)},${n(p.y)} ${n((p.x + next.x) / 2)},${n((p.y + next.y) / 2)}`;
  }
  const last = points[points.length - 1] as Point;
  return `${d} L${n(last.x)},${n(last.y)}`;
}

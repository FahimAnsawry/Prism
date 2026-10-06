import { type BoardElement, hiddenMindNodes } from "@prism/shared";

// The canvas draws its world inside one <g> with `translate(x, y) scale(zoom)` and
// `transform-origin: center` (the viewport's center). We keep that origin, so the default view
// doesn't move, and the math below works from the center: a world point w shows on screen at
//   center + (x, y) + zoom · (w − center).

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
/** The top-bar buttons and Ctrl +/− move in 10% steps. */
const ZOOM_STEP = 0.1;
/** Space left around the content by "zoom to fit", in screen pixels. */
const FIT_MARGIN = 64;

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** The next 10% step in or out, snapped so 100% stays reachable. */
export const stepZoom = (zoom: number, direction: 1 | -1) =>
  clampZoom(Math.round((zoom + direction * ZOOM_STEP) * 10) / 10);

/**
 * Zooms to `zoom` while the screen point `offset` (measured from the viewport's center) stays over
 * the same world point. `{ x: 0, y: 0 }` zooms around the middle of the view.
 */
export function zoomAt(camera: Camera, zoom: number, offset: { x: number; y: number }): Camera {
  const next = clampZoom(zoom);
  const ratio = next / camera.zoom;
  return {
    x: offset.x - (offset.x - camera.x) * ratio,
    y: offset.y - (offset.y - camera.y) * ratio,
    zoom: next,
  };
}

/**
 * Frames every shown element in a `width` × `height` viewport, never past 100%. An empty board
 * gets 100% with the world's origin in the middle, where new content goes.
 */
export function fitCamera(all: BoardElement[], width: number, height: number): Camera {
  if (width <= 0 || height <= 0) return { x: 0, y: 0, zoom: 1 };
  // Nodes inside folded mind map branches aren't drawn, so they don't count.
  const hidden = hiddenMindNodes(all);
  const elements = all.filter((el) => !hidden.has(el.id));
  if (elements.length === 0) return { x: width / 2, y: height / 2, zoom: 1 };

  // An arrow's width and height can be negative (it points up or left).
  const xs = elements.flatMap((el) => [el.x, el.x + el.width]);
  const ys = elements.flatMap((el) => [el.y, el.y + el.height]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const boxWidth = Math.max(Math.max(...xs) - left, 1);
  const boxHeight = Math.max(Math.max(...ys) - top, 1);

  const zoom = clampZoom(
    Math.min(1, (width - 2 * FIT_MARGIN) / boxWidth, (height - 2 * FIT_MARGIN) / boxHeight),
  );
  // Put the content's center on the viewport's center.
  const centerX = left + boxWidth / 2;
  const centerY = top + boxHeight / 2;
  return { x: zoom * (width / 2 - centerX), y: zoom * (height / 2 - centerY), zoom };
}

/** The world point under a screen point (`screen` is relative to the viewport's top-left). */
export function screenToWorld(
  camera: Camera,
  screen: { x: number; y: number },
  width: number,
  height: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  return {
    x: cx + (screen.x - cx - camera.x) / camera.zoom,
    y: cy + (screen.y - cy - camera.y) / camera.zoom,
  };
}

/** The screen point (relative to the viewport's top-left) where a world point shows. */
export function worldToScreen(
  camera: Camera,
  world: { x: number; y: number },
  width: number,
  height: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  return {
    x: cx + camera.x + camera.zoom * (world.x - cx),
    y: cy + camera.y + camera.zoom * (world.y - cy),
  };
}

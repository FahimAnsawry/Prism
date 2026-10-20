import { type RefObject, useCallback, useEffect, useRef } from "react";
import { type Camera, clampZoom, stepZoom, zoomAt } from "./camera";

/** How quickly the zoom catches up with its target: about 95% of the way in 3 × this (ms). */
const EASE_MS = 80;
/** Close enough to the target (as a log ratio) to snap the last bit. */
const SETTLED = 0.0005;

type Offset = { x: number; y: number };
const CENTER: Offset = { x: 0, y: 0 };

interface Glide {
  target: number;
  offset: Offset;
  frame: number;
  last: number;
  /** The camera this glide set last; anything else means another gesture took over. */
  expected: Camera;
}

interface Latest {
  /** The newest camera: the last one set here, or a newer one from outside (a pan, a fit). */
  camera: Camera;
  setCamera: (camera: Camera) => void;
  /** Every camera set here. A render can commit one a frame late; it mustn't read as a takeover. */
  ours: WeakSet<Camera>;
}

/** Sets `next` as the camera, remembering it as one of ours. */
function put(latest: Latest, next: Camera) {
  latest.ours.add(next);
  latest.camera = next;
  latest.setCamera(next);
}

/** One frame of a glide: the zoom closes part of its gap to the target, then the next is asked for. */
function glideFrame(glide: RefObject<Glide | null>, latest: RefObject<Latest>, now: number) {
  const g = glide.current;
  if (!g) return;
  const current = latest.current.camera;
  if (current !== g.expected) {
    glide.current = null;
    return;
  }
  const dt = Math.min(64, now - g.last);
  g.last = now;
  const gap = Math.log(g.target / current.zoom);
  const settled = Math.abs(gap) < SETTLED;
  const zoom = settled ? g.target : current.zoom * Math.exp(gap * (1 - Math.exp(-dt / EASE_MS)));
  const next = zoomAt(current, zoom, g.offset);
  g.expected = next;
  put(latest.current, next);
  if (settled) glide.current = null;
  else g.frame = requestAnimationFrame((t) => glideFrame(glide, latest, t));
}

/**
 * Eases the camera's zoom toward a target instead of jumping, keeping `offset` (screen px from the
 * viewport's center) over the same world point. Calls made while a glide runs add to its target,
 * so wheel notches and repeated key presses stack. Another camera change (a pan, a fit) stops it.
 * Reduced-motion users get the jump.
 */
export function useSmoothZoom(camera: Camera, setCamera: (camera: Camera) => void) {
  const latest = useRef<Latest>({ camera, setCamera, ours: new WeakSet() });
  /** The camera prop at the last render, so a render that doesn't change it changes nothing here. */
  const seen = useRef(camera);
  useEffect(() => {
    latest.current.setCamera = setCamera;
    if (camera === seen.current) return;
    seen.current = camera;
    // Only a new camera from outside replaces the newest one; ours may arrive after a newer one.
    if (!latest.current.ours.has(camera)) latest.current.camera = camera;
  });
  const glide = useRef<Glide | null>(null);

  useEffect(
    () => () => {
      if (glide.current) cancelAnimationFrame(glide.current.frame);
    },
    [],
  );

  /** Glides to `zoom` around `offset` (the view's middle by default). */
  const zoomTo = useCallback((zoom: number, offset: Offset = CENTER) => {
    const target = clampZoom(zoom);
    const current = latest.current.camera;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (glide.current) cancelAnimationFrame(glide.current.frame);
      glide.current = null;
      put(latest.current, zoomAt(current, target, offset));
      return;
    }
    if (glide.current && glide.current.expected === current) {
      glide.current.target = target;
      glide.current.offset = offset;
      return;
    }
    if (glide.current) cancelAnimationFrame(glide.current.frame);
    glide.current = {
      target,
      offset,
      last: performance.now(),
      expected: current,
      frame: requestAnimationFrame((t) => glideFrame(glide, latest, t)),
    };
  }, []);

  /** Where the zoom is heading: the glide's target, or the zoom itself when still. */
  const targetZoom = useCallback(() => {
    const g = glide.current;
    return g && g.expected === latest.current.camera ? g.target : latest.current.camera.zoom;
  }, []);

  /** Multiplies the target zoom by `factor` around `offset` (the wheel and trackpad). */
  const zoomBy = useCallback(
    (factor: number, offset: Offset) => zoomTo(targetZoom() * factor, offset),
    [zoomTo, targetZoom],
  );

  /** One step in or out around the view's middle (the buttons and Ctrl +/−). */
  const step = useCallback(
    (direction: 1 | -1) => zoomTo(stepZoom(targetZoom(), direction)),
    [zoomTo, targetZoom],
  );

  return { zoomTo, zoomBy, step };
}

// Shows a big batch an AI editor saved (a whole screen from create_screen) being built, as
// MagicPath does, instead of all of it appearing in one frame: the frame first, then the rest in
// drawing order (parents before the things on them, so section by section down the page), in
// steps, with the editor's cursor at the newest element and each new element fading in.
// The batch stays one undo step: the first step is a normal remote change, the others join it.

import type { BoardElement, ElementOp, Peer } from "@prism/shared";
import { flushSync } from "react-dom";
import type { BoardAction } from "./board-model";
import { showCursor } from "./presence-bus";

/** The whole reveal takes about this long however big the screen is (bigger ones go faster). */
const TARGET_MS = 3_200;
const MIN_STEP_MS = 120;
const MAX_STEP_MS = 320;
const MIN_STEPS = 6;
const MAX_STEPS = 16;
/** Elements shown per step, about. */
const PER_STEP = 18;
const FADE_MS = 320;

const created = (ops: ElementOp[]) => ops.flatMap((op) => (op.op === "create" ? [op.element] : []));

/** `ops` cut into the steps of a reveal: the first element alone if it's a frame, then even cuts. */
export function revealSteps(ops: ElementOp[]): ElementOp[][] {
  const creates = ops.filter((op) => op.op === "create");
  const others = ops.filter((op) => op.op !== "create");
  const steps: ElementOp[][] = [];
  let rest = creates;
  if (rest[0]?.op === "create" && rest[0].element.type === "frame") {
    steps.push([rest[0]]);
    rest = rest.slice(1);
  }
  const count = Math.min(MAX_STEPS, Math.max(MIN_STEPS, Math.round(rest.length / PER_STEP)));
  const size = Math.max(1, Math.ceil(rest.length / count));
  for (let i = 0; i < rest.length; i += size) steps.push(rest.slice(i, i + size));
  // Changes to what was already there come with the last step.
  if (others.length > 0) {
    if (steps.length === 0) steps.push([]);
    steps[steps.length - 1] = [...(steps.at(-1) ?? []), ...others];
  }
  return steps;
}

/** Where an editor's cursor points while it draws `el`: inside its top left, never far off. */
const tip = (el: BoardElement) => ({
  x: el.x + Math.min(Math.abs(el.width) / 2, 80),
  y: el.y + Math.min(Math.abs(el.height) / 2, 36),
});

/** Fades in the drawn elements with these ids (called right after they were put on screen). */
function fadeIn(ids: string[]) {
  const wanted = new Set(ids);
  const drawn = document.querySelectorAll<SVGGElement>('svg[aria-label="Board canvas"] g[data-id]');
  const fresh: SVGGElement[] = [];
  for (const node of drawn) {
    if (node.dataset["id"] && wanted.has(node.dataset["id"])) fresh.push(node);
  }
  for (const node of fresh) node.classList.add("prism-reveal");
  setTimeout(() => {
    for (const node of fresh) node.classList.remove("prism-reveal");
  }, FADE_MS + 60);
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Applies `ops` (already recorded as saved) to the board in steps, as `peer` building it.
 * `onStart` gets the elements about to appear, to bring them into view. Returns a function that
 * stops the reveal (what is still to come is dropped; the server has all of it).
 */
export function revealOps({
  ops,
  peer,
  dispatch,
  onStart,
}: {
  ops: ElementOp[];
  peer: Peer;
  dispatch: (action: BoardAction) => void;
  onStart?: (elements: BoardElement[]) => void;
}) {
  const steps = revealSteps(ops);
  if (steps.length <= 1 || reducedMotion()) {
    dispatch({ type: "remote", ops });
    return () => {};
  }
  onStart?.(created(ops));

  const step = Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, TARGET_MS / steps.length));
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const next = () => {
    const chunk = steps[index];
    if (!chunk) return;
    const elements = created(chunk);
    // Rendered now, so the fade can start before the browser paints them in full.
    flushSync(() => dispatch({ type: "remote", ops: chunk, join: index > 0 }));
    fadeIn(elements.map((el) => el.id));
    const last = elements.at(-1);
    if (last) {
      const at = tip(last);
      showCursor(peer, at.x, at.y);
    }
    index += 1;
    if (index < steps.length) timer = setTimeout(next, step);
  };
  next();
  return () => clearTimeout(timer);
}

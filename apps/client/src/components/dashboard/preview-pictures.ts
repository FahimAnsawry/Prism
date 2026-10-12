// Dashboard previews as pictures. A card's live drawing is costly to mount (every element, with
// its shadows and filters), and the grid mounts all of them at once: on a filter change, on a
// switch of view, on the way back from a board. So each board's preview is drawn once per
// version, rasterized and kept, in memory for this page and in Cache Storage across visits.
// Cards show the picture (an older one while the new one is made); only a board that was never
// pictured draws live, until its picture is ready.

import type { BoardElement } from "@prism/shared";
import { useEffect, useSyncExternalStore } from "react";
import { boundsOf, type Box } from "@/components/board/geometry";
import type { Theme } from "@/lib/theme";

const CACHE_NAME = "prism-previews-v1";
/** Longest side of a picture in px: sharp on a 2x screen at a card's widest. */
const PICTURE_SIDE = 900;
/** Space around the drawing, as a share of its larger side. */
const PADDING = 0.08;
/** The smallest area shown (world px), so a lone sticky note isn't blown up to fill the card. */
const MIN_VIEW = 600;

export interface PreviewPicture {
  /** An object URL of the image. */
  url: string;
  /** The board version it shows. */
  editedAt: string;
}

/** The board area a preview shows: the drawing, padded, never smaller than MIN_VIEW. */
export function previewBox(elements: BoardElement[]): Box | null {
  const bounds = boundsOf(elements);
  if (!bounds) return null;
  const pad = Math.max(bounds.width, bounds.height) * PADDING;
  const width = Math.max(bounds.width + pad * 2, MIN_VIEW);
  const height = Math.max(bounds.height + pad * 2, MIN_VIEW);
  return {
    x: bounds.x + bounds.width / 2 - width / 2,
    y: bounds.y + bounds.height / 2 - height / 2,
    width,
    height,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────

/** Colors are baked into a picture, so each theme has its own. */
const keyOf = (boardId: string, theme: Theme) => `${boardId}:${theme}`;
const requestFor = (boardId: string, theme: Theme) =>
  new Request(new URL(`/__prism-preview/${encodeURIComponent(boardId)}/${theme}`, location.origin));

const pictures = new Map<string, PreviewPicture>();
/** The decoded image behind each picture, held so the browser keeps it ready to paint. */
const decodedImages = new Map<string, HTMLImageElement>();

/**
 * An object URL for `blob`, decoded: an <img> given it later paints in its first frame instead
 * of showing nothing until it decodes.
 */
async function decodedUrl(key: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    // Shown anyway; the card's loader covers the decode.
  }
  decodedImages.set(key, image);
  return url;
}
/** Keys whose stored picture was looked up (found or not). */
const checked = new Set<string>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function setPicture(key: string, picture: PreviewPicture) {
  const old = pictures.get(key);
  pictures.set(key, picture);
  // An <img> that already shows the old picture keeps it; nothing new loads it.
  if (old) URL.revokeObjectURL(old.url);
  notify();
}

/** Cache Storage, where the browser has it (secure origins only). */
async function openCache() {
  try {
    return "caches" in window ? await caches.open(CACHE_NAME) : null;
  } catch {
    return null;
  }
}

const lookups = new Map<string, Promise<void>>();

/** Reads the stored picture into memory, once per key. */
function lookUp(boardId: string, theme: Theme) {
  const key = keyOf(boardId, theme);
  let pending = lookups.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await (await openCache())?.match(requestFor(boardId, theme));
        const editedAt = response?.headers.get("x-edited-at");
        // A picture made meanwhile is newer than the stored one.
        if (response && editedAt && !pictures.has(key)) {
          const url = await decodedUrl(key, await response.blob());
          if (!pictures.has(key)) setPicture(key, { url, editedAt });
          else URL.revokeObjectURL(url);
        }
      } catch {
        // No stored picture: the card draws live.
      }
      checked.add(key);
      notify();
    })();
    lookups.set(key, pending);
  }
  return pending;
}

/**
 * The board's preview picture in `theme`, if there is one (it may show an older version), and
 * whether storage was checked yet: until then a card shows nothing rather than draw live.
 */
export function usePreviewPicture(boardId: string, theme: Theme) {
  const key = keyOf(boardId, theme);
  useEffect(() => {
    void lookUp(boardId, theme);
  }, [boardId, theme]);
  const picture = useSyncExternalStore(subscribe, () => pictures.get(key));
  const ready = useSyncExternalStore(subscribe, () => checked.has(key));
  return { picture, checked: ready };
}

// ── Making pictures ───────────────────────────────────────────────────────

/** One picture at a time, in idle time, so making them never holds up the page. */
const queue: (() => Promise<void>)[] = [];
let draining = false;
/** Pictures asked for (key and version), so a card rendering again doesn't ask twice. */
const requested = new Set<string>();

const idle = () =>
  new Promise<void>((resolve) => {
    if ("requestIdleCallback" in window) requestIdleCallback(() => resolve(), { timeout: 1_500 });
    else setTimeout(resolve, 50);
  });

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length > 0) {
    await idle();
    const job = queue.shift();
    try {
      await job?.();
    } catch (error) {
      console.warn("[Prism] Couldn't make a board preview:", error);
    }
  }
  draining = false;
}

const currentTheme = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

/**
 * Makes the picture of `elements` (the board as of `editedAt`, bottom layer first, folded
 * branches left out) in the current theme, then keeps it.
 */
export function requestPreviewPicture(
  boardId: string,
  editedAt: string,
  theme: Theme,
  elements: BoardElement[],
) {
  const key = keyOf(boardId, theme);
  const job = `${key}@${editedAt}`;
  if (requested.has(job) || pictures.get(key)?.editedAt === editedAt) return;
  requested.add(job);
  queue.push(async () => {
    const box = previewBox(elements);
    // The theme changed since: the colors would be the wrong ones.
    if (!box || currentTheme() !== theme) return;
    const { canvasBlob, drawSvg, renderSvg } = await import("@/components/board/export-image");
    const scale = PICTURE_SIDE / Math.max(box.width, box.height);
    const width = Math.max(1, Math.round(box.width * scale));
    const height = Math.max(1, Math.round(box.height * scale));
    const markup = await renderSvg(elements, box, width, height, { background: false });
    if (currentTheme() !== theme) return;
    const canvas = await drawSvg(markup, width, height);
    // WebP where the browser can encode it (it falls back to PNG elsewhere).
    const blob = await canvasBlob(canvas, "image/webp", 0.85);
    // A newer version may have been pictured meanwhile.
    const shown = pictures.get(key);
    if (shown && shown.editedAt > editedAt) return;
    setPicture(key, { url: await decodedUrl(key, blob), editedAt });
    const cache = await openCache();
    await cache?.put(
      requestFor(boardId, theme),
      new Response(blob, { headers: { "content-type": blob.type, "x-edited-at": editedAt } }),
    );
  });
  void drain();
}

/** Drops every picture (signing out: the next user of this browser shouldn't have them). */
export async function forgetPreviewPictures() {
  for (const picture of pictures.values()) URL.revokeObjectURL(picture.url);
  pictures.clear();
  decodedImages.clear();
  checked.clear();
  lookups.clear();
  requested.clear();
  queue.length = 0;
  notify();
  try {
    if ("caches" in window) await caches.delete(CACHE_NAME);
  } catch {
    // Nothing stored.
  }
}

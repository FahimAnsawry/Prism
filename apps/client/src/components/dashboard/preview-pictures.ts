// Dashboard previews as cover pictures. A board's card shows one small picture of its cover
// frame (the leftmost frame; a board without frames fits the whole drawing). The picture lives on
// the server, so every device downloads a few KB instead of drawing the board. Whichever editor
// finds it older than the board draws a new one in this tab and uploads it (the server keeps the
// newest); the board's other viewers then just download it.
// Pictures are drawn in the light theme only, on a background of their own, and shown as they are.

import { hiddenMindNodes, previewStoredSchema, type BoardElement } from "@prism/shared";
import { useSyncExternalStore } from "react";
import { byZ } from "@/components/board/board-model";
import { boundsOf, type Box, elementBounds, intersects } from "@/components/board/geometry";
import { apiFetch } from "@/lib/api";

/** Longest side of a picture in px: sharp on a 2x screen at a card's widest. */
const PICTURE_SIDE = 640;
/** Space around a whole-board drawing, as a share of its larger side. */
const PADDING = 0.08;
/** The smallest area shown (world px), so a lone sticky note isn't blown up to fill the card. */
const MIN_VIEW = 600;
/** A whole-board picture is drawn at this width : height, so a card that crops to fill loses nothing. */
const CARD_ASPECT = 2;
/** The previous version kept pictures per browser in Cache Storage. */
const LEGACY_CACHE = "prism-previews-v1";

export interface PreviewPicture {
  /** An object URL of the image. */
  url: string;
  /** The board `editedAt` it shows. */
  version: string;
  /** Taller than wide (a phone screen): shown whole instead of cropped to fill the card. */
  portrait: boolean;
}

/** The board area a whole-board picture shows: the drawing, padded, at the card's proportions. */
function wholeBoardBox(elements: BoardElement[]): Box | null {
  const bounds = boundsOf(elements);
  if (!bounds) return null;
  const pad = Math.max(bounds.width, bounds.height) * PADDING;
  let width = Math.max(bounds.width + pad * 2, MIN_VIEW);
  let height = Math.max(bounds.height + pad * 2, MIN_VIEW);
  if (width / height < CARD_ASPECT) width = height * CARD_ASPECT;
  else height = width / CARD_ASPECT;
  return {
    x: bounds.x + bounds.width / 2 - width / 2,
    y: bounds.y + bounds.height / 2 - height / 2,
    width,
    height,
  };
}

/**
 * What a board's cover picture shows: the leftmost frame (the topmost of those) with what lies
 * on it, or the whole drawing when the board has no frames. Null for an empty board.
 */
export function coverRegion(all: BoardElement[]): { box: Box; shown: BoardElement[] } | null {
  // Folded mind map branches aren't on the board, so not in its picture either.
  const hidden = hiddenMindNodes(all);
  const elements = byZ(all.filter((el) => !hidden.has(el.id)));
  let cover: BoardElement | undefined;
  for (const el of elements) {
    if (el.type !== "frame") continue;
    if (!cover || el.x < cover.x || (el.x === cover.x && el.y < cover.y)) cover = el;
  }
  if (cover) {
    const box = elementBounds(cover);
    return { box, shown: elements.filter((el) => intersects(elementBounds(el), box)) };
  }
  const box = wholeBoardBox(elements);
  return box ? { box, shown: elements } : null;
}

// ── Store ─────────────────────────────────────────────────────────────────

/** The newest picture known for each board, in memory for this page. */
const pictures = new Map<string, PreviewPicture>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The board's picture, if one is known (it may show an older version of the board). */
export function usePreviewPicture(boardId: string) {
  return useSyncExternalStore(subscribe, () => pictures.get(boardId));
}

/**
 * Keeps `blob` as the board's picture for `version`, unless a newer one is already known. The
 * image is decoded first: an <img> given it later paints in its first frame.
 */
async function keepPicture(boardId: string, version: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    // Shown anyway; it simply decodes when it paints.
  }
  const known = pictures.get(boardId);
  if (known && known.version > version) {
    URL.revokeObjectURL(url);
    return;
  }
  // An <img> that already shows the old picture keeps it; nothing new loads it.
  if (known) URL.revokeObjectURL(known.url);
  pictures.set(boardId, {
    url,
    version,
    portrait: image.naturalHeight > image.naturalWidth * 1.15,
  });
  notify();
}

let cleanedLegacy = false;
function cleanLegacyCache() {
  if (cleanedLegacy) return;
  cleanedLegacy = true;
  try {
    if ("caches" in window) void caches.delete(LEGACY_CACHE).catch(() => undefined);
  } catch {
    // Nothing stored.
  }
}

/** Downloads (once per version) the picture the server holds, shown for `version` of the board. */
const downloads = new Set<string>();
export function loadPreviewPicture(boardId: string, version: string, path: string) {
  const known = pictures.get(boardId);
  const job = `${boardId}@${version}`;
  if ((known && known.version >= version) || downloads.has(job)) return;
  downloads.add(job);
  cleanLegacyCache();
  void (async () => {
    try {
      // The version in the URL keeps the browser's cache from serving an older picture.
      const url = new URL(path, import.meta.env.VITE_SERVER_URL);
      url.searchParams.set("v", version);
      const response = await fetch(url, { credentials: "include" });
      if (response.ok) await keepPicture(boardId, version, await response.blob());
    } catch {
      // The card keeps its placeholder.
    }
  })();
}

// ── Making pictures ───────────────────────────────────────────────────────

/** One picture at a time, in idle time, so making them never holds up the page. */
const queue: (() => Promise<void>)[] = [];
let draining = false;
/** Pictures asked for (board and version), so a card rendering again doesn't ask twice. */
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
    try {
      await queue.shift()?.();
    } catch (error) {
      console.warn("[Prism] Couldn't make a board preview:", error);
    }
  }
  draining = false;
}

/**
 * Draws the cover picture of `elements` (the board as of `editedAt`), shows it at once and
 * uploads it. If the upload fails the picture still shows for this visit.
 */
export function requestPreviewPicture(boardId: string, editedAt: string, elements: BoardElement[]) {
  const job = `${boardId}@${editedAt}`;
  if (requested.has(job) || pictures.get(boardId)?.version === editedAt) return;
  requested.add(job);
  queue.push(async () => {
    const region = coverRegion(elements);
    if (!region || pictures.get(boardId)?.version === editedAt) return;
    const { canvasBlob, drawSvg, renderSvg } = await import("@/components/board/export-image");
    const scale = PICTURE_SIDE / Math.max(region.box.width, region.box.height);
    const width = Math.max(1, Math.round(region.box.width * scale));
    const height = Math.max(1, Math.round(region.box.height * scale));
    const markup = await renderSvg(region.shown, region.box, width, height, { theme: "light" });
    const canvas = await drawSvg(markup, width, height);
    // WebP where the browser can encode it (it falls back to PNG elsewhere).
    const blob = await canvasBlob(canvas, "image/webp", 0.82);
    await keepPicture(boardId, editedAt, blob);
    try {
      await apiFetch(
        `/api/boards/${boardId}/preview?editedAt=${encodeURIComponent(editedAt)}`,
        previewStoredSchema,
        { method: "PUT", body: blob },
      );
    } catch (error) {
      console.warn("[Prism] Couldn't save a board preview:", error);
    }
  });
  void drain();
}

/** Drops every picture (signing out: the next user of this browser shouldn't have them). */
export function forgetPreviewPictures() {
  for (const picture of pictures.values()) URL.revokeObjectURL(picture.url);
  pictures.clear();
  downloads.clear();
  requested.clear();
  queue.length = 0;
  notify();
}

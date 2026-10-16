// The board's Export menu (tools.md §1 "Export"): the whole board or the selection as a PNG, a
// JPG or a PDF. Pictures come from export_image's renderer (export-image.tsx), so a download
// looks just like what an AI editor sees. A PDF has one page per frame.

import { type BoardElement, frameLabel, hiddenMindNodes } from "@prism/shared";
import { byZ } from "./board-model";
import { canvasBlob, drawSvg, renderSvg } from "./export-image";
import { boundsOf, type Box, elementBounds, intersects } from "./geometry";
import { type PdfPage, pdfFile } from "./pdf-file";

export type ExportFormat = "png" | "jpg" | "pdf";

/** Image px per board px for PNG and JPG. */
export type ImageScale = 1 | 2 | 4;

/** Room around a selection or the whole board, in board px. A frame is shown edge to edge. */
const PADDING = 24;
/** PDF pages are drawn at 2x. */
const PDF_SCALE = 2;
const JPEG_QUALITY = 0.9;
const PDF_JPEG_QUALITY = 0.85;
/** Canvas limits: Safari (and every iOS browser) holds about 16.7M px; the others far more. */
const WEBKIT =
  /AppleWebKit/.test(navigator.userAgent) && !/Chrome\/|Chromium\//.test(navigator.userAgent);
const CANVAS_MAX_SIDE = 16_384;
const CANVAS_MAX_PIXELS = WEBKIT ? 16_777_216 : 40_000_000;

export class BoardExportError extends Error {}

/** A picture to draw: a board area, the elements in it (bottom layer first) and a name for it. */
type Region = { box: Box; shown: BoardElement[]; label: string | null };

const isFrame = (el: BoardElement) => el.type === "frame";

/** Whether `el`'s center lies inside `frame` (as the server reads frames). */
function insideFrame(el: BoardElement, frame: BoardElement) {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return (
    cx >= frame.x && cx <= frame.x + frame.width && cy >= frame.y && cy <= frame.y + frame.height
  );
}

/** A frame edge to edge, with everything on it. */
function frameRegion(frame: BoardElement, elements: BoardElement[]): Region {
  const box = elementBounds(frame);
  return {
    box,
    shown: byZ(elements.filter((el) => intersects(elementBounds(el), box))),
    label: frameLabel(frame, elements),
  };
}

/** The elements on the board (nodes in folded mind map branches aren't) and the ones chosen. */
function pick(elements: BoardElement[], ids: string[] | null) {
  const hidden = hiddenMindNodes(elements);
  const visible = elements.filter((el) => !hidden.has(el.id));
  if (!ids) return { visible, chosen: visible };
  const wanted = new Set(ids);
  const chosen = visible.filter((el) => wanted.has(el.id));
  // A selected frame comes with what's on it.
  const frames = chosen.filter(isFrame);
  if (frames.length === 0) return { visible, chosen };
  return {
    visible,
    chosen: visible.filter((el) => wanted.has(el.id) || frames.some((f) => insideFrame(el, f))),
  };
}

/** One picture of the chosen elements: a lone frame edge to edge, else them with room around. */
function imageRegion(elements: BoardElement[], ids: string[] | null): Region {
  const { visible, chosen } = pick(elements, ids);
  const frames = chosen.filter(isFrame);
  const onlyFrame =
    frames.length === 1 && chosen.every((el) => el === frames[0] || insideFrame(el, frames[0]!));
  if (onlyFrame) return frameRegion(frames[0]!, visible);
  const bounds = boundsOf(chosen);
  if (!bounds) {
    throw new BoardExportError(ids ? "Nothing selected to export." : "The board is empty.");
  }
  return {
    box: {
      x: bounds.x - PADDING,
      y: bounds.y - PADDING,
      width: bounds.width + 2 * PADDING,
      height: bounds.height + 2 * PADDING,
    },
    shown: byZ(chosen),
    label: null,
  };
}

/** Frames in reading order: rows top to bottom, each row left to right. */
function readingOrder(frames: BoardElement[]) {
  const rows: BoardElement[][] = [];
  for (const frame of [...frames].sort((a, b) => a.y - b.y)) {
    const row = rows.at(-1);
    const first = row?.[0];
    if (row && first && frame.y < first.y + first.height / 2) row.push(frame);
    else rows.push([frame]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
}

/** PDF pages: each chosen frame that isn't inside another one, else one page of everything. */
function pdfRegions(elements: BoardElement[], ids: string[] | null): Region[] {
  const { visible, chosen } = pick(elements, ids);
  const frames = chosen.filter(isFrame);
  const screens = frames.filter(
    (frame) => !frames.some((other) => other !== frame && insideFrame(frame, other)),
  );
  if (screens.length === 0) return [imageRegion(elements, ids)];
  return readingOrder(screens).map((frame) => frameRegion(frame, visible));
}

/** A file name from the board's name (and the frame's label), safe on every OS. */
function fileName(board: string, label: string | null, extension: string) {
  const clean = (text: string) =>
    text
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  const name = [clean(board), label && clean(label)].filter(Boolean).join(" - ");
  return `${name || "board"}.${extension}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers start the download after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** `wanted` image px per board px for `box`, lowered until the canvas fits in the browser. */
function rasterSize(box: Box, wanted: number) {
  const longest = Math.max(box.width, box.height, 1);
  const area = Math.max(box.width * box.height, 1);
  const scale = Math.min(wanted, CANVAS_MAX_SIDE / longest, Math.sqrt(CANVAS_MAX_PIXELS / area));
  return {
    width: Math.max(1, Math.round(box.width * scale)),
    height: Math.max(1, Math.round(box.height * scale)),
  };
}

/** Where a running export is, for its progress screen. */
export interface ExportProgress {
  step: string;
  done: number;
  total: number;
}

/**
 * Reports a step, then lets the page paint it before the next stretch of work. Throws once the
 * export's signal aborts (Cancel), so the work stops at the next step.
 */
type Step = ((step: string) => Promise<void>) & { signal: AbortSignal | undefined };

function stepper(
  total: number,
  onProgress: ((progress: ExportProgress) => void) | undefined,
  signal: AbortSignal | undefined,
): Step {
  let done = 0;
  const step = async (label: string) => {
    signal?.throwIfAborted();
    onProgress?.({ step: label, done, total });
    done += 1;
    // A hidden tab doesn't run animation frames, so a timer stands in.
    await Promise.race([
      new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))),
      new Promise((resolve) => setTimeout(resolve, 50)),
    ]);
    signal?.throwIfAborted();
  };
  return Object.assign(step, { signal });
}

/** One region drawn on a canvas at `wanted` image px per board px. */
async function rasterRegion({ box, shown }: Region, wanted: number, step: Step, prefix = "") {
  const { width, height } = rasterSize(box, wanted);
  await step(`${prefix}Embedding fonts and images`);
  const markup = await renderSvg(shown, box, width, height, { signal: step.signal });
  await step(`${prefix}Drawing ${width.toLocaleString()} × ${height.toLocaleString()} px`);
  return { canvas: await drawSvg(markup, width, height) };
}

/** A PDF file of the regions, one JPEG page each, drawn one at a time to keep memory low. */
async function rasterPdf(regions: Region[], title: string, step: Step) {
  const pages: PdfPage[] = [];
  for (const [index, region] of regions.entries()) {
    const prefix = regions.length > 1 ? `Page ${index + 1} of ${regions.length} · ` : "";
    const { canvas } = await rasterRegion(region, PDF_SCALE, step, prefix);
    await step(`${prefix}Compressing`);
    const jpeg = await canvasBlob(canvas, "image/jpeg", PDF_JPEG_QUALITY);
    pages.push({
      jpeg: new Uint8Array(await jpeg.arrayBuffer()),
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
      width: region.box.width,
      height: region.box.height,
    });
    // Frees the canvas's memory before the next page.
    canvas.width = 0;
    canvas.height = 0;
  }
  await step("Writing the PDF");
  return pdfFile(pages, title);
}

/**
 * Exports the selection (`ids`), or the whole board when `ids` is null, in `format`. PNG and JPG
 * are drawn at `scale`; the file downloads. `onProgress` hears each step; aborting `signal` stops
 * the export (it then rejects with the abort reason and nothing is saved).
 */
export async function exportBoard(
  elements: BoardElement[],
  ids: string[] | null,
  format: ExportFormat,
  boardName: string,
  {
    scale = 2,
    onProgress,
    signal,
  }: {
    scale?: ImageScale;
    onProgress?: (progress: ExportProgress) => void;
    signal?: AbortSignal;
  } = {},
) {
  if (format === "pdf") {
    const regions = pdfRegions(elements, ids);
    const only = regions.length === 1 ? regions[0]!.label : null;
    const name = fileName(boardName, only, "pdf");
    // Per page: embed, draw, compress; then the file itself.
    const step = stepper(3 * regions.length + 1, onProgress, signal);
    const file = await rasterPdf(regions, name.replace(/\.pdf$/, ""), step);
    signal?.throwIfAborted();
    download(file, name);
    return;
  }

  const region = imageRegion(elements, ids);
  // Embed, draw, encode.
  const step = stepper(3, onProgress, signal);
  const { canvas } = await rasterRegion(region, scale, step);
  await step(format === "jpg" ? "Compressing the JPG" : "Encoding the PNG");
  const blob =
    format === "jpg"
      ? await canvasBlob(canvas, "image/jpeg", JPEG_QUALITY)
      : await canvasBlob(canvas, "image/png");
  signal?.throwIfAborted();
  download(blob, fileName(boardName, region.label, format));
}

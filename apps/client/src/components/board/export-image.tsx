// export_image (tools.md §6): an AI editor asks an open board tab to draw part of the board as a
// PNG, so it can see its own work. The tab renders the server's elements with the canvas's own
// ElementShape into a hidden SVG, makes that SVG standalone (computed colors inlined, images and
// fonts embedded as data URLs), then rasterizes it on a <canvas>.

import {
  type BoardElement,
  EXPORT_IMAGE_DEFAULT_SIDE,
  EXPORT_IMAGE_MAX_SIDE,
  type ExportImageReply,
  type ExportImageRequest,
  hiddenMindNodes,
} from "@prism/shared";
import { type ReactNode, startTransition, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import type { Theme } from "@/lib/theme";
import { byZ } from "./board-model";
import { ElementShape } from "./element-shape";
import { blobToDataUrl, embeddedFontCss } from "./embed-fonts";
import { backdropOf, boundsOf, type Box, elementBounds, intersects } from "./geometry";
import { preloadIcons } from "./icons";
import { MindBranches } from "./mind-branches";
import { loadBoardFonts } from "./text-layout";

const SVG_NS = "http://www.w3.org/2000/svg";
/** Room around a selection or the whole board, in board px. A frame is shown edge to edge. */
const PADDING = 24;
/** Above this a PNG goes out as a JPEG instead (vision APIs cap images near 5 MB). */
const IMAGE_MAX_BYTES = 3_500_000;
/** JPEG qualities tried in turn until the image fits. */
const JPEG_QUALITIES = [0.9, 0.75, 0.6];
/** Computed styles copied onto every node, so the image needs no stylesheet or CSS variables. */
const PAINT = ["fill", "stroke", "color"];
const TEXT = ["font-family", "font-size", "font-weight", "letter-spacing"];

class ExportError extends Error {}

/** The board area to show and the elements in it, bottom layer first. */
function pickRegion(request: ExportImageRequest): { box: Box; shown: BoardElement[] } {
  // Nodes in folded mind map branches aren't on the board, so they aren't in the picture.
  const hidden = hiddenMindNodes(request.elements);
  const elements = request.elements.filter((el) => !hidden.has(el.id));
  if (request.frameId) {
    const frame = elements.find((el) => el.id === request.frameId);
    if (!frame) throw new ExportError("No element with that frameId on this board.");
    const box = elementBounds(frame);
    return { box, shown: byZ(elements.filter((el) => intersects(elementBounds(el), box))) };
  }
  let shown = elements;
  if (request.ids) {
    const ids = new Set(request.ids);
    shown = elements.filter((el) => ids.has(el.id));
    if (shown.length === 0) throw new ExportError("None of those ids are on this board.");
  }
  const bounds = boundsOf(shown);
  if (!bounds) throw new ExportError("The board is empty: there's nothing to show yet.");
  return {
    box: {
      x: bounds.x - PADDING,
      y: bounds.y - PADDING,
      width: bounds.width + 2 * PADDING,
      height: bounds.height + 2 * PADDING,
    },
    shown: byZ(shown),
  };
}

/** Image px per board px: the asked-for scale, else a fit to the default size; never too big. */
function pickScale(box: Box, requested: number | undefined) {
  const longest = Math.max(box.width, box.height, 1);
  const scale = requested ?? Math.min(2, EXPORT_IMAGE_DEFAULT_SIDE / longest);
  return Math.min(scale, EXPORT_IMAGE_MAX_SIDE / longest);
}

/** The page background behind the board, resolved from the theme. */
function boardBackground(host: HTMLElement) {
  const probe = document.createElement("div");
  probe.style.background = "var(--background)";
  host.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color && color !== "rgba(0, 0, 0, 0)" ? color : "#ffffff";
}

/** How long a stretch of export work runs before the page gets a turn, in ms. */
const SLICE_MS = 12;

function yieldToPage() {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * Awaited between small pieces of a long job: every SLICE_MS it lets the page paint and handle
 * input (an export's progress screen and its Cancel button), and it throws once `signal` aborts.
 */
export function pacer(signal?: AbortSignal) {
  let until = performance.now() + SLICE_MS;
  return async () => {
    signal?.throwIfAborted();
    if (performance.now() < until) return;
    await yieldToPage();
    signal?.throwIfAborted();
    until = performance.now() + SLICE_MS;
  };
}

/**
 * Copies the computed paint and text styles onto each node, then drops the class names. Every
 * value is read before any is written: a write between reads would make the browser work out
 * the styles again for each node.
 */
async function inlineStyles(svg: SVGSVGElement, pace: () => Promise<void>) {
  const nodes = [...svg.querySelectorAll<SVGElement>("*")].filter(
    (node) => node instanceof SVGGraphicsElement,
  );
  const values: string[][] = [];
  for (const node of nodes) {
    await pace();
    const computed = getComputedStyle(node);
    const isText = node instanceof SVGTextContentElement;
    values.push((isText ? [...PAINT, ...TEXT] : PAINT).map((p) => computed.getPropertyValue(p)));
  }
  nodes.forEach((node, i) => {
    const isText = node instanceof SVGTextContentElement;
    (isText ? [...PAINT, ...TEXT] : PAINT).forEach((property, j) => {
      const value = values[i]?.[j];
      if (value) node.style.setProperty(property, value);
    });
    node.removeAttribute("class");
  });
}

/** Calls `onCommit` once its children are in the page. */
function Committed({ onCommit, children }: { onCommit: () => void; children: ReactNode }) {
  useLayoutEffect(() => onCommit(), [onCommit]);
  return children;
}

/** Downloaded image files, newest last. Asset keys never change content, so they're kept. */
const assetFiles = new Map<string, Promise<Blob | null>>();
const ASSET_CACHE_SIZE = 40;

function assetFile(href: string) {
  const cached = assetFiles.get(href);
  if (cached) {
    assetFiles.delete(href);
    assetFiles.set(href, cached);
    return cached;
  }
  const file = fetch(href)
    .then((response) => (response.ok ? response.blob() : null))
    .catch(() => null);
  void file.then((blob) => {
    if (!blob && assetFiles.get(href) === file) assetFiles.delete(href);
  });
  assetFiles.set(href, file);
  const oldest = assetFiles.keys().next().value;
  if (assetFiles.size > ASSET_CACHE_SIZE && oldest !== undefined) assetFiles.delete(oldest);
  return file;
}

/** Below this share of its pixels a raster image isn't worth scaling down. */
const RESIZE_BELOW = 0.8;

/**
 * The share of `natural`'s width and height that `image` shows at `scale` image px per board px:
 * a photo drawn small in the picture needs only that many of its pixels.
 */
function shownShare(
  image: SVGImageElement,
  natural: { width: number; height: number },
  scale: number,
) {
  const width = Number(image.getAttribute("width")) * scale;
  const height = Number(image.getAttribute("height")) * scale;
  if (!(width > 0 && height > 0)) return { x: 1, y: 1 };
  const aspect = image.getAttribute("preserveAspectRatio") ?? "";
  if (aspect === "none") return { x: width / natural.width, y: height / natural.height };
  const pick = aspect.includes("slice") ? Math.max : Math.min;
  const fit = pick(width / natural.width, height / natural.height);
  return { x: fit, y: fit };
}

/**
 * The image file to embed: `file` scaled down to what its largest use shows, or `file` itself
 * when that saves little. SVG files stay vector.
 */
async function sizedImage(file: Blob, uses: SVGImageElement[], scale: number) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const natural = { width: bitmap.width, height: bitmap.height };
    let x = 0;
    let y = 0;
    for (const use of uses) {
      const share = shownShare(use, natural, scale);
      x = Math.max(x, share.x);
      y = Math.max(y, share.y);
    }
    if (x >= RESIZE_BELOW && y >= RESIZE_BELOW) {
      bitmap.close();
      return file;
    }
    const width = Math.max(1, Math.ceil(natural.width * Math.min(1, x)));
    const height = Math.max(1, Math.ceil(natural.height * Math.min(1, y)));
    const resized = await createImageBitmap(bitmap, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
    });
    bitmap.close();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(resized, 0, 0);
    resized.close();
    // Photos stay JPEG; anything that may be transparent stays PNG.
    const smaller =
      file.type === "image/jpeg"
        ? await canvasBlob(canvas, "image/jpeg", 0.9)
        : await canvasBlob(canvas, "image/png");
    return smaller.size < file.size ? smaller : file;
  } catch {
    return file;
  }
}

/**
 * Replaces each <image>'s URL with the file itself (an SVG image can't load anything), scaled
 * down to the pixels the picture shows at `scale` image px per board px.
 */
async function inlineImages(svg: SVGSVGElement, scale: number) {
  const uses = new Map<string, SVGImageElement[]>();
  for (const image of svg.querySelectorAll("image")) {
    const href = image.getAttribute("href");
    if (!href || href.startsWith("data:")) continue;
    uses.set(href, [...(uses.get(href) ?? []), image]);
  }
  await Promise.all(
    [...uses].map(async ([href, images]) => {
      const file = await assetFile(href);
      const url = file ? await blobToDataUrl(await sizedImage(file, images, scale)) : null;
      for (const image of images) {
        if (url) image.setAttribute("href", url);
        else image.remove();
      }
    }),
  );
}

/**
 * The region drawn as standalone SVG markup, `width` × `height` px: on the page background, or
 * transparent (dashboard previews sit on their own dotted canvas). Colors follow the page's
 * theme, or `theme` when given. Images keep only the pixels `width` shows.
 *
 * The work is done in slices so the page stays responsive, and stops (throwing the abort
 * reason) once `signal` aborts.
 */
export async function renderSvg(
  shown: BoardElement[],
  box: Box,
  width: number,
  height: number,
  {
    background = true,
    theme,
    signal,
  }: { background?: boolean; theme?: Theme; signal?: AbortSignal } = {},
) {
  const pace = pacer(signal);
  // Text is measured with the board's fonts, and icons must draw on the first render.
  await Promise.all([
    loadBoardFonts(shown),
    preloadIcons(shown.flatMap((el) => (el.type === "icon" && el.icon ? [el.icon] : []))),
  ]);

  // Rendered in the page (offscreen), so classes and CSS variables resolve to real values.
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  // index.css scopes both themes' variables to these classes.
  if (theme) host.classList.add(theme);
  document.body.append(host);
  const root = createRoot(host);
  try {
    const fill = background ? boardBackground(host) : null;
    signal?.throwIfAborted();
    // A transition: React renders in slices between which the page gets its turn.
    await new Promise<void>((resolve, reject) => {
      const abort = () => reject(signal?.reason as Error);
      signal?.addEventListener("abort", abort, { once: true });
      const committed = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
      startTransition(() =>
        root.render(
          <Committed onCommit={committed}>
            <svg
              xmlns={SVG_NS}
              viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
              width={width}
              height={height}
            >
              {fill && (
                <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={fill} />
              )}
              <MindBranches elements={shown} />
              {shown.map((el, i) => (
                <ElementShape key={el.id} el={el} below={backdropOf(shown, i)} />
              ))}
            </svg>
          </Committed>,
        ),
      );
    });
    const svg = host.querySelector("svg");
    if (!svg) throw new Error("The board image didn't render.");
    await inlineStyles(svg, pace);
    await inlineImages(svg, Math.max(width / box.width, height / box.height));
    await pace();
    const fonts = await embeddedFontCss(svg, pace);
    if (fonts) {
      const style = document.createElementNS(SVG_NS, "style");
      style.textContent = fonts;
      svg.prepend(style);
    }
    return new XMLSerializer().serializeToString(svg);
  } finally {
    root.unmount();
    host.remove();
  }
}

export function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the image."))),
      type,
      quality,
    );
  });
}

/** Draws standalone SVG markup on a `width` × `height` canvas. */
export async function drawSvg(markup: string, width: number, height: number) {
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const image = new Image(width, height);
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser can't draw images.");
    context.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws the SVG markup on a canvas and encodes it: PNG, or JPEG when the PNG is too large. */
async function rasterize(markup: string, width: number, height: number) {
  const canvas = await drawSvg(markup, width, height);
  let blob = await canvasBlob(canvas, "image/png");
  let mimeType: "image/png" | "image/jpeg" = "image/png";
  for (const quality of JPEG_QUALITIES) {
    if (blob.size <= IMAGE_MAX_BYTES) break;
    blob = await canvasBlob(canvas, "image/jpeg", quality);
    mimeType = "image/jpeg";
  }
  if (blob.size > IMAGE_MAX_BYTES) {
    throw new ExportError("The image is too large to send. Try a smaller scale or area.");
  }
  const dataUrl = await blobToDataUrl(blob);
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType };
}

/** Answers an export_image request from an AI editor. Never throws: failures become a reply. */
export async function exportBoardImage(request: ExportImageRequest): Promise<ExportImageReply> {
  try {
    const { box, shown } = pickRegion(request);
    const scale = pickScale(box, request.scale);
    const width = Math.max(1, Math.round(box.width * scale));
    const height = Math.max(1, Math.round(box.height * scale));
    const markup = await renderSvg(shown, box, width, height);
    const image = await rasterize(markup, width, height);
    return { ok: true, ...image, width, height, region: box };
  } catch (error) {
    if (!(error instanceof ExportError)) console.error("[Prism] Board image export failed:", error);
    const message = error instanceof Error ? error.message : "The board image couldn't be made.";
    return { ok: false, error: message.slice(0, 500) };
  }
}

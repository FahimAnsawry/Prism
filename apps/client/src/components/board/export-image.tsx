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
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { byZ } from "./board-model";
import { ElementShape } from "./element-shape";
import { blobToDataUrl, embeddedFontCss } from "./embed-fonts";
import { boundsOf, type Box, elementBounds, intersects } from "./geometry";
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

/** Copies the computed paint and text styles onto each node, then drops the class names. */
function inlineStyles(svg: SVGSVGElement) {
  for (const node of svg.querySelectorAll<SVGElement>("*")) {
    if (!(node instanceof SVGGraphicsElement)) continue;
    const computed = getComputedStyle(node);
    const isText = node instanceof SVGTextContentElement;
    for (const property of isText ? [...PAINT, ...TEXT] : PAINT) {
      const value = computed.getPropertyValue(property);
      if (value) node.style.setProperty(property, value);
    }
    node.removeAttribute("class");
  }
}

/** Replaces each <image>'s URL with the file itself (an SVG image can't load anything). */
async function inlineImages(svg: SVGSVGElement) {
  const files = new Map<string, Promise<string | null>>();
  await Promise.all(
    [...svg.querySelectorAll("image")].map(async (image) => {
      const href = image.getAttribute("href");
      if (!href || href.startsWith("data:")) return;
      let file = files.get(href);
      if (!file) {
        file = fetch(href)
          .then((response) => (response.ok ? response.blob() : null))
          .then((blob) => (blob ? blobToDataUrl(blob) : null))
          .catch(() => null);
        files.set(href, file);
      }
      const url = await file;
      if (url) image.setAttribute("href", url);
      else image.remove();
    }),
  );
}

/** The region drawn as standalone SVG markup, `width` × `height` px. */
async function renderSvg(shown: BoardElement[], box: Box, width: number, height: number) {
  // Text is measured with the board's fonts, and icons must draw on the first render.
  await Promise.all([
    loadBoardFonts(shown),
    preloadIcons(shown.flatMap((el) => (el.type === "icon" && el.icon ? [el.icon] : []))),
  ]);

  // Rendered in the page (offscreen), so classes and CSS variables resolve to real values.
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  document.body.append(host);
  const root = createRoot(host);
  try {
    const background = boardBackground(host);
    flushSync(() =>
      root.render(
        <svg
          xmlns={SVG_NS}
          viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
          width={width}
          height={height}
        >
          <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={background} />
          <MindBranches elements={shown} />
          {shown.map((el) => (
            <ElementShape key={el.id} el={el} />
          ))}
        </svg>,
      ),
    );
    const svg = host.querySelector("svg");
    if (!svg) throw new Error("The board image didn't render.");
    inlineStyles(svg);
    await inlineImages(svg);
    const fonts = await embeddedFontCss(svg);
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

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the image."))),
      type,
      quality,
    );
  });
}

/** Draws the SVG markup on a canvas and encodes it: PNG, or JPEG when the PNG is too large. */
async function rasterize(markup: string, width: number, height: number) {
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
  } finally {
    URL.revokeObjectURL(url);
  }
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

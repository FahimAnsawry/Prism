// Images and SVGs on the board (tools.md §1, tools 15 and 17): sanitize, upload, size.

import {
  IMAGE_TYPES,
  isSafeSvgAttribute,
  isSafeSvgStyle,
  SVG_ALLOWED_ELEMENTS,
  SVG_TYPE,
  UPLOAD_MAX_BYTES,
  uploadResultSchema,
} from "@prism/shared";
import { ApiError, apiFetch } from "@/lib/api";

/** Where the server serves an uploaded file. */
export const assetUrl = (assetKey: string) =>
  new URL(`/uploads/${assetKey}`, import.meta.env.VITE_SERVER_URL).href;

export const isImageFile = (file: File) => (IMAGE_TYPES as readonly string[]).includes(file.type);
export const isSvgFile = (file: File) =>
  file.type === SVG_TYPE || file.name.toLowerCase().endsWith(".svg");

export async function uploadAsset(boardId: string, file: Blob) {
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new ApiError(`Files can be up to ${UPLOAD_MAX_BYTES / 1024 / 1024} MB.`, 413);
  }
  const { assetKey } = await apiFetch(
    `/api/boards/${encodeURIComponent(boardId)}/uploads`,
    uploadResultSchema,
    { method: "POST", body: file },
  );
  return assetKey;
}

/** The natural size of an image file. */
export async function imageSize(file: Blob) {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * Cleans SVG markup in the browser: drops <script>, <foreignObject> and every other element
 * outside the allowlist, `on*` attributes and external links. Returns null for a non-SVG file.
 * The server runs the same rules again.
 */
export function sanitizeSvg(source: string) {
  const doc = new DOMParser().parseFromString(source, SVG_TYPE);
  const root = doc.documentElement;
  if (root.nodeName !== "svg" || doc.querySelector("parsererror")) return null;

  const clean = (node: Element) => {
    for (const child of [...node.children]) {
      if (!SVG_ALLOWED_ELEMENTS.has(child.localName)) {
        child.remove();
        continue;
      }
      if (child.localName === "style" && !isSafeSvgStyle(child.textContent ?? "")) {
        child.remove();
        continue;
      }
      clean(child);
    }
    for (const attribute of [...node.attributes]) {
      if (!isSafeSvgAttribute(node.localName, attribute.name, attribute.value)) {
        node.removeAttribute(attribute.name);
      }
    }
  };
  clean(root);

  // Size from the viewBox, else width/height, else a default.
  const viewBox = root
    .getAttribute("viewBox")
    ?.split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite);
  const length = (name: string) => {
    const value = Number.parseFloat(root.getAttribute(name) ?? "");
    return Number.isFinite(value) && value > 0 && !root.getAttribute(name)?.endsWith("%")
      ? value
      : undefined;
  };
  const width = length("width") ?? (viewBox?.length === 4 ? viewBox[2] : undefined) ?? 300;
  const height = length("height") ?? (viewBox?.length === 4 ? viewBox[3] : undefined) ?? 150;
  if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${width} ${height}`);

  return { markup: new XMLSerializer().serializeToString(root), width, height };
}

/** Fits a natural size inside `max` × `max` world units, keeping the ratio. */
export function fitSize(width: number, height: number, max = 480) {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.max(8, width * scale), height: Math.max(8, height * scale) };
}

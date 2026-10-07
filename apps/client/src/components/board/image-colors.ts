// search_images (color: true): the server hands this tab small thumbnails of the candidate
// photos and the tab, which can decode any image, measures how colorful each one is, so black
// and white photos can be left out. Pure browser APIs: an <img> and a tiny canvas.

import type { ImageColorsReply, ImageColorsRequest } from "@prism/shared";

/** Thumbnails are sampled at this size: enough to tell color from gray. */
const SAMPLE = 32;
/** Pixels darker than this have no meaningful color, so they don't count. */
const DARK = 25;

async function saturationOf(data: string): Promise<number | null> {
  const img = new Image();
  img.src = data;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  const pixels = context.getImageData(0, 0, SAMPLE, SAMPLE).data;
  let sum = 0;
  let counted = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const max = Math.max(r, g, b);
    if (max < DARK) continue;
    sum += (max - Math.min(r, g, b)) / max;
    counted++;
  }
  return counted > 0 ? sum / counted : 0;
}

/** Answers a color check. Never throws: an image that can't be read gets null. */
export async function imageColorsOnTab(request: ImageColorsRequest): Promise<ImageColorsReply> {
  try {
    const results = await Promise.all(
      request.images.map(async ({ id, data }) => ({ id, saturation: await saturationOf(data) })),
    );
    return { ok: true, results };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 500) : "The colors couldn't be read.",
    };
  }
}

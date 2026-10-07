// compare_reference (tools.md §1): measures a screen against a reference image so an AI editor
// can see how far its design is from the reference. The open board tab renders the frame (the
// same drawing as export_image), loads the reference, samples both onto small grids and compares
// layout lightness, colors, whitespace and shape. Only numbers and sentences go back, no image.

import type { CompareReferenceReply, CompareReferenceRequest } from "@prism/shared";
import { assetUrl } from "./assets";
import { exportBoardImage } from "./export-image";

/** Sampling grid: fine enough for colors and whitespace, coarse enough to ignore detail. */
const GRID = 48;
/** The coarser grid the layout (lightness map) is compared on. */
const LAYOUT_GRID = 12;
/** Longest side the screen is rendered at before sampling. */
const RENDER_SIDE = 480;
/** Colors this close (RGB distance) count as the same color. */
const SAME_COLOR = 48;
const REGION_NAMES = [
  "top-left",
  "top",
  "top-right",
  "middle-left",
  "middle",
  "middle-right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

type Rgb = [number, number, number];

interface Sample {
  aspect: number;
  /** GRID × GRID colors, row by row. */
  pixels: Rgb[];
}

class CompareError extends Error {}

/** Draws an image onto a size × size canvas (stretched, so both images share one grid). */
function sample(image: ImageBitmap, size: number): Rgb[] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new CompareError("This browser can't measure images.");
  // Transparent areas read as white, like the page behind a screen.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, size, size);
  const data = context.getImageData(0, 0, size, size).data;
  const pixels: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i] ?? 255, data[i + 1] ?? 255, data[i + 2] ?? 255]);
  }
  return pixels;
}

async function load(blob: Blob): Promise<Sample> {
  const image = await createImageBitmap(blob).catch(() => {
    throw new CompareError("The reference isn't an image this browser can read.");
  });
  try {
    return { aspect: image.width / Math.max(1, image.height), pixels: sample(image, GRID) };
  } finally {
    image.close();
  }
}

/** Relative lightness, 0 (black) to 1 (white). */
const lightness = ([r, g, b]: Rgb) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hex = (color: Rgb) =>
  `#${color.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The mean lightness of each cell of an n × n grid over the sample. */
function lightnessGrid(pixels: Rgb[], n: number) {
  const sums = new Array<number>(n * n).fill(0);
  const counts = new Array<number>(n * n).fill(0);
  pixels.forEach((pixel, i) => {
    const cell =
      Math.floor((Math.floor(i / GRID) * n) / GRID) * n + Math.floor(((i % GRID) * n) / GRID);
    sums[cell] = (sums[cell] ?? 0) + lightness(pixel);
    counts[cell] = (counts[cell] ?? 0) + 1;
  });
  return sums.map((sum, i) => sum / Math.max(1, counts[i] ?? 1));
}

/**
 * How much detail each cell of an n × n grid holds: the spread of lightness between neighboring
 * pixels in it. Text, edges and photos are detailed; plain backgrounds aren't.
 */
function detailGrid(pixels: Rgb[], n: number) {
  const sums = new Array<number>(n * n).fill(0);
  const counts = new Array<number>(n * n).fill(0);
  const light = pixels.map(lightness);
  light.forEach((l, i) => {
    const row = Math.floor(i / GRID);
    const col = i % GRID;
    if (col === GRID - 1 || row === GRID - 1) return;
    const change = Math.abs(l - (light[i + 1] ?? l)) + Math.abs(l - (light[i + GRID] ?? l));
    const cell = Math.floor((row * n) / GRID) * n + Math.floor((col * n) / GRID);
    sums[cell] = (sums[cell] ?? 0) + change;
    counts[cell] = (counts[cell] ?? 0) + 1;
  });
  return sums.map((sum, i) => sum / Math.max(1, counts[i] ?? 1));
}

/**
 * How alike two maps are in where things are, 0 to 1: their correlation. Two flat maps (no
 * structure to compare) fall back to how close their values are.
 */
function mapSimilarity(a: number[], b: number[]) {
  const mean = (v: number[]) => v.reduce((sum, x) => sum + x, 0) / v.length;
  const ma = mean(a);
  const mb = mean(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  a.forEach((x, i) => {
    const y = b[i] ?? mb;
    cov += (x - ma) * (y - mb);
    va += (x - ma) ** 2;
    vb += (y - mb) ** 2;
  });
  if (va < 1e-4 || vb < 1e-4) {
    const gap = a.reduce((sum, x, i) => sum + Math.abs(x - (b[i] ?? x)), 0) / a.length;
    return Math.max(0, 1 - 2 * gap);
  }
  return Math.max(0, cov / Math.sqrt(va * vb));
}

/** Dominant colors: pixels bucketed by 3 bits per channel, each bucket's mean color and share. */
function topColors(pixels: Rgb[], limit = 5) {
  const buckets = new Map<number, { sum: Rgb; count: number }>();
  for (const pixel of pixels) {
    const key = ((pixel[0] >> 5) << 6) | ((pixel[1] >> 5) << 3) | (pixel[2] >> 5);
    const bucket = buckets.get(key) ?? { sum: [0, 0, 0], count: 0 };
    bucket.sum = [bucket.sum[0] + pixel[0], bucket.sum[1] + pixel[1], bucket.sum[2] + pixel[2]];
    bucket.count++;
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ sum, count }) => ({
      rgb: sum.map((v) => v / count) as Rgb,
      share: count / pixels.length,
    }));
}

/** Share of the pixels close to `color`. */
const shareNear = (pixels: Rgb[], color: Rgb) =>
  pixels.filter((pixel) => distance(pixel, color) <= SAME_COLOR).length / pixels.length;

/** How alike two color mixes are: histogram overlap on 4 levels per channel, 0 to 1. */
function colorOverlap(a: Rgb[], b: Rgb[]) {
  const histogram = (pixels: Rgb[]) => {
    const bins = new Array<number>(64).fill(0);
    for (const [r, g, bl] of pixels) {
      const bin = ((r >> 6) << 4) | ((g >> 6) << 2) | (bl >> 6);
      bins[bin] = (bins[bin] ?? 0) + 1 / pixels.length;
    }
    return bins;
  };
  const ha = histogram(a);
  const hb = histogram(b);
  return ha.reduce((sum, value, i) => sum + Math.min(value, hb[i] ?? 0), 0);
}

const tone = (l: number) => (l < 0.35 ? "dark" : l > 0.7 ? "light" : "mid-tone");

/** Measures the frame against the reference. Never throws: failures become a reply. */
export async function compareReference(
  request: CompareReferenceRequest,
): Promise<CompareReferenceReply> {
  try {
    const frame = request.elements.find((el) => el.id === request.frameId);
    if (!frame) throw new CompareError("No element with that frameId on this board.");
    const reference = request.elements.find((el) => el.id === request.referenceId);
    if (!reference?.assetKey || (reference.type !== "image" && reference.type !== "svg")) {
      throw new CompareError(
        "referenceId must be an image on the board (add one with add_image first).",
      );
    }

    const scale = RENDER_SIDE / Math.max(Math.abs(frame.width), Math.abs(frame.height), 1);
    const shot = await exportBoardImage({
      boardId: request.boardId,
      elements: request.elements,
      frameId: request.frameId,
      scale,
    });
    if (!shot.ok) throw new CompareError(shot.error);
    const shotBytes = Uint8Array.from(atob(shot.data), (ch) => ch.charCodeAt(0));
    const screen = await load(new Blob([shotBytes], { type: shot.mimeType }));
    const referenceBlob = await fetch(assetUrl(reference.assetKey)).then((response) => {
      if (!response.ok) throw new CompareError("The reference image couldn't be loaded.");
      return response.blob();
    });
    const ref = await load(referenceBlob);

    // Layout: where it's light or dark, and where the detail (text, edges, photos) is, on a
    // coarse grid. Correlation, so two mostly white images don't match just for being white.
    const tones = mapSimilarity(
      lightnessGrid(screen.pixels, LAYOUT_GRID),
      lightnessGrid(ref.pixels, LAYOUT_GRID),
    );
    const screenDetail = detailGrid(screen.pixels, LAYOUT_GRID);
    const refDetail = detailGrid(ref.pixels, LAYOUT_GRID);
    const structure = mapSimilarity(screenDetail, refDetail);
    const colors = colorOverlap(screen.pixels, ref.pixels);
    const shape = Math.min(screen.aspect, ref.aspect) / Math.max(screen.aspect, ref.aspect);
    const score = Math.round(100 * (0.3 * tones + 0.3 * structure + 0.25 * colors + 0.15 * shape));

    const screenRegions = lightnessGrid(screen.pixels, 3);
    const refRegions = lightnessGrid(ref.pixels, 3);
    const regions = REGION_NAMES.map((region, i) => ({
      region,
      screen: round2(screenRegions[i] ?? 0),
      reference: round2(refRegions[i] ?? 0),
    }));

    const screenColors = topColors(screen.pixels);
    const refColors = topColors(ref.pixels);
    const screenBackground = screenColors[0]?.rgb ?? [255, 255, 255];
    const refBackground = refColors[0]?.rgb ?? [255, 255, 255];
    const whitespace = {
      screen: round2(shareNear(screen.pixels, screenBackground)),
      reference: round2(shareNear(ref.pixels, refBackground)),
    };

    // The biggest differences, each with a weight, as changes to make in the screen.
    const found: { weight: number; text: string }[] = [];
    for (const { region, screen: s, reference: r } of regions) {
      if (Math.abs(s - r) > 0.25 && tone(s) !== tone(r)) {
        found.push({
          weight: Math.abs(s - r),
          text: `${region}: the reference is ${tone(r)}, the screen is ${tone(s)}. Make that area ${s < r ? "lighter" : "darker"}.`,
        });
      }
    }
    for (const { rgb, share } of refColors) {
      if (share < 0.08) continue;
      const inScreen = shareNear(screen.pixels, rgb);
      if (inScreen < share / 3) {
        found.push({
          weight: share - inScreen,
          text: `The reference uses ${hex(rgb)} for ${Math.round(share * 100)}% of the image; the screen has ${Math.round(inScreen * 100)}%. Bring that color in where the reference has it.`,
        });
      }
    }
    const space = whitespace.screen - whitespace.reference;
    if (Math.abs(space) > 0.15) {
      found.push({
        weight: Math.abs(space),
        text:
          space > 0
            ? `The screen is emptier than the reference (${Math.round(whitespace.screen * 100)}% plain background vs ${Math.round(whitespace.reference * 100)}%): tighten spacing or add the content the reference has.`
            : `The screen is busier than the reference (${Math.round(whitespace.screen * 100)}% plain background vs ${Math.round(whitespace.reference * 100)}%): give it more room or fewer elements.`,
      });
    }
    if (structure < 0.5) {
      // Where each one's busiest third of the regions is.
      const busiest = (map: number[]) => {
        const regions = REGION_NAMES.map((name, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          let sum = 0;
          map.forEach((v, j) => {
            const r = Math.floor((Math.floor(j / LAYOUT_GRID) * 3) / LAYOUT_GRID);
            const c = Math.floor(((j % LAYOUT_GRID) * 3) / LAYOUT_GRID);
            if (r === row && c === col) sum += v;
          });
          return { name, sum };
        });
        return regions
          .sort((a, b) => b.sum - a.sum)
          .slice(0, 3)
          .map((r) => r.name);
      };
      found.push({
        weight: 1 - structure,
        text: `Content sits in different places: the reference's busiest areas are ${busiest(refDetail).join(", ")}; the screen's are ${busiest(screenDetail).join(", ")}. Move the main blocks to match the reference's layout.`,
      });
    }
    if (shape < 0.85) {
      found.push({
        weight: 1 - shape,
        text: `The shapes differ: the screen is ${round2(screen.aspect)}:1 (width:height), the reference ${round2(ref.aspect)}:1. Compare at the same size, or adjust the frame.`,
      });
    }

    return {
      ok: true,
      score,
      breakdown: {
        tones: round2(tones),
        structure: round2(structure),
        colors: round2(colors),
        shape: round2(shape),
      },
      aspect: { screen: round2(screen.aspect), reference: round2(ref.aspect) },
      colors: {
        screen: screenColors.map(({ rgb, share }) => ({ color: hex(rgb), share: round2(share) })),
        reference: refColors.map(({ rgb, share }) => ({ color: hex(rgb), share: round2(share) })),
      },
      regions,
      whitespace,
      differences: found
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map((d) => d.text),
    };
  } catch (error) {
    if (!(error instanceof CompareError))
      console.error("[Prism] Reference comparison failed:", error);
    const message = error instanceof Error ? error.message : "The comparison couldn't be made.";
    return { ok: false, error: message.slice(0, 500) };
  }
}

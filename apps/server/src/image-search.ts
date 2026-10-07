// Photo search for AI editors (search_images), with no API keys: Openverse first, Wikimedia
// Commons when Openverse fails or comes up short. Each source is an adapter returning the same
// result shape, so another source (a keyed stock site) can be added without touching the tool.
// Only licenses that allow commercial use and changes, with at most a credit line, are returned:
// CC0, public domain and CC BY (no share-alike, no non-commercial).

export type Orientation = "landscape" | "portrait" | "square";

export interface FoundImage {
  /** A direct image URL, sized for a screen where the source offers it. */
  url: string;
  /** The image's size (the original's when the URL is a smaller copy): its shape, not its pixels. */
  width: number | null;
  height: number | null;
  title: string;
  /** Where it was found: "openverse", "wikimedia". */
  source: string;
  /** "CC0 1.0", "Public Domain", "CC BY 2.0", … */
  license: string;
  licenseUrl: string | null;
  author: string | null;
  /** A small copy, for checking its colors (not shown to AI editors). */
  thumb?: string;
  /** The page the image comes from. */
  page: string | null;
  /** A credit line to show when the license asks for one (CC BY). */
  credit: string;
}

export interface SearchOptions {
  orientation?: Orientation | undefined;
  count: number;
}

export interface ImageSource {
  name: string;
  search(query: string, options: SearchOptions): Promise<FoundImage[]>;
}

const TIMEOUT_MS = 10_000;
// Wikimedia asks API clients to say who they are.
const USER_AGENT = "Prism/0.1 (design whiteboard; https://github.com/FahimAnsawry/Prism)";

async function getJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 429) throw new Error("rate-limited");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** Whether a width × height fits the orientation asked for (unknown sizes pass). */
function fits(width: number | null, height: number | null, orientation?: Orientation) {
  if (!orientation || !width || !height) return true;
  const ratio = width / height;
  if (orientation === "landscape") return ratio >= 1.15;
  if (orientation === "portrait") return ratio <= 0.87;
  return ratio > 0.87 && ratio < 1.15;
}

function creditLine(image: Omit<FoundImage, "credit">) {
  const by = image.author ? ` by ${image.author}` : "";
  return `"${image.title}"${by}, ${image.license} (${image.source})`;
}

// ── Openverse ──────────────────────────────────────────────────────────────

interface OpenverseResult {
  url?: string;
  thumbnail?: string | null;
  width?: number | null;
  height?: number | null;
  title?: string | null;
  creator?: string | null;
  license?: string;
  license_version?: string | null;
  license_url?: string | null;
  foreign_landing_url?: string | null;
  source?: string | null;
}

const OPENVERSE_LICENSES: Record<string, string> = {
  cc0: "CC0",
  pdm: "Public Domain",
  by: "CC BY",
};
const ASPECT: Record<Orientation, string> = {
  landscape: "wide",
  portrait: "tall",
  square: "square",
};
/** Openverse's stock photo sites: polished photos of anonymous models, searched first. */
const STOCK_SOURCES = "stocksnap,rawpixel,wordpress,nappy";
/** Screen-size copies of Wikimedia originals, which can be far over the upload limit. */
const SCREEN_WIDTH = 1600;

/** A Wikimedia Commons original as its 1600px thumbnail; other URLs as they are. */
function screenSize(url: string, width: number | null) {
  const original =
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)/.exec(
      url,
    );
  if (!original || !width || width <= SCREEN_WIDTH) return url;
  const [, a, ab, file] = original;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${a}/${ab}/${file}/${SCREEN_WIDTH}px-${file}`;
}

export const openverse: ImageSource = {
  name: "openverse",
  async search(query, { orientation, count }) {
    const page = async (filters: Record<string, string>) => {
      const url = new URL("https://api.openverse.org/v1/images/");
      url.searchParams.set("q", query);
      url.searchParams.set("license", "cc0,pdm,by");
      url.searchParams.set("page_size", String(Math.min(20, count * 2)));
      if (orientation) url.searchParams.set("aspect_ratio", ASPECT[orientation]);
      for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
      const data = (await getJson(url)) as { results?: OpenverseResult[] };
      return data.results ?? [];
    };
    // Stock photo sites first, then large photos from anywhere, then anything.
    let results: OpenverseResult[] = [];
    const passes: Record<string, string>[] = [{ source: STOCK_SOURCES }, { size: "large" }, {}];
    for (const filters of passes) {
      if (results.length >= count) break;
      const seen = new Set(results.map((r) => r.url));
      results = [...results, ...(await page(filters)).filter((r) => !seen.has(r.url))];
    }
    return results.flatMap((r): FoundImage[] => {
      const kind = r.license ? OPENVERSE_LICENSES[r.license] : undefined;
      if (!r.url || !kind) return [];
      const version = r.license === "by" && r.license_version ? ` ${r.license_version}` : "";
      const image = {
        url: screenSize(r.url, r.width ?? null),
        width: r.width ?? null,
        height: r.height ?? null,
        title: r.title?.trim() || "Untitled",
        source: `openverse/${r.source ?? "unknown"}`,
        license: `${kind}${version}`,
        licenseUrl: r.license_url ?? null,
        author: r.creator?.trim() || null,
        page: r.foreign_landing_url ?? null,
      };
      return [{ ...image, credit: creditLine(image), ...(r.thumbnail && { thumb: r.thumbnail }) }];
    });
  },
};

// ── Wikimedia Commons ──────────────────────────────────────────────────────

interface CommonsPage {
  title?: string;
  imageinfo?: {
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

/** Commons licenses Prism accepts: CC0, public domain and CC BY without share-alike. */
const COMMONS_OK = /^(cc0|public domain|pd\b|cc by \d(\.\d)?$|cc-by-\d(\.\d)?$)/i;
const stripTags = (html: string) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export const wikimedia: ImageSource = {
  name: "wikimedia",
  // Commons can't filter by shape; searchImages checks the orientation.
  async search(query, { count }) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    for (const [key, value] of Object.entries({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: `filetype:bitmap ${query}`,
      gsrnamespace: "6",
      gsrlimit: String(Math.min(50, count * 4)),
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      // A thumbnail at screen size: originals can be far over the upload limit.
      iiurlwidth: "1600",
      iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|ObjectName",
    })) {
      url.searchParams.set(key, value);
    }
    const data = (await getJson(url)) as { query?: { pages?: Record<string, CommonsPage> } };
    return Object.values(data.query?.pages ?? {}).flatMap((p): FoundImage[] => {
      const info = p.imageinfo?.[0];
      const meta = info?.extmetadata ?? {};
      const license = stripTags(meta["LicenseShortName"]?.value ?? "");
      if (!info?.thumburl || !COMMONS_OK.test(license)) return [];
      if (info.mime && !/^image\/(png|jpeg|gif|webp)$/.test(info.mime)) return [];
      const image = {
        url: info.thumburl,
        width: info.thumbwidth ?? null,
        height: info.thumbheight ?? null,
        title:
          stripTags(meta["ObjectName"]?.value ?? "") ||
          (p.title ?? "Untitled").replace(/^File:/, "").replace(/\.\w+$/, ""),
        source: "wikimedia",
        license,
        licenseUrl: meta["LicenseUrl"]?.value ?? null,
        author: stripTags(meta["Artist"]?.value ?? "") || null,
        page: info.descriptionurl ?? null,
      };
      // A small copy for the color check.
      const thumb = info.thumburl.replace(/\/\d+px-([^/]+)$/, "/160px-$1");
      return [{ ...image, credit: creditLine(image), thumb }];
    });
  },
};

// ── Color ──────────────────────────────────────────────────────────────────

/** Below this mean saturation (0-1) a photo reads as black and white. */
export const COLOR_SATURATION_MIN = 0.08;
const THUMB_BYTES_MAX = 1_500_000;
const THUMB_TIMEOUT_MS = 8_000;
/** Saturation measured so far, by image URL (only successful measurements). */
const saturations = new Map<string, number>();

/** An image's small copy as a data URL, or null if it can't be fetched. */
async function thumbnailData(url: string) {
  try {
    const response = await fetch(url, {
      // Openverse's thumbnail endpoint refuses image/* (406); any type is fine here.
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      signal: AbortSignal.timeout(THUMB_TIMEOUT_MS),
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > THUMB_BYTES_MAX) return null;
    return `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Measures thumbnails' saturation; null when nothing can measure them (no board tab). */
export type ColorMeasurer = (
  images: { id: string; data: string }[],
) => Promise<ReadonlyMap<string, number | null> | null>;

/**
 * Up to `count` of `images`, leaving out black and white ones. Photos whose color couldn't be
 * measured are kept. `checked` is false when nothing could measure them.
 */
export async function colorPhotos(images: FoundImage[], count: number, measure: ColorMeasurer) {
  const unknown = images.filter((image) => !saturations.has(image.url));
  const thumbs = await Promise.all(
    unknown.map(async (image) => ({
      id: image.url,
      data: await thumbnailData(image.thumb ?? image.url),
    })),
  );
  const readable = thumbs.filter((t): t is { id: string; data: string } => t.data !== null);
  let checked = true;
  if (readable.length > 0) {
    const measured = await measure(readable);
    if (measured === null) checked = false;
    for (const [url, saturation] of measured ?? []) {
      if (saturation !== null) saturations.set(url, saturation);
    }
  }
  const kept = images.filter((image) => (saturations.get(image.url) ?? 1) >= COLOR_SATURATION_MIN);
  return { images: kept.slice(0, count), dropped: images.length - kept.length, checked };
}

// ── Search ─────────────────────────────────────────────────────────────────

export const IMAGE_SOURCES: readonly ImageSource[] = [openverse, wikimedia];

const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; result: { images: FoundImage[]; notes: string[] } }>();

/**
 * Up to `count` images for `query` from the sources in order: a later source fills in when an
 * earlier one fails or comes up short. `notes` says which sources failed and why.
 */
export async function searchImages(
  query: string,
  options: SearchOptions,
  sources: readonly ImageSource[] = IMAGE_SOURCES,
) {
  const key = JSON.stringify([query.toLowerCase(), options, sources.map((s) => s.name)]);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.result;

  const images: FoundImage[] = [];
  const notes: string[] = [];
  for (const source of sources) {
    if (images.length >= options.count) break;
    try {
      const found = await source.search(query, options);
      const seen = new Set(images.map((image) => image.url));
      images.push(
        ...found
          .filter((image) => !seen.has(image.url))
          .filter((image) => fits(image.width, image.height, options.orientation)),
      );
    } catch (error) {
      notes.push(`${source.name}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }
  const result = { images: images.slice(0, options.count), notes };
  // Failures aren't cached, so the next call tries the sources again.
  if (notes.length === 0) cache.set(key, { at: Date.now(), result });
  return result;
}

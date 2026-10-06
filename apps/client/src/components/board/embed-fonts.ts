// Fonts for a standalone SVG image (export_image): an SVG drawn as an <img> can't use the page's
// web fonts, so the @font-face rules its text needs are copied in with the files as data URLs.
// Only the faces in use are embedded: the right family, the closest weight, and the unicode-range
// subsets that cover the characters.

interface FaceRule {
  family: string;
  /** Lowest and highest weight (a static font has one; a variable font a range). */
  weights: [number, number];
  /** Code point ranges; null covers everything. */
  ranges: [number, number][] | null;
  /** The font file, as an absolute URL. */
  src: string;
  /** The rule's text, for weights and ranges in the embedded copy. */
  weightText: string;
  rangeText: string;
  format: string;
}

const unquote = (value: string) => value.trim().replace(/^["']|["']$/g, "");

function parseWeights(value: string): [number, number] {
  const words = value.trim().split(/\s+/);
  const weight = (word: string | undefined) =>
    word === "bold" ? 700 : Number.parseInt(word ?? "", 10) || 400;
  const low = weight(words[0]);
  return [low, words[1] ? weight(words[1]) : low];
}

function parseRanges(value: string): [number, number][] | null {
  if (!value.trim()) return null;
  const ranges: [number, number][] = [];
  for (const part of value.split(",")) {
    const match = /U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim());
    if (!match?.[1]) continue;
    const start = match[1];
    if (start.includes("?")) {
      ranges.push([
        Number.parseInt(start.replace(/\?/g, "0"), 16),
        Number.parseInt(start.replace(/\?/g, "f"), 16),
      ]);
    } else {
      const low = Number.parseInt(start, 16);
      ranges.push([low, match[2] ? Number.parseInt(match[2], 16) : low]);
    }
  }
  return ranges.length > 0 ? ranges : null;
}

function readRule(rule: CSSFontFaceRule, base: string): FaceRule | null {
  const style = rule.style;
  if ((style.getPropertyValue("font-style").trim() || "normal") !== "normal") return null;
  // The first source is the preferred format (woff2 for every board font).
  const source = /url\(\s*(["']?)(.*?)\1\s*\)\s*(?:format\(\s*["']?([\w-]+)["']?\s*\))?/.exec(
    style.getPropertyValue("src"),
  );
  if (!source?.[2]) return null;
  const weightText = style.getPropertyValue("font-weight").trim() || "400";
  const rangeText = style.getPropertyValue("unicode-range").trim();
  return {
    family: unquote(style.getPropertyValue("font-family")),
    weights: parseWeights(weightText),
    ranges: parseRanges(rangeText),
    src: new URL(source[2], base).href,
    weightText,
    rangeText,
    format: source[3] ?? "woff2",
  };
}

function collect(rules: CSSRuleList, base: string, out: FaceRule[]) {
  for (const rule of rules) {
    if (rule instanceof CSSFontFaceRule) {
      const face = readRule(rule, base);
      if (face) out.push(face);
    } else if (rule instanceof CSSImportRule && rule.styleSheet) {
      collect(rule.styleSheet.cssRules, rule.styleSheet.href ?? base, out);
    }
  }
}

/** Google Fonts stylesheets are cross-origin, so their rules are read from a fetched copy. */
const googleSheets = new Map<string, Promise<CSSRuleList | null>>();

function googleRules(href: string) {
  let rules = googleSheets.get(href);
  if (!rules) {
    rules = fetch(href)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error())))
      .then((text) => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(text);
        return sheet.cssRules;
      })
      .catch(() => {
        googleSheets.delete(href);
        return null;
      });
    googleSheets.set(href, rules);
  }
  return rules;
}

/** Every @font-face rule on the page. */
async function pageFaces() {
  const faces: FaceRule[] = [];
  for (const sheet of document.styleSheets) {
    const base = sheet.href ?? location.href;
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      if (sheet.href?.startsWith("https://fonts.googleapis.com/")) rules = await googleRules(base);
    }
    if (rules) collect(rules, base, faces);
  }
  return faces;
}

const covers = (face: FaceRule, codePoints: Set<number>) =>
  !face.ranges ||
  [...codePoints].some((cp) => face.ranges?.some(([low, high]) => cp >= low && cp <= high));

/** The faces a text node needs: its first family the page has, the closest weight, used ranges. */
function facesFor(faces: FaceRule[], families: string[], weight: number, codePoints: Set<number>) {
  for (const family of families) {
    const own = faces.filter((face) => face.family.toLowerCase() === family.toLowerCase());
    if (own.length === 0) continue;
    const distance = (face: FaceRule) =>
      weight < face.weights[0]
        ? face.weights[0] - weight
        : weight > face.weights[1]
          ? weight - face.weights[1]
          : 0;
    const best = Math.min(...own.map(distance));
    return own.filter((face) => distance(face) === best && covers(face, codePoints));
  }
  return [];
}

const fileCache = new Map<string, Promise<string>>();

function dataUrl(src: string) {
  let pending = fileCache.get(src);
  if (!pending) {
    pending = fetch(src)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(src))))
      .then(blobToDataUrl);
    pending.catch(() => fileCache.delete(src));
    fileCache.set(src, pending);
  }
  return pending;
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read a file."));
    reader.readAsDataURL(blob);
  });
}

/**
 * @font-face CSS, with the files inlined, for the text in `svg` (attached to the page, so its
 * computed styles are real). A font that fails to download is left out and falls back.
 */
export async function embeddedFontCss(svg: SVGSVGElement) {
  const faces = await pageFaces();
  const needed = new Set<FaceRule>();
  for (const text of svg.querySelectorAll("text")) {
    const content = text.textContent;
    if (!content.trim()) continue;
    const style = getComputedStyle(text);
    const families = style.fontFamily.split(",").map(unquote).filter(Boolean);
    const weight = Number.parseInt(style.fontWeight, 10) || 400;
    const codePoints = new Set([...content].map((ch) => ch.codePointAt(0) ?? 0));
    for (const face of facesFor(faces, families, weight, codePoints)) needed.add(face);
  }
  const rules = await Promise.all(
    [...needed].map(async (face) => {
      try {
        const url = await dataUrl(face.src);
        const range = face.rangeText ? `unicode-range:${face.rangeText};` : "";
        return `@font-face{font-family:${JSON.stringify(face.family)};font-style:normal;font-weight:${face.weightText};src:url(${url}) format(${JSON.stringify(face.format)});${range}}`;
      } catch {
        return "";
      }
    }),
  );
  return rules.join("\n");
}

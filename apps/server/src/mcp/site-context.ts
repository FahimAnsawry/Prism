// The "This site" section get_design_guide adds when it is given a board. A website (a project, or a
// board outside any) is one design: a new page keeps the language of the pages it already has, and a
// new site is told how the user's other sites look so it doesn't come out as the same page again.

import { DEFAULT_THEME, fontFamilyName, type FontFamily } from "@prism/shared";
import type { DesignSite, SiteElement } from "../routes/workspace.js";

/** Frames narrower than this are notes or icons, not screens. */
const MIN_SCREEN_WIDTH = 320;
/** Screens of this site listed, and other sites compared against. */
const MAX_SCREENS = 12;
const MAX_OTHER_SITES = 4;

type Screen = { board: string; frame: SiteElement; sections: string[]; patterns: string[] };
type Box = {
  name: string;
  /** Its place in the source (create_screen numbers groups in document order), if known. */
  order: number | null;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

/**
 * create_screen makes group ids "<name>-<n>-<suffix>": the name is what the designer called it, n
 * counts groups in document order, so a section comes before the groups inside it.
 */
const GROUP_ID = /^(.*)-(\d+)-[a-z0-9]+$/i;

/** How close to the frame's side a box must reach to count as full-bleed (a scrollbar's width). */
const BLEED = 24;

const centerInside = (el: SiteElement, frame: SiteElement) => {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return (
    cx >= frame.x && cx <= frame.x + frame.width && cy >= frame.y && cy <= frame.y + frame.height
  );
};

const area = (box: Box) => (box.x1 - box.x0) * (box.y1 - box.y0);

/**
 * inner is part of outer: its center is inside outer (a button in a nav), or it comes later in the
 * source and sits beside outer's content (a product window next to its section's text; sections
 * without a background draw only their text, so their box doesn't cover what they hold). A box that
 * reaches the frame's side is a section of its own, like a sign-in page's full-height panel.
 */
const nested = (inner: Box, outer: Box, frame: SiteElement) => {
  if (outer === inner) return false;
  const cx = (inner.x0 + inner.x1) / 2;
  const cy = (inner.y0 + inner.y1) / 2;
  const besideY = cy >= outer.y0 && cy <= outer.y1;
  if (besideY && area(outer) > area(inner) && cx >= outer.x0 && cx <= outer.x1) return true;
  const bleeds = inner.x0 <= frame.x + BLEED || inner.x1 >= frame.x + frame.width - BLEED;
  return (
    besideY && !bleeds && inner.order !== null && outer.order !== null && outer.order < inner.order
  );
};

/** Boxes in reading order: rows top to bottom (side-by-side boxes share a row), each left to right. */
function readingOrder(boxes: Box[]) {
  const rows: { bottom: number; boxes: Box[] }[] = [];
  for (const box of [...boxes].sort((a, b) => a.y0 - b.y0)) {
    const row = rows.at(-1);
    // Side by side: it starts above the middle of the row so far.
    if (row && box.y0 < row.bottom - (box.y1 - box.y0) / 2) {
      row.boxes.push(box);
      row.bottom = Math.max(row.bottom, box.y1);
    } else rows.push({ bottom: box.y1, boxes: [box] });
  }
  return rows.flatMap((row) => row.boxes.sort((a, b) => a.x0 - b.x0));
}

/** A screen's top-level named groups (its sections), in reading order. */
function sectionsOf(frame: SiteElement, elements: SiteElement[]) {
  const boxes = new Map<string, Box>();
  for (const el of elements) {
    if (!el.groupId || el.type === "frame" || !centerInside(el, frame)) continue;
    const box = boxes.get(el.groupId);
    if (box) {
      box.x0 = Math.min(box.x0, el.x);
      box.y0 = Math.min(box.y0, el.y);
      box.x1 = Math.max(box.x1, el.x + el.width);
      box.y1 = Math.max(box.y1, el.y + el.height);
    } else {
      const match = GROUP_ID.exec(el.groupId);
      boxes.set(el.groupId, {
        name: match?.[1] ?? el.groupId,
        order: match ? Number(match[2]) : null,
        x0: el.x,
        y0: el.y,
        x1: el.x + el.width,
        y1: el.y + el.height,
      });
    }
  }
  const all = [...boxes.values()];
  return readingOrder(all.filter((box) => !all.some((outer) => nested(box, outer, frame))))
    .map((box) => box.name)
    .filter((name, i, names) => name !== names[i - 1]);
}

/** How far down a screen its first viewport (the hero) reaches. */
const HERO_DEPTH = 900;

const isPhoto = (el: SiteElement) => el.image !== undefined && !el.image.endsWith(".svg");

/** A fill that reads as a color field: saturated, or dark. */
const colorField = (fill: string | null) => {
  const hsl = fill ? saturation(fill) : null;
  return !!hsl && ((hsl.sat >= 0.25 && hsl.light >= 0.15 && hsl.light <= 0.85) || hsl.light <= 0.2);
};

/**
 * The parts of the landing-page kit a screen uses, in words: how it opens, proves and ends. Names
 * and themes differ from site to site; these shapes are what make AI-made pages look alike.
 */
function patternsOf(frame: SiteElement, elements: SiteElement[]) {
  const inside = elements.filter(
    (el) => el !== frame && el.type !== "frame" && centerInside(el, frame),
  );
  const heroBottom = frame.y + Math.min(HERO_DEPTH, frame.height / 2);
  const bleeds = (el: SiteElement) =>
    el.x <= frame.x + BLEED && el.x + el.width >= frame.x + frame.width - BLEED;
  const patterns: string[] = [];

  // A large light panel inset from the edges near the top: a product window.
  const productWindow = inside.some((el) => {
    const hsl = el.fill ? saturation(el.fill) : null;
    return (
      el.type === "rect" &&
      !el.image &&
      el.y < heroBottom &&
      el.width >= 800 &&
      el.height >= 300 &&
      !bleeds(el) &&
      (!hsl || hsl.light >= 0.9)
    );
  });
  if (productWindow) patterns.push("a product window in the hero");
  else if (inside.some((el) => isPhoto(el) && el.y < heroBottom && el.width >= 600)) {
    patterns.push("a photo hero");
  }

  if (inside.some((el) => isPhoto(el) && el.width >= 160 && el.height >= el.width * 1.15)) {
    patterns.push("a portrait photo (a testimonial)");
  }

  // Four or more wide, short images in one row: wordmarks (avatars are square, so they don't count).
  const marks = inside.filter(
    (el) => el.image && el.type !== "ellipse" && el.height <= 64 && el.width >= el.height * 1.8,
  );
  const logoRow = marks.some(
    (mark) =>
      marks.filter(
        (other) => Math.abs(other.y + other.height / 2 - (mark.y + mark.height / 2)) <= 16,
      ).length >= 4,
  );
  if (logoRow) patterns.push("a logo strip");

  // A wide color field in the lower part of the page with more content (the footer) below it.
  const bottom = frame.y + frame.height;
  const band = inside.some(
    (el) =>
      el.type === "rect" &&
      el.width >= Math.min(1000, frame.width * 0.7) &&
      el.height >= 160 &&
      el.height <= 700 &&
      el.y >= frame.y + frame.height * 0.6 &&
      el.y + el.height <= bottom - 120 &&
      colorField(el.fill),
  );
  if (band) patterns.push("a brand-color band before the footer");
  return patterns;
}

function screensOf(site: DesignSite): Screen[] {
  return site.boards.flatMap((board) =>
    board.elements
      .filter((el) => el.type === "frame" && el.width >= MIN_SCREEN_WIDTH)
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .map((frame) => ({
        board: board.name,
        frame,
        sections: sectionsOf(frame, board.elements),
        patterns: patternsOf(frame, board.elements),
      })),
  );
}

const size = (frame: SiteElement) => `${Math.round(frame.width)}×${Math.round(frame.height)}`;
const outline = (screen: Screen) =>
  screen.sections.length > 0 ? screen.sections.join(" → ") : "no named sections";

const fontName = (font: string) => fontFamilyName(font as FontFamily) ?? font;

/** "#28e99f" → its HSL saturation and lightness (0-1), or null for anything but #rgb / #rrggbb. */
function saturation(color: string) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  return { sat, light };
}

const mostCommon = (values: string[], count: number) => {
  const tally = new Map<string, number>();
  for (const value of values) tally.set(value, (tally.get(value) ?? 0) + 1);
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([value]) => value);
};

/** A site's look in one line: its fonts, accent color and radius. */
function lookOf(site: DesignSite, screens: Screen[]) {
  const theme = site.theme;
  if (theme) {
    const fonts = [...new Set([theme.fonts.heading, theme.fonts.sans])].map(fontName);
    // The color the site is known by: the most saturated of its brand roles (a yellow field
    // with ink buttons is a yellow site).
    const roles = (["primary", "secondary", "accent"] as const).flatMap(
      (role) => theme.light[role] ?? [],
    );
    const chroma = (c: string | undefined) => {
      const hsl = c ? saturation(c) : null;
      return hsl ? hsl.sat * (1 - Math.abs(2 * hsl.light - 1)) : -1;
    };
    const accent = roles.reduce<string | undefined>(
      (best, color) => (chroma(color) > chroma(best) ? color : best),
      undefined,
    );
    // Colors other than hex (oklch, hsl) can't be compared here; primary stands in.
    return `${fonts.join(" / ")}, accent ${accent ?? theme.light["primary"] ?? "none"}, radius ${theme.radius}px`;
  }
  // The default theme: what its screens actually use.
  const used = site.boards.flatMap((board) =>
    board.elements.filter((el) => screens.some((s) => s.frame !== el && centerInside(el, s.frame))),
  );
  const themeFont = (font: string | undefined) => {
    const slot = font?.startsWith("$") ? font.slice(1) : undefined;
    if (slot === "heading" || slot === "sans" || slot === "mono") return DEFAULT_THEME.fonts[slot];
    return font ?? DEFAULT_THEME.fonts.sans;
  };
  const fonts = mostCommon(
    used.filter((el) => el.type === "text").map((el) => fontName(themeFont(el.font))),
    2,
  );
  const accent = mostCommon(
    used.flatMap((el) => {
      const hsl = el.type !== "text" && el.fill ? saturation(el.fill) : null;
      return hsl && hsl.sat >= 0.3 && hsl.light >= 0.2 && hsl.light <= 0.8
        ? [el.fill!.toLowerCase()]
        : [];
    }),
    1,
  )[0];
  return `${fonts.join(" / ") || "default fonts"}${accent ? `, accent ${accent}` : ""}`;
}

/** The photos sites show, by file name without extension (a hash of the source URL; see ai-actions). */
export function photosOf(sites: DesignSite[]) {
  return new Set(
    sites.flatMap((site) =>
      site.boards.flatMap((board) =>
        board.elements.flatMap((el) => (isPhoto(el) ? [el.image!.replace(/\.[^.]+$/, "")] : [])),
      ),
    ),
  );
}

/** The guide's "This site" section for a board's site. */
export function siteContext({ current, others }: { current: DesignSite; others: DesignSite[] }) {
  const screens = screensOf(current);
  if (screens.length > 0) {
    const listed = screens.slice(0, MAX_SCREENS);
    return `## 8. This site: ${current.name}

This board belongs to "${current.name}", a website that already has ${screens.length} screen${screens.length === 1 ? "" : "s"}. A website is one design: a new page keeps the language of the pages it has, and gets the structure its own content needs. This section comes before the general advice above.

Screens so far (read the first one with get_screen_code before drawing, and look at it with export_image):
${listed.map((s) => `- ${s.board} · frame ${s.frame.id} · ${size(s.frame)}: ${outline(s)}`).join("\n")}${screens.length > listed.length ? `\n- and ${screens.length - listed.length} more` : ""}

Keep across the site: the theme and components; the nav and footer, drawn the same way on every page that has them; the hero treatment; section spacing, dividers and backgrounds; card, button, input and label styles; image, illustration and icon treatment; the copy voice and the names in the product's data.
Change per page: its structure and section order. A pricing, sign-in, blog or settings page is laid out for its own content and does not repeat the landing page's sections. Where this page needs a part the site hasn't drawn yet, design it in the site's language.`;
  }

  const compared = others
    .map((site) => ({ site, screens: screensOf(site) }))
    .filter(({ screens: list }) => list.length > 0)
    .slice(0, MAX_OTHER_SITES);
  const lines = compared.map(({ site, screens: list }) => {
    const main = list.reduce((a, b) => (b.frame.height > a.frame.height ? b : a));
    const patterns = main.patterns.length > 0 ? `; it uses ${main.patterns.join(", ")}` : "";
    return `- ${site.name}: ${lookOf(site, list)}; its ${size(main.frame)} page: ${outline(main)}${patterns}`;
  });
  const used = [
    ...new Set(compared.flatMap(({ screens: list }) => list.flatMap((s) => s.patterns))),
  ];
  const savedTheme = current.theme
    ? " This project already has a saved theme, so its colors and fonts are set: make it different through structure, hero treatment, imagery, density and voice."
    : "";
  return `## 8. This site: ${current.name}

"${current.name}" has no screens yet, so this design sets the look of a new website. Its later pages will follow what you decide here, so decide it on purpose: type pairing, color strategy, radius, hero treatment, section rhythm, imagery and voice. This section comes before the general advice above.
${
  lines.length > 0
    ? `
The user's other sites, which this one must not resemble:
${lines.join("\n")}

Choose a type pairing, color strategy and page structure that differ from each of them, unless the user asks for a family resemblance.${
        used.length > 0
          ? ` They already use ${used.join(", ")}: open, prove and end this one another way unless the user asks for one of them.`
          : ""
      } search_images with this boardId leaves out the photos they use.${savedTheme}`
    : savedTheme
}`;
}

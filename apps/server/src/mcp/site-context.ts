// The "This site" section get_design_guide adds when it is given a board. A website (a project, or a
// board outside any) is one design: a new page keeps the language of the pages it already has, and a
// new site is told how the user's other sites look so it doesn't come out as the same page again.

import { DEFAULT_THEME, fontFamilyName, type FontFamily } from "@prism/shared";
import type { DesignSite, SiteElement } from "../routes/workspace.js";
import {
  GROUND_NAMES,
  HERO_NAMES,
  SCALE_NAMES,
  scaleOf,
  type GroundKey,
  type HeroKey,
  type ScaleKey,
  type Taken,
} from "./design-guide.js";
import { isLongPage, type ScreenWarning } from "./screen-lint.js";

/** Frames narrower than this are notes or icons, not screens. */
const MIN_SCREEN_WIDTH = 320;
/** Screens of this site listed, and other sites compared against. */
const MAX_SCREENS = 12;
const MAX_OTHER_SITES = 8;
/** Sections named per screen. */
const MAX_SECTIONS = 8;
/** A group covering this share of its frame is the page itself (an HTML page's body), not a section. */
const PAGE_SHARE = 0.85;
/** Roles only an interface has: what tells a page from a storyboard, a logo sheet or a diagram. */
const UI_ROLE = /button|input|nav|form|link|tab|field|menu/i;
/** This many texts of mock size (MOCK_TEXT_PX or smaller) in the first viewport are a drawn product. */
const HERO_MOCK_TEXTS = 14;
const MOCK_TEXT_PX = 14;
/** Other sites sharing this many of a page's four traits make it the same page. */
const SAME_TRAITS = 3;
/** A headline's first word used by this many other sites is a habit. */
const SAME_OPENERS = 2;

/** What gives a long desktop page its shape, read from its first viewport. */
type Traits = {
  heroPx: number;
  heroWeight: number;
  scale: ScaleKey;
  align: "left" | "center";
  ground: GroundKey;
  hero: HeroKey;
  /** The headline's first word, in lower case. */
  opener: string | null;
  /** The size most of its text is set in. */
  bodyPx: number | null;
};

type Screen = {
  board: string;
  frame: SiteElement;
  sections: string[];
  patterns: string[];
  /** It holds buttons, inputs or navigation: an interface, not a storyboard or a logo sheet. */
  ui: boolean;
  /** Null unless it is a long desktop page. */
  traits: Traits | null;
};
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
  const whole = [...boxes.values()];
  const frameArea = frame.width * frame.height;
  const parts = whole.filter((box) => area(box) < frameArea * PAGE_SHARE);
  const all = parts.length > 0 ? parts : whole;
  return readingOrder(all.filter((box) => !all.some((outer) => nested(box, outer, frame))))
    .map((box) => box.name)
    .filter((name, i, names) => name !== names[i - 1]);
}

/** How far down a screen its first viewport (the hero) reaches. */
const HERO_DEPTH = 900;
const PRODUCT_WINDOW = "a product window in the hero";
const PHOTO_HERO = "a photo hero";

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
function patternsOf(frame: SiteElement, inside: SiteElement[]) {
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
  if (productWindow) patterns.push(PRODUCT_WINDOW);
  else if (inside.some((el) => isPhoto(el) && el.y < heroBottom && el.width >= 600)) {
    patterns.push(PHOTO_HERO);
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

/** The ground a fill reads as; null for anything but a hex color. */
function groundOf(fill: string | null): GroundKey | null {
  const hsl = fill ? saturation(fill.slice(0, 7)) : null;
  if (!hsl) return null;
  const chroma = hsl.sat * (1 - Math.abs(2 * hsl.light - 1));
  if (hsl.light <= 0.25) return "dark";
  if (chroma >= 0.25) return "colored";
  return hsl.light >= 0.9 && chroma <= 0.06 ? "light" : "tinted";
}

/** A long desktop page's traits: its headline, ground and what its first viewport holds. */
function traitsOf(frame: SiteElement, inside: SiteElement[], patterns: string[]): Traits | null {
  if (!isLongPage(frame)) return null;
  const heroBottom = frame.y + Math.min(HERO_DEPTH, frame.height / 2);
  const texts = inside.filter((el) => el.type === "text" && el.size !== undefined);
  const first = inside.filter((el) => el.y < heroBottom);
  const heroTexts = texts.filter((el) => el.y < heroBottom).sort((a, b) => b.size! - a.size!);
  const headline = heroTexts[0];
  if (!headline) return null;

  const middle = headline.x + headline.width / 2;
  const centered =
    headline.align === "center" ||
    (Math.abs(middle - (frame.x + frame.width / 2)) <= frame.width * 0.04 &&
      headline.x - frame.x >= frame.width * 0.15);

  // The color under the first viewport: a full-width field drawn there, else the frame's own.
  const field = first
    .filter(
      (el) =>
        el.type === "rect" &&
        !el.image &&
        el.fill &&
        el.height >= 300 &&
        el.x <= frame.x + BLEED &&
        el.x + el.width >= frame.x + frame.width - BLEED,
    )
    .sort((a, b) => b.height - a.height)[0];

  const mock = heroTexts.filter((el) => el.size! <= MOCK_TEXT_PX).length;
  const hero: HeroKey =
    patterns.includes(PRODUCT_WINDOW) || mock >= HERO_MOCK_TEXTS
      ? "product"
      : patterns.includes(PHOTO_HERO)
        ? "photo"
        : first.some((el) => el.role && /input|form|search|field/i.test(el.role))
          ? "form"
          : "type";

  return {
    heroPx: Math.round(headline.size!),
    heroWeight: headline.weight ?? 400,
    scale: scaleOf(headline.size!, headline.weight ?? 400),
    align: centered ? "center" : "left",
    ground: groundOf(field?.fill ?? null) ?? groundOf(frame.fill) ?? "light",
    hero,
    opener: heroTexts.find((el) => el.opener)?.opener ?? null,
    bodyPx:
      Number(
        mostCommon(
          texts.map((el) => String(Math.round(el.size!))),
          1,
        )[0],
      ) || null,
  };
}

function screensOf(site: DesignSite): Screen[] {
  return site.boards.flatMap((board) =>
    board.elements
      .filter((el) => el.type === "frame" && el.width >= MIN_SCREEN_WIDTH)
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .map((frame) => {
        const inside = board.elements.filter(
          (el) => el !== frame && el.type !== "frame" && centerInside(el, frame),
        );
        const patterns = patternsOf(frame, inside);
        return {
          board: board.name,
          frame,
          sections: sectionsOf(frame, board.elements),
          patterns,
          ui: inside.some((el) => el.role && UI_ROLE.test(el.role)),
          traits: traitsOf(frame, inside, patterns),
        };
      }),
  );
}

const size = (frame: SiteElement) => `${Math.round(frame.width)}×${Math.round(frame.height)}`;
const outline = (screen: Screen) =>
  screen.sections.length > 0
    ? `${screen.sections.slice(0, MAX_SECTIONS).join(" → ")}${screen.sections.length > MAX_SECTIONS ? " → …" : ""}`
    : "no named sections";

const alignName = (align: Traits["align"]) => (align === "center" ? "centered" : "left-aligned");
const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** A page's traits in a sentence: how it opens. */
const opening = (t: Traits) =>
  `opens with a ${t.heroPx}px weight-${t.heroWeight} ${alignName(t.align)} headline${t.opener ? ` ("${capital(t.opener)} …")` : ""} (${SCALE_NAMES[t.scale]} scale) on ${GROUND_NAMES[t.ground]}, with ${HERO_NAMES[t.hero]} in the first viewport${t.bodyPx ? `; most of its text is ${t.bodyPx}px` : ""}`;

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

type Sites = { current: DesignSite; others: DesignSite[] };
type Compared = { site: DesignSite; screens: Screen[]; main: Screen };

/**
 * The user's other sites a new one is compared with: only those with an interface (a storyboard
 * or a logo sheet is not a site), each by its tallest screen. Sites with a whole page come first,
 * since a page says how a site looks and a single component study doesn't; within each, the most
 * recently edited first.
 */
function comparedSites(others: DesignSite[]): Compared[] {
  const sites = others
    .map((site) => ({ site, screens: screensOf(site).filter((screen) => screen.ui) }))
    .filter(({ screens }) => screens.length > 0)
    .map(({ site, screens }) => ({
      site,
      screens,
      main: screens.reduce((a, b) => (b.frame.height > a.frame.height ? b : a)),
    }));
  return [
    ...sites.filter(({ main }) => main.traits),
    ...sites.filter(({ main }) => !main.traits),
  ].slice(0, MAX_OTHER_SITES);
}

/** Values by how many sites use them, most used first. */
function tally<T extends string>(values: (T | null | undefined)[]) {
  const counts = new Map<T, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/**
 * What the user's other sites already use, for a site with no screens yet: the design guide leaves
 * those choices out of what it offers. Undefined for a site that has screens, which keeps its own.
 */
export function takenBy({ current, others }: Sites): Taken | undefined {
  if (screensOf(current).length > 0) return undefined;
  const traits = comparedSites(others).flatMap(({ main }) => main.traits ?? []);
  if (traits.length === 0) return undefined;
  // A habit, not a one-off: two sites use it, or half of them do.
  const habits = <T extends string>(values: T[]) =>
    tally(values)
      .filter(([, count]) => count >= 2 || count * 2 >= traits.length)
      .map(([key]) => key);
  return {
    scales: habits(traits.map((t) => t.scale)),
    grounds: habits(traits.map((t) => t.ground)),
    // "type" is also what a first viewport reads as when nothing else is found in it, so it is
    // never left out: a page of type alone is one of the ways out of the product-window habit.
    heroes: habits(traits.map((t) => t.hero)).filter((key) => key !== "type"),
  };
}

/** What several sites share, in words: the sameness a new site has to break. */
function sharedBy(traits: Traits[]) {
  if (traits.length < 2) return [];
  const most = <T extends string>(values: T[], name: (value: T) => string) => {
    const [value, count] = tally(values)[0] ?? [];
    return value && count && count >= 2 ? [`${name(value)} (${count} of ${traits.length})`] : [];
  };
  return [
    ...most(
      traits.map((t) => t.scale),
      (key) => `the ${SCALE_NAMES[key]} type scale`,
    ),
    ...most(
      traits.map((t) => t.ground),
      (key) => GROUND_NAMES[key],
    ),
    ...most(
      traits.map((t) => t.hero),
      (key) => `${HERO_NAMES[key]} in the first viewport`,
    ),
    ...most(
      traits.map((t) => t.align),
      (key) => `a ${alignName(key)} headline`,
    ),
    ...tally(traits.map((t) => t.opener))
      .filter(([, count]) => count >= 2)
      .map(([opener, count]) => `headlines opening with "${capital(opener)}" (${count})`),
  ];
}

/**
 * Warnings for a new site's first long page that opens like another of the user's sites: the same
 * type scale, ground, hero and alignment under different colors. `elements` are the new screen's.
 */
export function sameAsOtherSites(
  frame: SiteElement,
  elements: SiteElement[],
  { current, others }: Sites,
): ScreenWarning[] {
  if (!isLongPage(frame)) return [];
  // A site that already has screens keeps its own look: only its first page is compared.
  if (screensOf(current).some((screen) => screen.frame.id !== frame.id)) return [];
  const inside = elements.filter((el) => el.id !== frame.id && el.type !== "frame");
  const mine = traitsOf(frame, inside, patternsOf(frame, inside));
  if (!mine) return [];

  const names: Record<"scale" | "ground" | "hero" | "align", string> = {
    scale: `the ${SCALE_NAMES[mine.scale]} type scale (a ${mine.heroPx}px headline)`,
    ground: GROUND_NAMES[mine.ground],
    hero: `${HERO_NAMES[mine.hero]} in the first viewport`,
    align: `a ${alignName(mine.align)} headline`,
  };
  const keys = Object.keys(names) as (keyof typeof names)[];
  const alike = comparedSites(others)
    .flatMap(({ site, main }) =>
      main.traits
        ? [{ site, traits: main.traits, same: keys.filter((k) => main.traits![k] === mine[k]) }]
        : [],
    )
    .sort((a, b) => b.same.length - a.same.length);

  const warnings: ScreenWarning[] = [];
  const closest = alike[0];
  const others3 = alike.filter(({ same }) => same.length >= SAME_TRAITS);
  if (closest && closest.same.length >= SAME_TRAITS) {
    warnings.push({
      kind: "same-as-site",
      ids: [frame.id],
      message: `This page opens like "${closest.site.name}"${others3.length > 1 ? ` and ${others3.length - 1} more of the user's sites` : ""}: ${closest.same.map((k) => names[k]).join(", ")}. The same page in other colors is still the same page. Change at least ${closest.same.length === keys.length ? "two of these" : "one more of these"} by redrawing the first viewport (the design guide's sections 3, 4 and 7 list the other scales, grounds and hero forms), unless the user asked for a family resemblance.`,
    });
  }
  const opened = alike.filter(({ traits }) => mine.opener && traits.opener === mine.opener);
  if (mine.opener && opened.length >= SAME_OPENERS) {
    warnings.push({
      kind: "headline-opener",
      ids: [frame.id],
      message: `The headline opens with "${capital(mine.opener)}", like the headlines of ${opened.length} of the user's other sites. Write it in another shape (the design guide's section 6: a number, a question, an instruction, a plain label).`,
    });
  }
  return warnings;
}

/** The guide's "This site" section for a board's site. */
export function siteContext({ current, others }: Sites) {
  const screens = screensOf(current);
  if (screens.length > 0) {
    const listed = screens.slice(0, MAX_SCREENS);
    const look = screens
      .filter((screen) => screen.traits)
      .sort((a, b) => b.frame.height - a.frame.height)[0];
    return `## This site: ${current.name}

This board belongs to "${current.name}", a website that already has ${screens.length} screen${screens.length === 1 ? "" : "s"}. A website is one design: a new page keeps the language of the pages it has, and gets the structure its own content needs. This section comes before the general advice above.

Screens so far (read the first one with get_screen_code before drawing, and look at it with export_image):
${listed.map((s) => `- ${s.board} · frame ${s.frame.id} · ${size(s.frame)}: ${outline(s)}`).join("\n")}${screens.length > listed.length ? `\n- and ${screens.length - listed.length} more` : ""}
${look?.traits ? `\nIts look, which every new page keeps: its ${size(look.frame)} page ${opening(look.traits)}.\n` : ""}
Keep across the site: the theme and components; the type scale and ground; the nav and footer, drawn the same way on every page that has them; the hero treatment; section spacing, dividers and backgrounds; card, button, input and label styles; image, illustration and icon treatment; the copy voice and the names in the product's data.
Change per page: its structure and section order. A pricing, sign-in, blog or settings page is laid out for its own content and does not repeat the landing page's sections. Where this page needs a part the site hasn't drawn yet, design it in the site's language.`;
  }

  const compared = comparedSites(others);
  const lines = compared.map(({ site, screens: list, main }) => {
    const patterns = main.patterns.length > 0 ? `; it uses ${main.patterns.join(", ")}` : "";
    const opens = main.traits ? ` ${opening(main.traits)}; sections` : "";
    return `- ${site.name}: ${lookOf(site, list)}; its ${size(main.frame)} page${opens}: ${outline(main)}${patterns}`;
  });
  const used = [
    ...new Set(compared.flatMap(({ screens: list }) => list.flatMap((s) => s.patterns))),
  ];
  const shared = sharedBy(compared.flatMap(({ main }) => main.traits ?? []));
  const savedTheme = current.theme
    ? " This project already has a saved theme, so its colors and fonts are set: make it different through type scale, structure, hero treatment, imagery, density and voice."
    : "";
  return `## This site: ${current.name}

"${current.name}" has no screens yet, so this design sets the look of a new website. Its later pages will follow what you decide here, so decide it on purpose: type scale and pairing, ground and color strategy, radius, hero treatment, section rhythm, imagery and voice. This section comes before the general advice above.
${
  lines.length > 0
    ? `
The user's other sites, which this one must not resemble:
${lines.join("\n")}
${
  shared.length > 0
    ? `\nWhat they have in common, and what makes pages look alike whatever their colors and fonts: ${shared.join("; ")}. This site changes most of these: the guide above has left the most used ones out of the scales, grounds, hero forms and structures it offers.\n`
    : ""
}
Choose a type scale, type pairing, ground, hero form and page structure that differ from each of them, unless the user asks for a family resemblance.${
        used.length > 0
          ? ` They already use ${used.join(", ")}: open, prove and end this one another way unless the user asks for one of them.`
          : ""
      } search_images with this boardId leaves out the photos they use.${savedTheme}`
    : savedTheme
}`;
}

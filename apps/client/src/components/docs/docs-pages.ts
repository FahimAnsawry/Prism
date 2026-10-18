import { BUILD_PAGES } from "./content/build";
import { COLLABORATE_PAGES } from "./content/collaborate";
import { DESIGN_PAGES } from "./content/design";
import { REFERENCE_PAGES } from "./content/reference";
import { START_PAGES } from "./content/start";
import { TOOL_PAGES } from "./content/tools";
import { GROUPS } from "./docs-config";
import type { DocPage, DocsGroup } from "./docs-types";

/**
 * Every page in reading order, which is the sidebar's order: what you do first comes first, and
 * the previous / next links at the foot of a page follow it.
 */
export const PAGES: DocPage[] = [
  ...START_PAGES,
  ...DESIGN_PAGES,
  ...COLLABORATE_PAGES,
  ...BUILD_PAGES,
  ...REFERENCE_PAGES,
  ...TOOL_PAGES,
];

const BY_SLUG = new Map(PAGES.map((page) => [page.slug, page]));

/** The page for a path under /docs ("" is the index), or undefined for an unknown path. */
export function findPage(slug: string): DocPage | undefined {
  return BY_SLUG.get(slug.replace(/^\/+|\/+$/g, ""));
}

/** The page's neighbours in reading order. */
export function neighbours(page: DocPage): { previous?: DocPage; next?: DocPage } {
  const index = PAGES.indexOf(page);
  return { previous: PAGES[index - 1], next: PAGES[index + 1] };
}

export function headingId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The "On this page" entries: a page's h2 headings and its steps, in reading order. */
export function headings(page: DocPage): { id: string; title: string }[] {
  const found: { id: string; title: string }[] = [];
  for (const block of page.blocks) {
    if (block.type === "h2")
      found.push({ id: block.id ?? headingId(block.title), title: block.title });
    // A page of steps lists them too, so the outline follows the order of the work.
    if (block.type === "steps") {
      for (const step of block.steps) found.push({ id: headingId(step.title), title: step.title });
    }
  }
  return found;
}

/** Pages grouped for the sidebar. The tools overview and the tools sit under "The seven tools". */
export function sidebarGroups() {
  return GROUPS.map((group) => ({
    ...group,
    pages: PAGES.filter(
      (page) => page.group === group.id && page.slug !== "tools" && !page.slug.startsWith("tools/"),
    ),
  }));
}

export const TOOLS_OVERVIEW = PAGES.find((page) => page.slug === "tools")!;
export const TOOLS = PAGES.filter((page) => page.slug.startsWith("tools/"));

export function groupLabel(group: DocsGroup): string {
  return GROUPS.find((info) => info.id === group)?.label ?? "";
}

/** What the search box matches against: a page's title, summary and headings. */
export interface SearchEntry {
  page: DocPage;
  heading?: { id: string; title: string };
  text: string;
}

export const SEARCH_ENTRIES: SearchEntry[] = PAGES.flatMap((page) => [
  { page, text: `${page.title} ${page.lede}`.toLowerCase() },
  ...headings(page).map((heading) => ({
    page,
    heading,
    text: `${page.title} ${heading.title}`.toLowerCase(),
  })),
]);

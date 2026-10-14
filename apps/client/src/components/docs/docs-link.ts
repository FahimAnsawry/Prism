import type { DocPage } from "./docs-types";

/** Props for a router <Link> to a docs page (and optionally a heading on it). */
export function docsLink(page: DocPage, hash?: string) {
  return page.slug
    ? ({ to: "/docs/$", params: { _splat: page.slug }, hash } as const)
    : ({ to: "/docs", hash } as const);
}

import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { pageContainer } from "@/components/landing/page-container";
import { cn } from "@/lib/utils";
import { DocsHeader } from "./docs-header";
import { DocsNav } from "./docs-nav";
import { DocsToc } from "./docs-toc";
import { findPage, PAGES } from "./docs-pages";

/**
 * The docs frame: the header, the sidebar, "On this page" and the footer, around the page the
 * router renders. It reads the path itself so the sidebar keeps its scroll while you move between
 * pages.
 */
export function DocsShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const page = findPage(pathname.replace(/^\/docs\/?/, "")) ?? PAGES[0]!;

  return (
    <>
      <DocsHeader current={page} />
      <div
        className={cn(
          pageContainer,
          "grid grid-cols-[minmax(0,1fr)] gap-x-12 lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:grid-cols-[13.5rem_minmax(0,1fr)_12.5rem]",
        )}
      >
        <div className="max-lg:hidden">
          <div className="sticky top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto py-10 pr-2">
            <DocsNav current={page} />
          </div>
        </div>
        <main id="docs-main" className="min-w-0">
          <Outlet />
        </main>
        <div className="max-xl:hidden">
          <div className="sticky top-16 py-10">
            <DocsToc page={page} />
          </div>
        </div>
      </div>
      <footer className="border-t border-border">
        <div
          className={cn(
            pageContainer,
            "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-6 text-sm text-muted-foreground",
          )}
        >
          <p>© 2026 Prism · One idea broken into many views.</p>
          <Link to="/about" className="underline-offset-4 hover:text-ink hover:underline">
            About
          </Link>
        </div>
      </footer>
    </>
  );
}

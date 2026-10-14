import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { sidebarGroups, TOOLS, TOOLS_OVERVIEW } from "./docs-pages";
import { docsLink } from "./docs-link";
import type { DocPage } from "./docs-types";

const itemClass =
  "block border-l-2 py-1.5 pr-3 pl-3 text-sm transition-colors duration-150 ease-standard hover:text-ink";

function NavLink({
  page,
  current,
  onNavigate,
  mono = false,
}: {
  page: DocPage;
  current: DocPage;
  onNavigate?: () => void;
  mono?: boolean;
}) {
  const active = page === current;
  return (
    <Link
      {...docsLink(page)}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        itemClass,
        mono && "font-mono text-[13px]",
        active
          ? "border-brand bg-accent font-medium text-foreground"
          : "border-transparent text-muted-foreground",
      )}
    >
      {page.title}
    </Link>
  );
}

/** The docs sidebar: pages grouped by the job a reader is doing. */
export function DocsNav({ current, onNavigate }: { current: DocPage; onNavigate?: () => void }) {
  return (
    <nav aria-label="Docs" className="space-y-7">
      {sidebarGroups().map((group) => (
        <div key={group.id}>
          <h2 className="mb-2 font-mono text-xs font-bold tracking-[0.1em] text-foreground uppercase">
            {group.label}
          </h2>
          <ul>
            {group.pages.map((page) => (
              <li key={page.slug}>
                <NavLink page={page} current={current} onNavigate={onNavigate} />
              </li>
            ))}
            {group.id === "reference" && (
              <li className="mt-1">
                <NavLink page={TOOLS_OVERVIEW} current={current} onNavigate={onNavigate} />
                <ul className="ml-3 border-l border-border">
                  {TOOLS.map((tool) => (
                    <li key={tool.slug}>
                      <NavLink page={tool} current={current} onNavigate={onNavigate} mono />
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
}

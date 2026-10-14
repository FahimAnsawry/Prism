import { Check, Copy, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

import { DOCS_SOURCE_URL } from "./docs-config";
import { pageToMarkdown } from "./docs-markdown";
import { headings } from "./docs-pages";
import type { DocPage } from "./docs-types";
import { useCopy } from "./use-copy";

/** The slug's content file, for "Edit on GitHub". */
function sourceFile(page: DocPage): string {
  const file = {
    start: "start",
    design: "design",
    collaborate: "collaborate",
    build: "build",
    reference: page.slug.startsWith("tools/") ? "tools" : "reference",
  }[page.group];
  return `${DOCS_SOURCE_URL}/${file}.ts`;
}

/** "On this page": the headings, with the one being read marked, and page actions below. */
export function DocsToc({ page }: { page: DocPage }) {
  const items = useMemo(() => headings(page), [page]);
  const [active, setActive] = useState(items[0]?.id);
  const { copied, copy } = useCopy();

  // The active heading is the last one that has scrolled past a line near the top of the page.
  useEffect(() => {
    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = elements[0]!.id;
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= 120) current = element.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [items]);

  const action =
    "flex items-center gap-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink";

  return (
    <aside aria-label="On this page" className="text-sm">
      {items.length > 0 && (
        <>
          <h2 className="mb-3 font-mono text-xs font-bold tracking-[0.1em] text-foreground uppercase">
            On this page
          </h2>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={item.id === active ? "location" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 py-1.5 transition-colors duration-150 ease-standard hover:text-ink",
                    item.id === active ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 shrink-0",
                      item.id === active ? "bg-brand" : "bg-transparent",
                    )}
                  />
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className={cn("space-y-0.5", items.length > 0 && "mt-6 border-t border-border pt-5")}>
        <button
          type="button"
          onClick={() => void copy(pageToMarkdown(page))}
          className={cn(action, "w-full")}
        >
          {copied ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          <span aria-live="polite">{copied ? "Copied" : "Copy as Markdown"}</span>
        </button>
        <a href={sourceFile(page)} className={action}>
          <Pencil aria-hidden="true" className="size-4" />
          Edit on GitHub
        </a>
      </div>
    </aside>
  );
}

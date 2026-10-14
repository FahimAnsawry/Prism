import { useNavigate } from "@tanstack/react-router";
import { CornerDownLeft, Hash, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { docsLink } from "./docs-link";
import { groupLabel, SEARCH_ENTRIES, type SearchEntry } from "./docs-pages";

const MAX_RESULTS = 8;

function search(query: string): SearchEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const pool = terms.length
    ? SEARCH_ENTRIES.filter((entry) => terms.every((term) => entry.text.includes(term)))
    : SEARCH_ENTRIES.filter((entry) => !entry.heading);
  // Pages before the headings inside them.
  return pool.toSorted((a, b) => Number(!!a.heading) - Number(!!b.heading)).slice(0, MAX_RESULTS);
}

/** The search box's trigger and the dialog it opens. Ctrl K (or Cmd K) opens it from anywhere. */
export function DocsSearch({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search docs"
        aria-haspopup="dialog"
        className={cn(
          "flex h-[38px] items-center gap-2.5 border border-input text-sm text-muted-foreground transition-colors duration-150 ease-standard hover:bg-muted",
          compact ? "w-[38px] justify-center" : "w-full max-w-72 px-3",
        )}
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        {!compact && (
          <>
            <span className="flex-1 text-left">Search docs</span>
            <kbd className="border border-border px-1.5 py-0.5 font-mono text-[11px] leading-none">
              Ctrl K
            </kbd>
          </>
        )}
      </button>
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => search(query), [query]);

  useEffect(() => {
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function go(entry: SearchEntry | undefined) {
    if (!entry) return;
    onClose();
    void navigate({ ...docsLink(entry.page, entry.heading?.id) });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((value) => Math.min(value + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[index]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close search"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-onyx/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search docs"
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl border border-border bg-popover shadow-[0_24px_48px_-16px_rgb(0_0_0/0.4)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[index] ? `${listId}-${index}` : undefined}
            placeholder="Search docs"
            className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <kbd className="border border-border px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted-foreground">
            Esc
          </kbd>
        </div>
        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </li>
          )}
          {results.map((entry, position) => (
            <li
              key={`${entry.page.slug}#${entry.heading?.id ?? ""}`}
              id={`${listId}-${position}`}
              role="option"
              aria-selected={position === index}
              onMouseMove={() => setIndex(position)}
              onClick={() => go(entry)}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-3 py-2.5",
                position === index && "bg-accent",
              )}
            >
              {entry.heading ? (
                <Hash aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <span aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm", entry.page.mono && "font-mono")}>
                  {entry.heading ? entry.heading.title : entry.page.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {entry.heading
                    ? `${entry.page.title} · ${groupLabel(entry.page.group)}`
                    : groupLabel(entry.page.group)}
                </span>
              </span>
              {position === index && (
                <CornerDownLeft aria-hidden="true" className="size-3.5 text-muted-foreground" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

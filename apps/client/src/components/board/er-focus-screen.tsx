import type { BoardElement } from "@prism/shared";
import { ArrowLeft, ArrowRight, ChevronRight, Eye, LayoutGrid } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { isTyping } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { boundsOf } from "./geometry";
import { AUTO_KEYS_BELOW, fitScale, FocusView, MARGIN } from "./er-focus-dialog";
import { focusLayout } from "./er-focus-layout";
import { TableSwitcher } from "./er-table-switcher";
import { TableDetails } from "./table-details";
import { useElementSize } from "./use-element-size";

/**
 * Full-screen ER diagram viewer for public sharing.
 * Renders in Focus View by default:
 * - Initially displays all tables in the diagram.
 * - Selecting any table focuses that table and displays all its relational tables.
 */
export function ErFocusScreen({
  elements,
  title,
  context,
  leading,
  onSwitchToBoard,
}: {
  elements: BoardElement[];
  title: string;
  context?: ReactNode;
  leading?: ReactNode;
  onSwitchToBoard?: () => void;
}) {
  // null in history represents the "All tables" overview
  const [history, setHistory] = useState<(string | null)[]>([null]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const switcher = useRef<HTMLButtonElement>(null);
  const [keysChoice, setKeysChoice] = useState<boolean | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const current = history[historyIndex] ?? null;
  const trail = history.slice(0, historyIndex + 1);
  const canBack = historyIndex > 0;
  const canForward = historyIndex < history.length - 1;

  const area = useRef<HTMLDivElement>(null);
  const size = useElementSize(area);
  const spaceWidth = Math.max(1, Math.round((size.width - 2 * MARGIN) / 40) * 40);
  const spaceHeight = Math.max(1, Math.round((size.height - 2 * MARGIN) / 40) * 40);

  const full = useMemo(
    () => focusLayout(elements, current, { view: { width: spaceWidth, height: spaceHeight } }),
    [elements, current, spaceWidth, spaceHeight],
  );
  const keysOnly =
    keysChoice ?? (!!full && size.width > 0 && fitScale(boundsOf(full), size) < AUTO_KEYS_BELOW);
  const compact = useMemo(
    () =>
      keysOnly
        ? focusLayout(elements, current, {
            keysOnly,
            view: { width: spaceWidth, height: spaceHeight },
          })
        : null,
    [elements, current, keysOnly, spaceWidth, spaceHeight],
  );
  const shown = compact ?? full;

  const table = current
    ? elements.find((el) => el.id === current && el.type === "table")
    : undefined;
  const allTablesCount = elements.filter((el) => el.type === "table").length;
  const name = (id: string | null) =>
    id === null ? "All tables" : (elements.find((el) => el.id === id)?.table?.name ?? "table");

  const goTo = (index: number) => {
    setHighlight(null);
    setHistoryIndex(Math.max(0, Math.min(history.length - 1, index)));
  };

  const focusOn = (id: string | null) => {
    setHighlight(null);
    if (id === current) return;
    setHistory((h) => [...h.slice(0, historyIndex + 1), id]);
    setHistoryIndex((i) => i + 1);
  };

  useEffect(() => {
    const step = (by: number) => {
      setHighlight(null);
      setHistoryIndex((idx) => Math.max(0, Math.min(history.length - 1, idx + by)));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const mod = event.ctrlKey || event.metaKey;
      if (event.key === "/" || (mod && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        switcher.current?.click();
      } else if ((event.altKey && event.key === "ArrowLeft") || event.key === "Backspace") {
        event.preventDefault();
        step(-1);
      } else if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "Escape" && current !== null) {
        event.preventDefault();
        focusOn(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, history.length]);

  const chrome = "border border-chrome bg-card text-foreground";
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-divider bg-card px-4 md:pr-6">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <div className="min-w-0 px-1">
            {context && (
              <p className="truncate font-mono text-3xs leading-4 text-muted-foreground uppercase">
                {context}
              </p>
            )}
            <h1 className="truncate text-[15px] leading-[21px] font-bold text-ink">{title}</h1>
          </div>
          <span className="ml-1 hidden shrink-0 items-center gap-1.5 border border-divider px-2 py-1 font-mono text-3xs font-bold text-muted-foreground uppercase sm:flex">
            <Eye aria-hidden="true" className="size-3.5" />
            View only
          </span>

          <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-divider md:inline-block" />

          {/* History back / forward & breadcrumbs */}
          <div className="flex min-w-0 items-center gap-2">
            <div className={cn("flex h-8 shrink-0 items-stretch", chrome)}>
              <button
                type="button"
                aria-label="Back"
                title="Back · Alt+Left"
                disabled={!canBack}
                onClick={() => goTo(historyIndex - 1)}
                className="flex w-8 items-center justify-center transition-colors duration-150 ease-standard enabled:hover:bg-background disabled:text-muted-foreground/40"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Forward"
                title="Forward · Alt+Right"
                disabled={!canForward}
                onClick={() => goTo(historyIndex + 1)}
                className="flex w-8 items-center justify-center border-l border-chrome transition-colors duration-150 ease-standard enabled:hover:bg-background disabled:text-muted-foreground/40"
              >
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </div>

            <div className="flex min-w-0 items-center gap-1 text-[13px] font-medium">
              {trail.map((id, i) =>
                i === trail.length - 1 ? (
                  <span key={`${id ?? "all"}-${i}`} className="truncate font-bold text-ink">
                    {id === null ? `All tables (${allTablesCount})` : name(id)}
                  </span>
                ) : (
                  <span
                    key={`${id ?? "all"}-${i}`}
                    className="flex min-w-0 shrink items-center gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      title={`Back to ${name(id)}`}
                      className="truncate text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink"
                    >
                      {name(id)}
                    </button>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                  </span>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {current !== null && (
            <button
              type="button"
              onClick={() => focusOn(null)}
              className="hidden h-8 items-center gap-1 border border-chrome bg-background px-2.5 text-xs text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink sm:flex"
            >
              Show all tables
            </button>
          )}

          <TableSwitcher
            elements={elements}
            currentId={current ?? ""}
            triggerRef={switcher}
            onPick={focusOn}
          />

          <div
            role="group"
            aria-label="Columns shown in tables"
            className="flex h-8 items-stretch border border-chrome bg-background p-0.5"
          >
            {(
              [
                [false, "All columns"],
                [true, "Keys only"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={keysOnly === value}
                onClick={() => setKeysChoice(value)}
                className={cn(
                  "px-2.5 text-xs font-medium transition-colors duration-150 ease-standard",
                  keysOnly === value
                    ? "bg-card text-ink shadow-sm"
                    : "text-muted-foreground hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {onSwitchToBoard && (
            <button
              type="button"
              onClick={onSwitchToBoard}
              aria-label="Canvas view"
              title="Canvas view"
              className={cn(
                "hidden size-8 items-center justify-center transition-colors duration-150 ease-standard hover:bg-background sm:flex",
                chrome,
              )}
            >
              <LayoutGrid aria-hidden="true" className="size-4" />
            </button>
          )}

          <ThemeToggle className="size-8 border border-chrome bg-card" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div ref={area} className="relative min-w-0 flex-1 overflow-hidden bg-background">
          {!shown ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No tables in this diagram.
            </p>
          ) : (
            size.width > 0 && (
              <FocusView
                key={`${current ?? "all"}-${keysOnly}-${spaceWidth}x${spaceHeight}`}
                focusId={current}
                shown={shown}
                size={size}
                highlight={highlight}
                onFocusTable={focusOn}
              />
            )
          )}
        </div>

        {table && (
          <aside
            aria-label={`${table.table?.name ?? "Table"} details`}
            className="hidden w-72 shrink-0 overflow-y-auto border-l border-divider bg-card md:block"
          >
            <TableDetails
              table={table}
              board={elements}
              onSelect={(ids) => {
                const id = ids[0];
                const el = id ? elements.find((e) => e.id === id) : undefined;
                if (el?.type === "table") focusOn(el.id);
                else if (el) setHighlight(highlight === el.id ? null : el.id);
              }}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

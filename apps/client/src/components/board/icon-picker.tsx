import { Search } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { IconGlyph } from "./icon-glyph";
import { useIconNames } from "./icons";

/** What the grid shows before a search: everyday UI icons. */
const COMMON = (
  "search menu x check plus minus chevron-left chevron-right chevron-down chevron-up arrow-left " +
  "arrow-right arrow-up arrow-down house user users circle-user settings bell heart star bookmark " +
  "share-2 mail phone message-circle send calendar clock map-pin camera image video music play " +
  "pause shopping-cart shopping-bag credit-card wallet lock eye eye-off log-in log-out filter " +
  "sliders-horizontal ellipsis ellipsis-vertical trash-2 pencil copy download upload link " +
  "external-link info circle-alert triangle-alert circle-check circle-help sun moon globe wifi mic " +
  "volume-2 file file-text folder cloud refresh-cw layout-grid list layout-dashboard chart-column " +
  "trending-up gift tag zap sparkles thumbs-up smile award briefcase car plane coffee book-open " +
  "headphones monitor smartphone shield-check key paperclip"
).split(" ");

/** Enough results to scan; each icon is its own small download. */
const MAX_RESULTS = 84;

/** Icon names matching `query`: names starting with it first, then names containing it. */
function searchIcons(names: readonly string[], query: string) {
  const q = query.trim().toLowerCase().replace(/\s+/g, "-");
  if (!q) return COMMON;
  const starts = names.filter((name) => name.startsWith(q));
  const contains = names.filter((name) => !name.startsWith(q) && name.includes(q));
  return [...starts, ...contains].slice(0, MAX_RESULTS);
}

/** A search box over a grid of Lucide icons. */
export function IconGrid({
  value,
  onPick,
  className,
}: {
  value: string | null;
  onPick: (name: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  // Searching needs Lucide's catalog; the common icons show while it loads.
  const names = useIconNames();
  const results = names ? searchIcons(names, query) : COMMON;

  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={inputId} className="sr-only">
        Search icons
      </label>
      <div className="flex items-center gap-2 border-b border-divider px-3">
        <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons"
          autoComplete="off"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {results.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">No icon matches.</p>
      ) : (
        <div className="grid max-h-64 grid-cols-7 gap-0.5 overflow-y-auto p-2">
          {results.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              title={name}
              aria-pressed={name === value}
              onClick={() => onPick(name)}
              className={cn(
                "flex aspect-square items-center justify-center text-foreground transition-colors duration-100 ease-standard hover:bg-background",
                name === value && "bg-brand/40",
              )}
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <IconGlyph
                  name={name}
                  x={0}
                  y={0}
                  width={24}
                  height={24}
                  color="currentColor"
                  strokeWidth={2}
                />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The Icon tool's picker: choose one, then click the board to place it. */
export function IconPicker({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (name: string) => void;
}) {
  return (
    <div
      // Not a dialog: the board's keys keep working, and the board stays clickable.
      role="group"
      aria-label="Icon picker"
      className="absolute top-6 left-20 z-10 flex w-[316px] flex-col border border-chrome bg-card"
    >
      <IconGrid value={value} onPick={onPick} />
      <p className="border-t border-divider px-3 py-2 text-xs text-muted-foreground">
        {value ? "Click the board to place it." : "Pick an icon, then click the board."}
      </p>
    </div>
  );
}

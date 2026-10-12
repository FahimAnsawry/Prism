import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft, ArrowRight, ChevronRight, Maximize, Minus, Plus } from "lucide-react";
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { isTyping } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import type { BoardElement } from "./board-model";
import { ElementShape } from "./element-shape";
import { focusLayout } from "./er-focus-layout";
import { TableSwitcher } from "./er-table-switcher";
import { type Box, boundsOf, type Point, topHit } from "./geometry";
import { TableDetails } from "./table-details";
import { useElementSize } from "./use-element-size";

// A table's focus view: the table and every table it's related to, laid out together on their own
// (focusLayout) and shown as large as the screen allows, at full size whenever they fit. It only
// looks: the board's camera, selection and elements stay as they are. As ErFocusPanel (View mode)
// it fills the board instead of a dialog and starts on every table, then narrows on a click.

/** Room kept around the diagram when it's fitted, in screen px. */
export const MARGIN = 40;
/** Fitting never goes past full size: 100% is the size the board draws at 100%. */
const MAX_FIT = 1;
/** How far the wheel and the buttons may zoom, as screen px per board px. */
const ZOOM = { min: 0.1, max: 3 };
/** One press of the zoom buttons. */
const ZOOM_STEP = 1.25;
/** Below this fit with every column shown, related tables start with only their keys. */
export const AUTO_KEYS_BELOW = 0.5;
/** A press that moves less than this (screen px) is a click, not a pan. */
const CLICK_SLOP = 4;

const closeButton =
  "flex h-8 items-center gap-2 border border-chrome bg-card pr-1.5 pl-2.5 text-xs font-medium text-foreground transition-colors duration-150 ease-standard hover:bg-background";
const escKey =
  "flex h-5 items-center border border-divider bg-background px-1 font-mono text-3xs text-muted-foreground";

export function ErFocusDialog({
  tableId,
  elements,
  onClose,
}: {
  /** The table to start from; the dialog is open while it's set. */
  tableId: string | null;
  elements: BoardElement[];
  /** Called with the table focused last, which may be another one than the view opened on. */
  onClose: (lastId: string) => void;
}) {
  // The last table stays drawn while the dialog fades out.
  const [shownId, setShownId] = useState(tableId);
  if (tableId && tableId !== shownId) setShownId(tableId);
  const popup = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  return (
    <Dialog.Root
      open={tableId !== null}
      onOpenChange={(open) => {
        if (!open && tableId) onClose(last.current ?? tableId);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate/40 transition-opacity duration-150 ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60" />
        {/* Focus goes to the popup (Esc and Tab work) rather than ringing the first button. */}
        <Dialog.Popup
          ref={popup}
          initialFocus={popup}
          className="fixed inset-2 z-50 flex flex-col border border-input bg-popover outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 sm:inset-4"
        >
          {shownId && (
            <FocusContent
              key={shownId}
              start={shownId}
              elements={elements}
              onFocusChange={(id) => {
                if (id) last.current = id;
              }}
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The focus view without a dialog, for View mode: it starts on every table and relation, a click
 * on a table focuses it, and "All tables" (or Esc) goes back to them all.
 */
export function ErFocusPanel({
  elements,
  leading,
  eyebrow,
  trailing,
}: {
  elements: BoardElement[];
  /** Before the history buttons (a back link). */
  leading?: ReactNode;
  /** Above the table trail, in place of "Table focus" (the board's name). */
  eyebrow?: string;
  /** At the end of the header (mode, theme, share), so the board needs no second bar. */
  trailing?: ReactNode;
}) {
  return (
    <FocusContent
      start={null}
      elements={elements}
      inline
      leading={leading}
      eyebrow={eyebrow}
      trailing={trailing}
    />
  );
}

function Eyebrow({ inline, children }: { inline: boolean; children: string }) {
  const className = "font-mono text-3xs font-bold text-muted-foreground uppercase";
  return inline ? (
    <p className={className}>{children}</p>
  ) : (
    <Dialog.Description className={className}>{children}</Dialog.Description>
  );
}

function Heading({ inline, children }: { inline: boolean; children: ReactNode }) {
  const className = "flex min-w-0 items-center gap-1 text-[15px] leading-5 font-bold text-ink";
  return inline ? (
    <h2 className={className}>{children}</h2>
  ) : (
    <Dialog.Title className={className}>{children}</Dialog.Title>
  );
}

/**
 * The window's content: the history of tables walked through (a click on a related table, in the
 * diagram or the details panel, or a pick in "Jump to table" moves the focus; back and forward
 * step through it, as in a browser), the diagram and the table's details. Inline, the history
 * starts on null: every table at once.
 */
function FocusContent({
  start,
  elements,
  onFocusChange,
  inline = false,
  leading,
  eyebrow,
  trailing,
}: {
  start: string | null;
  elements: BoardElement[];
  onFocusChange?: (id: string | null) => void;
  /** Fills its parent in View mode instead of living in a dialog. */
  inline?: boolean;
  leading?: ReactNode;
  eyebrow?: string;
  trailing?: ReactNode;
}) {
  const [history, setHistory] = useState<{ stack: (string | null)[]; index: number }>({
    stack: [start],
    index: 0,
  });
  const switcher = useRef<HTMLButtonElement>(null);
  /** Null until the switch is used: then keys only is on when every column would show too small. */
  const [keysChoice, setKeysChoice] = useState<boolean | null>(null);
  /** A relation picked in the details panel: it and its two tables stand out in the diagram. */
  const [highlight, setHighlight] = useState<string | null>(null);
  const current = history.stack[history.index] ?? null;
  const trail = history.stack.slice(0, history.index + 1);
  const canBack = history.index > 0;
  const canForward = history.index < history.stack.length - 1;
  const area = useRef<HTMLDivElement>(null);
  const size = useElementSize(area);
  // The space the layout fills (inside the margin), in steps so a small resize doesn't redo it.
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
  const name = (id: string | null) =>
    id ? (elements.find((el) => el.id === id)?.table?.name ?? "table") : "All tables";
  /** Moves to step `index` of the history. */
  const goTo = (index: number) => {
    setHighlight(null);
    setHistory((h) => ({ ...h, index: Math.max(0, Math.min(h.stack.length - 1, index)) }));
  };
  /** Focuses `id`, dropping the steps ahead (as following a link does in a browser). */
  const focusOn = (id: string | null) => {
    setHighlight(null);
    if (id === current) return;
    setHistory((h) => ({ stack: [...h.stack.slice(0, h.index + 1), id], index: h.index + 1 }));
  };

  useEffect(() => {
    onFocusChange?.(current);
  }, [current, onFocusChange]);

  // "/" or Ctrl+K searches; Alt+Left (or Backspace) and Alt+Right step back and forward. Inline,
  // Esc goes back to every table (the dialog's Esc closes it instead).
  useEffect(() => {
    const step = (by: number) => {
      setHighlight(null);
      setHistory((h) => ({ ...h, index: Math.max(0, Math.min(h.stack.length - 1, h.index + by)) }));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      // A dialog above the view (the shortcut list, Share) takes the keys while it's open.
      if (inline && document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
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
      } else if (inline && event.key === "Escape") {
        setHighlight(null);
        setHistory((h) =>
          h.stack[h.index] === null
            ? h
            : { stack: [...h.stack.slice(0, h.index + 1), null], index: h.index + 1 },
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inline]);

  return (
    <>
      <header
        className={cn(
          "flex h-14 shrink-0 items-center justify-between gap-4 border-b border-divider",
          inline ? "bg-card px-4 md:pr-6" : "pr-2 pl-5",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <div className="flex h-8 shrink-0 items-stretch border border-chrome bg-card text-foreground">
            <button
              type="button"
              aria-label="Back"
              title="Back · Alt+Left"
              disabled={!canBack}
              onClick={() => goTo(history.index - 1)}
              className="flex w-8 items-center justify-center transition-colors duration-150 ease-standard enabled:hover:bg-background disabled:text-muted-foreground/40"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Forward"
              title="Forward · Alt+Right"
              disabled={!canForward}
              onClick={() => goTo(history.index + 1)}
              className="flex w-8 items-center justify-center border-l border-chrome transition-colors duration-150 ease-standard enabled:hover:bg-background disabled:text-muted-foreground/40"
            >
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="min-w-0">
            <Eyebrow inline={inline}>{eyebrow ?? "Table focus"}</Eyebrow>
            <Heading inline={inline}>
              {trail.map((id, i) =>
                i === trail.length - 1 ? (
                  <span key={`${id}-${i}`} className="truncate">
                    {name(id)}
                  </span>
                ) : (
                  <span key={`${id}-${i}`} className="flex min-w-0 shrink items-center gap-1">
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      title={`Back to ${name(id)}`}
                      className="truncate font-medium text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink"
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
            </Heading>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TableSwitcher
            elements={elements}
            currentId={current ?? ""}
            triggerRef={switcher}
            onPick={focusOn}
          />
          <div
            role="group"
            aria-label="Columns shown in related tables"
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
          {inline ? (
            current !== null && (
              <>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-divider" />
                <button type="button" onClick={() => focusOn(null)} className={closeButton}>
                  All tables
                  <kbd className={escKey}>Esc</kbd>
                </button>
              </>
            )
          ) : (
            <>
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-divider" />
              <Dialog.Close className={closeButton}>
                Back to board
                <kbd className={escKey}>Esc</kbd>
              </Dialog.Close>
            </>
          )}
          {trailing && (
            <>
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-divider" />
              {trailing}
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div ref={area} className="relative min-w-0 flex-1 overflow-hidden bg-background">
          {!shown ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {current === null
                ? "There are no tables on this board."
                : "This table isn’t on the board anymore."}
            </p>
          ) : (
            size.width > 0 && (
              <FocusView
                // A new focus, keys only turned on or off, or a new layout fits again.
                key={`${current}-${keysOnly}-${spaceWidth}x${spaceHeight}`}
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
    </>
  );
}

/** The laid-out group, fitted to the space; the wheel zooms and a drag pans. */
export function FocusView({
  focusId,
  shown,
  size,
  highlight,
  onFocusTable,
}: {
  focusId: string | null;
  /** The elements to draw, bottom layer first (focusLayout). */
  shown: BoardElement[];
  /** The space it fills, in screen px. */
  size: { width: number; height: number };
  /** A relation to bring forward, with its two tables; the rest dims. */
  highlight: string | null;
  onFocusTable: (id: string) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const grid = `focus-grid${useId().replace(/[^\w-]/g, "")}`;
  const content = boundsOf(shown) ?? { x: 0, y: 0, width: 1, height: 1 };
  /** Null while fitted: the view follows the space as the window resizes. */
  const [moved, setMoved] = useState<Box | null>(null);
  const view = moved ?? fitView(content, size);
  const scale = size.width / view.width;
  const latest = useRef({ view, scale });
  useEffect(() => {
    latest.current = { view, scale };
  });
  const drag = useRef<{ x: number; y: number; view: Box; moved: boolean } | null>(null);
  const [cursor, setCursor] = useState("cursor-grab");
  const focused = shown.find((el) => el.id === focusId);
  const picked = highlight ? shown.find((el) => el.id === highlight) : undefined;
  const lit = picked
    ? new Set([picked.id, picked.startBinding, picked.endBinding].filter((id) => id != null))
    : null;

  /** Zooms to `to` around the middle of the view. */
  const zoomTo = (to: number) => {
    const next = Math.min(ZOOM.max, Math.max(ZOOM.min, to));
    const cx = view.x + view.width / 2;
    const cy = view.y + view.height / 2;
    const width = size.width / next;
    const height = size.height / next;
    setMoved({ x: cx - width / 2, y: cy - height / 2, width, height });
  };

  const toWorld = (event: { clientX: number; clientY: number }): Point => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: view.x + (event.clientX - rect.left) / scale,
      y: view.y + (event.clientY - rect.top) / scale,
    };
  };

  const tableAt = (p: Point) =>
    topHit(shown, p, 6 / scale, (el) => el.type === "table" && el.id !== focusId);

  // Not a React handler: those are passive, and preventDefault must stop the page from zooming.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { view: current, scale: from } = latest.current;
      const pixels =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      const factor = Math.exp(-pixels * (event.ctrlKey ? 0.01 : 0.0015));
      const to = Math.min(ZOOM.max, Math.max(ZOOM.min, from * factor));
      const rect = el.getBoundingClientRect();
      // Zoom around the board point under the pointer, so it stays put.
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const p = { x: current.x + sx / from, y: current.y + sy / from };
      const next = {
        x: p.x - sx / to,
        y: p.y - sy / to,
        width: rect.width / to,
        height: rect.height / to,
      };
      latest.current = { view: next, scale: to };
      setMoved(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, view, moved: false };
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start) {
      setCursor(tableAt(toWorld(event)) ? "cursor-pointer" : "cursor-grab");
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
    start.moved = true;
    setCursor("cursor-grabbing");
    setMoved({ ...start.view, x: start.view.x - dx / scale, y: start.view.y - dy / scale });
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    setCursor("cursor-grab");
    if (start.moved || event.button !== 0) return;
    const hit = tableAt(toWorld(event));
    if (hit) onFocusTable(hit.id);
  };

  return (
    <>
      <svg
        ref={svg}
        aria-label="Focused tables"
        role="img"
        width={size.width}
        height={size.height}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
        className={`absolute inset-0 touch-none select-none ${cursor}`}
      >
        <defs>
          <pattern id={grid} width="16" height="16" y="8" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="8" r="1" className="fill-grid-dot" />
          </pattern>
        </defs>
        <rect
          x={view.x}
          y={view.y}
          width={view.width}
          height={view.height}
          fill={`url(#${grid})`}
        />

        {shown.map((el) => (
          <g
            key={el.id}
            opacity={lit && !lit.has(el.id) ? 0.18 : undefined}
            className="transition-opacity duration-150 ease-standard"
          >
            <ElementShape el={el} />
          </g>
        ))}

        {/* The picked relation again on top, so no table hides it. */}
        {picked && (
          <g pointerEvents="none">
            <ElementShape el={picked} />
          </g>
        )}

        {focused && (
          <rect
            x={focused.x - 6}
            y={focused.y - 6}
            width={focused.width + 12}
            height={focused.height + 12}
            fill="none"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            className="stroke-blue"
          />
        )}
      </svg>
      <p className="pointer-events-none absolute bottom-3 left-3 hidden border border-chrome bg-card px-2.5 py-1.5 font-mono text-3xs text-muted-foreground lg:block">
        Scroll to zoom · Drag to pan · Click a table to focus it
      </p>
      <div className="absolute right-3 bottom-3 flex h-9 items-stretch border border-chrome bg-card text-foreground">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomTo(scale / ZOOM_STEP)}
          className="flex w-9 items-center justify-center transition-colors duration-150 ease-standard hover:bg-background"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Zoom to 100%"
          title="Full size"
          onClick={() => zoomTo(1)}
          className="w-14 font-mono text-xs tabular-nums transition-colors duration-150 ease-standard hover:bg-background"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomTo(scale * ZOOM_STEP)}
          className="flex w-9 items-center justify-center transition-colors duration-150 ease-standard hover:bg-background"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Fit the view"
          title="Fit"
          onClick={() => setMoved(null)}
          className="flex w-9 items-center justify-center border-l border-chrome transition-colors duration-150 ease-standard hover:bg-background"
        >
          <Maximize aria-hidden="true" className="size-4" />
        </button>
      </div>
    </>
  );
}

/** The scale that shows `content` whole in `size` with a margin, never past full size. */
export function fitScale(content: Box | null, size: { width: number; height: number }) {
  if (!content) return MAX_FIT;
  const scale = Math.min(
    MAX_FIT,
    (size.width - 2 * MARGIN) / Math.max(1, content.width),
    (size.height - 2 * MARGIN) / Math.max(1, content.height),
  );
  return Math.max(ZOOM.min, scale);
}

/** The viewBox showing `content` centered in `size`, at fitScale. */
export function fitView(content: Box, size: { width: number; height: number }): Box {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const fit = fitScale(content, size);
  return {
    x: content.x + content.width / 2 - width / fit / 2,
    y: content.y + content.height / 2 - height / fit / 2,
    width: width / fit,
    height: height / fit,
  };
}

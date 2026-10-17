import type { BoardElement, ElementOp, Peer } from "@prism/shared";
import { Eye, Grid2x2, Hand, Maximize, Minus, MousePointer2, Plus } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { isTyping } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { BoardCanvas } from "./board-canvas";
import { type BoardAction, boardReducer, initialBoardState } from "./board-model";
import { type CatchUpSource, reportCursor, useBoardRealtime, useBoardSaver } from "./board-sync";
import { type Camera, fitCamera, inView, stepZoom, zoomAt } from "./camera";
import { ErFocusDialog } from "./er-focus-dialog";
import { ExportMenu } from "./export-menu";
import { TableSwitcher } from "./er-table-switcher";
import { loadFont } from "./fonts";
import { revealOps } from "./remote-reveal";
import { TableDetails } from "./table-details";
import type { ToolId } from "./tools";
import { useElementSize } from "./use-element-size";

/** Zoom buttons and keys zoom around the middle of the view. */
const CENTER = { x: 0, y: 0 };

/** What a read-only tab may do to its own copy: follow live changes and fold mind map branches. */
const ALLOWED = new Set<BoardAction["type"]>(["remote", "mindToggle", "select"]);

const noop = () => {};

/**
 * A board to look at, not change: a team member with the viewer role, or anyone with a public
 * link (`shareToken`). It pans, zooms and follows other people's edits live; nothing is saved.
 */
export function BoardViewer({
  boardId,
  initial,
  shareToken,
  initialEditedAt,
  catchUpSource,
  title,
  context,
  leading,
  onRevoked,
  onAccessChanged,
  onSwitchToFocus,
}: {
  boardId: string;
  initial: BoardElement[];
  /** Joins through this public link instead of as the signed-in user. */
  shareToken?: string;
  /** The board's `editedAt` (ms) when `initial` was read. */
  initialEditedAt: number | null;
  /** Where to catch up from after (re)joining. */
  catchUpSource: CatchUpSource;
  title: string;
  /** A line above the title (the project, who shared it). */
  context?: ReactNode;
  /** Before the title: a back link. */
  leading?: ReactNode;
  onRevoked: () => void;
  onAccessChanged?: () => void;
  onSwitchToFocus?: () => void;
}) {
  const [state, rawDispatch] = useReducer(boardReducer, initial, initialBoardState);
  const dispatch = useCallback((action: BoardAction) => {
    if (ALLOWED.has(action.type)) rawDispatch(action);
  }, []);
  const hasTables = state.elements.some((el) => el.type === "table");
  const [tool, setTool] = useState<ToolId>(hasTables ? "select" : "hand");
  const [focusTable, setFocusTable] = useState<string | null>(null);
  const switcher = useRef<HTMLButtonElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [grid, setGrid] = useState(true);
  const viewport = useRef<HTMLElement>(null);
  const size = useElementSize(viewport);
  const { receive, catchUp } = useBoardSaver(boardId, initial, state.elements, {
    readOnly: true,
    editedAt: initialEditedAt,
  });

  const chosenTableId = state.selectedIds.length === 1 ? (state.selectedIds[0] ?? null) : null;
  const selectedTable = chosenTableId
    ? state.elements.find((el) => el.id === chosenTableId)
    : undefined;

  // Reveals of an AI editor's big batches in progress, stopped when the board closes.
  const reveals = useRef(new Set<() => void>());
  useEffect(() => {
    const running = reveals.current;
    return () => {
      for (const stop of running) stop();
      running.clear();
    };
  }, []);
  const view = useRef({ camera, size });
  useEffect(() => {
    view.current = { camera, size };
  });

  const applyRemote = useCallback(
    (ops: ElementOp[], staged?: Peer) => {
      const fresh = receive(ops);
      if (fresh.length === 0) return;
      if (staged) {
        reveals.current.add(
          revealOps({
            ops: fresh,
            peer: staged,
            dispatch: rawDispatch,
            onStart: (created) => {
              const { camera: cam, size: box } = view.current;
              if (!inView(created, cam, box)) setCamera(fitCamera(created, box.width, box.height));
            },
          }),
        );
      } else {
        rawDispatch({ type: "remote", ops: fresh });
      }
      for (const op of fresh) {
        const el = op.op === "create" ? op.element : op.op === "update" ? op.changes : null;
        if (el?.font)
          void loadFont(el.font, typeof el.fontWeight === "number" ? el.fontWeight : 400);
      }
    },
    [receive],
  );

  useBoardRealtime(
    boardId,
    {
      onOps: applyRemote,
      onJoined: (editedAt) => {
        catchUp(catchUpSource, editedAt).then(
          (fresh) => {
            if (fresh.length > 0) rawDispatch({ type: "remote", ops: fresh });
          },
          (error: unknown) => console.warn("[Prism] Couldn't catch up with the board:", error),
        );
      },
      onRevoked,
      ...(onAccessChanged && { onAccessChanged }),
    },
    shareToken ? { shareToken } : {},
  );

  // Opens framed on the content, once the viewport is measured.
  const framed = useRef(false);
  useLayoutEffect(() => {
    if (framed.current || size.width <= 0 || size.height <= 0) return;
    framed.current = true;
    setCamera(fitCamera(state.elements, size.width, size.height));
  }, [size.width, size.height, state.elements]);

  const fit = useCallback(
    () => setCamera(fitCamera(state.elements, size.width, size.height)),
    [state.elements, size.width, size.height],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      const ids = state.selectedIds;
      const focusTarget = () => {
        const chosen = ids.length === 1 ? ids[0] : undefined;
        const el = chosen ? state.elements.find((e) => e.id === chosen) : undefined;
        return el?.type === "table" ? el.id : null;
      };

      if (event.key === "/" || (mod && event.key.toLowerCase() === "k")) {
        if (hasTables) {
          event.preventDefault();
          switcher.current?.click();
        }
      } else if (key === "f" && !mod && !event.altKey && !event.shiftKey && focusTarget()) {
        event.preventDefault();
        setFocusTable(focusTarget());
      } else if (key === "escape") {
        dispatch({ type: "select", ids: [] });
      } else if (key === "v" && !mod && !event.altKey) {
        setTool("select");
      } else if (key === "h" && !mod && !event.altKey) {
        setTool("hand");
      } else if (mod && (key === "=" || key === "+")) {
        event.preventDefault();
        setCamera((c) => zoomAt(c, stepZoom(c.zoom, 1), CENTER));
      } else if (mod && key === "-") {
        event.preventDefault();
        setCamera((c) => zoomAt(c, stepZoom(c.zoom, -1), CENTER));
      } else if (mod && key === "0") {
        event.preventDefault();
        setCamera((c) => zoomAt(c, 1, CENTER));
      } else if (event.shiftKey && !mod && event.code === "Digit1") {
        event.preventDefault();
        fit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fit, state.selectedIds, state.elements, hasTables, dispatch]);

  const chrome = "border border-chrome bg-card text-foreground";
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-divider bg-card px-4 md:pr-6">
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          <div className="min-w-0 px-1.5">
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
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {hasTables && (
            <TableSwitcher
              elements={state.elements}
              currentId={chosenTableId ?? ""}
              triggerRef={switcher}
              onPick={(id) => setFocusTable(id)}
            />
          )}
          {hasTables && (
            <div className={cn("flex h-9 items-stretch", chrome)}>
              <button
                type="button"
                aria-label="Select / Inspect (V)"
                title="Select · V"
                onClick={() => setTool("select")}
                className={cn(
                  "flex w-9 items-center justify-center transition-colors duration-150 ease-standard hover:bg-hover",
                  tool === "select" && "bg-background text-ink",
                )}
              >
                <MousePointer2 aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Hand / Pan (H)"
                title="Pan · H"
                onClick={() => setTool("hand")}
                className={cn(
                  "flex w-9 items-center justify-center border-l border-chrome transition-colors duration-150 ease-standard hover:bg-hover",
                  tool === "hand" && "bg-background text-ink",
                )}
              >
                <Hand aria-hidden="true" className="size-4" />
              </button>
            </div>
          )}
          {hasTables && onSwitchToFocus && (
            <button
              type="button"
              onClick={onSwitchToFocus}
              aria-label="Focus view"
              title="Focus view"
              className={cn(
                "hidden h-9 items-center gap-1.5 border border-chrome bg-card px-2.5 text-xs font-medium text-foreground transition-colors duration-150 ease-standard hover:bg-hover md:flex",
              )}
            >
              Focus view
            </button>
          )}
          <button
            type="button"
            aria-label="Dot grid"
            aria-pressed={grid}
            title="Dot grid"
            onClick={() => setGrid((on) => !on)}
            className={cn(
              "hidden size-9 items-center justify-center transition-colors duration-150 ease-standard hover:bg-hover md:flex",
              chrome,
              !grid && "bg-background text-muted-foreground",
            )}
          >
            <Grid2x2 aria-hidden="true" className="size-[18px]" />
          </button>
          <div className={cn("flex h-9 items-stretch", chrome)}>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setCamera((c) => zoomAt(c, stepZoom(c.zoom, -1), CENTER))}
              className="flex w-9 items-center justify-center hover:bg-hover"
            >
              <Minus aria-hidden="true" className="size-[18px]" />
            </button>
            <button
              type="button"
              aria-label="Reset zoom to 100%"
              title="Reset to 100%"
              onClick={() => setCamera((c) => zoomAt(c, 1, CENTER))}
              className="hidden w-16 font-mono text-xs tabular-nums hover:bg-hover sm:block"
            >
              {Math.round(camera.zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setCamera((c) => zoomAt(c, stepZoom(c.zoom, 1), CENTER))}
              className="flex w-9 items-center justify-center hover:bg-hover"
            >
              <Plus aria-hidden="true" className="size-[18px]" />
            </button>
          </div>
          <button
            type="button"
            aria-label="Fit the board (Shift+1)"
            title="Fit · Shift+1"
            onClick={fit}
            className={cn(
              "flex size-9 items-center justify-center transition-colors duration-150 ease-standard hover:bg-hover",
              chrome,
            )}
          >
            <Maximize aria-hidden="true" className="size-4" />
          </button>
          <ThemeToggle className="size-9 border border-chrome bg-card" />
          <ExportMenu
            elements={state.elements}
            selectedIds={state.selectedIds}
            boardName={title}
            className="hidden sm:flex"
          />
        </div>
      </header>

      <main ref={viewport} className="relative min-h-0 flex-1 overflow-hidden">
        <BoardCanvas
          state={state}
          dispatch={dispatch}
          tool={tool}
          grid={grid}
          camera={camera}
          editingId={null}
          emoji={null}
          icon={null}
          onCameraChange={setCamera}
          onBorrowHand={noop}
          onStartEditing={noop}
          onFinishEditing={noop}
          onToolDone={noop}
          onPointerWorld={(p) => {
            // A public link's viewer has no account, so no cursor to show.
            if (!shareToken) reportCursor(boardId, p);
          }}
          onDropFiles={noop}
          presenceBoardId={boardId}
          viewport={size}
        />
        {selectedTable?.type === "table" && !focusTable && (
          <aside
            aria-label={`${selectedTable.table?.name ?? "Table"} details`}
            className="absolute top-6 right-4 z-20 max-h-[calc(100%-2.5rem)] w-64 overflow-y-auto border border-chrome bg-card shadow-lg"
          >
            <TableDetails
              table={selectedTable}
              board={state.elements}
              onSelect={(ids) => dispatch({ type: "select", ids })}
              onOpenFocus={() => setFocusTable(selectedTable.id)}
            />
          </aside>
        )}
        {state.elements.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-24 text-center text-sm text-muted-foreground">
            This board is empty.
          </p>
        )}
      </main>

      <ErFocusDialog
        tableId={focusTable}
        elements={state.elements}
        onClose={(lastId) => {
          // Coming back from another table than the one it opened on, the board shows that one.
          const last = lastId !== focusTable && state.elements.find((el) => el.id === lastId);
          if (last) {
            setCamera((c) => ({
              ...c,
              x: -c.zoom * (last.x + last.width / 2 - size.width / 2),
              y: -c.zoom * (last.y + last.height / 2 - size.height / 2),
            }));
          }
          setFocusTable(null);
        }}
      />
    </div>
  );
}

import type { BoardElement, ElementOp } from "@prism/shared";
import { Eye, Grid2x2, Maximize, Minus, Plus } from "lucide-react";
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
import { useBoardRealtime, useBoardSaver } from "./board-sync";
import { type Camera, fitCamera, stepZoom, zoomAt } from "./camera";
import { loadFont } from "./fonts";
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
  fetchElements,
  title,
  context,
  leading,
  onRevoked,
  onAccessChanged,
}: {
  boardId: string;
  initial: BoardElement[];
  /** Joins through this public link instead of as the signed-in user. */
  shareToken?: string;
  /** The board's elements as the server has them now, to catch up after reconnecting. */
  fetchElements: () => Promise<BoardElement[]>;
  title: string;
  /** A line above the title (the project, who shared it). */
  context?: ReactNode;
  /** Before the title: a back link. */
  leading?: ReactNode;
  onRevoked: () => void;
  onAccessChanged?: () => void;
}) {
  const [state, rawDispatch] = useReducer(boardReducer, initial, initialBoardState);
  const dispatch = useCallback((action: BoardAction) => {
    if (ALLOWED.has(action.type)) rawDispatch(action);
  }, []);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [grid, setGrid] = useState(true);
  const viewport = useRef<HTMLElement>(null);
  const size = useElementSize(viewport);
  const { receive, resync } = useBoardSaver(boardId, initial, state.elements, { readOnly: true });

  const applyRemote = useCallback(
    (ops: ElementOp[]) => {
      const fresh = receive(ops);
      if (fresh.length === 0) return;
      rawDispatch({ type: "remote", ops: fresh });
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
      onJoined: () => {
        fetchElements().then(
          (server) => {
            const fresh = resync(server);
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
      if (mod && (key === "=" || key === "+")) {
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
  }, [fit]);

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
          <button
            type="button"
            aria-label="Dot grid"
            aria-pressed={grid}
            title="Dot grid"
            onClick={() => setGrid((on) => !on)}
            className={cn(
              "hidden size-9 items-center justify-center transition-colors duration-150 ease-standard hover:bg-background md:flex",
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
              className="flex w-9 items-center justify-center hover:bg-background"
            >
              <Minus aria-hidden="true" className="size-[18px]" />
            </button>
            <button
              type="button"
              aria-label="Reset zoom to 100%"
              title="Reset to 100%"
              onClick={() => setCamera((c) => zoomAt(c, 1, CENTER))}
              className="hidden w-16 font-mono text-xs tabular-nums hover:bg-background sm:block"
            >
              {Math.round(camera.zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setCamera((c) => zoomAt(c, stepZoom(c.zoom, 1), CENTER))}
              className="flex w-9 items-center justify-center hover:bg-background"
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
              "flex size-9 items-center justify-center transition-colors duration-150 ease-standard hover:bg-background",
              chrome,
            )}
          >
            <Maximize aria-hidden="true" className="size-4" />
          </button>
          <ThemeToggle className="size-9 border border-chrome bg-card" />
        </div>
      </header>

      <main ref={viewport} className="relative min-h-0 flex-1 overflow-hidden">
        <BoardCanvas
          state={state}
          dispatch={dispatch}
          tool="hand"
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
          onPointerWorld={noop}
          onDropFiles={noop}
        />
        {state.elements.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-24 text-center text-sm text-muted-foreground">
            This board is empty.
          </p>
        )}
      </main>
    </div>
  );
}

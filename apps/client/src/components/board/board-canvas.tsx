import type { BoardElement } from "@prism/shared";
import {
  type Dispatch,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { isTyping } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { type BoardAction, type BoardState, byZ } from "./board-model";
import { type Camera, screenToWorld, zoomAt } from "./camera";
import { ElementShape } from "./element-shape";
import {
  elementBounds,
  type Frame,
  handleAt,
  handleCursor,
  isLinear,
  type Point,
  selectionFrame,
  topHit,
} from "./geometry";
import { type Gesture, isTextual, type Overlay, placeText, startGesture } from "./gestures";
import type { ToolId } from "./tools";

const SELECTION = "#5882ff"; // --color-blue

const TOOL_CURSORS: Partial<Record<ToolId, string>> = {
  text: "cursor-text",
  handwriting: "cursor-text",
  rect: "cursor-crosshair",
  ellipse: "cursor-crosshair",
  diamond: "cursor-crosshair",
  line: "cursor-crosshair",
  arrow: "cursor-crosshair",
  pencil: "cursor-crosshair",
  eraser: "cursor-cell",
  sticky: "cursor-copy",
  list: "cursor-copy",
  emoji: "cursor-copy",
  chart: "cursor-copy",
};

export function BoardCanvas({
  state,
  dispatch,
  tool,
  grid,
  camera,
  editingId,
  emoji,
  onCameraChange,
  onBorrowHand,
  onStartEditing,
  onFinishEditing,
  onToolDone,
  onPointerWorld,
  onDropFiles,
}: {
  state: BoardState;
  dispatch: Dispatch<BoardAction>;
  tool: ToolId;
  grid: boolean;
  camera: Camera;
  /** The element the text editor is open on; it's hidden here while the editor shows it. */
  editingId: string | null;
  /** The emoji the Emoji tool places. */
  emoji: string | null;
  onCameraChange: (camera: Camera) => void;
  /** True while a right/middle drag or held Space pans, so the toolbar can show the Hand tool. */
  onBorrowHand: (borrowing: boolean) => void;
  onStartEditing: (id: string, before: BoardElement[]) => void;
  onFinishEditing: () => void;
  onToolDone: () => void;
  /** The pointer's last world position, for pasting where the user is looking. */
  onPointerWorld: (p: Point) => void;
  onDropFiles: (files: File[], p: Point) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const pan = useRef<{ x: number; y: number; camera: Camera } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  /**
   * Set when a press opens the text editor. The editor focuses its textarea during pointerdown,
   * and the browser's default mousedown action that follows would move focus back to the page,
   * which closes the editor before anything is typed.
   */
  const keepEditorFocus = useRef(false);
  const [panning, setPanning] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string | undefined>();
  const spaceHeld = useHeldSpace();
  const { elements, selectedIds } = state;
  const ordered = byZ(elements);
  const selected = elements.filter((el) => selectedIds.includes(el.id));
  const frame = editingId ? null : selectionFrame(selected, camera.zoom);

  const borrowingHand = spaceHeld || panning;
  useEffect(() => {
    onBorrowHand(borrowingHand);
  }, [borrowingHand, onBorrowHand]);

  // The wheel handler is attached once, so it reads the latest camera from a ref. The ref also
  // takes each result right away, so several wheel events before the next render add up.
  const latest = useRef({ camera, onCameraChange });
  useEffect(() => {
    latest.current = { camera, onCameraChange };
  });

  // Wheel (and Ctrl+wheel, a trackpad pinch) zooms toward the pointer. Not a React handler:
  // those are passive, and preventDefault must stop page scroll and the browser's own zoom.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { camera: current, onCameraChange: change } = latest.current;
      const pixels =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      // Pinches send small deltas, so they get a stronger factor than a mouse wheel's notches.
      const factor = Math.exp(-pixels * (event.ctrlKey ? 0.01 : 0.0015));
      const rect = el.getBoundingClientRect();
      const next = zoomAt(current, current.zoom * factor, {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      });
      latest.current.camera = next;
      change(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toWorld = (event: { clientX: number; clientY: number }): Point => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return { x: event.clientX, y: event.clientY };
    return screenToWorld(
      latest.current.camera,
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      rect.width,
      rect.height,
    );
  };

  const context = {
    state,
    zoom: camera.zoom,
    dispatch,
    setOverlay,
    startEditing: (id: string, before: BoardElement[]) => {
      keepEditorFocus.current = true;
      onStartEditing(id, before);
    },
    finishTool: onToolDone,
    toWorld,
    emoji,
  };

  /** Right or middle drag pans with any tool; so does a left drag with the Hand tool or Space. */
  const pansWith = (event: PointerEvent) =>
    event.button === 1 ||
    event.button === 2 ||
    (event.button === 0 && (tool === "hand" || spaceHeld));

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (pansWith(event)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pan.current = { x: event.clientX, y: event.clientY, camera };
      setPanning(true);
      return;
    }
    if (event.button !== 0) return;
    // A press outside the text being edited just closes the editor.
    if (editingId) {
      onFinishEditing();
      return;
    }
    keepEditorFocus.current = false;
    const next = startGesture(tool, context, toWorld(event), event.nativeEvent);
    if (next) {
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = next;
    }
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = pan.current;
    if (start) {
      onCameraChange({
        ...start.camera,
        x: start.camera.x + event.clientX - start.x,
        y: start.camera.y + event.clientY - start.y,
      });
      return;
    }
    const p = toWorld(event);
    onPointerWorld(p);
    if (gesture.current) {
      gesture.current.move(p, event.nativeEvent);
      return;
    }
    if (tool === "select") setHoverCursor(cursorAt(p));
  };

  const endPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (pan.current) {
      pan.current = null;
      setPanning(false);
      return;
    }
    const current = gesture.current;
    gesture.current = null;
    current?.up(toWorld(event), event.nativeEvent);
  };

  /** What the Select tool's cursor shows over `p`. */
  const cursorAt = (p: Point) => {
    const handle = handleAt(frame, p, camera.zoom);
    if (handle) return handleCursor(handle, frame?.rotation ?? 0);
    const hit = topHit(ordered, p, 6 / camera.zoom);
    if (!hit) return undefined;
    return hit.locked ? "default" : "move";
  };

  const onDoubleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (tool !== "select" || editingId) return;
    const p = toWorld(event);
    const hit = topHit(ordered, p, 6 / camera.zoom);
    if (hit && isTextual(hit) && !hit.locked) {
      dispatch({ type: "select", ids: [hit.id] });
      onStartEditing(hit.id, elements);
    } else if (!hit) {
      // Double-clicking empty canvas starts typing there.
      placeText("text", context, p);
    }
  };

  const onDrop = (event: DragEvent<SVGSVGElement>) => {
    const files = [...event.dataTransfer.files];
    if (files.length === 0) return;
    event.preventDefault();
    onDropFiles(files, toWorld(event));
  };

  const cursor = panning
    ? "cursor-grabbing"
    : tool === "hand" || spaceHeld
      ? "cursor-grab"
      : TOOL_CURSORS[tool];

  return (
    <svg
      ref={svg}
      aria-label="Board canvas"
      role="application"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={onDoubleClick}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={onDrop}
      // Right-drag pans, so no context menu; and no autoscroll on a middle click.
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault();
        if (keepEditorFocus.current) {
          keepEditorFocus.current = false;
          event.preventDefault();
        }
      }}
      style={{ cursor: !cursor && tool === "select" ? hoverCursor : undefined }}
      className={cn("absolute inset-0 size-full touch-none select-none", cursor)}
    >
      <defs>
        {/* 2px dots every 16px, as in the Miro canvas image. */}
        <pattern id="dot-grid" width="16" height="16" y="8" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="1" className="fill-grid-dot" />
        </pattern>
      </defs>

      <g
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          transformOrigin: "center",
          transformBox: "view-box",
        }}
      >
        {grid && <rect x="-8000" y="-8000" width="16000" height="16000" fill="url(#dot-grid)" />}

        {ordered.map((el) => (
          <g key={el.id} data-id={el.id} opacity={overlay?.erasing?.has(el.id) ? 0.25 : undefined}>
            <ElementShape el={el} hidden={el.id === editingId} />
          </g>
        ))}

        {overlay?.snapTarget && (
          <SnapHighlight
            el={elements.find((el) => el.id === overlay.snapTarget)}
            zoom={camera.zoom}
          />
        )}

        {selected.length > 1 &&
          selected.map((el) => {
            const b = elementBounds(el);
            return (
              <rect
                key={el.id}
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                fill="none"
                stroke={SELECTION}
                strokeWidth={1 / camera.zoom}
                pointerEvents="none"
              />
            );
          })}

        {frame && (
          <SelectionFrame
            frame={frame}
            zoom={camera.zoom}
            linear={selected.length === 1 && selected[0] !== undefined && isLinear(selected[0])}
          />
        )}

        {overlay?.marquee && (
          <rect
            {...overlay.marquee}
            fill={SELECTION}
            fillOpacity={0.08}
            stroke={SELECTION}
            strokeWidth={1 / camera.zoom}
            pointerEvents="none"
          />
        )}
      </g>
    </svg>
  );
}

/** Selection: box, 8 square handles and a rotate handle above (Miro frame 10). */
function SelectionFrame({ frame, zoom, linear }: { frame: Frame; zoom: number; linear: boolean }) {
  const { box, rotation, handles } = frame;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const size = 10 / zoom;
  const rotate = handles.find((h) => h.handle === "rotate");

  return (
    <g pointerEvents="none" stroke={SELECTION} strokeWidth={1.5 / zoom}>
      {!linear && (
        <g transform={rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined}>
          <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="none" />
          {rotate && <line x1={cx} y1={box.y - 24 / zoom} x2={cx} y2={box.y} />}
        </g>
      )}
      {handles.map(({ handle, point }) =>
        handle === "rotate" || handle === "start" || handle === "end" ? (
          <circle key={handle} cx={point.x} cy={point.y} r={6 / zoom} className="fill-card" />
        ) : (
          <rect
            key={handle}
            x={point.x - size / 2}
            y={point.y - size / 2}
            width={size}
            height={size}
            transform={rotation ? `rotate(${rotation} ${point.x} ${point.y})` : undefined}
            className="fill-card"
          />
        ),
      )}
    </g>
  );
}

/** The outline of the shape an arrow end is about to attach to. */
function SnapHighlight({ el, zoom }: { el: BoardElement | undefined; zoom: number }) {
  if (!el) return null;
  const pad = 4 / zoom;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return (
    <rect
      x={el.x - pad}
      y={el.y - pad}
      width={el.width + 2 * pad}
      height={el.height + 2 * pad}
      transform={el.rotation ? `rotate(${el.rotation} ${cx} ${cy})` : undefined}
      fill="none"
      stroke={SELECTION}
      strokeWidth={2 / zoom}
      strokeDasharray={`${6 / zoom} ${4 / zoom}`}
      pointerEvents="none"
    />
  );
}

/**
 * True while Space is held down outside a text field: a temporary Hand tool (tools.md §1).
 * Ignored while a dialog is open; resets when the window loses focus.
 */
function useHeldSpace() {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    let down = false;
    const set = (next: boolean) => {
      down = next;
      setHeld(next);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      // Stops the page scrolling and a focused button from being pressed.
      event.preventDefault();
      if (!down) set(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" || !down) return;
      event.preventDefault();
      set(false);
    };
    const release = () => set(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
    };
  }, []);
  return held;
}

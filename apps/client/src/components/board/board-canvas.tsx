import { type BoardElement, hiddenMindNodes, isNameable, suggestName } from "@prism/shared";
import {
  type Dispatch,
  type DragEvent,
  type MouseEvent,
  memo,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isTyping } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { type BoardAction, type BoardState, byZ, displayColor } from "./board-model";
import { type Camera, screenToWorld, zoomAt } from "./camera";
import { type ElementLabel, ElementLabels } from "./element-labels";
import { ElementShape } from "./element-shape";
import { PresenceLayer } from "./presence-layer";
import { SnapGuidesView } from "./snap-guides";
import { MindBranches, mindToggles, MindToggles, TOGGLE_RADIUS } from "./mind-branches";
import {
  backdropOf,
  type Box,
  boundsOf,
  distance,
  elementBounds,
  erFocus,
  type Frame,
  handleAt,
  handleCursor,
  intersects,
  isLinear,
  type Point,
  selectionFrame,
  topHit,
} from "./geometry";
import { type Gesture, isTextual, type Overlay, placeText, startGesture } from "./gestures";
import { drillInto, outlineRoots, pickAt, unitIds } from "./selection";
import { fontPx, lineHeightOf } from "./text-layout";
import type { ToolId } from "./tools";

const SELECTION = "#5882ff"; // --color-blue

/** Text smaller than this on screen draws as bars: unreadable, and costly to wrap and draw. */
const GREEK_BELOW_PX = 4;
/** Below this zoom the dot grid is hidden: its dots would blur into a gray wash. */
const GRID_MIN_ZOOM = 0.3;

/**
 * The world area elements are drawn for: the view and one view's size of margin on every side,
 * snapped to a grid of view-sized cells, with the zoom snapped to half-octave steps. Panning or
 * zooming inside it doesn't redraw any element; only crossing a cell or a step does.
 */
function useDrawnArea(camera: Camera, viewport: { width: number; height: number } | undefined) {
  const width = viewport?.width ?? 0;
  const height = viewport?.height ?? 0;
  const step = Math.round(Math.log2(camera.zoom) * 2);
  const zoom = 2 ** (step / 2);
  const cellWidth = width / zoom;
  const cellHeight = height / zoom;
  const measured = width > 0 && height > 0;
  const start = screenToWorld(camera, { x: 0, y: 0 }, width, height);
  const end = screenToWorld(camera, { x: width, y: height }, width, height);
  const x0 = measured ? Math.floor(start.x / cellWidth) - 1 : 0;
  const y0 = measured ? Math.floor(start.y / cellHeight) - 1 : 0;
  const x1 = measured ? Math.floor(end.x / cellWidth) + 1 : 0;
  const y1 = measured ? Math.floor(end.y / cellHeight) + 1 : 0;
  const area = useMemo<Box | null>(
    () =>
      measured
        ? {
            x: x0 * cellWidth,
            y: y0 * cellHeight,
            width: (x1 - x0 + 1) * cellWidth,
            height: (y1 - y0 + 1) * cellHeight,
          }
        : null,
    [measured, x0, y0, x1, y1, cellWidth, cellHeight],
  );
  return { area, zoom };
}

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
  icon: "cursor-copy",
  mindmap: "cursor-copy",
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
  icon,
  onCameraChange,
  onBorrowHand,
  onStartEditing,
  onFinishEditing,
  onToolDone,
  onPointerWorld,
  onDropFiles,
  renamable = false,
  presenceBoardId,
  viewport,
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
  /** The Lucide icon the Icon tool places. */
  icon: string | null;
  onCameraChange: (camera: Camera) => void;
  /** True while a right/middle drag or held Space pans, so the toolbar can show the Hand tool. */
  onBorrowHand: (borrowing: boolean) => void;
  onStartEditing: (id: string, before: BoardElement[]) => void;
  onFinishEditing: () => void;
  onToolDone: () => void;
  /** The pointer's last world position, for pasting where the user is looking. */
  onPointerWorld: (p: Point) => void;
  onDropFiles: (files: File[], p: Point) => void;
  /** Whether the names above frames, sections and cards can be edited (a board this tab edits). */
  renamable?: boolean;
  /** The board whose other visitors (cursors, selections, AI editors at work) are drawn. */
  presenceBoardId?: string;
  /** The canvas's size on screen. Without it every element is drawn, wherever it is. */
  viewport?: { width: number; height: number };
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
  /** The mind map node under the pointer: its fold toggle shows, as on a selected node. */
  const [hoverMindId, setHoverMindId] = useState<string | null>(null);
  /** The element under the pointer; what a click would select from it is `hoverPick`. */
  const [hoverHitId, setHoverHitId] = useState<string | null>(null);
  /** Ctrl / Cmd held: a click would take the element itself, skipping the card levels. */
  const [hoverDeep, setHoverDeep] = useState(false);
  /** The element whose name is being edited in place. */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const spaceHeld = useHeldSpace();
  const { elements, selectedIds } = state;
  // Derived from the elements only, so panning and zooming (a render per frame) reuse them.
  // Nodes inside folded mind map branches aren't drawn, hit or selected.
  const { hidden, ordered } = useMemo(() => {
    const folded = hiddenMindNodes(elements);
    return { hidden: folded, ordered: byZ(elements).filter((el) => !folded.has(el.id)) };
  }, [elements]);
  const selected = useMemo(
    () => elements.filter((el) => selectedIds.includes(el.id) && !hidden.has(el.id)),
    [elements, selectedIds, hidden],
  );
  const toggles = useMemo(
    () =>
      editingId
        ? []
        : mindToggles(elements, ordered, hoverMindId ? [...selectedIds, hoverMindId] : selectedIds),
    [editingId, elements, ordered, hoverMindId, selectedIds],
  );
  // What a click on the hovered element would select at the current level (the card or section
  // with its contents, or the one element), outlined and named before the press.
  const hoverPick = useMemo(() => {
    if (editingId || tool !== "select" || !hoverHitId) return null;
    const hit = elements.find((el) => el.id === hoverHitId);
    return hit ? pickAt(elements, hit, selectedIds, hoverDeep) : null;
  }, [editingId, tool, hoverHitId, hoverDeep, elements, selectedIds]);
  const hoverBox = useMemo(() => {
    if (!hoverPick || hoverPick.ids.every((id) => selectedIds.includes(id))) return null;
    const ids = new Set(hoverPick.ids);
    return boundsOf(elements.filter((el) => ids.has(el.id)));
  }, [hoverPick, elements, selectedIds]);
  // A selected card brings all its contents: outline and name the card, not each of them.
  const roots = useMemo(() => outlineRoots(elements, selected), [elements, selected]);
  const hoverLabelId = hoverPick?.target.id;
  const labels = useMemo<ElementLabel[]>(() => {
    if (editingId || tool !== "select") return [];
    const out: ElementLabel[] = [];
    const add = (el: BoardElement | undefined, isSelected: boolean) => {
      if (!el || (el.type !== "frame" && el.type !== "rect")) return;
      const name = el.name?.trim() || suggestName(el, elements);
      if (!name) return;
      const box = elementBounds(el);
      out.push({ id: el.id, name, x: box.x, y: box.y, selected: isSelected });
    };
    for (const el of roots.slice(0, 4)) add(el, true);
    if (hoverLabelId && !selectedIds.includes(hoverLabelId)) {
      add(
        elements.find((el) => el.id === hoverLabelId),
        false,
      );
    }
    return out;
  }, [editingId, tool, roots, selectedIds, hoverLabelId, elements]);
  const frame = editingId ? null : selectionFrame(selected, camera.zoom);
  // A selected table or relation shows what it connects and dims the rest (only here on screen:
  // exports and previews draw everything as it is).
  const focus = useMemo(() => erFocus(elements, selectedIds), [elements, selectedIds]);
  const drawn = useDrawnArea(camera, viewport);

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
  // Trackpads send wheel events faster than the screen refreshes, so the camera goes out once
  // per frame.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    let frame = 0;
    /** The camera waiting for the next frame; a render in between mustn't drop it. */
    let pending: Camera | null = null;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = pending ?? latest.current.camera;
      const pixels =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      // Pinches send small deltas, so they get a stronger factor than a mouse wheel's notches.
      const factor = Math.exp(-pixels * (event.ctrlKey ? 0.01 : 0.0015));
      const rect = el.getBoundingClientRect();
      const next = zoomAt(current, current.zoom * factor, {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      });
      pending = next;
      latest.current.camera = next;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const camera = pending;
        pending = null;
        if (camera) latest.current.onCameraChange(camera);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(frame);
    };
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
    icon,
    hidden,
    toggles,
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
    setHoverHitId(null);
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
    const hit = tool === "select" ? topHit(ordered, p, 6 / camera.zoom) : undefined;
    if (tool === "select") setHoverCursor(cursorAt(p, hit));
    setHoverMindId(tool === "select" ? mindHoverAt(p, hit) : null);
    // Over a selection handle or a fold toggle the pointer is on that, not on the element.
    const onControl = tool === "select" && (handleAt(frame, p, camera.zoom) || toggleAt(p));
    setHoverHitId(hit && !onControl ? hit.id : null);
    setHoverDeep(event.ctrlKey || event.metaKey);
  };

  /** A toggle under `p`; the toggles past a node's edge belong to that node. */
  const toggleAt = (p: Point) => toggles.find((t) => distance(t, p) <= TOGGLE_RADIUS / camera.zoom);

  /** The mind map node whose toggle should show for a pointer at `p`. */
  const mindHoverAt = (p: Point, hit: BoardElement | undefined) => {
    // On its toggle the node stays hovered, so the toggle doesn't vanish on the way to it.
    const toggle = toggleAt(p);
    if (toggle) return toggle.id;
    return hit?.type === "mindnode" ? hit.id : null;
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
  const cursorAt = (p: Point, hit: BoardElement | undefined) => {
    const handle = handleAt(frame, p, camera.zoom);
    if (handle) return handleCursor(handle, frame?.rotation ?? 0);
    if (toggleAt(p)) return "pointer";
    if (!hit) return undefined;
    return hit.locked ? "default" : "move";
  };

  const onDoubleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (tool !== "select" || editingId) return;
    const p = toWorld(event);
    const hit = topHit(ordered, p, 6 / camera.zoom);
    if (!hit) {
      // Double-clicking empty canvas starts typing there.
      placeText("text", context, p);
      return;
    }
    // Inside a selected card or section: one level deeper, to the nested card or the element.
    const deeper = drillInto(elements, selectedIds, hit);
    if (deeper) {
      dispatch({ type: "select", ids: deeper });
    } else if (isTextual(hit) && !hit.locked) {
      dispatch({ type: "select", ids: [hit.id] });
      onStartEditing(hit.id, elements);
    } else if (
      renamable &&
      selectedIds.includes(hit.id) &&
      !hit.locked &&
      (hit.name?.trim() || isNameable(hit, elements))
    ) {
      // Already as deep as it goes: a named frame, section or card is renamed in place.
      setRenamingId(hit.id);
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
      onPointerLeave={() => {
        setHoverMindId(null);
        setHoverHitId(null);
      }}
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
        {grid && camera.zoom >= GRID_MIN_ZOOM && (
          <rect x="-8000" y="-8000" width="16000" height="16000" fill="url(#dot-grid)" />
        )}

        <ElementLayer
          ordered={ordered}
          editingId={editingId}
          erasing={overlay?.erasing}
          focus={focus}
          area={drawn.area}
          zoom={drawn.zoom}
        />

        <MindToggles toggles={toggles} zoom={camera.zoom} />

        {overlay?.snapTarget && (
          <SnapHighlight
            el={elements.find((el) => el.id === overlay.snapTarget)}
            zoom={camera.zoom}
          />
        )}

        {hoverBox && (
          <rect
            x={hoverBox.x}
            y={hoverBox.y}
            width={hoverBox.width}
            height={hoverBox.height}
            fill="none"
            stroke={SELECTION}
            strokeWidth={1.5 / camera.zoom}
            opacity={0.7}
            pointerEvents="none"
          />
        )}

        {roots.length > 1 &&
          roots.map((el) => {
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

        {labels.length > 0 && (
          <ElementLabels
            labels={labels}
            zoom={camera.zoom}
            renamingId={labels.some((l) => l.id === renamingId) ? renamingId : null}
            onSelect={(id) => dispatch({ type: "select", ids: unitIds(elements, id) })}
            onStopRename={() => setRenamingId(null)}
            {...(renamable && {
              onStartRename: (id: string) => setRenamingId(id),
              onRename: (id: string, name: string) =>
                dispatch({ type: "patch", patches: { [id]: { name: name.trim() || null } } }),
            })}
          />
        )}

        {overlay?.guides && <SnapGuidesView guides={overlay.guides} zoom={camera.zoom} />}

        {presenceBoardId && (
          <PresenceLayer boardId={presenceBoardId} elements={elements} zoom={camera.zoom} />
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

/** Whether `el` is text too small at `zoom` to read: it's drawn as bars instead. */
const greeked = (el: BoardElement, zoom: number) =>
  el.type === "text" && fontPx(el) * zoom < GREEK_BELOW_PX;

/** Text too small to read, as one faint bar per line (what Miro and Figma show zoomed out). */
const TextBars = memo(function TextBars({ el }: { el: BoardElement }) {
  const px = fontPx(el);
  const lineHeight = px * lineHeightOf(el);
  const lines = Math.min(12, Math.max(1, Math.round(el.height / lineHeight)));
  const bar = px * 0.6;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return (
    <g
      fill={displayColor(el.stroke)}
      opacity={0.3}
      transform={el.rotation ? `rotate(${el.rotation} ${cx} ${cy})` : undefined}
    >
      {Array.from({ length: lines }, (_, i) => (
        <rect
          key={i}
          x={el.x}
          y={el.y + i * lineHeight + (lineHeight - bar) / 2}
          width={i === lines - 1 && lines > 1 ? el.width * 0.65 : el.width}
          height={bar}
        />
      ))}
    </g>
  );
});

/**
 * The board's elements, bottom layer first: those in `area` (the view and a margin around it),
 * with text too small to read at `zoom` drawn as bars. Memoized apart from the camera, the hover
 * and the selection frame, so a pan or zoom frame doesn't walk the elements at all.
 */
const ElementLayer = memo(function ElementLayer({
  ordered,
  editingId,
  erasing,
  focus,
  area,
  zoom,
}: {
  ordered: BoardElement[];
  editingId: string | null;
  erasing: ReadonlySet<string> | undefined;
  focus: ReadonlySet<string> | null;
  /** Null draws everything. */
  area: Box | null;
  zoom: number;
}) {
  const below = useMemo(() => ordered.map((_, i) => backdropOf(ordered, i)), [ordered]);
  const shown = useMemo(
    () =>
      ordered.flatMap((el, i) => (!area || intersects(elementBounds(el), area) ? [{ el, i }] : [])),
    [ordered, area],
  );
  return (
    <>
      <MindBranches elements={ordered} />

      {shown.map(({ el, i }) => (
        <g
          key={el.id}
          data-id={el.id}
          opacity={erasing?.has(el.id) ? 0.25 : focus && !focus.has(el.id) ? 0.18 : undefined}
        >
          {greeked(el, zoom) && el.id !== editingId ? (
            <TextBars el={el} />
          ) : (
            <ElementShape el={el} hidden={el.id === editingId} below={below[i]} />
          )}
        </g>
      ))}

      {/* The focused relations again on top, so none hides behind a table. */}
      {focus &&
        ordered
          .filter((el) => el.type === "arrow" && focus.has(el.id))
          .map((el) => (
            <g key={`focus-${el.id}`} pointerEvents="none">
              <ElementShape el={el} />
            </g>
          ))}
    </>
  );
});

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

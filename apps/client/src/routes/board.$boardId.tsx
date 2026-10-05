import { type BoardElement, type BoardSummary, SVG_TYPE } from "@prism/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type RefObject, useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  fitSize,
  imageSize,
  isImageFile,
  isSvgFile,
  sanitizeSvg,
  uploadAsset,
} from "@/components/board/assets";
import { BoardCanvas } from "@/components/board/board-canvas";
import { boardReducer, initialBoardState, newElement } from "@/components/board/board-model";
import { boardElementsQuery, useBoardSaver } from "@/components/board/board-sync";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { BoardTopBar } from "@/components/board/board-top-bar";
import { type Camera, fitCamera, screenToWorld, stepZoom, zoomAt } from "@/components/board/camera";
import {
  cloneAt,
  cloneElements,
  parseElements,
  serializeElements,
} from "@/components/board/clipboard";
import { EmojiPicker } from "@/components/board/emoji-picker";
import { googleFontId, loadFont, loadFonts, weightOf } from "@/components/board/fonts";
import type { Point } from "@/components/board/geometry";
import { isTextual } from "@/components/board/gestures";
import { applicableChanges, PropertiesPanel } from "@/components/board/properties-panel";
import { ShortcutsDialog } from "@/components/board/shortcuts-dialog";
import { TextEditor } from "@/components/board/text-editor";
import { fitTextBox, resetMeasurements } from "@/components/board/text-layout";
import { TOOLS_BY_SHORTCUT, type ToolId } from "@/components/board/tools";
import { ErrorScreen } from "@/components/feedback/error-page";
import { NotFoundPage } from "@/components/feedback/not-found-page";
import { PrismLoader } from "@/components/feedback/prism-loader";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { requireSession } from "@/lib/auth-client";
import { isTyping } from "@/lib/keyboard";
import { boardQuery, useUpdateBoardStyle, workspaceQuery } from "@/lib/workspace";

export const Route = createFileRoute("/board/$boardId")({
  head: () => ({ meta: [{ title: "Board - Prism" }] }),
  beforeLoad: requireSession,
  component: BoardPage,
});

/** Top-bar buttons and keys zoom around the middle of the view; the wheel zooms toward the pointer. */
const CENTER = { x: 0, y: 0 };

/**
 * Text is measured on a canvas, which doesn't load web fonts by itself; load the fonts the
 * board's elements use first so the first layout is right. Gives up after 3s and measures with
 * what's there.
 */
async function loadBoardFonts(elements: BoardElement[]) {
  const used = elements.flatMap((el) =>
    el.font || el.fontWeight ? [[el.font ?? "sans", weightOf(el)] as const] : [],
  );
  await loadFonts(["sans", "caveat", "mono", ...used]);
  resetMeasurements();
  return true;
}

function BoardPage() {
  const { boardId } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const board = useQuery({
    ...boardQuery(boardId),
    // Switching boards from the project menu: show the name the workspace already has.
    placeholderData: () =>
      queryClient.getQueryData(workspaceQuery.queryKey)?.boards.find((b) => b.id === boardId),
  });
  const elements = useQuery(boardElementsQuery(boardId));
  const fonts = useQuery({
    queryKey: ["board-fonts", boardId],
    queryFn: () => loadBoardFonts(elements.data?.elements ?? []),
    enabled: Boolean(elements.data),
    staleTime: Infinity,
  });

  const notFound = [board.error, elements.error].some(
    (error) => error instanceof ApiError && error.status === 404,
  );
  if (notFound) return <NotFoundPage />;
  if (elements.error) {
    return (
      <ErrorScreen
        error={elements.error}
        onRetry={() => void elements.refetch()}
        onGoHome={() => void navigate({ to: "/dashboard" })}
      />
    );
  }
  if (!elements.data || fonts.isPending) {
    return <PrismLoader fullScreen label="Opening board" />;
  }
  return (
    <BoardEditor
      key={boardId}
      boardId={boardId}
      board={board.data}
      initial={elements.data.elements}
    />
  );
}

interface Notice {
  text: string;
  error?: boolean;
}

function BoardEditor({
  boardId,
  board,
  initial,
}: {
  boardId: string;
  board: BoardSummary | undefined;
  initial: BoardElement[];
}) {
  const [state, dispatch] = useReducer(boardReducer, initial, initialBoardState);
  const [tool, setTool] = useState<ToolId>("select");
  // Right/middle drag and held Space pan without switching tools; the toolbar shows Hand meanwhile.
  const [borrowingHand, setBorrowingHand] = useState(false);
  const [grid, setGrid] = useState(true);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; before: BoardElement[] } | null>(null);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const viewport = useRef<HTMLElement>(null);
  const size = useElementSize(viewport);
  const pointer = useRef<Point | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveStatus = useBoardSaver(boardId, initial, state.elements);
  const updateStyle = useUpdateBoardStyle(boardId);
  const customFonts = board?.customFonts;
  const selected = state.elements.filter((el) => state.selectedIds.includes(el.id));
  const editingEl = editing && state.elements.find((el) => el.id === editing.id);

  const zoomIn = () => setCamera((c) => zoomAt(c, stepZoom(c.zoom, 1), CENTER));
  const zoomOut = () => setCamera((c) => zoomAt(c, stepZoom(c.zoom, -1), CENTER));
  const zoomReset = () => setCamera((c) => zoomAt(c, 1, CENTER));

  // Event handlers attached once read the latest values from here.
  const latest = useRef({ state, camera, size, editing });
  useEffect(() => {
    latest.current = { state, camera, size, editing };
  });

  /** The world point in the middle of the view. */
  const viewCenter = useCallback((): Point => {
    const { camera: cam, size: box } = latest.current;
    return screenToWorld(cam, { x: box.width / 2, y: box.height / 2 }, box.width, box.height);
  }, []);
  /** Where pasted and uploaded things go: under the pointer, else the middle of the view. */
  const dropPoint = useCallback(() => pointer.current ?? viewCenter(), [viewCenter]);

  const showNotice = useCallback((next: Notice | null, timeout = 0) => {
    setNotice(next);
    if (timeout)
      setTimeout(() => setNotice((current) => (current === next ? null : current)), timeout);
  }, []);

  const startEditing = useCallback((id: string, before: BoardElement[]) => {
    setEditing({ id, before });
  }, []);

  const finishEditing = useCallback(() => {
    const current = latest.current.editing;
    if (!current) return;
    latest.current.editing = null;
    setEditing(null);
    dispatch({ type: "finishEdit", id: current.id, before: current.before });
  }, []);

  const toolDone = useCallback(() => setTool("select"), []);

  // The board's added Google fonts, so the font list can preview them.
  useEffect(() => {
    for (const family of customFonts ?? []) void loadFont(googleFontId(family));
  }, [customFonts]);

  // ── Images and SVGs ──────────────────────────────────────────────────────

  const addFiles = useCallback(
    async (files: File[], at: Point) => {
      const usable = files.filter((file) => isImageFile(file) || isSvgFile(file));
      if (usable.length === 0) {
        showNotice(
          { text: "Only PNG, JPEG, GIF, WebP and SVG files can go on the board.", error: true },
          4_000,
        );
        return;
      }
      showNotice({ text: usable.length > 1 ? `Uploading ${usable.length} files…` : "Uploading…" });
      const added: BoardElement[] = [];
      try {
        for (const [i, file] of usable.entries()) {
          const offset = i * 24;
          if (isSvgFile(file)) {
            const clean = sanitizeSvg(await file.text());
            if (!clean) throw new ApiError(`${file.name} isn't a valid SVG file.`, 400);
            const assetKey = await uploadAsset(
              boardId,
              new Blob([clean.markup], { type: SVG_TYPE }),
            );
            const box = fitSize(clean.width, clean.height);
            added.push(
              newElement("svg", [], {
                x: at.x - box.width / 2 + offset,
                y: at.y - box.height / 2 + offset,
                ...box,
                assetKey,
              }),
            );
          } else {
            const natural = await imageSize(file);
            const assetKey = await uploadAsset(boardId, file);
            const box = fitSize(natural.width, natural.height);
            added.push(
              newElement("image", [], {
                x: at.x - box.width / 2 + offset,
                y: at.y - box.height / 2 + offset,
                ...box,
                assetKey,
              }),
            );
          }
        }
        showNotice(null);
      } catch (error) {
        showNotice({ text: apiErrorMessage(error), error: true }, 5_000);
      }
      if (added.length > 0) dispatch({ type: "add", elements: added, select: true });
    },
    [boardId, showNotice],
  );

  const pickFile = (kind: "image" | "svg") => {
    const input = fileInput.current;
    if (!input) return;
    input.accept =
      kind === "svg" ? ".svg,image/svg+xml" : "image/png,image/jpeg,image/gif,image/webp";
    input.value = "";
    input.click();
  };

  /** Picks a tool. Image and SVG open the file picker instead of becoming the active tool. */
  const chooseTool = useCallback(
    (next: ToolId) => {
      if (next === "image" || next === "svg") {
        pickFile(next);
        return;
      }
      if (latest.current.editing) finishEditing();
      // Opening the Emoji tool starts with a fresh pick.
      if (next === "emoji") setEmoji(null);
      setTool(next);
    },
    [finishEditing],
  );

  // ── Clipboard (copy, cut, paste) ─────────────────────────────────────────

  useEffect(() => {
    const blocked = (target: EventTarget | null) =>
      isTyping(target) || Boolean(document.querySelector('[role="dialog"], [role="alertdialog"]'));

    const onCopy = (event: ClipboardEvent, cut = false) => {
      if (blocked(event.target)) return;
      const { state: current } = latest.current;
      const chosen = current.elements.filter((el) => current.selectedIds.includes(el.id));
      if (chosen.length === 0 || !event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", serializeElements(chosen));
      if (cut) dispatch({ type: "delete", ids: chosen.map((el) => el.id) });
    };
    const onCut = (event: ClipboardEvent) => onCopy(event, true);

    const onPaste = (event: ClipboardEvent) => {
      if (blocked(event.target) || !event.clipboardData) return;
      const at = dropPoint();
      const files = [...event.clipboardData.files];
      if (files.length > 0) {
        event.preventDefault();
        void addFiles(files, at);
        return;
      }
      const text = event.clipboardData.getData("text/plain");
      if (!text.trim()) return;
      event.preventDefault();
      const copied = parseElements(text);
      if (copied) {
        dispatch({ type: "add", elements: cloneAt(copied, at), select: true });
      } else if (/^\s*(<\?xml[\s\S]*?\?>\s*)?<svg[\s>]/i.test(text)) {
        void addFiles([new File([text], "pasted.svg", { type: SVG_TYPE })], at);
      } else {
        // Plain text becomes a text element.
        const el = fitTextBox(
          newElement("text", [], {
            x: at.x,
            y: at.y,
            width: 0,
            height: 0,
            text: text.slice(0, 20_000),
          }),
        );
        dispatch({
          type: "add",
          elements: [{ ...el, x: at.x - el.width / 2, y: at.y - el.height / 2 }],
          select: true,
        });
      }
    };

    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCut);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCut);
      window.removeEventListener("paste", onPaste);
    };
  }, [addFiles, dropPoint]);

  // ── Keyboard (tools.md §1, §4 and §5) ────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // While text is being edited every key belongs to the editor, wherever focus is.
      if (isTyping(event.target) || latest.current.editing) return;
      // A dialog (the shortcut list, a board dialog) takes the keys while it's open.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      const ids = state.selectedIds;

      // Ctrl +/−/0 would zoom the whole page; here they zoom the board.
      if (mod && (key === "=" || key === "+")) {
        event.preventDefault();
        setCamera((c) => zoomAt(c, stepZoom(c.zoom, 1), CENTER));
      } else if (mod && key === "-") {
        event.preventDefault();
        setCamera((c) => zoomAt(c, stepZoom(c.zoom, -1), CENTER));
      } else if (mod && key === "0") {
        event.preventDefault();
        setCamera((c) => zoomAt(c, 1, CENTER));
      } else if (event.shiftKey && !mod && !event.altKey && event.code === "Digit1") {
        // Shift+1 by key position, since the character it types depends on the layout.
        event.preventDefault();
        setCamera(fitCamera(state.elements, size.width, size.height));
      } else if (key === "?" && !mod) {
        event.preventDefault();
        setShortcutsOpen(true);
      } else if (mod && key === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (mod && key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (mod && key === "a") {
        event.preventDefault();
        dispatch({ type: "select", ids: state.elements.map((el) => el.id) });
      } else if (mod && key === "d") {
        event.preventDefault();
        const chosen = state.elements.filter((el) => ids.includes(el.id));
        if (chosen.length > 0) {
          dispatch({ type: "add", elements: cloneElements(chosen, 16, 16), select: true });
        }
      } else if ((key === "delete" || key === "backspace") && ids.length > 0) {
        event.preventDefault();
        dispatch({ type: "delete", ids });
      } else if (key === "escape") {
        dispatch({ type: "select", ids: [] });
        setTool("select");
      } else if (key === "enter" && ids.length === 1 && !mod) {
        const el = state.elements.find((e) => e.id === ids[0]);
        if (el && isTextual(el) && !el.locked) {
          event.preventDefault();
          startEditing(el.id, state.elements);
        }
      } else if (key.startsWith("arrow") && ids.length > 0 && !mod) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        const patches = Object.fromEntries(
          state.elements
            .filter((el) => ids.includes(el.id))
            .map((el) => [el.id, { x: el.x + dx, y: el.y + dy }]),
        );
        dispatch({ type: "patch", patches });
      } else if (!mod && !event.altKey) {
        const shortcutTool = TOOLS_BY_SHORTCUT.get(key);
        if (shortcutTool) chooseTool(shortcutTool);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.selectedIds, state.elements, size, chooseTool, startEditing]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <BoardTopBar
        board={board}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        saveStatus={saveStatus}
        grid={grid}
        onToggleGrid={() => setGrid((on) => !on)}
        zoom={camera.zoom}
        onZoomOut={zoomOut}
        onZoomIn={zoomIn}
        onZoomReset={zoomReset}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />

      <main ref={viewport} className="relative min-h-0 flex-1 overflow-hidden">
        <BoardCanvas
          state={state}
          dispatch={dispatch}
          tool={tool}
          grid={grid}
          camera={camera}
          editingId={editing?.id ?? null}
          emoji={emoji}
          onCameraChange={setCamera}
          onBorrowHand={setBorrowingHand}
          onStartEditing={startEditing}
          onFinishEditing={finishEditing}
          onToolDone={toolDone}
          onPointerWorld={(p) => {
            pointer.current = p;
          }}
          onDropFiles={(files, p) => void addFiles(files, p)}
        />

        {editingEl && (
          <TextEditor
            key={editingEl.id}
            el={editingEl}
            camera={camera}
            viewport={size}
            onChange={(element) => dispatch({ type: "previewElement", element })}
            onDone={finishEditing}
          />
        )}

        {state.elements.length === 0 && !editing && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-24 text-center text-sm text-muted-foreground">
            Pick a tool and start creating — or try the AI assistant
          </p>
        )}

        <BoardToolbar active={borrowingHand ? "hand" : tool} onSelect={chooseTool} />

        {tool === "emoji" && <EmojiPicker value={emoji} onPick={setEmoji} />}

        {selected.length > 0 && !editing && (
          <PropertiesPanel
            elements={selected}
            customColors={board?.customColors ?? []}
            customFonts={customFonts ?? []}
            onStyleChange={(style) =>
              updateStyle.mutate(style, {
                onError: (error) =>
                  showNotice({ text: apiErrorMessage(error), error: true }, 5_000),
              })
            }
            onChange={(changes) => {
              const patches: Record<string, Partial<BoardElement>> = {};
              for (const el of selected) {
                const kept = applicableChanges(el, changes);
                if (kept) patches[el.id] = kept;
              }
              dispatch({ type: "patch", patches });
            }}
            onLayer={(move) => dispatch({ type: "layer", ids: state.selectedIds, move })}
          />
        )}

        {notice && (
          <p
            role={notice.error ? "alert" : "status"}
            className={
              "absolute bottom-6 left-1/2 z-20 -translate-x-1/2 border px-4 py-2 text-sm " +
              (notice.error
                ? "border-coral bg-card text-ink"
                : "border-chrome bg-card text-foreground")
            }
          >
            {notice.text}
          </p>
        )}

        <input
          ref={fileInput}
          type="file"
          hidden
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            if (files.length > 0) void addFiles(files, viewCenter());
          }}
        />
      </main>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

/** The element's size, kept up to date as it resizes. */
function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

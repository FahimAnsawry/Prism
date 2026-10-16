import {
  type BoardElement,
  type BoardSummary,
  type ElementOp,
  type Peer,
  suggestName,
  SVG_TYPE,
} from "@prism/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  fitSize,
  imageSize,
  isImageFile,
  isSvgFile,
  sanitizeSvg,
  uploadAsset,
} from "@/components/board/assets";
import { AskAiBox } from "@/components/board/ask-ai-box";
import { BoardCanvas } from "@/components/board/board-canvas";
import {
  type BoardAction,
  boardReducer,
  initialBoardState,
  type LayerMove,
  newElement,
} from "@/components/board/board-model";
import {
  boardElementsQuery,
  fetchBoardElements,
  fetchBoardElementsAhead,
  reportCursor,
  reportSelection,
  useBoardRealtime,
  useBoardSaver,
} from "@/components/board/board-sync";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { BoardViewer } from "@/components/board/board-viewer";
import {
  type BoardMode,
  BoardTopBar,
  ModeMenu,
  ShareControl,
  type ViewTool,
} from "@/components/board/board-top-bar";
import {
  type Camera,
  fitCamera,
  saveCamera,
  savedCamera,
  screenToWorld,
  stepZoom,
  zoomAt,
} from "@/components/board/camera";
import {
  cloneAt,
  cloneElements,
  parseElements,
  serializeElements,
} from "@/components/board/clipboard";
import {
  type AlignMode,
  alignPatches,
  type DistributeAxis,
  distributePatches,
} from "@/components/board/align";
import { EmojiPicker } from "@/components/board/emoji-picker";
import { ErFocusDialog, ErFocusPanel } from "@/components/board/er-focus-dialog";
import { ExportMenu } from "@/components/board/export-menu";
import { inView } from "@/components/board/camera";
import { revealOps } from "@/components/board/remote-reveal";
import { IconPicker } from "@/components/board/icon-picker";
import { googleFontId, loadFont, loadFonts } from "@/components/board/fonts";
import type { Point } from "@/components/board/geometry";
import { isTextual } from "@/components/board/gestures";
import { selectionParent } from "@/components/board/selection";
import { applicableChanges, PropertiesPanel } from "@/components/board/properties-panel";
import { ShortcutsDialog } from "@/components/board/shortcuts-dialog";
import { TableDetails } from "@/components/board/table-details";
import { TextEditor } from "@/components/board/text-editor";
import {
  boardFontsReady,
  fitTextBox,
  loadBoardFontsToOpen,
  preloadBoardFonts,
} from "@/components/board/text-layout";
import { TOOLS_BY_SHORTCUT, type ToolId } from "@/components/board/tools";
import { useElementSize } from "@/components/board/use-element-size";
import { ShareDialog } from "@/components/share/share-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorScreen } from "@/components/feedback/error-page";
import { NotFoundPage } from "@/components/feedback/not-found-page";
import { PrismLoader } from "@/components/feedback/prism-loader";
import { boardEditsQuery, useMergeEdit, useRemoveEdit } from "@/lib/ai";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { requireSession } from "@/lib/auth-client";
import { isTyping } from "@/lib/keyboard";
import { allBoards, boardQuery, useUpdateBoardStyle, workspaceQuery } from "@/lib/workspace";

export const Route = createFileRoute("/board/$boardId")({
  head: () => ({ meta: [{ title: "Board - Prism" }] }),
  beforeLoad: requireSession,
  // The board starts loading alongside the page's code instead of after it. A hover over its link
  // already fetches the elements (and the code), so a click usually opens it at once.
  loader: ({ context: { queryClient }, params: { boardId }, preload }) => {
    // The fonts the board used last time load alongside its elements.
    preloadBoardFonts(boardId);
    if (preload) {
      fetchBoardElementsAhead(boardId);
      void loadFonts(["sans", "caveat", "mono"]);
      return;
    }
    const summary = boardQuery(boardId);
    // Cached data shows at once and the page refreshes it itself.
    if (!queryClient.getQueryData(summary.queryKey)) void queryClient.prefetchQuery(summary);
    void queryClient.prefetchQuery(boardElementsQuery(boardId));
    void loadFonts(["sans", "caveat", "mono"]);
  },
  component: BoardPage,
});

/** Top-bar buttons and keys zoom around the middle of the view; the wheel zooms toward the pointer. */
const CENTER = { x: 0, y: 0 };

/** What View mode lets the canvas do to the board: follow live changes and select, nothing else. */
const VIEW_ALLOWED = new Set<BoardAction["type"]>(["remote", "select"]);

/** View mode never opens the text editor. */
const ignoreEditing = () => {};

/** One empty list for every render, so memoized panels see no change. */
const NONE: string[] = [];

function BoardPage() {
  const { boardId } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const board = useQuery({
    ...boardQuery(boardId),
    // Switching boards from the project menu: show the name the workspace already has.
    placeholderData: () => {
      const workspace = queryClient.getQueryData(workspaceQuery.queryKey);
      return workspace && allBoards(workspace).find((b) => b.id === boardId);
    },
  });
  const elements = useQuery(boardElementsQuery(boardId));
  const fonts = useQuery({
    queryKey: ["board-fonts", boardId],
    queryFn: () => loadBoardFontsToOpen(elements.data?.elements ?? [], boardId),
    enabled: Boolean(elements.data),
    staleTime: Infinity,
  });

  const notFound = [board.error, elements.error].some(
    (error) => error instanceof ApiError && error.status === 404,
  );
  if (notFound) return <NotFoundPage />;
  const error = elements.error ?? (board.data ? null : board.error);
  if (error) {
    return (
      <ErrorScreen
        error={error}
        onRetry={() => void Promise.all([board.refetch(), elements.refetch()])}
        onGoHome={() => void navigate({ to: "/dashboard" })}
      />
    );
  }
  // Whether this tab edits or only views depends on the board's access, so it waits for it.
  // Fonts are waited for only when the board's text needs some that haven't loaded yet.
  if (
    !elements.data ||
    (fonts.isPending && !boardFontsReady(elements.data.elements)) ||
    !board.data
  ) {
    return <PrismLoader fullScreen label="Opening board" />;
  }
  /** The user was removed or got another role: reload what they may do (a 404 if nothing). */
  const reloadAccess = () => {
    void queryClient.invalidateQueries({ queryKey: boardQuery(boardId).queryKey });
    void queryClient.invalidateQueries({ queryKey: workspaceQuery.queryKey });
  };
  if (board.data.access === "viewer") {
    return (
      <BoardViewer
        key={`${boardId}:view`}
        boardId={boardId}
        initial={elements.data.elements}
        fetchElements={() => fetchBoardElements(boardId)}
        title={board.data.name}
        context={`Shared by ${board.data.ownerName}`}
        leading={
          <Link
            to="/dashboard"
            aria-label="Back to dashboard"
            className="flex size-8 items-center justify-center text-foreground transition-colors duration-150 ease-standard hover:bg-hover"
          >
            <ArrowLeft aria-hidden="true" className="size-[18px]" />
          </Link>
        }
        onRevoked={reloadAccess}
        onAccessChanged={reloadAccess}
      />
    );
  }
  return (
    <BoardEditor
      key={`${boardId}:edit`}
      boardId={boardId}
      board={board.data}
      initial={elements.data.elements}
      onAccessChanged={reloadAccess}
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
  onAccessChanged,
}: {
  boardId: string;
  board: BoardSummary | undefined;
  initial: BoardElement[];
  /** Removed from the board, or given another role. */
  onAccessChanged: () => void;
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
  const [icon, setIcon] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sharing, setSharing] = useState(false);
  /** Edit changes the board. View only looks (an ER diagram as its focus view). */
  const [mode, setMode] = useState<BoardMode>("edit");
  const [viewTool, setViewTool] = useState<ViewTool>("hand");
  /** The table whose focus view (ErFocusDialog) is open. */
  const [focusTable, setFocusTable] = useState<string | null>(null);
  const viewport = useRef<HTMLElement>(null);
  const size = useElementSize(viewport);
  const pointer = useRef<Point | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { status: saveStatus, receive, resync } = useBoardSaver(boardId, initial, state.elements);
  const updateStyle = useUpdateBoardStyle(boardId);
  const customFonts = board?.customFonts;
  // Memoized with the callbacks below: the editor renders on every pan and zoom frame, and the
  // panels it shows mustn't render with it.
  const selected = useMemo(
    () => state.elements.filter((el) => state.selectedIds.includes(el.id)),
    [state.elements, state.selectedIds],
  );
  const editingEl = editing && state.elements.find((el) => el.id === editing.id);
  /** The name the one selected frame or card gets while it has none of its own. */
  const suggestedName = useMemo(() => {
    const only = selected.length === 1 ? selected[0] : undefined;
    return only && !only.name ? (suggestName(only, state.elements) ?? undefined) : undefined;
  }, [selected, state.elements]);
  const viewing = mode === "view";
  /** Opens the Share dialog; only the owner gets it. */
  const onShare = board?.access === "owner" ? () => setSharing(true) : undefined;
  const hasTables = state.elements.some((el) => el.type === "table");
  /** The one selected table: its details card shows, and F opens its focus view. */
  const selectedTable =
    selected.length === 1 && selected[0]?.type === "table" ? selected[0] : undefined;
  /** The canvas in View mode may follow live changes and select, but never change the board. */
  const viewDispatch = useCallback((action: BoardAction) => {
    if (VIEW_ALLOWED.has(action.type)) dispatch(action);
  }, []);

  // ── Live sync and AI editors ─────────────────────────────────────────────

  // Event handlers attached once read the latest values from here.
  const latest = useRef({ state, camera, size, editing, viewing });
  useEffect(() => {
    latest.current = { state, camera, size, editing, viewing };
  });

  /** Applies ops saved elsewhere (another tab, an AI editor) as one undo step. */
  const applyRemote = useCallback(
    (ops: ElementOp[], staged?: Peer) => {
      const fresh = receive(ops);
      if (fresh.length === 0) return;
      if (staged) {
        // A whole screen an AI editor drew: shown being built, its cursor at work.
        reveals.current.add(
          revealOps({
            ops: fresh,
            peer: staged,
            dispatch,
            onStart: (created) => {
              const { camera: cam, size: box } = latest.current;
              const view = fitCamera(created, box.width, box.height);
              if (!inView(created, cam, box)) setCamera(view);
            },
          }),
        );
      } else {
        dispatch({ type: "remote", ops: fresh });
      }
      // Text an AI editor wrote may use fonts this tab hasn't loaded yet.
      for (const op of fresh) {
        const el = op.op === "create" ? op.element : op.op === "update" ? op.changes : null;
        if (el?.font)
          void loadFont(el.font, typeof el.fontWeight === "number" ? el.fontWeight : 400);
      }
    },
    [receive],
  );

  const edits = useQuery(boardEditsQuery(boardId));
  const mergeEdit = useMergeEdit(boardId);
  const removeEdit = useRemoveEdit(boardId);
  // Statuses show for unfinished requests, and for ones made or changed while the board is open.
  const [seenEdits, setSeenEdits] = useState<ReadonlySet<string>>(() => new Set());
  const recentEdits = useMemo(
    () =>
      (edits.data ?? []).filter(
        (r) =>
          r.status === "pending" ||
          r.status === "paused" ||
          r.status === "working" ||
          seenEdits.has(r.id),
      ),
    [edits.data, seenEdits],
  );

  /** The selection as last reported, re-sent after a reconnect. */
  const selection = useRef(state.selectedIds);
  useBoardRealtime(boardId, {
    onOps: applyRemote,
    onJoined: () => {
      reportSelection(boardId, selection.current);
      void edits.refetch();
      fetchBoardElements(boardId).then(
        (server) => {
          const fresh = resync(server);
          if (fresh.length > 0) dispatch({ type: "remote", ops: fresh });
        },
        (error: unknown) => console.warn("[Prism] Couldn't catch up with the board:", error),
      );
    },
    onEdit: (request) => {
      mergeEdit(request);
      setSeenEdits((ids) => (ids.has(request.id) ? ids : new Set(ids).add(request.id)));
    },
    onEditDeleted: removeEdit,
    onRevoked: onAccessChanged,
    onAccessChanged,
  });

  // AI editors read the selection (get_selection) from the server.
  useEffect(() => {
    selection.current = state.selectedIds;
    const timer = setTimeout(() => reportSelection(boardId, state.selectedIds), 150);
    return () => clearTimeout(timer);
  }, [boardId, state.selectedIds]);

  // The board opens where it was last left in this browser, else framed on its content (an empty
  // one with the origin, where new content goes, in the middle). That needs the viewport's size,
  // known once it's measured before first paint.
  const framed = useRef(false);
  useLayoutEffect(() => {
    if (framed.current || size.width <= 0 || size.height <= 0) return;
    framed.current = true;
    setCamera(savedCamera(boardId) ?? fitCamera(state.elements, size.width, size.height));
  }, [boardId, size.width, size.height, state.elements]);

  useEffect(() => {
    if (!framed.current) return;
    const timer = setTimeout(() => saveCamera(boardId, camera), 400);
    return () => clearTimeout(timer);
  }, [boardId, camera]);

  const zoomIn = () => setCamera((c) => zoomAt(c, stepZoom(c.zoom, 1), CENTER));
  const zoomOut = () => setCamera((c) => zoomAt(c, stepZoom(c.zoom, -1), CENTER));
  const zoomReset = () => setCamera((c) => zoomAt(c, 1, CENTER));

  // Reveals of an AI editor's big batches in progress, stopped when the board closes.
  const reveals = useRef(new Set<() => void>());
  useEffect(() => {
    const running = reveals.current;
    return () => {
      for (const stop of running) stop();
      running.clear();
    };
  }, []);

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

  // A mind map node just added with Tab / Enter opens for typing (once per request).
  const [editRequest, setEditRequest] = useState(state.editRequest);
  if (state.editRequest !== editRequest) {
    setEditRequest(state.editRequest);
    if (state.editRequest) {
      setEditing({ id: state.editRequest.id, before: state.editRequest.before });
    }
  }

  const finishEditing = useCallback(() => {
    const current = latest.current.editing;
    if (!current) return;
    latest.current.editing = null;
    setEditing(null);
    dispatch({ type: "finishEdit", id: current.id, before: current.before });
  }, []);

  const toolDone = useCallback(() => setTool("select"), []);

  /** Edit ↔ View. Going to View closes whatever is open for editing; the board's state stays. */
  const changeMode = useCallback(
    (next: BoardMode) => {
      if (next === "view") {
        if (latest.current.editing) finishEditing();
        setFocusTable(null);
        setTool("select");
        setEmoji(null);
        setIcon(null);
      }
      setMode(next);
    },
    [finishEditing],
  );

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

  // ── Properties panel ─────────────────────────────────────────────────────

  const tidyMind = useCallback((id: string) => dispatch({ type: "mindTidy", id }), []);

  const { mutate: mutateStyle } = updateStyle;
  const changeStyle = useCallback(
    (style: Parameters<typeof mutateStyle>[0]) =>
      mutateStyle(style, {
        onError: (error) => showNotice({ text: apiErrorMessage(error), error: true }, 5_000),
      }),
    [mutateStyle, showNotice],
  );

  const changeSelected = useCallback(
    (changes: Partial<BoardElement>) => {
      const patches: Record<string, Partial<BoardElement>> = {};
      for (const el of selected) {
        const kept = applicableChanges(el, changes);
        if (kept) patches[el.id] = kept;
      }
      dispatch({ type: "patch", patches });
    },
    [selected],
  );

  /** Lines the selection up or spreads it out: one patch, so one undo step. */
  const arrangeSelected = useCallback((patches: Record<string, Partial<BoardElement>>) => {
    if (Object.keys(patches).length > 0) dispatch({ type: "patch", patches });
  }, []);
  const alignSelected = useCallback(
    (mode: AlignMode) => arrangeSelected(alignPatches(selected, mode)),
    [selected, arrangeSelected],
  );
  const distributeSelected = useCallback(
    (axis: DistributeAxis) => arrangeSelected(distributePatches(selected, axis)),
    [selected, arrangeSelected],
  );

  const layerSelected = useCallback(
    (move: LayerMove) => dispatch({ type: "layer", ids: state.selectedIds, move }),
    [state.selectedIds],
  );

  const uploadImage = useCallback(
    async (file: File) => {
      if (!isImageFile(file)) {
        showNotice({ text: "Pick a PNG, JPEG, GIF or WebP image.", error: true }, 4_000);
        return null;
      }
      showNotice({ text: "Uploading…" });
      try {
        const assetKey = await uploadAsset(boardId, file);
        showNotice(null);
        return assetKey;
      } catch (error) {
        showNotice({ text: apiErrorMessage(error), error: true }, 5_000);
        return null;
      }
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
      // Opening the Emoji or Icon tool starts with a fresh pick.
      if (next === "emoji") setEmoji(null);
      if (next === "icon") setIcon(null);
      setTool(next);
    },
    [finishEditing],
  );

  // ── Clipboard (copy, cut, paste) ─────────────────────────────────────────

  useEffect(() => {
    const blocked = (target: EventTarget | null) =>
      isTyping(target) || Boolean(document.querySelector('[role="dialog"], [role="alertdialog"]'));

    const onCopy = (event: ClipboardEvent, cut = false) => {
      // Text the user selected on the page (an error message, a status line) copies as itself.
      if (blocked(event.target) || window.getSelection()?.toString()) return;
      const { state: current, viewing: readOnly } = latest.current;
      // View mode can copy but not cut.
      if (cut && readOnly) return;
      const chosen = current.elements.filter((el) => current.selectedIds.includes(el.id));
      if (chosen.length === 0 || !event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", serializeElements(chosen));
      if (cut) dispatch({ type: "delete", ids: chosen.map((el) => el.id) });
    };
    const onCut = (event: ClipboardEvent) => onCopy(event, true);

    const onPaste = (event: ClipboardEvent) => {
      if (blocked(event.target) || !event.clipboardData || latest.current.viewing) return;
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

      // View mode: look around only. Every other key is left alone.
      if (viewing) {
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
          event.preventDefault();
          setCamera(fitCamera(state.elements, size.width, size.height));
        } else if (key === "?" && !mod) {
          event.preventDefault();
          setShortcutsOpen(true);
        } else if (key === "escape") {
          dispatch({ type: "select", ids: selectionParent(state.elements, ids) ?? [] });
        } else if (!hasTables && !mod && !event.altKey && (key === "v" || key === "h")) {
          setViewTool(key === "v" ? "select" : "hand");
        }
        return;
      }

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
      } else if (key === "f" && !mod && !event.altKey && !event.shiftKey && selectedTable) {
        // F: the focus view of the one selected table.
        event.preventDefault();
        setFocusTable(selectedTable.id);
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
        // Inside a card or section you drilled into, Esc goes up a level before it deselects.
        const parent = tool === "select" ? selectionParent(state.elements, ids) : null;
        dispatch({ type: "select", ids: parent ?? [] });
        if (!parent) setTool("select");
      } else if ((key === "enter" || key === "tab" || key === "f2") && ids.length === 1 && !mod) {
        const el = state.elements.find((e) => e.id === ids[0]);
        if (!el || el.locked) return;
        if (el.type === "mindnode" && key !== "f2") {
          // Mind map: Tab adds a child, Enter a sibling (a child of a central topic).
          event.preventDefault();
          dispatch({ type: "mindAdd", from: el.id, sibling: key === "enter" });
        } else if (isTextual(el) && key !== "tab") {
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
  }, [
    state.selectedIds,
    state.elements,
    tool,
    size,
    chooseTool,
    startEditing,
    selectedTable,
    viewing,
    hasTables,
  ]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* An ER diagram in View mode has one bar: the focus view's header carries these controls. */}
      {!(viewing && hasTables) && (
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
          onShare={onShare}
          mode={mode}
          onModeChange={changeMode}
          viewTool={hasTables ? undefined : viewTool}
          onViewTool={setViewTool}
          elements={state.elements}
          selectedIds={state.selectedIds}
        />
      )}

      <main ref={viewport} className="relative min-h-0 flex-1 overflow-hidden">
        <BoardCanvas
          state={state}
          dispatch={viewing ? viewDispatch : dispatch}
          tool={viewing ? viewTool : tool}
          grid={grid}
          camera={camera}
          editingId={editing?.id ?? null}
          emoji={emoji}
          icon={icon}
          onCameraChange={setCamera}
          onBorrowHand={setBorrowingHand}
          onStartEditing={viewing ? ignoreEditing : startEditing}
          onFinishEditing={finishEditing}
          onToolDone={toolDone}
          onPointerWorld={(p) => {
            pointer.current = p;
            reportCursor(boardId, p);
          }}
          onDropFiles={(files, p) => {
            if (!viewing) void addFiles(files, p);
          }}
          renamable={!viewing}
          presenceBoardId={boardId}
          viewport={size}
        />

        {/* An ER diagram in View mode: every table first, a click narrows to one. */}
        {viewing && hasTables && (
          <div className="absolute inset-0 z-10 flex flex-col bg-popover">
            <ErFocusPanel
              elements={state.elements}
              eyebrow={board?.name}
              leading={
                <Link
                  to="/dashboard"
                  aria-label="Back to dashboard"
                  className="flex size-8 shrink-0 items-center justify-center text-foreground transition-colors duration-150 ease-standard hover:bg-hover"
                >
                  <ArrowLeft aria-hidden="true" className="size-[18px]" />
                </Link>
              }
              trailing={
                <div className="flex items-center gap-3">
                  <ModeMenu mode={mode} onChange={changeMode} />
                  <ThemeToggle className="size-9 border border-chrome bg-card" />
                  <ExportMenu
                    elements={state.elements}
                    selectedIds={state.selectedIds}
                    boardName={board?.name ?? "Board"}
                    className="hidden sm:flex"
                  />
                  <ShareControl board={board} onShare={onShare} />
                </div>
              }
            />
          </div>
        )}

        {editingEl && !viewing && (
          <TextEditor
            key={editingEl.id}
            el={editingEl}
            camera={camera}
            viewport={size}
            onChange={(element) => dispatch({ type: "previewElement", element })}
            onDone={finishEditing}
            onAddChild={() => dispatch({ type: "mindAdd", from: editingEl.id, sibling: false })}
          />
        )}

        {state.elements.length === 0 && !editing && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-24 text-center text-sm text-muted-foreground">
            {viewing
              ? "This board is empty."
              : "Pick a tool and start creating — or try the AI assistant"}
          </p>
        )}

        {!viewing && (
          <>
            <BoardToolbar active={borrowingHand ? "hand" : tool} onSelect={chooseTool} />

            {tool === "emoji" && <EmojiPicker value={emoji} onPick={setEmoji} />}
            {tool === "icon" && <IconPicker value={icon} onPick={setIcon} />}
          </>
        )}

        {/* Beside the properties panel, which is open whenever a table is selected. While the
            table's focus view is open its details show there instead. */}
        {selectedTable && !viewing && !editing && !focusTable && (
          <aside
            aria-label={`${selectedTable.table?.name ?? "Table"} details`}
            className="absolute top-6 right-[18rem] z-20 max-h-[calc(100%-2.5rem)] w-64 overflow-y-auto border border-chrome bg-card shadow-lg md:right-[18.5rem]"
          >
            <TableDetails
              table={selectedTable}
              board={state.elements}
              onSelect={(ids) => dispatch({ type: "select", ids })}
              onOpenFocus={() => setFocusTable(selectedTable.id)}
            />
          </aside>
        )}

        {selected.length > 0 && !editing && !viewing && (
          <PropertiesPanel
            elements={selected}
            onTidy={tidyMind}
            customColors={board?.customColors ?? NONE}
            customFonts={customFonts ?? NONE}
            onStyleChange={changeStyle}
            onChange={changeSelected}
            onLayer={layerSelected}
            onUploadImage={uploadImage}
            onAlign={alignSelected}
            onDistribute={distributeSelected}
            suggestedName={suggestedName}
          />
        )}

        {!editing && !viewing && (
          <AskAiBox boardId={boardId} selectedIds={state.selectedIds} requests={recentEdits} />
        )}

        {notice && (
          <p
            role={notice.error ? "alert" : "status"}
            className={
              "absolute top-6 left-1/2 z-20 -translate-x-1/2 border px-4 py-2 text-sm " +
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
      <ErFocusDialog
        tableId={viewing ? null : focusTable}
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
      {board?.access === "owner" && (
        <ShareDialog
          kind="board"
          id={boardId}
          name={board.name}
          open={sharing}
          onOpenChange={setSharing}
        />
      )}
    </div>
  );
}

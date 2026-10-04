import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useReducer, useState } from "react";
import { BoardCanvas, type Camera } from "@/components/board/board-canvas";
import { boardReducer, initialBoardState } from "@/components/board/board-model";
import { BoardToolbar } from "@/components/board/board-toolbar";
import { BoardTopBar } from "@/components/board/board-top-bar";
import { PropertiesPanel } from "@/components/board/properties-panel";
import { TOOLS_BY_SHORTCUT, type ToolId } from "@/components/board/tools";

export const Route = createFileRoute("/board")({
  head: () => ({ meta: [{ title: "Test Board · Prism" }] }),
  component: BoardPage,
});

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 10) / 10));

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function BoardPage() {
  const [state, dispatch] = useReducer(boardReducer, initialBoardState);
  const [tool, setTool] = useState<ToolId>("select");
  const [grid, setGrid] = useState(true);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const selected = state.elements.find((el) => el.id === state.selectedId);

  // Shortcuts from tools.md §1 and §4.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && key === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (mod && key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if ((key === "delete" || key === "backspace") && state.selectedId) {
        event.preventDefault();
        dispatch({ type: "delete", id: state.selectedId });
      } else if (key === "escape") {
        dispatch({ type: "select", id: null });
      } else if (!mod && !event.altKey) {
        const shortcutTool = TOOLS_BY_SHORTCUT.get(key);
        if (shortcutTool) setTool(shortcutTool);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.selectedId]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <BoardTopBar
        name="Test Board"
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        grid={grid}
        onToggleGrid={() => setGrid((on) => !on)}
        zoom={camera.zoom}
        onZoomOut={() => setCamera((c) => ({ ...c, zoom: clampZoom(c.zoom - ZOOM_STEP) }))}
        onZoomIn={() => setCamera((c) => ({ ...c, zoom: clampZoom(c.zoom + ZOOM_STEP) }))}
        onZoomReset={() => setCamera((c) => ({ ...c, zoom: 1 }))}
      />

      <main className="relative min-h-0 flex-1">
        <BoardCanvas
          elements={state.elements}
          selectedId={state.selectedId}
          tool={tool}
          grid={grid}
          camera={camera}
          onCameraChange={setCamera}
          onSelect={(id) => dispatch({ type: "select", id })}
        />

        {state.elements.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-24 text-center text-sm text-muted-foreground">
            Pick a tool and start creating — or try the AI assistant
          </p>
        )}

        <BoardToolbar active={tool} onSelect={setTool} />

        {selected && (
          <PropertiesPanel
            el={selected}
            onChange={(changes) => dispatch({ type: "update", id: selected.id, changes })}
            onLayer={(move) => dispatch({ type: "layer", id: selected.id, move })}
          />
        )}
      </main>
    </div>
  );
}

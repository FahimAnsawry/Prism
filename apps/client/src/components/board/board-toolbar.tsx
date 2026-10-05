import { ChevronUp } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isTyping } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { TOOL_GROUPS, type ToolId } from "./tools";

const COLLAPSED_KEY = "prism:toolbar-collapsed";
const TOOLS = TOOL_GROUPS.flat();

/** The collapsed choice is kept in this browser; storage can be unavailable. */
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function storeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    // Not critical: the choice lasts for this visit only.
  }
}

/** A soft ease-out: quick start, long settle. Used for the fold and the tools sliding in. */
const EASE_OUT = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/** A row that animates its height between 0 and its content (grid-template-rows 0fr ↔ 1fr). */
const foldClass = cn(
  "grid min-h-0 transition-[grid-template-rows] duration-300 motion-reduce:transition-none",
  EASE_OUT,
);

/** Each tool fades and slides in, one after another, when the rail opens; all leave at once. */
const STAGGER_MS = 14;
const enterClass = cn(
  "transition-[opacity,translate,scale] duration-300 motion-reduce:transition-none",
  EASE_OUT,
);

/**
 * Floating tool rail on the left of the canvas, 24px below the top bar. Ctrl+B or the chevron folds
 * it down to the active tool alone; tool shortcuts keep working either way.
 */
export function BoardToolbar({
  active,
  onSelect,
}: {
  active: ToolId;
  onSelect: (tool: ToolId) => void;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const highlight = useRef<HTMLDivElement>(null);
  // Each tool's slot in the list. Its offsetTop ignores the slot's own fold-in transform.
  const slots = useRef(new Map<ToolId, HTMLDivElement>());
  const activeTool = TOOLS.find((tool) => tool.id === active);

  const toggle = () => {
    setCollapsed(!collapsed);
    storeCollapsed(!collapsed);
  };

  // Ctrl+B (⌘B) folds or opens the rail, unless the user is typing or a dialog is open.
  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "b" || event.repeat || isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // One green block behind the buttons slides to the active tool, whether it was clicked or picked
  // by shortcut. Its first placement doesn't animate: `data-ready` turns the transition on after.
  useLayoutEffect(() => {
    const block = highlight.current;
    const slot = slots.current.get(active);
    if (!block || !slot) return;
    block.style.transform = `translateY(${slot.offsetTop}px)`;
    if (block.dataset.ready === undefined) {
      const frame = requestAnimationFrame(() => {
        block.dataset.ready = "";
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [active]);

  const toggleLabel = collapsed ? "Show all tools" : "Collapse tools";
  let index = 0;

  return (
    <div
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      className="absolute top-6 left-4 z-10 flex max-h-[calc(100%-2.5rem)] w-12 flex-col border border-chrome bg-card p-[3px]"
    >
      {/* Collapsed: just the active tool, which opens the rail again. */}
      <div className={cn(foldClass, collapsed ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden" inert={!collapsed}>
          {activeTool && (
            <button
              type="button"
              aria-label={`${activeTool.label}: show all tools (Ctrl+B)`}
              title={`${activeTool.label} · show all tools · Ctrl+B`}
              onClick={toggle}
              className={cn(
                enterClass,
                "group flex size-10 items-center justify-center bg-brand text-onyx",
                collapsed ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
            >
              <activeTool.icon
                aria-hidden="true"
                className="size-[18px] transition-transform duration-150 ease-standard group-hover:scale-110 group-active:scale-90 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-active:scale-100"
              />
            </button>
          )}
        </div>
      </div>

      <div className={cn(foldClass, "min-h-0", collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]")}>
        <div
          inert={collapsed}
          className="relative flex min-h-0 flex-col gap-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none]"
        >
          <div
            ref={highlight}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-0 left-0 size-10 bg-brand transition-opacity duration-200 data-ready:transition-[transform,opacity] data-ready:duration-200 data-ready:ease-standard motion-reduce:transition-none",
              collapsed && "opacity-0",
            )}
          />
          {TOOL_GROUPS.map((group, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <div
                  aria-hidden="true"
                  className={cn(
                    enterClass,
                    "mx-1 mt-1 -mb-px h-px shrink-0 bg-divider",
                    collapsed && "opacity-0",
                  )}
                />
              )}
              {group.map((tool) => {
                const Icon = tool.icon;
                const isActive = tool.id === active;
                const delay = collapsed ? 0 : index++ * STAGGER_MS;
                return (
                  // The wrapper carries the fold-in motion, so hover and active colors stay instant.
                  <div
                    key={tool.id}
                    ref={(slot) => {
                      if (slot) slots.current.set(tool.id, slot);
                      else slots.current.delete(tool.id);
                    }}
                    className={cn(
                      enterClass,
                      "shrink-0",
                      collapsed ? "-translate-y-2 scale-90 opacity-0" : "opacity-100",
                    )}
                    style={{ transitionDelay: `${delay}ms` }}
                  >
                    <button
                      type="button"
                      aria-label={`${tool.label} (${tool.shortcut})`}
                      title={`${tool.label} · ${tool.shortcut}`}
                      aria-pressed={isActive}
                      onClick={() => onSelect(tool.id)}
                      className={cn(
                        "group relative flex size-10 items-center justify-center transition-colors duration-200 ease-standard motion-reduce:transition-none",
                        isActive ? "text-onyx" : "text-foreground hover:bg-background",
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "size-[18px] transition-transform duration-150 ease-standard group-active:scale-90 motion-reduce:transition-none motion-reduce:group-active:scale-100",
                          !isActive && "group-hover:scale-110 motion-reduce:group-hover:scale-100",
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={`${toggleLabel} (Ctrl+B)`}
        title={`${toggleLabel} · Ctrl+B`}
        onClick={toggle}
        className="mt-1 flex h-6 w-10 shrink-0 items-center justify-center border-t border-divider text-muted-foreground transition-colors duration-150 ease-standard hover:bg-background hover:text-ink"
      >
        <ChevronUp
          aria-hidden="true"
          className={cn(
            "size-3.5 transition-transform duration-300 motion-reduce:transition-none",
            EASE_OUT,
            collapsed && "rotate-180",
          )}
        />
      </button>
    </div>
  );
}

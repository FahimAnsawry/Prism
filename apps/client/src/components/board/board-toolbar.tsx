import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { Fragment, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TurningChevron } from "@/components/motion-parts";
import { isTyping } from "@/lib/keyboard";
import { EASE_SPRING_OUT, EASE_STANDARD } from "@/lib/motion";
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
const FOLD = { duration: 0.3, ease: EASE_SPRING_OUT };

/** A row animates its height between 0 and its content (grid-template-rows 0fr ↔ 1fr). */
const rows = (open: boolean) => ({ gridTemplateRows: open ? "1fr" : "0fr" });

/** Each tool fades and slides in, one after another, when the rail opens; all leave at once. */
const STAGGER_MS = 14;

const PRESS = { duration: 0.15, ease: EASE_STANDARD };

/**
 * A tool's icon: it grows a little under the pointer (`hover`, unless the tool is the active
 * one) and shrinks while pressed. The button it sits in supplies the `hover` and `tap` states.
 * Reduced-motion users get a still icon.
 */
function ToolIcon({
  icon: Icon,
  grows = true,
}: {
  icon: (typeof TOOLS)[number]["icon"];
  grows?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className="inline-flex"
      variants={reduced ? undefined : { hover: grows ? { scale: 1.1 } : {}, tap: { scale: 0.9 } }}
      transition={PRESS}
    >
      <Icon aria-hidden="true" className="size-[18px]" />
    </motion.span>
  );
}

/**
 * Floating tool rail on the left of the canvas, 24px below the top bar. Ctrl+B or the chevron folds
 * it down to the active tool alone; tool shortcuts keep working either way.
 */
// Memoized: the board editor re-renders on every pan and zoom frame.
export const BoardToolbar = memo(BoardToolbarView);

function BoardToolbarView({
  active,
  onSelect,
}: {
  active: ToolId;
  onSelect: (tool: ToolId) => void;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const highlightY = useMotionValue(0);
  const highlightPlaced = useRef(false);
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
  // by shortcut. Its first placement doesn't animate.
  useLayoutEffect(() => {
    const slot = slots.current.get(active);
    if (!slot) return;
    if (!highlightPlaced.current) {
      highlightPlaced.current = true;
      highlightY.set(slot.offsetTop);
      return;
    }
    const slide = animate(highlightY, slot.offsetTop, { duration: 0.2, ease: EASE_STANDARD });
    return () => slide.stop();
  }, [active, highlightY]);

  const toggleLabel = collapsed ? "Show all tools" : "Collapse tools";
  let index = 0;

  return (
    <div
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      className="absolute top-6 left-4 z-10 flex max-h-[calc(100%-2.5rem)] w-12 flex-col border border-chrome bg-card p-[3px] shadow-sm"
    >
      {/* Collapsed: just the active tool, which opens the rail again. */}
      <motion.div
        className="grid min-h-0"
        initial={false}
        animate={rows(collapsed)}
        transition={FOLD}
      >
        <div className="min-h-0 overflow-hidden" inert={!collapsed}>
          {activeTool && (
            <motion.button
              type="button"
              aria-label={`${activeTool.label}: show all tools (Ctrl+B)`}
              title={`${activeTool.label} · show all tools · Ctrl+B`}
              onClick={toggle}
              className="flex size-10 items-center justify-center bg-brand text-onyx"
              initial={false}
              animate={{ scale: collapsed ? 1 : 0.75, opacity: collapsed ? 1 : 0 }}
              transition={FOLD}
              whileHover="hover"
              whileTap="tap"
            >
              <ToolIcon icon={activeTool.icon} />
            </motion.button>
          )}
        </div>
      </motion.div>

      <motion.div
        className="grid min-h-0"
        initial={false}
        animate={rows(!collapsed)}
        transition={FOLD}
      >
        <div
          inert={collapsed}
          className="relative flex min-h-0 flex-col gap-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none]"
        >
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 size-10 bg-brand"
            style={{ y: highlightY }}
            initial={false}
            animate={{ opacity: collapsed ? 0 : 1 }}
            transition={{ duration: 0.2, ease: EASE_STANDARD }}
          />
          {TOOL_GROUPS.map((group, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <motion.div
                  aria-hidden="true"
                  className="mx-1 mt-1 -mb-px h-px shrink-0 bg-divider"
                  initial={false}
                  animate={{ opacity: collapsed ? 0 : 1 }}
                  transition={FOLD}
                />
              )}
              {group.map((tool) => {
                const isActive = tool.id === active;
                const delay = collapsed ? 0 : index++ * STAGGER_MS;
                return (
                  // The wrapper carries the fold-in motion, so hover and active colors stay instant.
                  <motion.div
                    key={tool.id}
                    ref={(slot) => {
                      if (slot) slots.current.set(tool.id, slot);
                      else slots.current.delete(tool.id);
                    }}
                    className="shrink-0"
                    initial={false}
                    animate={
                      collapsed ? { opacity: 0, y: -8, scale: 0.9 } : { opacity: 1, y: 0, scale: 1 }
                    }
                    transition={{ ...FOLD, delay: delay / 1000 }}
                  >
                    <motion.button
                      type="button"
                      aria-label={`${tool.label} (${tool.shortcut})`}
                      title={`${tool.label} · ${tool.shortcut}`}
                      aria-pressed={isActive}
                      onClick={() => onSelect(tool.id)}
                      className={cn(
                        "relative flex size-10 items-center justify-center transition-colors duration-200 ease-standard motion-reduce:transition-none",
                        isActive ? "text-onyx" : "text-foreground hover:bg-hover",
                      )}
                      whileHover="hover"
                      whileTap="tap"
                    >
                      <ToolIcon icon={tool.icon} grows={!isActive} />
                    </motion.button>
                  </motion.div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </motion.div>

      <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={`${toggleLabel} (Ctrl+B)`}
        title={`${toggleLabel} · Ctrl+B`}
        onClick={toggle}
        className="mt-1 flex h-6 w-10 shrink-0 items-center justify-center border-t border-divider text-muted-foreground transition-colors duration-150 ease-standard hover:bg-hover hover:text-ink"
      >
        <TurningChevron
          up
          turned={collapsed}
          seconds={0.3}
          ease={EASE_SPRING_OUT}
          className="size-3.5"
        />
      </button>
    </div>
  );
}

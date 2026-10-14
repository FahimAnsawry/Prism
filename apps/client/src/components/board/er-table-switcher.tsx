import { Combobox } from "@base-ui/react/combobox";
import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type RefObject } from "react";
import { popupMotion, usePopupExit } from "@/components/popup-motion";
import type { BoardElement } from "./board-model";
import { erFocus, isRelation } from "./geometry";

// The focus view's "Jump to table" search: every table on the board, the ones related to the
// focused table first, so any table is one search away without leaving the focus view.

interface TableItem {
  id: string;
  label: string;
  /** How many relations it takes part in. */
  relations: number;
}

interface TableGroup {
  value: string;
  items: TableItem[];
}

export function TableSwitcher({
  elements,
  currentId,
  triggerRef,
  onPick,
}: {
  elements: BoardElement[];
  /** The focused table: left out of the list, its relations listed first. */
  currentId: string;
  /** The button that opens the search: "/" and Ctrl+K press it. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  onPick: (id: string) => void;
}) {
  const groups = tableGroups(elements, currentId);
  const [open, setOpen] = useState(false);
  const { actionsRef, onExitComplete } = usePopupExit(open);
  return (
    <Combobox.Root<TableItem>
      open={open}
      onOpenChange={setOpen}
      actionsRef={actionsRef}
      items={groups}
      value={null}
      onValueChange={(item) => {
        if (item) onPick(item.id);
      }}
      itemToStringLabel={(item) => item.label}
      autoHighlight
    >
      <Combobox.Trigger
        ref={triggerRef}
        aria-label="Jump to table"
        title="Jump to table · /"
        className="flex h-8 w-56 items-center gap-2 border border-chrome bg-background pr-1.5 pl-2.5 text-xs text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink data-popup-open:text-ink"
      >
        <Search aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">Jump to table…</span>
        <kbd className="flex h-5 min-w-5 items-center justify-center border border-divider bg-card px-1 font-mono text-3xs">
          /
        </kbd>
      </Combobox.Trigger>
      <AnimatePresence>
        {open && (
          <Combobox.Portal keepMounted>
            <Combobox.Positioner align="end" sideOffset={6} className="z-[60] outline-none">
              <Combobox.Popup
                aria-label="Jump to table"
                className="w-80 max-w-[var(--available-width)] origin-[var(--transform-origin)] border border-input bg-popover shadow-lg"
                render={<motion.div {...popupMotion} onAnimationComplete={onExitComplete} />}
              >
                <div className="flex items-center gap-2 border-b border-divider px-3">
                  <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <Combobox.Input
                    // Opened by a key, nothing else moves focus into the popup: the box takes it as
                    // it mounts (a frame later, after the dialog's own focus handling).
                    ref={(node) => {
                      if (node) requestAnimationFrame(() => node.focus());
                    }}
                    placeholder="Search tables"
                    className="h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <Combobox.Empty>
                  <p className="px-3 py-4 text-xs text-muted-foreground">No tables match.</p>
                </Combobox.Empty>
                <Combobox.List className="max-h-[min(22rem,calc(var(--available-height)-3rem))] scroll-py-1 overflow-y-auto overscroll-contain py-1 empty:p-0">
                  {(group: TableGroup) => (
                    <Combobox.Group
                      key={group.value}
                      items={group.items}
                      className="pb-1 last:pb-0"
                    >
                      <Combobox.GroupLabel className="px-3 pt-2 pb-1 font-mono text-3xs font-bold text-muted-foreground uppercase select-none">
                        {group.value}
                      </Combobox.GroupLabel>
                      <Combobox.Collection>
                        {(item: TableItem) => (
                          <Combobox.Item
                            key={item.id}
                            value={item}
                            className="flex cursor-default items-center gap-2 px-3 py-1.5 text-[13px] text-foreground outline-none select-none data-highlighted:bg-background data-highlighted:text-ink"
                          >
                            <span className="flex-1 truncate">{item.label}</span>
                            <span className="shrink-0 font-mono text-3xs text-muted-foreground tabular-nums">
                              {item.relations} {item.relations === 1 ? "relation" : "relations"}
                            </span>
                          </Combobox.Item>
                        )}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        )}
      </AnimatePresence>
    </Combobox.Root>
  );
}

/** The board's tables but `currentId`: its related tables, then the rest, each A to Z. */
function tableGroups(elements: BoardElement[], currentId: string): TableGroup[] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const counts = new Map<string, number>();
  for (const el of elements) {
    if (!isRelation(el, byId)) continue;
    for (const end of new Set([el.startBinding, el.endBinding])) {
      if (end) counts.set(end, (counts.get(end) ?? 0) + 1);
    }
  }
  const related = erFocus(elements, [currentId]) ?? new Set<string>();
  const near: TableItem[] = [];
  const rest: TableItem[] = [];
  for (const el of elements) {
    if (el.type !== "table" || el.id === currentId) continue;
    const item = { id: el.id, label: el.table?.name ?? "table", relations: counts.get(el.id) ?? 0 };
    (related.has(el.id) ? near : rest).push(item);
  }
  const byName = (a: TableItem, b: TableItem) => a.label.localeCompare(b.label);
  const current = byId.get(currentId)?.table?.name ?? "table";
  return [
    { value: `Related to ${current}`, items: near.sort(byName) },
    { value: "Other tables", items: rest.sort(byName) },
  ].filter((group) => group.items.length > 0);
}

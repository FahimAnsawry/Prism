import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { TOOL_GROUPS } from "./tools";

type Shortcut = { label: string; keys: string[] };

const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Tools",
    items: TOOL_GROUPS.flat().map((tool) => ({ label: tool.label, keys: [tool.shortcut] })),
  },
  {
    title: "Canvas",
    items: [
      { label: "Zoom toward the pointer", keys: ["Wheel"] },
      { label: "Pan", keys: ["Right-drag"] },
      { label: "Pan", keys: ["Middle-drag"] },
      { label: "Pan with any tool", keys: ["Space", "Drag"] },
      { label: "Zoom in", keys: ["Ctrl", "+"] },
      { label: "Zoom out", keys: ["Ctrl", "−"] },
      { label: "Zoom to 100%", keys: ["Ctrl", "0"] },
      { label: "Zoom to fit", keys: ["Shift", "1"] },
      { label: "Collapse or show the toolbar", keys: ["Ctrl", "B"] },
    ],
  },
  {
    title: "Editing",
    items: [
      { label: "Undo", keys: ["Ctrl", "Z"] },
      { label: "Redo", keys: ["Ctrl", "Shift", "Z"] },
      { label: "Select all", keys: ["Ctrl", "A"] },
      { label: "Add to selection", keys: ["Shift", "Click"] },
      { label: "Copy", keys: ["Ctrl", "C"] },
      { label: "Paste (elements, images, SVG, text)", keys: ["Ctrl", "V"] },
      { label: "Duplicate", keys: ["Ctrl", "D"] },
      { label: "Move 1px (10px with Shift)", keys: ["Arrows"] },
      { label: "Edit text", keys: ["Enter"] },
      { label: "Finish editing", keys: ["Esc"] },
      { label: "Delete selection", keys: ["Delete"] },
      { label: "Deselect", keys: ["Esc"] },
      { label: "This list", keys: ["?"] },
    ],
  },
  {
    title: "Drawing",
    items: [
      { label: "Square, circle, keep ratio", keys: ["Shift", "Drag"] },
      { label: "Snap lines and rotation to 15°", keys: ["Shift", "Drag"] },
      { label: "Type on the board", keys: ["Double-click"] },
      { label: "New list item", keys: ["Enter"] },
      { label: "Indent / outdent list item", keys: ["Tab"] },
    ],
  },
];

/** "?" on the board: every tool key, canvas gesture and editing shortcut in one list. */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate/40 transition-opacity duration-150 ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[44rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-input bg-popover p-6 outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[26px] leading-8 font-bold text-ink">
                Shortcuts
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Keys and mouse gestures for the board. ⌘ works wherever Ctrl does.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <section
                key={section.title}
                className={section.title === "Tools" ? "sm:row-span-2" : undefined}
              >
                <h3 className="font-mono text-3xs font-bold text-muted-foreground uppercase">
                  {section.title}
                </h3>
                <dl className="mt-2">
                  {section.items.map((item) => (
                    <div
                      key={`${item.label}-${item.keys.join("+")}`}
                      className="flex h-8 items-center justify-between gap-4 border-b border-divider text-[13px] last:border-b-0"
                    >
                      <dt className="text-foreground">{item.label}</dt>
                      <dd className="flex shrink-0 items-center gap-1">
                        {item.keys.map((key) => (
                          <kbd
                            key={key}
                            className="flex h-6 min-w-[26px] items-center justify-center border border-divider bg-card px-1.5 font-mono text-2xs text-muted-foreground"
                          >
                            {key}
                          </kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

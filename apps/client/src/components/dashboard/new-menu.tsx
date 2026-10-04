import { Menu } from "@base-ui/react/menu";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";

type CreateKind = "project" | "whiteboard";

const OPTIONS: { kind: CreateKind; title: string; description: string; shortcut: string }[] = [
  {
    kind: "project",
    title: "Project",
    description: "A folder that holds many boards",
    shortcut: "P",
  },
  {
    kind: "whiteboard",
    title: "Whiteboard",
    description: "One canvas for one idea",
    shortcut: "B",
  },
];

/** "+ New": one button, one menu with both things a workspace can hold (frame 14). */
export function NewMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const create = (kind: CreateKind) => {
    setOpen(false);
    // TEMP: no create API yet. A whiteboard opens the demo board; projects have no page.
    if (kind === "whiteboard") void navigate({ to: "/board" });
  };

  // The shortcuts shown on each row work while the menu is open.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const option = OPTIONS.find((o) => o.shortcut.toLowerCase() === event.key.toLowerCase());
    if (option) {
      event.preventDefault();
      create(option.kind);
    }
  };

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger className="inline-flex h-11 w-[140px] shrink-0 items-center justify-center gap-2 border border-transparent bg-brand text-[15px] font-bold text-slate transition-colors duration-150 ease-standard select-none hover:bg-brand/80 data-popup-open:border-slate">
        <Plus aria-hidden="true" className="size-4" strokeWidth={2.5} />
        New
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={14} className="z-50 outline-none">
          <Menu.Popup
            onKeyDown={onKeyDown}
            className="w-80 origin-(--transform-origin) border border-edge bg-fog p-1.5 outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0"
          >
            <Menu.Group>
              <Menu.GroupLabel className="px-2.5 pt-1.5 pb-2.5 font-mono text-3xs font-bold text-graphite">
                CREATE
              </Menu.GroupLabel>
              <div className="flex flex-col gap-1">
                {OPTIONS.map((option) => (
                  <Menu.Item
                    key={option.kind}
                    onClick={() => create(option.kind)}
                    className="flex h-18 cursor-default items-center gap-3.5 pr-2.5 pl-3 outline-none select-none data-highlighted:bg-seafoam"
                  >
                    {option.kind === "project" ? <ProjectIcon /> : <WhiteboardIcon />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-[21px] font-bold text-slate">
                        {option.title}
                      </span>
                      <span className="block text-xs leading-[17px] text-graphite">
                        {option.description}
                      </span>
                    </span>
                    <kbd className="flex h-6 w-[26px] shrink-0 items-center justify-center border border-silver bg-fog font-mono text-2xs text-graphite">
                      {option.shortcut}
                    </kbd>
                  </Menu.Item>
                ))}
              </div>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function OptionIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 38 36"
      aria-hidden="true"
      className="h-9 w-[38px] shrink-0 overflow-visible stroke-slate"
    >
      {children}
    </svg>
  );
}

/** A folder: tab behind, body in front. */
function ProjectIcon() {
  return (
    <OptionIcon>
      <rect x="4.5" y="0.5" width="30" height="9" className="fill-canvas" />
      <rect x="0.5" y="6.5" width="37" height="29" className="fill-lime" />
    </OptionIcon>
  );
}

function WhiteboardIcon() {
  return (
    <OptionIcon>
      <rect x="0.5" y="3.5" width="37" height="29" className="fill-ice" />
    </OptionIcon>
  );
}

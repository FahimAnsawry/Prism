import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import { SORT_OPTIONS, type SortKey } from "./workspace-data";

export function SortMenu({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (sort: SortKey) => void;
}) {
  const current = SORT_OPTIONS.find((o) => o.id === value) ?? SORT_OPTIONS[0];

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Sort by: ${current?.label}`}
        className="inline-flex h-8 items-center gap-1 font-mono text-xs text-foreground select-none hover:text-ink data-popup-open:text-ink"
      >
        {current?.label}
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 transition-transform duration-150 ease-standard in-data-popup-open:rotate-180"
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50 outline-none">
          <Menu.Popup className="w-48 origin-(--transform-origin) border border-input bg-popover p-1 outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            <Menu.RadioGroup value={value} onValueChange={(sort: SortKey) => onChange(sort)}>
              <Menu.GroupLabel className="px-2.5 pt-1.5 pb-2 font-mono text-3xs font-bold text-muted-foreground">
                SORT BY
              </Menu.GroupLabel>
              {SORT_OPTIONS.map((option) => (
                <Menu.RadioItem
                  key={option.id}
                  value={option.id}
                  closeOnClick
                  className="grid h-9 cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-2.5 text-[13px] text-foreground outline-none select-none data-checked:font-bold data-highlighted:bg-seafoam dark:data-highlighted:bg-seafoam/12"
                >
                  <Menu.RadioItemIndicator className="col-start-1">
                    <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                  </Menu.RadioItemIndicator>
                  <span className="col-start-2">{option.label}</span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

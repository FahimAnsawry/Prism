import { Menu } from "@base-ui/react/menu";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { popupMotion, usePopupExit } from "@/components/popup-motion";
import { TurningChevron } from "@/components/motion-parts";
import { ArrowUpDown, Check } from "lucide-react";
import { SORT_OPTIONS, type SortKey } from "./workspace-data";

export function SortMenu({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (sort: SortKey) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { actionsRef, onExitComplete } = usePopupExit(menuOpen);
  const current = SORT_OPTIONS.find((o) => o.id === value) ?? SORT_OPTIONS[0];

  return (
    <Menu.Root open={menuOpen} onOpenChange={setMenuOpen} actionsRef={actionsRef}>
      <Menu.Trigger
        aria-label={`Sort by: ${current?.label}`}
        className="inline-flex h-[38px] items-center gap-2 border border-divider bg-card px-3 text-[13px] text-foreground transition-colors select-none hover:bg-hover data-popup-open:border-input"
      >
        <ArrowUpDown aria-hidden="true" className="size-4" />
        <span className="max-sm:sr-only">{current?.label}</span>
        <TurningChevron turned={menuOpen} className="size-3.5 max-sm:hidden" />
      </Menu.Trigger>
      <AnimatePresence>
        {menuOpen && (
          <Menu.Portal keepMounted>
            <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50 outline-none">
              <Menu.Popup
                className="w-48 origin-(--transform-origin) border border-input bg-popover shadow-lg p-1 outline-none"
                render={<motion.div {...popupMotion} onAnimationComplete={onExitComplete} />}
              >
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
        )}
      </AnimatePresence>
    </Menu.Root>
  );
}

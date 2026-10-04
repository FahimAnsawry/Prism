import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { TOOL_GROUPS, type ToolId } from "./tools";

/** Floating tool rail on the left of the canvas, 24px below the top bar. */
export function BoardToolbar({
  active,
  onSelect,
}: {
  active: ToolId;
  onSelect: (tool: ToolId) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      className="absolute top-6 left-4 z-10 flex max-h-[calc(100%-2.5rem)] w-12 flex-col gap-1 overflow-y-auto border border-chrome bg-card p-[3px] pb-5 [scrollbar-width:none]"
    >
      {TOOL_GROUPS.map((group, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <div aria-hidden="true" className="mx-1 mt-1 -mb-px h-px shrink-0 bg-divider" />
          )}
          {group.map((tool) => {
            const Icon = tool.icon;
            const isActive = tool.id === active;
            return (
              <button
                key={tool.id}
                type="button"
                aria-label={`${tool.label} (${tool.shortcut})`}
                title={`${tool.label} · ${tool.shortcut}`}
                aria-pressed={isActive}
                onClick={() => onSelect(tool.id)}
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center transition-colors duration-150 ease-standard",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-foreground hover:bg-background",
                )}
              >
                <Icon aria-hidden="true" className="size-[18px]" />
              </button>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

/** One name shown above a frame, section or card. */
export interface ElementLabel {
  id: string;
  name: string;
  /** The top-left of the element's box, in board px. */
  x: number;
  y: number;
  /** Selected labels are drawn solid, a hovered one lighter. */
  selected: boolean;
}

const SELECTION = "#5882ff"; // --color-blue
/** Everything in a label is in screen px: the group is scaled by 1 / zoom. */
const HEIGHT = 20;
const GAP = 6;
const MAX_WIDTH = 280;
const CHAR_WIDTH = 6.4;
const PAD = 7;

/** A rough width for the label's text; the real text is clipped to MAX_WIDTH anyway. */
const widthOf = (name: string) =>
  Math.min(MAX_WIDTH, Math.ceil(name.length * CHAR_WIDTH) + 2 * PAD);

/**
 * The names of the selected and hovered frames, sections and cards, as small tags above them.
 * Double-clicking a tag renames the element in place (when `onRename` is given); Enter keeps
 * the name, Escape drops the change, and an empty name goes back to the automatic one.
 */
export function ElementLabels({
  labels,
  zoom,
  renamingId,
  onSelect,
  onStartRename,
  onRename,
  onStopRename,
}: {
  labels: ElementLabel[];
  zoom: number;
  renamingId: string | null;
  onSelect: (id: string) => void;
  /** Without it the labels only show (a view-only board). */
  onStartRename?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onStopRename: () => void;
}) {
  return (
    <>
      {labels.map((label) => {
        const renaming = renamingId === label.id && onRename !== undefined;
        const width = renaming ? MAX_WIDTH : widthOf(label.name);
        return (
          <g
            key={label.id}
            data-element-label={label.id}
            transform={`translate(${label.x} ${label.y - (HEIGHT + GAP) / zoom}) scale(${1 / zoom})`}
            // Pressing a tag must not start a marquee or clear the selection behind it.
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelect(label.id);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onStartRename?.(label.id);
            }}
            onPointerMove={(event) => event.stopPropagation()}
          >
            {/* Bridges the gap to the element, so reaching the tag doesn't hide it. */}
            <rect y={HEIGHT} width={width} height={GAP + 1} fill="transparent" />
            {renaming ? (
              <foreignObject x={0} y={0} width={width} height={HEIGHT}>
                <RenameInput
                  name={label.name}
                  onDone={(name) => {
                    onRename(label.id, name);
                    onStopRename();
                  }}
                  onCancel={onStopRename}
                />
              </foreignObject>
            ) : (
              <>
                <rect
                  width={width}
                  height={HEIGHT}
                  rx={3}
                  fill={label.selected ? SELECTION : "var(--card)"}
                  stroke={SELECTION}
                  strokeWidth={1}
                  opacity={label.selected ? 1 : 0.95}
                />
                <foreignObject x={0} y={0} width={width} height={HEIGHT} pointerEvents="none">
                  <div
                    className="size-full truncate px-[7px] text-[11px] leading-5 font-medium select-none"
                    style={{ color: label.selected ? "#fff" : "var(--foreground)" }}
                  >
                    {label.name}
                  </div>
                </foreignObject>
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

function RenameInput({
  name,
  onDone,
  onCancel,
}: {
  name: string;
  onDone: (name: string) => void;
  onCancel: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(name);
  /** Escape closes without keeping the text, though closing blurs the field. */
  const cancelled = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <input
      ref={input}
      aria-label="Element name"
      value={draft}
      maxLength={120}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          input.current?.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelled.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (!cancelled.current) onDone(draft);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      className="h-5 w-full rounded-[3px] border border-[#5882ff] bg-card px-[6px] text-[11px] font-medium text-foreground outline-none select-text"
    />
  );
}

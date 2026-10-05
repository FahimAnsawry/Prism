// The custom color picker behind the properties panel's "+" (tools.md §3): a saturation /
// brightness square, a hue strip and an editable hex value, all plain DOM. No picker library.

import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { normalizeHex } from "./board-model";

interface Hsv {
  /** 0–360. */
  h: number;
  /** 0–1. */
  s: number;
  /** 0–1. */
  v: number;
}

function hexToHsv(hex: string): Hsv {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex({ h, s, v }: Hsv) {
  const channel = (k: number) => {
    const p = (k + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(p, 4 - p, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Pointer drags over `el`, reported as 0–1 fractions of its box. */
function dragHandlers(onMove: (fx: number, fy: number) => void) {
  const report = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onMove(
      clamp01((event.clientX - box.left) / box.width),
      clamp01((event.clientY - box.top) / box.height),
    );
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus();
      report(event);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) report(event);
    },
  };
}

/** Arrow keys step by 1 (Shift: 10); the board must not also nudge the selection. */
function arrowStep(event: KeyboardEvent, onStep: (dx: number, dy: number) => void) {
  const step = event.shiftKey ? 10 : 1;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = moves[event.key];
  if (!move) return;
  event.preventDefault();
  event.stopPropagation();
  onStep(...move);
}

export function ColorPicker({
  initial,
  label,
  onAdd,
  onCancel,
}: {
  /** Where the picker starts; anything that isn't a hex color starts at the brand blue. */
  initial: string;
  /** What the color is for, e.g. "stroke"; used in the accessible names. */
  label: string;
  onAdd: (hex: string) => void;
  onCancel: () => void;
}) {
  const start = normalizeHex(initial) ?? "#5882ff";
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(start));
  const [draft, setDraft] = useState(start);
  const hexId = useId();
  const errorId = useId();
  const hexInput = useRef<HTMLInputElement>(null);

  const typed = normalizeHex(draft);
  const invalid = typed === null;
  const color = hsvToHex(hsv);

  /** A change from the square or the strip: the hex field follows. */
  const setFromPicker = (next: Hsv) => {
    setHsv(next);
    setDraft(hsvToHex(next));
  };

  const square = dragHandlers((fx, fy) => setFromPicker({ ...hsv, s: fx, v: 1 - fy }));
  const strip = dragHandlers((fx) => setFromPicker({ ...hsv, h: Math.min(359.9, fx * 360) }));

  const add = () => {
    if (typed) onAdd(typed);
    else hexInput.current?.focus();
  };

  return (
    <div
      className="mt-3 flex flex-col gap-3 border border-divider bg-background p-3"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} saturation and brightness`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        {...square}
        onKeyDown={(event) =>
          arrowStep(event, (dx, dy) =>
            setFromPicker({ ...hsv, s: clamp01(hsv.s + dx / 100), v: clamp01(hsv.v - dy / 100) }),
          )
        }
        className="relative h-32 w-full cursor-crosshair touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }),
          backgroundImage:
            "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} hue`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        {...strip}
        onKeyDown={(event) =>
          arrowStep(event, (dx, dy) =>
            setFromPicker({ ...hsv, h: Math.min(359.9, Math.max(0, hsv.h + dx - dy)) }),
          )
        }
        className="relative h-3 w-full cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          backgroundImage: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 border border-foreground bg-card"
          style={{ left: `${(hsv.h / 360) * 100}%` }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-7 shrink-0 border border-divider"
          style={{ backgroundColor: typed ?? color }}
        />
        <label htmlFor={hexId} className="sr-only">
          {`${label} hex value`}
        </label>
        <input
          ref={hexInput}
          id={hexId}
          value={draft}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            const next = normalizeHex(event.target.value);
            if (next) setHsv(hexToHsv(next));
          }}
          onBlur={() => {
            if (typed) setDraft(typed);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          className={cn(
            "h-7 min-w-0 flex-1 border bg-card px-2 font-mono text-xs text-foreground uppercase outline-none",
            invalid ? "border-coral" : "border-divider focus:border-foreground",
          )}
        />
      </div>
      {invalid && (
        <p id={errorId} className="-mt-1.5 text-3xs text-coral">
          Use a hex color like #5882FF.
        </p>
      )}

      <div className="grid grid-cols-2 gap-1">
        <PickerButton onClick={onCancel}>Cancel</PickerButton>
        <PickerButton primary disabled={invalid} onClick={add}>
          Add
        </PickerButton>
      </div>
    </div>
  );
}

function PickerButton({
  children,
  primary = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 font-mono text-2xs transition-colors duration-150 ease-standard disabled:pointer-events-none disabled:opacity-60",
        primary
          ? "bg-secondary text-secondary-foreground"
          : "bg-card text-foreground hover:bg-divider",
      )}
    >
      {children}
    </button>
  );
}

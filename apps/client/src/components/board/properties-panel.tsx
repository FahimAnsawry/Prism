import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  type BoardElement,
  type ElementType,
  elementLabel,
  type FontFamily,
  type FontSize,
  type LayerMove,
  STROKE_WIDTHS,
  type StrokeStyle,
  type TextAlign,
} from "./board-model";

// Palettes from the Miro frame: slate, bloom, coral, brand, blue, violet, pink, graphite.
const STROKES = [
  "#3d3b4f",
  "#ff6d6d",
  "#ff7f59",
  "#28e99f",
  "#5882ff",
  "#756cf5",
  "#f783a3",
  "#5f5f5f",
];
// seafoam, ice, lavender, peach, lime, sage.
const FILLS = ["#c5ffd6", "#d1e5ff", "#ffcffe", "#ffbcb3", "#ecffa3", "#c8ead0"];

// Which rows each element type shows (tools.md §3). Rows that don't apply are hidden.
const SHAPES: ElementType[] = ["rect", "diamond", "arrow"];
const FILLED: ElementType[] = ["rect", "diamond", "sticky"];
const TEXTUAL: ElementType[] = ["text", "sticky"];

export function PropertiesPanel({
  el,
  onChange,
  onLayer,
}: {
  el: BoardElement;
  onChange: (changes: Partial<BoardElement>) => void;
  onLayer: (move: LayerMove) => void;
}) {
  const locked = Boolean(el.locked);
  const hasStroke = SHAPES.includes(el.type);
  const hasText = TEXTUAL.includes(el.type);
  const width = (Object.keys(STROKE_WIDTHS) as (keyof typeof STROKE_WIDTHS)[]).find(
    (key) => STROKE_WIDTHS[key] === el.strokeWidth,
  );

  return (
    <aside
      aria-label={`${elementLabel(el)} properties`}
      className="absolute top-6 right-4 z-10 max-h-[calc(100%-2.5rem)] w-64 overflow-y-auto border border-ash bg-fog md:right-6"
    >
      <h2 className="flex h-12 items-center border-b border-silver px-4 text-sm font-bold text-onyx">
        {elementLabel(el)}
      </h2>

      <fieldset disabled={locked} className="contents">
        {hasStroke || FILLED.includes(el.type) ? (
          <section className="flex flex-col gap-3.5 border-b border-silver px-4 pt-2.5 pb-6">
            {hasStroke && (
              <Row label="Stroke">
                <div className="flex gap-[5px]">
                  {STROKES.map((color) => (
                    <Swatch
                      key={color}
                      color={color}
                      selected={el.stroke === color}
                      onClick={() => onChange({ stroke: color })}
                    />
                  ))}
                  <label
                    title="Custom color"
                    className={cn(
                      "relative flex size-5 cursor-pointer items-center justify-center border border-edge bg-fog text-slate hover:bg-canvas",
                      !STROKES.includes(el.stroke) &&
                        "ring-1 ring-slate ring-offset-1 ring-offset-fog",
                    )}
                  >
                    <Plus aria-hidden="true" className="size-3" />
                    <input
                      type="color"
                      aria-label="Custom stroke color"
                      value={el.stroke}
                      onChange={(event) => onChange({ stroke: event.target.value })}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </Row>
            )}

            {FILLED.includes(el.type) && (
              <Row label="Fill">
                <div className="flex gap-[5px]">
                  {el.type !== "sticky" && (
                    <button
                      type="button"
                      aria-pressed={el.fill === null}
                      onClick={() => onChange({ fill: null })}
                      className={cn(
                        "h-5 w-[45px] border font-mono text-3xs text-slate",
                        el.fill === null
                          ? "border-slate bg-fog"
                          : "border-silver bg-fog hover:bg-canvas",
                      )}
                    >
                      None
                    </button>
                  )}
                  {FILLS.map((color) => (
                    <Swatch
                      key={color}
                      color={color}
                      selected={el.fill === color}
                      onClick={() => onChange({ fill: color })}
                    />
                  ))}
                </div>
              </Row>
            )}

            {hasStroke && (
              <Row label="Stroke width">
                <Segmented
                  options={["thin", "medium", "thick"] as const}
                  value={width}
                  onChange={(w) => onChange({ strokeWidth: STROKE_WIDTHS[w] })}
                />
              </Row>
            )}

            {hasStroke && (
              <Row label="Stroke style">
                <Segmented<StrokeStyle>
                  options={["solid", "dashed", "dotted"]}
                  value={el.strokeStyle}
                  onChange={(strokeStyle) => onChange({ strokeStyle })}
                />
              </Row>
            )}

            {hasStroke && (
              <Toggle
                label="Sketch mode"
                checked={el.sketch}
                onChange={(sketch) => onChange({ sketch })}
                className="mt-1.5"
              />
            )}
          </section>
        ) : null}

        {hasText && (
          <section className="flex flex-col gap-3.5 border-b border-silver px-4 pt-4.5 pb-6">
            <Row label="Font">
              <Segmented<FontFamily>
                options={["sans", "caveat", "mono"]}
                value={el.font ?? "sans"}
                onChange={(font) => onChange({ font })}
              />
            </Row>
            <Row label="Font size">
              <Segmented<FontSize>
                options={["S", "M", "L", "XL"]}
                value={el.fontSize ?? "M"}
                onChange={(fontSize) => onChange({ fontSize })}
              />
            </Row>
            <Row label="Text align">
              <Segmented<TextAlign>
                options={["left", "center", "right"]}
                value={el.textAlign ?? "left"}
                onChange={(textAlign) => onChange({ textAlign })}
              />
            </Row>
          </section>
        )}
      </fieldset>

      <section className="flex flex-col px-4 pt-4.5 pb-5">
        <label className="flex flex-col">
          <span className="mb-4 flex justify-between font-mono text-3xs leading-[14px] text-graphite">
            OPACITY
            <span className="text-2xs text-slate tabular-nums">
              {Math.round(el.opacity * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(el.opacity * 100)}
            disabled={locked}
            onChange={(event) => onChange({ opacity: Number(event.target.value) / 100 })}
            className="h-3 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default disabled:opacity-60 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-slate [&::-moz-range-thumb]:bg-brand [&::-moz-range-track]:h-0.5 [&::-moz-range-track]:bg-slate [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:bg-slate [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-slate [&::-webkit-slider-thumb]:bg-brand"
          />
        </label>

        <Row label="Layer order" className="mt-[18px]">
          <div className="grid grid-cols-4 gap-1">
            {(["back", "down", "up", "front"] as const).map((move) => (
              <button
                key={move}
                type="button"
                disabled={locked}
                onClick={() => onLayer(move)}
                className={cn(segmentButton, "bg-canvas text-slate capitalize hover:bg-silver")}
              >
                {move}
              </button>
            ))}
          </div>
        </Row>

        <Toggle
          label="Lock"
          checked={locked}
          onChange={(value) => onChange({ locked: value })}
          className="mt-5"
        />
      </section>
    </aside>
  );
}

const segmentButton =
  "h-7 font-mono text-2xs transition-colors duration-150 ease-standard disabled:pointer-events-none disabled:opacity-60";

function Row({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-3 font-mono text-3xs leading-[14px] text-graphite uppercase">{label}</p>
      {children}
    </div>
  );
}

function Swatch({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={color}
      aria-pressed={selected}
      onClick={onClick}
      style={{ backgroundColor: color }}
      className={cn(
        "size-5 shrink-0",
        selected && "border border-slate ring-1 ring-slate ring-offset-1 ring-offset-fog",
      )}
    />
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <div className={cn("grid gap-1", options.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={cn(
            segmentButton,
            "capitalize",
            option === value ? "bg-slate text-fog" : "bg-canvas text-slate hover:bg-silver",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** Switch (approved change): an edge-colored track border so off reads at 3:1, slate when on. */
function Toggle({
  label,
  checked,
  onChange,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between", className)}>
      <span className="text-[13px] text-slate">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-10 border border-edge transition-colors duration-150 ease-standard",
          checked ? "bg-slate" : "bg-silver",
        )}
      >
        <span
          className={cn(
            "absolute top-px left-px size-4 bg-fog transition-transform duration-150 ease-standard",
            checked && "translate-x-5",
          )}
        />
      </button>
    </label>
  );
}

import {
  type ChartData,
  type ChartKind,
  CUSTOM_COLORS_MAX,
  CUSTOM_FONTS_MAX,
  type UpdateBoardStyleInput,
} from "@prism/shared";
import { Plus, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import {
  type BoardElement,
  displayColor,
  type ElementType,
  elementLabel,
  FILL_COLORS,
  type FontFamily,
  type FontSize,
  type LayerMove,
  normalizeHex,
  STROKE_COLORS,
  STROKE_WIDTHS,
  type StrokeStyle,
  type TextAlign,
} from "./board-model";
import { ColorPicker } from "./color-picker";
import { FontPicker } from "./font-picker";
import {
  BUILTIN_FONT_IDS,
  fontInfo,
  fontStack,
  isHandwriting,
  loadFont,
  nearestWeight,
  WEIGHT_NAMES,
  weightOf,
} from "./fonts";
import { clampFontPx, fontPx, resetMeasurements } from "./text-layout";

const SHAPES: ElementType[] = ["rect", "ellipse", "diamond"];
/** The corner radius "Round" sets, in px. */
const ROUND_RADIUS = 12;

/** Which element types each property applies to (tools.md §3). Unlisted ones apply to all. */
const APPLIES_TO: Partial<Record<keyof BoardElement, ElementType[]>> = {
  // On text and lists the stroke is the text color.
  stroke: [...SHAPES, "line", "arrow", "freehand", "text", "list"],
  fill: [...SHAPES, "sticky"],
  strokeWidth: [...SHAPES, "line", "arrow", "freehand"],
  strokeStyle: [...SHAPES, "line", "arrow"],
  sketch: [...SHAPES, "line", "arrow"],
  radius: ["rect", "frame"],
  font: ["text", "sticky", "list"],
  fontSize: ["text", "sticky", "list"],
  fontSizePx: ["text", "sticky", "list"],
  fontWeight: ["text", "sticky", "list"],
  textAlign: ["text", "sticky", "list"],
  chart: ["chart"],
};

const applies = (key: keyof BoardElement, el: BoardElement) =>
  APPLIES_TO[key]?.includes(el.type) ?? true;

/** The part of `changes` that applies to `el`, or null if none of it does. */
export function applicableChanges(el: BoardElement, changes: Partial<BoardElement>) {
  const kept = Object.fromEntries(
    Object.entries(changes).filter(([key]) => applies(key as keyof BoardElement, el)),
  ) as Partial<BoardElement>;
  return Object.keys(kept).length > 0 ? kept : null;
}

export function PropertiesPanel({
  elements,
  customColors,
  customFonts,
  onChange,
  onLayer,
  onStyleChange,
}: {
  /** The selection; changes go to each element they apply to. */
  elements: BoardElement[];
  /** The board's saved swatches (#rrggbb) and added Google fonts, newest first. */
  customColors: string[];
  customFonts: string[];
  onChange: (changes: Partial<BoardElement>) => void;
  onLayer: (move: LayerMove) => void;
  onStyleChange: (style: UpdateBoardStyleInput) => void;
}) {
  const first = elements[0];
  if (!first) return null;
  const locked = elements.every((el) => el.locked);
  /** The first selected element a property applies to; the panel shows its value. */
  const source = (key: keyof BoardElement) => elements.find((el) => applies(key, el));
  const stroke = source("stroke");
  const fill = source("fill");
  const widthEl = source("strokeWidth");
  const styleEl = source("strokeStyle");
  const sketchEl = source("sketch");
  const radiusEl = source("radius");
  const textEl = source("font");
  const chartEl = elements.length === 1 && first.type === "chart" ? first : undefined;
  const width = widthEl
    ? (Object.keys(STROKE_WIDTHS) as (keyof typeof STROKE_WIDTHS)[]).find(
        (key) => STROKE_WIDTHS[key] === widthEl.strokeWidth,
      )
    : undefined;
  const title = elements.length === 1 ? elementLabel(first) : `${elements.length} items`;
  // Sticky notes always have a color; only shapes can have no fill.
  const onlySticky = !elements.some((el) => SHAPES.includes(el.type));
  const onlyText = elements
    .filter((el) => applies("stroke", el))
    .every((el) => el.type === "text" || el.type === "list");
  const font = textEl?.font ?? "sans";

  const addColor = (hex: string) =>
    onStyleChange({
      customColors: [hex, ...customColors.filter((c) => c !== hex)].slice(0, CUSTOM_COLORS_MAX),
    });
  const removeColor = (hex: string) =>
    onStyleChange({ customColors: customColors.filter((c) => c !== hex) });

  /** Loads the font before applying it, so the text box is measured with the real glyphs. */
  const weight = textEl ? weightOf(textEl) : 400;

  /**
   * Loads the font before applying it, so the text box is measured with the real glyphs. A
   * weight the new font doesn't have moves to its closest one.
   */
  const pickFont = async (next: FontFamily) => {
    const nextWeight = nearestWeight(next, weight);
    await loadFont(next, nextWeight);
    resetMeasurements();
    onChange(nextWeight === weight ? { font: next } : { font: next, fontWeight: nextWeight });
  };

  const pickWeight = async (next: number) => {
    await loadFont(font, next);
    resetMeasurements();
    onChange({ fontWeight: next });
  };

  return (
    <aside
      aria-label={`${title} properties`}
      className="absolute top-6 right-4 z-10 max-h-[calc(100%-2.5rem)] w-64 overflow-y-auto border border-chrome bg-card md:right-6"
    >
      <h2 className="flex h-12 items-center border-b border-divider px-4 text-sm font-bold text-ink">
        {title}
      </h2>

      <fieldset disabled={locked} className="contents">
        {stroke || fill ? (
          <section className="flex flex-col gap-3.5 border-b border-divider px-4 pt-2.5 pb-6">
            {stroke && (
              <Row label={onlyText ? "Text color" : "Stroke"}>
                <ColorChoices
                  label={onlyText ? "Text color" : "Stroke color"}
                  value={stroke.stroke}
                  presets={STROKE_COLORS}
                  custom={customColors}
                  disabled={locked}
                  onPick={(color) => onChange({ stroke: color })}
                  onAdd={(hex) => {
                    addColor(hex);
                    onChange({ stroke: hex });
                  }}
                  onRemove={removeColor}
                />
              </Row>
            )}

            {fill && (
              <Row label={onlySticky ? "Color" : "Fill"}>
                <ColorChoices
                  label={onlySticky ? "Note color" : "Fill color"}
                  value={fill.fill}
                  presets={FILL_COLORS}
                  custom={customColors}
                  disabled={locked}
                  onPick={(color) => onChange({ fill: color })}
                  onAdd={(hex) => {
                    addColor(hex);
                    onChange({ fill: hex });
                  }}
                  onRemove={removeColor}
                  none={
                    onlySticky ? undefined : (
                      <button
                        type="button"
                        aria-pressed={fill.fill === null}
                        onClick={() => onChange({ fill: null })}
                        className={cn(
                          "h-5 w-[45px] border font-mono text-3xs text-foreground",
                          fill.fill === null
                            ? "border-foreground bg-card"
                            : "border-divider bg-card hover:bg-background",
                        )}
                      >
                        None
                      </button>
                    )
                  }
                />
              </Row>
            )}

            {widthEl && (
              <Row label="Stroke width">
                <Segmented
                  options={["thin", "medium", "thick"] as const}
                  value={width}
                  onChange={(w) => onChange({ strokeWidth: STROKE_WIDTHS[w] })}
                />
              </Row>
            )}

            {styleEl && (
              <Row label="Stroke style">
                <Segmented<StrokeStyle>
                  options={["solid", "dashed", "dotted"]}
                  value={styleEl.strokeStyle}
                  onChange={(strokeStyle) => onChange({ strokeStyle })}
                />
              </Row>
            )}

            {radiusEl && (
              <Row label="Corners">
                <Segmented
                  options={["sharp", "round"] as const}
                  value={radiusEl.radius ? "round" : "sharp"}
                  onChange={(corners) =>
                    onChange({ radius: corners === "round" ? ROUND_RADIUS : 0 })
                  }
                />
              </Row>
            )}

            {sketchEl && (
              <Toggle
                label="Sketch mode"
                checked={sketchEl.sketch}
                onChange={(sketch) => onChange({ sketch })}
                className="mt-1.5"
              />
            )}
          </section>
        ) : null}

        {textEl && (
          <section className="flex flex-col gap-3.5 border-b border-divider px-4 pt-4.5 pb-6">
            <Row label="Font">
              <FontPicker
                value={font}
                customFonts={customFonts}
                onPick={(next) => void pickFont(next)}
                onAddFont={(family) =>
                  onStyleChange({
                    customFonts: [family, ...customFonts.filter((f) => f !== family)].slice(
                      0,
                      CUSTOM_FONTS_MAX,
                    ),
                  })
                }
                onRemoveFont={(family) =>
                  onStyleChange({ customFonts: customFonts.filter((f) => f !== family) })
                }
              />
            </Row>
            <Row label="Font weight">
              <WeightPicker font={font} value={weight} onChange={(w) => void pickWeight(w)} />
            </Row>
            {isHandwriting(font) && (
              <Row label="Handwriting style">
                <div className="grid grid-cols-2 gap-1">
                  {HANDWRITING_FONTS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={option === font}
                      onClick={() => void pickFont(option)}
                      style={{ fontFamily: fontStack(option) }}
                      className={cn(
                        "h-8 truncate px-2 text-base transition-colors duration-150 ease-standard",
                        option === font
                          ? "bg-secondary text-secondary-foreground"
                          : "bg-background text-foreground hover:bg-divider",
                      )}
                    >
                      {fontInfo(option).label}
                    </button>
                  ))}
                </div>
              </Row>
            )}
            <Row label="Font size">
              <div className="flex gap-1">
                <div className="min-w-0 flex-1">
                  <Segmented<FontSize>
                    options={["S", "M", "L", "XL"]}
                    // A free size isn't one of the presets.
                    value={textEl.fontSizePx == null ? (textEl.fontSize ?? "M") : undefined}
                    onChange={(fontSize) => onChange({ fontSize, fontSizePx: undefined })}
                  />
                </div>
                <FontPxInput
                  key={textEl.id}
                  value={fontPx(textEl)}
                  onChange={(fontSizePx) => onChange({ fontSizePx })}
                />
              </div>
            </Row>
            <Row label="Text align">
              <Segmented<TextAlign>
                options={["left", "center", "right"]}
                value={textEl.textAlign ?? "left"}
                onChange={(textAlign) => onChange({ textAlign })}
              />
            </Row>
          </section>
        )}

        {chartEl?.chart && (
          <ChartEditor chart={chartEl.chart} onChange={(chart) => onChange({ chart })} />
        )}
      </fieldset>

      <section className="flex flex-col px-4 pt-4.5 pb-5">
        <label className="flex flex-col">
          <span className="mb-4 flex justify-between font-mono text-3xs leading-[14px] text-muted-foreground">
            OPACITY
            <span className="text-2xs text-foreground tabular-nums">
              {Math.round(first.opacity * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(first.opacity * 100)}
            disabled={locked}
            onChange={(event) => onChange({ opacity: Number(event.target.value) / 100 })}
            className="h-3 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-default disabled:opacity-60 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-foreground [&::-moz-range-thumb]:bg-brand [&::-moz-range-track]:h-0.5 [&::-moz-range-track]:bg-foreground [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:bg-foreground [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:bg-brand"
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
                className={cn(
                  segmentButton,
                  "bg-background text-foreground capitalize hover:bg-divider",
                )}
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

/**
 * The text size in px, typed or stepped with the arrow keys (Shift: 10). Typing applies on
 * Enter or blur, so each size is one undo step.
 */
function FontPxInput({ value, onChange }: { value: number; onChange: (px: number) => void }) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  // A size changed elsewhere (a resize, a preset, undo) replaces the draft.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setDraft(String(Math.round(value)));
  }
  const commit = (px: number) => {
    const next = clampFontPx(px);
    setDraft(String(next));
    if (next !== Math.round(value)) onChange(next);
  };
  return (
    <label className="flex h-7 w-[58px] shrink-0 items-center border border-divider bg-background pr-1.5 focus-within:border-foreground">
      <span className="sr-only">Font size in pixels</span>
      <input
        value={draft}
        inputMode="numeric"
        maxLength={3}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ""))}
        onBlur={() => (draft ? commit(Number(draft)) : setDraft(String(Math.round(value))))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (draft) commit(Number(draft));
          } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const step = (event.shiftKey ? 10 : 1) * (event.key === "ArrowUp" ? 1 : -1);
            commit((Number(draft) || Math.round(value)) + step);
          }
        }}
        className="h-full w-full min-w-0 bg-transparent px-1.5 text-right font-mono text-2xs text-foreground tabular-nums outline-none"
      />
      <span aria-hidden="true" className="font-mono text-3xs text-muted-foreground">
        px
      </span>
    </label>
  );
}

/**
 * The weights the font has, each shown in itself. Up to four fit a row; a font with one
 * weight shows it alone, so it's clear there's no other.
 */
function WeightPicker({
  font,
  value,
  onChange,
}: {
  font: FontFamily;
  value: number;
  onChange: (weight: number) => void;
}) {
  const weights = fontInfo(font).weights;
  return (
    <div className="grid grid-cols-4 gap-1">
      {weights.map((w) => (
        <button
          key={w}
          type="button"
          aria-pressed={w === value}
          aria-label={`${WEIGHT_NAMES[w] ?? w} (${w})`}
          title={`${WEIGHT_NAMES[w] ?? w} · ${w}`}
          onClick={() => onChange(w)}
          style={{ fontFamily: fontStack(font), fontWeight: w }}
          className={cn(
            "h-8 text-[15px] leading-none transition-colors duration-150 ease-standard",
            w === value
              ? "bg-secondary text-secondary-foreground"
              : "bg-background text-foreground hover:bg-divider",
          )}
        >
          Aa
          <span className="block pt-0.5 font-mono text-[9px] font-normal opacity-70">{w}</span>
        </button>
      ))}
    </div>
  );
}

const HANDWRITING_FONTS = BUILTIN_FONT_IDS.filter((id) => fontInfo(id).category === "handwriting");

/**
 * A color row: the presets, the board's saved colors (each removable), and "+" for the picker.
 * `value` can be any color; the "+" is ringed when it's none of the swatches.
 */
function ColorChoices({
  label,
  value,
  presets,
  custom,
  disabled,
  none,
  onPick,
  onAdd,
  onRemove,
}: {
  label: string;
  value: string | null;
  presets: string[];
  custom: string[];
  disabled: boolean;
  /** A "no color" button shown first (fills only). */
  none?: ReactNode;
  onPick: (color: string) => void;
  onAdd: (hex: string) => void;
  onRemove: (hex: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const current = value === null ? null : (normalizeHex(value) ?? value.toLowerCase());
  const same = (color: string) => current === color.toLowerCase();
  const saved = custom.filter((color) => !presets.some((p) => p.toLowerCase() === color));
  const isCustom = current !== null && !presets.some(same) && !saved.some(same);

  return (
    <>
      <div className="flex flex-wrap gap-[5px]">
        {none}
        {presets.map((color) => (
          <Swatch key={color} color={color} selected={same(color)} onClick={() => onPick(color)} />
        ))}
        {saved.map((color) => (
          <span key={color} className="group relative">
            <Swatch color={color} selected={same(color)} onClick={() => onPick(color)} />
            <button
              type="button"
              aria-label={`Remove saved color ${color}`}
              title="Remove from this board"
              onClick={() => onRemove(color)}
              className="absolute -top-1.5 -right-1.5 hidden size-3.5 items-center justify-center rounded-full border border-divider bg-card text-foreground group-focus-within:flex group-hover:flex hover:text-ink"
            >
              <X aria-hidden="true" className="size-2.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          title="Custom color"
          aria-label={`Add a custom ${label.toLowerCase()}`}
          aria-expanded={picking}
          onClick={() => setPicking((open) => !open)}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center border border-input bg-card text-foreground hover:bg-background",
            (isCustom || picking) && "ring-1 ring-foreground ring-offset-1 ring-offset-card",
          )}
        >
          <Plus aria-hidden="true" className="size-3" />
        </button>
      </div>
      {picking && !disabled && (
        <ColorPicker
          initial={value ?? "#5882ff"}
          label={label}
          onCancel={() => setPicking(false)}
          onAdd={(hex) => {
            onAdd(hex);
            setPicking(false);
          }}
        />
      )}
    </>
  );
}

const CHART_KINDS: ChartKind[] = ["bar", "line", "pie", "donut"];
const MAX_ROWS = 50;

/** The chart's data as a plain editable table (tools.md §1, tool 16). */
function ChartEditor({
  chart,
  onChange,
}: {
  chart: ChartData;
  onChange: (chart: ChartData) => void;
}) {
  const setRow = (i: number, row: Partial<ChartData["rows"][number]>) =>
    onChange({ ...chart, rows: chart.rows.map((r, j) => (j === i ? { ...r, ...row } : r)) });
  const cell =
    "h-7 w-full min-w-0 border border-divider bg-background px-1.5 text-xs text-foreground outline-none focus:border-foreground";

  return (
    <section className="flex flex-col gap-3.5 border-b border-divider px-4 pt-4.5 pb-6">
      <Row label="Chart type">
        <Segmented<ChartKind>
          options={CHART_KINDS}
          value={chart.kind}
          onChange={(kind) => onChange({ ...chart, kind })}
        />
      </Row>
      <Row label="Data">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="text-left font-mono text-3xs text-muted-foreground">
              <th className="pb-1 font-normal">LABEL</th>
              <th className="w-20 pb-1 pl-1 font-normal">VALUE</th>
              <th className="w-8 pb-1">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((row, i) => (
              <tr key={i}>
                <td className="py-0.5">
                  <input
                    aria-label={`Label ${i + 1}`}
                    value={row.label}
                    maxLength={60}
                    onChange={(event) => setRow(i, { label: event.target.value })}
                    className={cell}
                  />
                </td>
                <td className="py-0.5 pl-1">
                  <input
                    aria-label={`Value ${i + 1}`}
                    type="number"
                    value={Number.isFinite(row.value) ? row.value : 0}
                    onChange={(event) => setRow(i, { value: Number(event.target.value) || 0 })}
                    className={cn(cell, "tabular-nums")}
                  />
                </td>
                <td className="py-0.5 pl-1">
                  <button
                    type="button"
                    aria-label={`Remove row ${i + 1}`}
                    disabled={chart.rows.length <= 1}
                    onClick={() =>
                      onChange({ ...chart, rows: chart.rows.filter((_, j) => j !== i) })
                    }
                    className="flex size-7 items-center justify-center text-muted-foreground hover:bg-background hover:text-ink disabled:opacity-40"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          disabled={chart.rows.length >= MAX_ROWS}
          onClick={() =>
            onChange({
              ...chart,
              rows: [...chart.rows, { label: `Item ${chart.rows.length + 1}`, value: 10 }],
            })
          }
          className={cn(
            segmentButton,
            "mt-2 w-full bg-background text-foreground hover:bg-divider",
          )}
        >
          + Add row
        </button>
      </Row>
    </section>
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
      <p className="mb-3 font-mono text-3xs leading-[14px] text-muted-foreground uppercase">
        {label}
      </p>
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
      title={color}
      aria-pressed={selected}
      onClick={onClick}
      style={{ backgroundColor: displayColor(color) }}
      className={cn(
        "size-5 shrink-0",
        selected &&
          "border border-foreground ring-1 ring-foreground ring-offset-1 ring-offset-card",
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
    <div
      className={cn(
        "grid gap-1",
        options.length === 4 ? "grid-cols-4" : options.length === 2 ? "grid-cols-2" : "grid-cols-3",
      )}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={cn(
            segmentButton,
            "capitalize",
            option === value
              ? "bg-secondary text-secondary-foreground"
              : "bg-background text-foreground hover:bg-divider",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** Switch (approved change): an edge-colored track border so off reads at 3:1, filled when on. */
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
      <span className="text-[13px] text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-10 border border-input transition-colors duration-150 ease-standard",
          checked ? "bg-secondary" : "bg-divider",
        )}
      >
        <span
          className={cn(
            "absolute top-px left-px size-4 bg-card transition-transform duration-150 ease-standard",
            checked ? "translate-x-5" : "dark:bg-muted-foreground",
          )}
        />
      </button>
    </label>
  );
}

import {
  type Cardinality,
  CARDINALITIES,
  type ChartData,
  BACKDROP_BLUR_MAX,
  BLUR_TYPES,
  type ChartKind,
  type ConnectorRoute,
  CUSTOM_COLORS_MAX,
  type Gradient,
  GRADIENT_TYPES,
  IMAGE_FILL_TYPES,
  IMAGE_TYPES,
  type ImageFill,
  CUSTOM_FONTS_MAX,
  LETTER_SPACING_MAX,
  MIND_TEXT_COLOR,
  LETTER_SPACING_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  type Radius,
  type Shadow,
  SHADOW_TYPES,
  TABLE_COLUMNS_MAX,
  TABLE_DESCRIPTION_MAX,
  TABLE_TEXT_COLOR,
  type TableColumn,
  type TableData,
  type UpdateBoardStyleInput,
} from "@prism/shared";
import { motion } from "motion/react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { memo, type ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { EASE_STANDARD } from "@/lib/motion";
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
import { IconGrid } from "./icon-picker";
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
import {
  clampFontPx,
  fontPx,
  letterSpacingOf,
  lineHeightOf,
  resetMeasurements,
} from "./text-layout";

const SHAPES: ElementType[] = ["rect", "ellipse", "diamond"];
/** Text colors offered for mind map nodes: dark and white first, for light and dark fills. */
const MIND_TEXT_COLORS = ["#3d3b4f", "#ffffff", ...STROKE_COLORS.slice(1, 7)];
const FILL_TYPES = ["solid", "linear", "radial"] as const;
type FillType = (typeof FILL_TYPES)[number];
/** The second color a new gradient starts with. */
const GRADIENT_END = "#28e99f";

/** Switches an element between a solid fill and a gradient, keeping its colors. */
function fillTypeChange(el: BoardElement, type: FillType): Partial<BoardElement> {
  if (type === "solid") return { gradient: null };
  const stops = el.gradient?.stops ?? [
    { color: el.fill ?? "#5882ff", position: 0 },
    { color: GRADIENT_END, position: 100 },
  ];
  const gradient: Gradient =
    type === "linear"
      ? { type, angle: el.gradient?.type === "linear" ? el.gradient.angle : 135, stops }
      : { type, stops };
  return { gradient, fill: stops[0]?.color ?? el.fill };
}

/** The largest corner radius the panel offers, in px. */
const RADIUS_MAX = 999;
const CORNER_NAMES = ["Top left", "Top right", "Bottom right", "Bottom left"] as const;
type Corners = [number, number, number, number];
/** The shadow choices, and the preset each one stores. */
const SHADOW_OPTIONS = ["none", "small", "medium", "large"] as const;
type ShadowOption = (typeof SHADOW_OPTIONS)[number];
const SHADOW_PRESETS: Record<ShadowOption, Shadow | null> = {
  none: null,
  small: "sm",
  medium: "md",
  large: "lg",
};

/** Which element types each property applies to (tools.md §3). Unlisted ones apply to all. */
const APPLIES_TO: Partial<Record<keyof BoardElement, ElementType[]>> = {
  // On text and lists the stroke is the text color; on icons, the icon's color.
  // On mind map nodes it's the branch color, and the fill is the node's background.
  stroke: [...SHAPES, "line", "arrow", "freehand", "text", "list", "icon", "mindnode", "table"],
  fill: [...SHAPES, "sticky", "icon", "mindnode", "frame", "table"],
  gradient: [...GRADIENT_TYPES],
  fillImage: [...IMAGE_FILL_TYPES],
  backdropBlur: [...BLUR_TYPES],
  strokeWidth: [...SHAPES, "line", "arrow", "freehand", "icon", "mindnode", "table"],
  strokeStyle: [...SHAPES, "line", "arrow"],
  sketch: [...SHAPES, "line", "arrow", "table"],
  radius: ["rect", "frame"],
  shadow: [...SHADOW_TYPES],
  font: ["text", "sticky", "list", "mindnode"],
  fontSize: ["text", "sticky", "list", "mindnode"],
  fontSizePx: ["text", "sticky", "list", "mindnode"],
  fontWeight: ["text", "sticky", "list", "mindnode"],
  textAlign: ["text", "sticky", "list"],
  lineHeight: ["text", "sticky", "list"],
  letterSpacing: ["text", "sticky", "list"],
  textColor: ["mindnode", "table"],
  chart: ["chart"],
  icon: ["icon"],
  table: ["table"],
  keysOnly: ["table"],
  route: ["arrow"],
  startHead: ["arrow"],
  endHead: ["arrow"],
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

// Memoized: the board editor re-renders on every pan and zoom frame.
export const PropertiesPanel = memo(PropertiesPanelView);

function PropertiesPanelView({
  elements,
  customColors,
  customFonts,
  onChange,
  onLayer,
  onTidy,
  onStyleChange,
  onUploadImage,
}: {
  /** The selection; changes go to each element they apply to. */
  elements: BoardElement[];
  /** The board's saved swatches (#rrggbb) and added Google fonts, newest first. */
  customColors: string[];
  customFonts: string[];
  onChange: (changes: Partial<BoardElement>) => void;
  onLayer: (move: LayerMove) => void;
  /** Lays out the mind map a node belongs to again. */
  onTidy: (id: string) => void;
  onStyleChange: (style: UpdateBoardStyleInput) => void;
  /** Uploads an image to the board; its asset key, or null if it failed (the board says why). */
  onUploadImage: (file: File) => Promise<string | null>;
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
  const shadowEl = source("shadow");
  const gradientEl = source("gradient");
  const imageEl = source("fillImage");
  const blurEl = source("backdropBlur");
  const gradient = gradientEl?.gradient ?? null;

  /** The gradient with one stop's color changed by hand; the fill follows the first stop. */
  const pickStop = (index: number, color: string) => {
    if (!gradient) return;
    const stops = gradient.stops.map((stop, i) =>
      i === index ? { color, position: stop.position } : stop,
    );
    onChange({ gradient: { ...gradient, stops }, ...(index === 0 && { fill: color }) });
  };
  const stopChoices = (index: number, label: string) =>
    gradient && (
      <ColorChoices
        label={label}
        value={gradient.stops[index]?.color ?? null}
        presets={FILL_COLORS}
        custom={customColors}
        disabled={locked}
        onPick={(color) => pickStop(index, color)}
        onAdd={(hex) => {
          addColor(hex);
          pickStop(index, hex);
        }}
        onRemove={removeColor}
      />
    );
  const textEl = source("font");
  const chartEl = elements.length === 1 && first.type === "chart" ? first : undefined;
  const tableEl = elements.length === 1 && first.type === "table" ? first : undefined;
  const arrowEl = source("route");
  const iconEl = source("icon");
  const width = widthEl
    ? (Object.keys(STROKE_WIDTHS) as (keyof typeof STROKE_WIDTHS)[]).find(
        (key) => STROKE_WIDTHS[key] === widthEl.strokeWidth,
      )
    : undefined;
  const title = elements.length === 1 ? elementLabel(first) : `${elements.length} items`;
  // Sticky notes always have a color; shapes and icons can have no fill.
  const onlySticky = elements
    .filter((el) => applies("fill", el))
    .every((el) => el.type === "sticky");
  const inked = elements.filter((el) => applies("stroke", el));
  const onlyText = inked.every((el) => el.type === "text" || el.type === "list");
  const onlyIcons = inked.every((el) => el.type === "icon");
  const onlyMind = inked.every((el) => el.type === "mindnode");
  const onlyTables = inked.every((el) => el.type === "table");
  const strokeLabel = onlyText
    ? "Text color"
    : onlyIcons
      ? "Icon color"
      : onlyMind
        ? "Branch color"
        : onlyTables
          ? "Border color"
          : "Stroke color";
  const mindEl = source("textColor");
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
      className="absolute top-6 right-4 z-10 max-h-[calc(100%-2.5rem)] w-64 overflow-y-auto border border-chrome bg-card shadow-sm md:right-6"
    >
      <h2 className="flex h-12 items-center border-b border-divider px-4 text-sm font-bold text-ink">
        {title}
      </h2>

      <fieldset disabled={locked} className="contents">
        {stroke || fill || radiusEl || shadowEl ? (
          <section className="flex flex-col gap-3.5 border-b border-divider px-4 pt-2.5 pb-6">
            {stroke && (
              <Row label={onlyText || onlyIcons || onlyMind || onlyTables ? strokeLabel : "Stroke"}>
                <ColorChoices
                  label={strokeLabel}
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

            {gradientEl && (
              <Row label="Fill type">
                <Segmented<FillType>
                  options={FILL_TYPES}
                  value={gradient?.type ?? "solid"}
                  onChange={(type) => onChange(fillTypeChange(gradientEl, type))}
                />
              </Row>
            )}

            {gradient && (
              <>
                <Row label="From">{stopChoices(0, "Gradient start color")}</Row>
                <Row label="To">{stopChoices(gradient.stops.length - 1, "Gradient end color")}</Row>
                {gradient.type === "linear" && (
                  <Row label="Angle">
                    <NumberInput
                      key={gradientEl?.id}
                      label="Gradient angle, in degrees (0 points up, 90 right)"
                      value={gradient.angle}
                      min={-360}
                      max={360}
                      step={15}
                      unit="°"
                      onChange={(angle) => onChange({ gradient: { ...gradient, angle } })}
                    />
                  </Row>
                )}
              </>
            )}

            {fill && !gradient && (
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
                            : "border-divider bg-card hover:bg-hover",
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
              <Row label="Corner radius">
                <CornerInputs
                  key={radiusEl.id}
                  radius={radiusEl.radius ?? 0}
                  onChange={(radius) => onChange({ radius })}
                />
              </Row>
            )}

            {imageEl && (
              <Row label="Image fill">
                <ImageFillControls
                  image={imageEl.fillImage ?? null}
                  onUpload={onUploadImage}
                  onChange={(fillImage) => onChange({ fillImage })}
                />
              </Row>
            )}

            {blurEl && (
              <Row label="Background blur">
                <NumberInput
                  key={blurEl.id}
                  label="Background blur, in px: frosts what's under it"
                  value={blurEl.backdropBlur ?? 0}
                  min={0}
                  max={BACKDROP_BLUR_MAX}
                  step={2}
                  unit="px"
                  onChange={(px) => onChange({ backdropBlur: px || null })}
                />
              </Row>
            )}

            {shadowEl && (
              <Row label="Shadow">
                <Segmented<ShadowOption>
                  options={SHADOW_OPTIONS}
                  value={SHADOW_OPTIONS.find(
                    (option) => SHADOW_PRESETS[option] === (shadowEl.shadow ?? null),
                  )}
                  onChange={(option) => onChange({ shadow: SHADOW_PRESETS[option] })}
                />
                {Array.isArray(shadowEl.shadow) && (
                  <p className="mt-2 font-mono text-3xs text-muted-foreground">
                    Custom ({shadowEl.shadow.length}{" "}
                    {shadowEl.shadow.length === 1 ? "layer" : "layers"}). Pick a size to replace it.
                  </p>
                )}
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
            {source("lineHeight") && (
              <div className="grid grid-cols-2 gap-3">
                <Row label="Line height">
                  <NumberInput
                    key={textEl.id}
                    label="Line height, in percent of the text size"
                    value={Math.round(lineHeightOf(textEl) * 100)}
                    min={Math.round(LINE_HEIGHT_MIN * 100)}
                    max={Math.round(LINE_HEIGHT_MAX * 100)}
                    step={5}
                    unit="%"
                    onChange={(percent) => onChange({ lineHeight: percent / 100 })}
                  />
                </Row>
                <Row label="Letter spacing">
                  <NumberInput
                    key={textEl.id}
                    label="Letter spacing, in percent of the text size"
                    value={Math.round(letterSpacingOf(textEl) * 100)}
                    min={Math.round(LETTER_SPACING_MIN * 100)}
                    max={Math.round(LETTER_SPACING_MAX * 100)}
                    step={1}
                    unit="%"
                    onChange={(percent) => onChange({ letterSpacing: percent / 100 })}
                  />
                </Row>
              </div>
            )}
            {source("textAlign") && (
              <Row label="Text align">
                <Segmented<TextAlign>
                  options={["left", "center", "right"]}
                  value={textEl.textAlign ?? "left"}
                  onChange={(textAlign) => onChange({ textAlign })}
                />
              </Row>
            )}
          </section>
        )}

        {mindEl && (
          <section className="flex flex-col gap-3.5 border-b border-divider px-4 pt-4.5 pb-6">
            <Row label="Text color">
              <ColorChoices
                label="Text color"
                value={
                  mindEl.textColor ?? (mindEl.type === "table" ? TABLE_TEXT_COLOR : MIND_TEXT_COLOR)
                }
                presets={MIND_TEXT_COLORS}
                custom={customColors}
                disabled={locked}
                onPick={(textColor) => onChange({ textColor })}
                onAdd={(hex) => {
                  addColor(hex);
                  onChange({ textColor: hex });
                }}
                onRemove={removeColor}
              />
            </Row>
            {mindEl.type === "mindnode" && (
              <button
                type="button"
                onClick={() => onTidy(mindEl.id)}
                className="h-8 bg-background font-mono text-2xs text-foreground transition-colors duration-150 ease-standard hover:bg-divider"
              >
                Tidy up the map
              </button>
            )}
          </section>
        )}

        {iconEl && (
          <section className="flex flex-col border-b border-divider pt-4.5">
            <p className="mb-3 px-4 font-mono text-3xs leading-[14px] text-muted-foreground uppercase">
              Icon
            </p>
            <IconGrid
              value={iconEl.icon ?? null}
              onPick={(icon) => onChange({ icon })}
              className="border-t border-divider"
            />
          </section>
        )}

        {chartEl?.chart && (
          <ChartEditor chart={chartEl.chart} onChange={(chart) => onChange({ chart })} />
        )}

        {tableEl?.table && (
          <TableEditor
            table={tableEl.table}
            keysOnly={!!tableEl.keysOnly}
            onChange={(table) => onChange({ table })}
            onKeysOnly={(keysOnly) => onChange({ keysOnly })}
          />
        )}

        {arrowEl && (
          <section className="flex flex-col gap-3.5 border-b border-divider px-4 pt-4.5 pb-6">
            <Row label="Route">
              <Segmented<ConnectorRoute>
                options={["straight", "elbow"]}
                value={arrowEl.route ?? "straight"}
                onChange={(route) => onChange({ route })}
              />
            </Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Start">
                <HeadPicker
                  label="Start of the line"
                  value={arrowEl.startHead ?? null}
                  none="None"
                  onChange={(startHead) => onChange({ startHead })}
                />
              </Row>
              <Row label="End">
                <HeadPicker
                  label="End of the line"
                  value={arrowEl.endHead ?? null}
                  none="Arrow"
                  onChange={(endHead) => onChange({ endHead })}
                />
              </Row>
            </div>
          </section>
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
 * A whole percentage typed in, or stepped with the arrow keys (`step`, ×5 with Shift). It commits
 * on Enter or blur, kept within `min`–`max`.
 */
function NumberInput({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Shown after the number: "%", "px", "°". */
  unit: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // A value changed elsewhere (another element, undo, an AI edit) replaces the draft.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setDraft(String(value));
  }
  const commit = (percent: number) => {
    const next = Math.min(max, Math.max(min, Math.round(percent)));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  const typed = () => {
    const percent = Number.parseInt(draft, 10);
    if (Number.isNaN(percent)) setDraft(String(value));
    else commit(percent);
  };
  return (
    <label className="flex h-7 items-center border border-divider bg-background pr-1.5 focus-within:border-foreground">
      <span className="sr-only">{label}</span>
      <input
        value={draft}
        inputMode="numeric"
        maxLength={4}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9-]/g, ""))}
        onBlur={typed}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            typed();
          } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const delta = step * (event.shiftKey ? 5 : 1) * (event.key === "ArrowUp" ? 1 : -1);
            const current = Number.parseInt(draft, 10);
            commit((Number.isNaN(current) ? value : current) + delta);
          }
        }}
        className="h-full w-full min-w-0 bg-transparent px-1.5 text-right font-mono text-2xs text-foreground tabular-nums outline-none"
      />
      <span aria-hidden="true" className="font-mono text-3xs text-muted-foreground">
        {unit}
      </span>
    </label>
  );
}

/** An image inside the shape: add, replace or remove it, and crop it (cover) or fit it (contain). */
function ImageFillControls({
  image,
  onUpload,
  onChange,
}: {
  image: ImageFill | null;
  onUpload: (file: File) => Promise<string | null>;
  onChange: (image: ImageFill | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const button = cn(segmentButton, "bg-background text-foreground hover:bg-divider");
  return (
    <div className="flex flex-col gap-1">
      {image && (
        <Segmented<ImageFill["fit"]>
          options={["cover", "contain"]}
          value={image.fit}
          onChange={(fit) => onChange({ ...image, fit })}
        />
      )}
      <div className={cn("grid gap-1", image && "grid-cols-2")}>
        <button type="button" onClick={() => input.current?.click()} className={button}>
          {image ? "Replace" : "Add image"}
        </button>
        {image && (
          <button type="button" onClick={() => onChange(null)} className={button}>
            Remove
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void onUpload(file).then((assetKey) => {
            if (assetKey) onChange({ assetKey, fit: image?.fit ?? "cover" });
          });
        }}
      />
    </div>
  );
}

/** One radius for every corner, or four (top left, top right, bottom right, bottom left). */
function CornerInputs({
  radius,
  onChange,
}: {
  radius: Radius;
  onChange: (radius: Radius) => void;
}) {
  const [each, setEach] = useState(Array.isArray(radius));
  const corners: Corners = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
  const toggle = () => {
    // Back to one radius: every corner takes the top left's.
    if (each && Array.isArray(radius)) onChange(radius[0]);
    setEach(!each);
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <div className="min-w-0 flex-1">
          {each ? (
            <div className="grid grid-cols-4 gap-1">
              {CORNER_NAMES.map((name, i) => (
                <NumberInput
                  key={name}
                  label={`${name} corner radius, in px`}
                  value={corners[i] ?? 0}
                  min={0}
                  max={RADIUS_MAX}
                  step={1}
                  unit=""
                  onChange={(r) => {
                    const next: Corners = [...corners];
                    next[i] = r;
                    onChange(next);
                  }}
                />
              ))}
            </div>
          ) : (
            <NumberInput
              label="Corner radius, in px"
              value={corners[0]}
              min={0}
              max={RADIUS_MAX}
              step={1}
              unit="px"
              onChange={onChange}
            />
          )}
        </div>
        <button
          type="button"
          aria-pressed={each}
          title="Set each corner"
          onClick={toggle}
          className={cn(
            segmentButton,
            "px-2",
            each
              ? "bg-secondary text-secondary-foreground"
              : "bg-background text-foreground hover:bg-divider",
          )}
        >
          Each
        </button>
      </div>
    </div>
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
            "flex size-5 shrink-0 items-center justify-center border border-input bg-card text-foreground hover:bg-hover",
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
                    className="flex size-7 items-center justify-center text-muted-foreground hover:bg-hover hover:text-ink disabled:opacity-40"
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

const HEAD_NAMES: Record<Cardinality, string> = {
  one: "One",
  many: "Many",
  "zero-or-one": "Zero or one",
  "zero-or-many": "Zero or many",
  "one-or-many": "One or many",
};

/** An arrow end: its plain look (`none`), or a crow's-foot cardinality for an ER relation. */
function HeadPicker({
  label,
  value,
  none,
  onChange,
}: {
  label: string;
  value: Cardinality | null;
  none: string;
  onChange: (head: Cardinality | null) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(event) => {
        const head = CARDINALITIES.find((c) => c === event.target.value);
        onChange(head ?? null);
      }}
      className="h-7 w-full border border-divider bg-background px-1.5 font-mono text-2xs text-foreground outline-none focus:border-foreground"
    >
      <option value="">{none}</option>
      {CARDINALITIES.map((head) => (
        <option key={head} value={head}>
          {HEAD_NAMES[head]}
        </option>
      ))}
    </select>
  );
}

/** Column flags, as the table editor toggles them. */
const COLUMN_FLAGS = [
  { key: "pk", label: "PK", title: "Primary key" },
  { key: "fk", label: "FK", title: "Foreign key" },
  { key: "nullable", label: "Null", title: "Nullable" },
  { key: "unique", label: "Uniq", title: "Unique" },
] as const;

/**
 * A name that can't be empty: while the field is cleared to type a new one, the old name stays;
 * leaving it empty puts the old name back.
 */
function NameInput({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (name: string) => void;
  className: string;
}) {
  const [draft, setDraft] = useState(value);
  // A name changed elsewhere (undo, another tab) replaces the draft.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setDraft(value);
  }
  return (
    <input
      aria-label={label}
      value={draft}
      maxLength={64}
      onChange={(event) => {
        setDraft(event.target.value);
        if (event.target.value.trim()) onChange(event.target.value);
      }}
      onBlur={() => {
        if (!draft.trim()) setDraft(value);
      }}
      className={className}
    />
  );
}

/** A table's name and columns as plain inputs (tools.md §1, tool 20). */
function TableEditor({
  table,
  keysOnly,
  onChange,
  onKeysOnly,
}: {
  table: TableData;
  keysOnly: boolean;
  onChange: (table: TableData) => void;
  /** Shows only the key columns on the board (and "+N more"); the rest stay in the table. */
  onKeysOnly: (keysOnly: boolean) => void;
}) {
  const columns = table.columns;
  const setColumns = (next: TableColumn[]) => onChange({ ...table, columns: next });
  const setColumn = (i: number, changes: Partial<TableColumn>) =>
    setColumns(
      columns.map((column, j) => {
        if (j !== i) return column;
        const next: TableColumn = { ...column, ...changes };
        // Flags are stored only when on.
        for (const flag of COLUMN_FLAGS) if (!next[flag.key]) delete next[flag.key];
        return next;
      }),
    );
  const move = (i: number, by: number) => {
    const next = [...columns];
    const [column] = next.splice(i, 1);
    if (column) next.splice(i + by, 0, column);
    setColumns(next);
  };
  const freeName = () => {
    let n = columns.length + 1;
    while (columns.some((c) => c.name === `column${n}`)) n++;
    return `column${n}`;
  };
  const cell =
    "h-7 w-full min-w-0 border border-divider bg-background px-1.5 text-xs text-foreground outline-none focus:border-foreground";
  const iconButton =
    "flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:bg-hover hover:text-ink disabled:opacity-40";

  return (
    <section className="flex flex-col gap-3.5 border-b border-divider px-4 pt-4.5 pb-6">
      <Row label="Table name">
        <NameInput
          label="Table name"
          value={table.name}
          onChange={(name) => onChange({ ...table, name })}
          className={cell}
        />
      </Row>
      <Row label="Description">
        <textarea
          aria-label="Table description"
          value={table.description ?? ""}
          maxLength={TABLE_DESCRIPTION_MAX}
          rows={3}
          placeholder="What this table holds"
          onChange={(event) => {
            const { description: _old, ...rest } = table;
            const description = event.target.value;
            onChange(description.trim() ? { ...rest, description } : rest);
          }}
          className="w-full resize-y border border-divider bg-background px-1.5 py-1 text-xs leading-relaxed text-foreground outline-none focus:border-foreground"
        />
      </Row>
      <Toggle label="Keys only" checked={keysOnly} onChange={onKeysOnly} />
      <Row label="Columns">
        <ol className="flex flex-col gap-2.5">
          {columns.map((column, i) => (
            <li key={i} className="flex flex-col gap-1">
              <div className="flex gap-1">
                <NameInput
                  label={`Column ${i + 1} name`}
                  value={column.name}
                  onChange={(name) => setColumn(i, { name })}
                  className={cn(cell, column.pk && "font-semibold")}
                />
                <input
                  aria-label={`Column ${i + 1} type`}
                  value={column.type}
                  maxLength={64}
                  onChange={(event) => setColumn(i, { type: event.target.value })}
                  className={cn(cell, "w-[82px] shrink-0 font-mono text-2xs")}
                />
              </div>
              <div className="flex items-center gap-1">
                {COLUMN_FLAGS.map((flag) => (
                  <button
                    key={flag.key}
                    type="button"
                    title={flag.title}
                    aria-pressed={!!column[flag.key]}
                    aria-label={`${flag.title}: ${column.name}`}
                    onClick={() => setColumn(i, { [flag.key]: !column[flag.key] })}
                    className={cn(
                      segmentButton,
                      "min-w-0 flex-1 px-0.5",
                      column[flag.key]
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-background text-foreground hover:bg-divider",
                    )}
                  >
                    {flag.label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label={`Move ${column.name} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className={iconButton}
                >
                  <ArrowUp aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${column.name} down`}
                  disabled={i === columns.length - 1}
                  onClick={() => move(i, 1)}
                  className={iconButton}
                >
                  <ArrowDown aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${column.name}`}
                  onClick={() => setColumns(columns.filter((_, j) => j !== i))}
                  className={iconButton}
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          disabled={columns.length >= TABLE_COLUMNS_MAX}
          onClick={() => setColumns([...columns, { name: freeName(), type: "text" }])}
          className={cn(
            segmentButton,
            "mt-2.5 w-full bg-background text-foreground hover:bg-divider",
          )}
        >
          + Add column
        </button>
      </Row>
    </section>
  );
}

const segmentButton =
  "h-7 font-mono text-2xs transition-colors duration-150 ease-standard disabled:pointer-events-none disabled:opacity-60";

export function Row({
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
        <motion.span
          className={cn(
            "absolute top-px left-px size-4 bg-card",
            !checked && "dark:bg-muted-foreground",
          )}
          initial={false}
          animate={{ x: checked ? 20 : 0 }}
          transition={{ duration: 0.15, ease: EASE_STANDARD }}
        />
      </button>
    </label>
  );
}

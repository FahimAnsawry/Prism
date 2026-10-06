import { z } from "zod";
import {
  type BoardElement,
  type ElementTokens,
  type FontFamily,
  fontFamilySchema,
  iconNameSchema,
  isThemeRef,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  shadowSchema,
  type TextAlign,
  textAlignSchema,
  type ThemeRef,
  themeRefSchema,
} from "./elements.js";

// create_screen (tools.md §6): an AI editor describes a screen as a layout tree and this lays it
// out, flexbox-style, into plain board elements with x/y. Text is measured by a TextMeasurer: an
// open board tab's canvas measures it exactly; without one the server estimates.

// ── Tree ──────────────────────────────────────────────────────────────────

/** A size along one axis: px, "fill" (the space the parent offers), or left out to hug content. */
export type LayoutSize = number | "fill";
/** CSS-style padding: all sides, [vertical, horizontal], [top, horizontal, bottom] or all four. */
export type LayoutPadding = number | number[];
export type LayoutAlign = "start" | "center" | "end" | "stretch";
export type LayoutJustify = "start" | "center" | "end" | "space-between";

interface NodeBase {
  /** What it is in the UI ("button", "card", "nav", …), stored on what it draws. */
  role?: string | undefined;
  /** Groups everything it draws into one component (its groupId). */
  name?: string | undefined;
  /** The theme tokens behind its values; set by resolveLayoutTokens (theme.ts), not by AI editors. */
  tokens?: ElementTokens | undefined;
  /** The project component instance it belongs to; set by expandComponents (components.ts). */
  component?: string | undefined;
}

export interface LayoutContainer extends NodeBase {
  type: "stack" | "row" | "grid";
  children: LayoutNode[];
  gap?: number | undefined;
  padding?: LayoutPadding | undefined;
  align?: LayoutAlign | undefined;
  justify?: LayoutJustify | undefined;
  /** Grid only: equal-width columns. */
  columns?: number | undefined;
  width?: LayoutSize | undefined;
  height?: LayoutSize | undefined;
  fill?: string | undefined;
  stroke?: string | undefined;
  strokeWidth?: number | undefined;
  radius?: number | ThemeRef | undefined;
  shadow?: z.infer<typeof shadowSchema> | undefined;
}

export interface LayoutText extends NodeBase {
  type: "text";
  text: string;
  /** A theme text style ($h1, $body, …): size, weight, line height, spacing and font. */
  textStyle?: ThemeRef | undefined;
  font?: FontFamily | ThemeRef | undefined;
  fontSizePx?: number | undefined;
  fontWeight?: number | undefined;
  color?: string | undefined;
  lineHeight?: number | undefined;
  letterSpacing?: number | undefined;
  textAlign?: TextAlign | undefined;
  width?: LayoutSize | undefined;
}

export interface LayoutIcon extends NodeBase {
  type: "icon";
  icon: string;
  size?: number | undefined;
  color?: string | undefined;
  strokeWidth?: number | undefined;
}

export interface LayoutBox extends NodeBase {
  type: "box";
  height: number;
  width?: LayoutSize | undefined;
  shape?: "rect" | "ellipse" | undefined;
  fill?: string | undefined;
  stroke?: string | undefined;
  strokeWidth?: number | undefined;
  radius?: number | ThemeRef | undefined;
  shadow?: z.infer<typeof shadowSchema> | undefined;
}

export interface LayoutSpacer {
  type: "spacer";
  size?: number | undefined;
}

export interface LayoutDivider {
  type: "divider";
  color?: string | undefined;
  thickness?: number | undefined;
  tokens?: ElementTokens | undefined;
  component?: string | undefined;
}

/** A project component placed in the tree (components.ts expands it before layout). */
export interface LayoutUse {
  type: "use";
  component: string;
  variant?: string | undefined;
  props?: Record<string, string | number | null> | undefined;
  /** Fill the component's slot. */
  children?: LayoutNode[] | undefined;
  width?: LayoutSize | undefined;
  height?: LayoutSize | undefined;
  role?: string | undefined;
  name?: string | undefined;
}

/** Inside a component definition: where a use's children go. */
export interface LayoutSlot {
  type: "slot";
}

export type LayoutNode =
  | LayoutContainer
  | LayoutText
  | LayoutIcon
  | LayoutBox
  | LayoutSpacer
  | LayoutDivider
  | LayoutUse
  | LayoutSlot;

const px = z.number().min(0).max(10_000);
const color = z
  .string()
  .max(64)
  .describe("A theme token ($primary, $muted-foreground, $border, …) or a hex color.");
const radius = z
  .union([px, themeRefSchema])
  .describe("Corner radius: a theme token ($radius-md, $radius-lg, $radius-full) or px.");
const sizeSchema = z.union([px, z.literal("fill")]);
const base = {
  role: z.string().max(60).optional().describe('What it is: "button", "card", "nav", "input", …'),
  name: z
    .string()
    .max(40)
    .optional()
    .describe("Names a component: everything it draws gets one groupId, so it moves as one."),
};

const containerSchema = z.object({
  type: z
    .enum(["stack", "row", "grid"])
    .describe("stack: children top to bottom. row: left to right. grid: equal-width columns."),
  get children(): z.ZodArray<z.ZodType<LayoutNode>> {
    return z.array(layoutNodeSchema).max(200);
  },
  gap: px.optional().describe("Space between children. Default 0."),
  padding: z
    .union([px, z.array(px).min(2).max(4)])
    .optional()
    .describe("Like CSS: 16, [12, 20] (vertical, horizontal) or [t, r, b, l]."),
  align: z
    .enum(["start", "center", "end", "stretch"])
    .optional()
    .describe(
      "Cross-axis alignment. Default: stretch in a stack (child containers, boxes and dividers take the full width; text and icons keep their size), center in a row.",
    ),
  justify: z
    .enum(["start", "center", "end", "space-between"])
    .optional()
    .describe("Main-axis distribution of leftover space. Default start."),
  columns: z.number().int().min(1).max(12).optional().describe("Grid only. Default 2."),
  width: sizeSchema.optional().describe('px, "fill", or left out to hug the content.'),
  height: sizeSchema
    .optional()
    .describe('px, "fill" (share a fixed-height parent\'s leftover), or left out to hug.'),
  fill: color
    .optional()
    .describe("Background color ($token or hex); with any of fill/stroke/shadow it draws a rect."),
  stroke: color.optional().describe("Border color ($border or hex; 1px unless strokeWidth)."),
  strokeWidth: z.number().min(0).max(64).optional(),
  radius: radius.optional(),
  shadow: shadowSchema.optional().describe("sm, md (cards) or lg (menus, modals)."),
  ...base,
});

const textSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(5_000).describe("The copy; \\n for line breaks."),
  textStyle: themeRefSchema
    .optional()
    .describe(
      "The theme's text style: $display, $h1–$h4, $body-lg, $body, $body-sm, $caption or $label. Sets size, weight, line height, spacing and font. Default $body.",
    ),
  font: z
    .union([fontFamilySchema, themeRefSchema])
    .optional()
    .describe(
      "$heading, $sans or $mono (the theme's fonts), or a board font id. Default: the call's font, else $sans.",
    ),
  fontSizePx: z
    .number()
    .min(6)
    .max(400)
    .optional()
    .describe("Overrides the text style's size; avoid it (a strict theme refuses it)."),
  fontWeight: z.number().int().min(100).max(900).multipleOf(100).optional(),
  color: color.optional().describe("Text color ($token or hex). Default $foreground."),
  lineHeight: z.number().min(LINE_HEIGHT_MIN).max(LINE_HEIGHT_MAX).optional(),
  letterSpacing: z.number().min(LETTER_SPACING_MIN).max(LETTER_SPACING_MAX).optional(),
  textAlign: textAlignSchema.optional().describe("Within its width; matters with width fill/px."),
  width: sizeSchema
    .optional()
    .describe('Left out: its natural width, wrapping only if too wide. "fill" or px: wraps to it.'),
  ...base,
});

const iconSchema = z.object({
  type: z.literal("icon"),
  icon: iconNameSchema.describe('Lucide name, e.g. "search", "bell", "chevron-right".'),
  size: z.number().min(4).max(512).optional().describe("Default 20."),
  color: color.optional().describe("Icon color ($token or hex). Default $foreground."),
  strokeWidth: z.number().min(0.5).max(4).optional().describe("Default 2."),
  ...base,
});

const boxSchema = z.object({
  type: z.literal("box"),
  height: px.describe("Height in px."),
  width: sizeSchema.optional().describe('px or "fill" (default).'),
  shape: z.enum(["rect", "ellipse"]).optional().describe("ellipse for avatars and dots."),
  fill: color.optional(),
  stroke: color.optional(),
  strokeWidth: z.number().min(0).max(64).optional(),
  radius: radius.optional(),
  shadow: shadowSchema.optional(),
  ...base,
});

const spacerSchema = z.object({
  type: z.literal("spacer"),
  size: px.optional().describe("Fixed space; left out it takes all leftover main-axis space."),
});

const dividerSchema = z.object({
  type: z.literal("divider"),
  color: color.optional().describe("Default $border."),
  thickness: z.number().min(0.5).max(16).optional().describe("Default 1."),
});

/** A project component's name: PascalCase. */
export const componentNameSchema = z
  .string()
  .regex(/^[A-Z][A-Za-z0-9]{0,39}$/, "Use PascalCase, e.g. Button or PageHeader.");
/** A component prop's value: text, a token, a number, or null for "leave the field out". */
export const componentPropValueSchema = z.union([z.string().max(5_000), z.number(), z.null()]);

const useSchema = z.object({
  type: z.literal("use"),
  component: componentNameSchema.describe("A project component (list_components)."),
  variant: z
    .string()
    .max(31)
    .optional()
    .describe('One of its variants, e.g. "primary", "ghost". Default: its default variant.'),
  props: z
    .record(z.string(), componentPropValueSchema)
    .optional()
    .describe('Its props, e.g. { label: "Save", icon: "plus" }.'),
  get children(): z.ZodOptional<z.ZodArray<z.ZodType<LayoutNode>>> {
    return z.array(layoutNodeSchema).max(200).optional();
  },
  width: sizeSchema.optional().describe('Override its width: px or "fill".'),
  height: sizeSchema.optional().describe("Override its height."),
  role: base.role,
  name: base.name,
});

const slotSchema = z.object({ type: z.literal("slot") });

export const layoutNodeSchema: z.ZodType<LayoutNode> = z.lazy(() =>
  z.union([
    containerSchema,
    textSchema,
    iconSchema,
    boxSchema,
    spacerSchema,
    dividerSchema,
    useSchema,
    slotSchema,
  ]),
);

/** Most nodes one screen can have. */
export const LAYOUT_NODES_MAX = 800;

export function countNodes(node: LayoutNode): number {
  return "children" in node && node.children
    ? 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0)
    : 1;
}

// ── Measuring ─────────────────────────────────────────────────────────────

export interface LayoutTextStyle {
  font: FontFamily;
  px: number;
  weight: number;
  /** In ems. */
  letterSpacing: number;
}

/** Wraps `text` to `maxWidth` (null: only at newlines) and reports the widest line and the count. */
export type TextMeasurer = (
  text: string,
  style: LayoutTextStyle,
  maxWidth: number | null,
) => { width: number; lines: number };

/** A rough measurer for when no board tab can measure: average glyph widths, word wrapping. */
export const estimateText: TextMeasurer = (text, style, maxWidth) => {
  const charWidth = style.px * (0.55 + style.letterSpacing);
  let lines = 0;
  let widest = 0;
  for (const paragraph of text.split("\n")) {
    if (maxWidth === null || paragraph.length * charWidth <= maxWidth) {
      lines++;
      widest = Math.max(widest, paragraph.length * charWidth);
      continue;
    }
    let line = 0;
    for (const word of paragraph.split(/\s+/)) {
      const width = word.length * charWidth;
      const next = line === 0 ? width : line + charWidth + width;
      if (next <= maxWidth || line === 0) line = next;
      else {
        lines++;
        widest = Math.max(widest, line);
        line = width;
      }
    }
    lines++;
    widest = Math.max(widest, line);
  }
  return { width: Math.min(widest, maxWidth ?? widest), lines };
};

// ── Layout ────────────────────────────────────────────────────────────────

export interface LayoutOptions {
  /** Top-left corner of the screen on the board. */
  x: number;
  y: number;
  /** The screen's width (the root fills it). */
  width: number;
  /** Fixed height (the root fills it, so spacers can push content down); left out to hug. */
  height?: number | undefined;
  /** Font for text nodes that don't name one. */
  font: FontFamily;
}

/** One element to create: everything but the id, version and layer, which the server assigns. */
export type LayoutElement = Partial<Omit<BoardElement, "id" | "version" | "z" | "updatedBy">> &
  Pick<BoardElement, "type" | "x" | "y" | "width" | "height">;

const TEXT_COLOR = "#3d3b4f";
const DIVIDER_COLOR = "#e5e7eb";
const LINE_HEIGHT = 1.25;
const TEXT_PX = 16;
const ICON_SIZE = 20;

interface Size {
  width: number;
  height: number;
}

/** Top, right, bottom, left. */
function paddingOf(node: LayoutContainer): [number, number, number, number] {
  const p = node.padding ?? 0;
  if (typeof p === "number") return [p, p, p, p];
  const [a = 0, b = a, c = a, d = b] = p;
  return [a, b, c, d];
}

const isContainer = (node: LayoutNode): node is LayoutContainer =>
  node.type === "stack" || node.type === "row" || node.type === "grid";
/** A node's font; a theme token left unresolved falls back to the screen's font. */
const fontOf = (font: FontFamily | ThemeRef | undefined, fallback: FontFamily): FontFamily =>
  font === undefined || isThemeRef(font) ? fallback : font;
const hasBackground = (node: LayoutContainer) =>
  node.fill !== undefined || node.stroke !== undefined || node.shadow !== undefined;

export function layoutScreen(
  root: LayoutNode,
  options: LayoutOptions,
  measureText: TextMeasurer,
): LayoutElement[] {
  const out: LayoutElement[] = [];
  const groupSuffix = Math.random().toString(36).slice(2, 7);
  let groups = 0;

  const textStyle = (node: LayoutText): LayoutTextStyle => ({
    font: fontOf(node.font, options.font),
    px: node.fontSizePx ?? TEXT_PX,
    weight: node.fontWeight ?? 400,
    letterSpacing: node.letterSpacing ?? 0,
  });

  /** A text node at `width` (null: its natural width, wrapping only past `limit`). */
  function measureTextNode(node: LayoutText, width: number | null, limit: number) {
    const style = textStyle(node);
    const lineHeight = style.px * (node.lineHeight ?? LINE_HEIGHT);
    if (width !== null) {
      const { lines } = measureText(node.text, style, width);
      return { width, height: Math.max(1, lines) * lineHeight, hug: false };
    }
    const natural = measureText(node.text, style, null);
    // The board sizes hugging text to its widest line + 2px; match it.
    const hugWidth = Math.ceil(natural.width) + 2;
    if (hugWidth <= limit) {
      return { width: hugWidth, height: Math.max(1, natural.lines) * lineHeight, hug: true };
    }
    const { lines } = measureText(node.text, style, limit);
    return { width: limit, height: Math.max(1, lines) * lineHeight, hug: false };
  }

  /** The width a child takes in a stack whose content box is `inner` wide. */
  function widthInStack(parent: LayoutContainer, child: LayoutNode, inner: number) {
    if ("width" in child && typeof child.width === "number") return Math.min(child.width, inner);
    if ("width" in child && child.width === "fill") return inner;
    if (child.type === "divider") return inner;
    if (child.type === "box") return inner;
    const stretch = (parent.align ?? "stretch") === "stretch";
    if (stretch && isContainer(child)) return inner;
    return Math.min(measure(child, inner).width, inner);
  }

  /** Flexible in a row: takes a share of the leftover width. */
  const flexInRow = (child: LayoutNode) =>
    (child.type === "spacer" && child.size === undefined) ||
    ("width" in child && child.width === "fill") ||
    (child.type === "box" && child.width === undefined);

  /** Widths of a row's children in a content box `inner` wide. */
  function rowWidths(node: LayoutContainer, inner: number) {
    const gaps = (node.gap ?? 0) * Math.max(0, node.children.length - 1);
    const widths = node.children.map((child) => {
      if (flexInRow(child)) return null;
      if (child.type === "spacer") return child.size ?? 0;
      if (child.type === "divider") return child.thickness ?? 1;
      if ("width" in child && typeof child.width === "number") return child.width;
      return measure(child, inner).width;
    });
    const flexible = widths.filter((w) => w === null).length;
    const used = widths.reduce<number>((sum, w) => sum + (w ?? 0), 0) + gaps;
    const share = flexible > 0 ? Math.max(0, inner - used) / flexible : 0;
    return { widths: widths.map((w) => w ?? share), flexible, used };
  }

  /** The node's own size when offered `avail` px of width. */
  function measure(node: LayoutNode, avail: number): Size {
    switch (node.type) {
      case "text": {
        const w =
          node.width === "fill" ? avail : typeof node.width === "number" ? node.width : null;
        return measureTextNode(node, w, avail);
      }
      case "icon": {
        const size = node.size ?? ICON_SIZE;
        return { width: size, height: size };
      }
      case "box":
        return {
          width: typeof node.width === "number" ? node.width : avail,
          height: node.height,
        };
      case "spacer":
        return { width: node.size ?? 0, height: node.size ?? 0 };
      case "divider": {
        const t = node.thickness ?? 1;
        return { width: t, height: t };
      }
      // Components are expanded before layout (components.ts).
      case "use":
      case "slot":
        return { width: 0, height: 0 };
      default:
        return measureContainer(node, avail);
    }
  }

  function measureContainer(node: LayoutContainer, avail: number): Size {
    const [top, right, bottom, left] = paddingOf(node);
    const fixedWidth =
      typeof node.width === "number" ? node.width : node.width === "fill" ? avail : null;
    const inner = Math.max(0, (fixedWidth ?? avail) - left - right);
    const gap = node.gap ?? 0;
    const gaps = gap * Math.max(0, node.children.length - 1);
    let contentWidth = 0;
    let contentHeight = 0;

    if (node.type === "stack") {
      for (const child of node.children) {
        const w = widthInStack(node, child, inner);
        const h = child.type === "divider" ? (child.thickness ?? 1) : measure(child, w).height;
        contentWidth = Math.max(contentWidth, w);
        contentHeight += h;
      }
      contentHeight += gaps;
    } else if (node.type === "row") {
      const { widths, flexible, used } = rowWidths(node, inner);
      node.children.forEach((child, i) => {
        if (child.type === "divider" || child.type === "spacer") return;
        contentHeight = Math.max(contentHeight, measure(child, widths[i] ?? 0).height);
      });
      // A row with flexible children spreads to the width it's offered.
      contentWidth = flexible > 0 ? inner : used;
    } else {
      const columns = node.columns ?? 2;
      const cell = Math.max(0, (inner - gap * (columns - 1)) / columns);
      const rows = Math.ceil(node.children.length / columns);
      for (let r = 0; r < rows; r++) {
        const cells = node.children.slice(r * columns, (r + 1) * columns);
        contentHeight += Math.max(0, ...cells.map((child) => measure(child, cell).height));
      }
      contentHeight += gap * Math.max(0, rows - 1);
      contentWidth = inner;
    }

    return {
      width: fixedWidth ?? contentWidth + left + right,
      height: typeof node.height === "number" ? node.height : contentHeight + top + bottom,
    };
  }

  /** The groupId for what `node` draws: its own name, else the nearest named ancestor's. */
  function groupFor(node: LayoutNode, inherited: string | undefined) {
    if ("name" in node && node.name) return `${node.name}-${++groups}-${groupSuffix}`;
    return inherited;
  }

  const meta = (node: LayoutNode, groupId: string | undefined) => ({
    ...("role" in node && node.role && { role: node.role }),
    ...(groupId && { groupId }),
    ...("tokens" in node && node.tokens && { tokens: node.tokens }),
    ...("component" in node && node.component && { component: node.component }),
  });

  /** Draws `node` into the box at (x, y), `width` × `height`. */
  function place(
    node: LayoutNode,
    x: number,
    y: number,
    width: number,
    height: number,
    group: string | undefined,
  ) {
    const groupId = groupFor(node, group);
    switch (node.type) {
      case "text": {
        const { hug } = measureTextNode(
          node,
          node.width === undefined ? null : width,
          Math.max(width, 1),
        );
        const style = textStyle(node);
        out.push({
          type: "text",
          x,
          y,
          width,
          height,
          text: node.text,
          font: style.font,
          fontSizePx: style.px,
          fontWeight: style.weight,
          stroke: node.color ?? TEXT_COLOR,
          textAlign: node.textAlign ?? "left",
          autoWidth: hug,
          ...(node.lineHeight !== undefined && { lineHeight: node.lineHeight }),
          ...(node.letterSpacing !== undefined && { letterSpacing: node.letterSpacing }),
          ...meta(node, groupId),
        });
        return;
      }
      case "icon":
        out.push({
          type: "icon",
          x,
          y,
          width,
          height,
          icon: node.icon,
          stroke: node.color ?? TEXT_COLOR,
          strokeWidth: node.strokeWidth ?? 2,
          ...meta(node, groupId),
        });
        return;
      case "box":
        out.push({
          type: node.shape === "ellipse" ? "ellipse" : "rect",
          x,
          y,
          width,
          height,
          fill: node.fill ?? null,
          stroke: node.stroke ?? TEXT_COLOR,
          strokeWidth: node.stroke ? (node.strokeWidth ?? 1) : 0,
          ...(typeof node.radius === "number" &&
            node.shape !== "ellipse" && { radius: node.radius }),
          ...(node.shadow && { shadow: node.shadow }),
          ...meta(node, groupId),
        });
        return;
      case "spacer":
      case "use":
      case "slot":
        return;
      case "divider": {
        const t = node.thickness ?? 1;
        const horizontal = width >= height;
        out.push({
          type: "line",
          x: horizontal ? x : x + width / 2,
          y: horizontal ? y + height / 2 : y,
          width: horizontal ? width : 0,
          height: horizontal ? 0 : height,
          stroke: node.color ?? DIVIDER_COLOR,
          strokeWidth: t,
          ...meta(node, groupId),
        });
        return;
      }
      default:
        placeContainer(node, x, y, width, height, groupId);
    }
  }

  function placeContainer(
    node: LayoutContainer,
    x: number,
    y: number,
    width: number,
    height: number,
    groupId: string | undefined,
  ) {
    if (hasBackground(node)) {
      out.push({
        type: "rect",
        x,
        y,
        width,
        height,
        fill: node.fill ?? null,
        stroke: node.stroke ?? TEXT_COLOR,
        strokeWidth: node.stroke ? (node.strokeWidth ?? 1) : 0,
        ...(typeof node.radius === "number" && { radius: node.radius }),
        ...(node.shadow && { shadow: node.shadow }),
        ...meta(node, groupId),
      });
    }
    const [top, right, bottom, left] = paddingOf(node);
    const ix = x + left;
    const iy = y + top;
    const iw = Math.max(0, width - left - right);
    const ih = Math.max(0, height - top - bottom);
    const gap = node.gap ?? 0;
    const n = node.children.length;
    const justify = node.justify ?? "start";

    if (node.type === "grid") {
      const columns = node.columns ?? 2;
      const cell = Math.max(0, (iw - gap * (columns - 1)) / columns);
      let rowY = iy;
      for (let start = 0; start < n; start += columns) {
        const cells = node.children.slice(start, start + columns);
        const rowHeight = Math.max(0, ...cells.map((child) => measure(child, cell).height));
        cells.forEach((child, i) => {
          const h =
            isContainer(child) || child.type === "box" ? rowHeight : measure(child, cell).height;
          const w = isContainer(child) || child.type === "box" ? cell : measure(child, cell).width;
          place(child, ix + i * (cell + gap), rowY, w, h, groupId);
        });
        rowY += rowHeight + gap;
      }
      return;
    }

    const stack = node.type === "stack";
    const align = node.align ?? (stack ? "stretch" : "center");

    // Main-axis sizes, before sharing leftover space with flexible children.
    let sizes: { main: number; cross: number }[];
    let flexible: boolean[];
    if (stack) {
      flexible = node.children.map(
        (child) =>
          (child.type === "spacer" && child.size === undefined) ||
          (isContainer(child) && child.height === "fill"),
      );
      sizes = node.children.map((child, i) => {
        const w = widthInStack(node, child, iw);
        if (flexible[i]) return { main: 0, cross: w };
        if (child.type === "divider") return { main: child.thickness ?? 1, cross: iw };
        return { main: measure(child, w).height, cross: w };
      });
    } else {
      const { widths } = rowWidths(node, iw);
      flexible = node.children.map(flexInRow);
      sizes = node.children.map((child, i) => {
        const w = widths[i] ?? 0;
        if (child.type === "divider") return { main: w, cross: ih };
        if (child.type === "spacer") return { main: w, cross: 0 };
        const stretch =
          align === "stretch" && (isContainer(child) || child.type === "box") ? ih : null;
        return { main: w, cross: stretch ?? measure(child, w).height };
      });
    }

    const mainSpace = stack ? ih : iw;
    const used = sizes.reduce((sum, s) => sum + s.main, 0) + gap * Math.max(0, n - 1);
    let free = Math.max(0, mainSpace - used);
    // In a stack, flexible children share what's left (a row already shared it in rowWidths).
    const flexCount = stack ? flexible.filter(Boolean).length : 0;
    if (flexCount > 0) {
      const share = free / flexCount;
      sizes = sizes.map((s, i) => (flexible[i] ? { ...s, main: share } : s));
      free = 0;
    }
    let cursor = 0;
    let between = gap;
    if (justify === "center") cursor = free / 2;
    else if (justify === "end") cursor = free;
    else if (justify === "space-between" && n > 1) between = gap + free / (n - 1);

    node.children.forEach((child, i) => {
      const size = sizes[i] ?? { main: 0, cross: 0 };
      const crossSpace = stack ? iw : ih;
      const crossOffset =
        align === "center"
          ? (crossSpace - size.cross) / 2
          : align === "end"
            ? crossSpace - size.cross
            : 0;
      if (stack) place(child, ix + crossOffset, iy + cursor, size.cross, size.main, groupId);
      else place(child, ix + cursor, iy + crossOffset, size.main, size.cross, groupId);
      cursor += size.main + between;
    });
  }

  // The root fills the screen's width; with a fixed height it fills that too.
  const rootSize = measure(root, options.width);
  const rootWidth = isContainer(root) || root.type === "box" ? options.width : rootSize.width;
  const rootHeight = options.height ?? rootSize.height;
  place(root, options.x, options.y, rootWidth, Math.max(rootHeight, rootSize.height), undefined);
  return out;
}

/** The fonts and weights the tree's text uses, to load before measuring. */
export function layoutFonts(root: LayoutNode, defaultFont: FontFamily) {
  const fonts: [FontFamily, number][] = [];
  const visit = (node: LayoutNode) => {
    if (node.type === "text") fonts.push([fontOf(node.font, defaultFont), node.fontWeight ?? 400]);
    if (isContainer(node)) node.children.forEach(visit);
  };
  visit(root);
  return fonts;
}

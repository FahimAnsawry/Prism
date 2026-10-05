import type { BoardElement, ChartData, StrokeStyle } from "@prism/shared";
import { cn } from "@/lib/utils";
import { assetUrl } from "./assets";
import { displayColor, STICKY_DEFAULT } from "./board-model";
import { fontStack, weightOf } from "./fonts";
import { center, type Point, strokePoints } from "./geometry";
import { sketchEllipse, sketchLine, sketchPolygon, smoothPath } from "./sketch";
import {
  BULLETS,
  layoutList,
  layoutSticky,
  layoutText,
  LIST_BULLET_EM,
  LIST_INDENT_EM,
  STICKY_PADDING,
} from "./text-layout";

const ANCHOR = { left: "start", center: "middle", right: "end" } as const;

/** Bars, slices and lines of a chart take these in turn. */
export const CHART_COLORS = [
  "#5882ff",
  "#28e99f",
  "#ff7f59",
  "#756cf5",
  "#f783a3",
  "#ff6d6d",
  "#3d3b4f",
  "#ecffa3",
];

function dashArray(style: StrokeStyle, width: number) {
  if (style === "dashed") return `${width * 4} ${width * 3}`;
  if (style === "dotted") return `0 ${width * 2.5}`;
  return undefined;
}

/** One element, drawn in world coordinates and turned around its center. */
export function ElementShape({ el, hidden = false }: { el: BoardElement; hidden?: boolean }) {
  const c = center(el);
  return (
    <g
      opacity={hidden ? 0 : el.opacity}
      transform={el.rotation ? `rotate(${el.rotation} ${c.x} ${c.y})` : undefined}
    >
      <Shape el={el} />
    </g>
  );
}

function Shape({ el }: { el: BoardElement }) {
  const ink = displayColor(el.stroke);
  const stroke = {
    style: { stroke: ink },
    strokeWidth: el.strokeWidth,
    strokeDasharray: el.sketch ? undefined : dashArray(el.strokeStyle, el.strokeWidth),
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  // A transparent fill keeps the inside clickable when the fill is "none".
  const fill = el.fill ? displayColor(el.fill) : "transparent";
  const { x, y, width, height } = el;
  // Corner radius, at most half the shorter side (SVG clamps it per axis, which distorts).
  const radius = Math.min(el.radius ?? 0, Math.abs(width) / 2, Math.abs(height) / 2);

  switch (el.type) {
    case "rect":
    case "diamond": {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const points: Point[] =
        el.type === "rect"
          ? [
              { x, y },
              { x: x + width, y },
              { x: x + width, y: y + height },
              { x, y: y + height },
            ]
          : [
              { x: cx, y },
              { x: x + width, y: cy },
              { x: cx, y: y + height },
              { x, y: cy },
            ];
      const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");
      if (el.sketch) {
        return (
          <>
            <polygon points={polygon} style={{ fill }} />
            <path d={sketchPolygon(points, el.id, el.strokeWidth)} fill="none" {...stroke} />
          </>
        );
      }
      return el.type === "rect" ? (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={radius || undefined}
          {...stroke}
          style={{ fill, stroke: ink }}
        />
      ) : (
        <polygon points={polygon} {...stroke} style={{ fill, stroke: ink }} />
      );
    }

    case "ellipse": {
      const cx = x + width / 2;
      const cy = y + height / 2;
      if (el.sketch) {
        return (
          <>
            <ellipse cx={cx} cy={cy} rx={width / 2} ry={height / 2} style={{ fill }} />
            <path
              d={sketchEllipse(cx, cy, width / 2, height / 2, el.id, el.strokeWidth)}
              fill="none"
              {...stroke}
            />
          </>
        );
      }
      return (
        <ellipse
          cx={cx}
          cy={cy}
          rx={width / 2}
          ry={height / 2}
          {...stroke}
          style={{ fill, stroke: ink }}
        />
      );
    }

    case "line":
    case "arrow": {
      const start = { x, y };
      const end = { x: x + width, y: y + height };
      const isArrow = el.type === "arrow";
      const angle = Math.atan2(height, width);
      const head = 8 + el.strokeWidth * 2;
      const half = 4 + el.strokeWidth;
      // The line stops at the arrowhead's base so a thick stroke doesn't poke through the tip.
      const lineEnd = isArrow
        ? { x: end.x - head * Math.cos(angle), y: end.y - head * Math.sin(angle) }
        : end;
      const back = (offset: number) =>
        `${lineEnd.x - offset * Math.sin(angle)},${lineEnd.y + offset * Math.cos(angle)}`;
      return (
        <>
          {/* Wide invisible hit area so a 1px line is still easy to point at. */}
          <line x1={x} y1={y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth={14} />
          {el.sketch ? (
            <path d={sketchLine(start, lineEnd, el.id, el.strokeWidth)} fill="none" {...stroke} />
          ) : (
            <line x1={x} y1={y} x2={lineEnd.x} y2={lineEnd.y} {...stroke} />
          )}
          {isArrow && Math.hypot(width, height) > 0 && (
            <polygon
              points={`${end.x},${end.y} ${back(half)} ${back(-half)}`}
              strokeLinejoin="round"
              style={{ fill: ink, stroke: ink }}
              strokeWidth={1}
            />
          )}
        </>
      );
    }

    case "freehand":
      return (
        <path
          d={smoothPath(strokePoints(el))}
          fill="none"
          {...stroke}
          strokeDasharray={dashArray(el.strokeStyle, el.strokeWidth)}
        />
      );

    case "sticky": {
      const layout = layoutSticky(el);
      const top = y + height / 2 - (layout.lines.length * layout.lineHeight) / 2;
      return (
        <>
          <rect
            x={x + 2}
            y={y + 4}
            width={width}
            height={height}
            className="fill-slate/10 dark:fill-black/30"
          />
          <rect x={x} y={y} width={width} height={height} fill={el.fill ?? STICKY_DEFAULT} />
          <TextLines
            el={el}
            lines={layout.lines}
            px={layout.px}
            lineHeight={layout.lineHeight}
            top={top}
            left={x + STICKY_PADDING}
            width={width - 2 * STICKY_PADDING}
            // Sticky notes are light in both themes, so their text stays dark.
            color="#3d3b4f"
          />
        </>
      );
    }

    case "text": {
      const layout = layoutText(el);
      return (
        <>
          <rect x={x} y={y} width={width} height={height} fill="transparent" />
          <TextLines
            el={el}
            lines={layout.lines}
            px={layout.px}
            lineHeight={layout.lineHeight}
            top={y}
            left={x}
            width={width}
            color={ink}
          />
        </>
      );
    }

    case "list": {
      const layout = layoutList(el);
      return (
        <>
          <rect x={x} y={y} width={width} height={height} fill="transparent" />
          <text
            style={{ fill: ink, fontFamily: fontStack(el.font ?? "sans") }}
            fontSize={layout.px}
            fontWeight={weightOf(el)}
            dominantBaseline="central"
          >
            {layout.lines.map((line, i) => {
              const left = x + line.indent * LIST_INDENT_EM * layout.px;
              const lineY = y + (i + 0.5) * layout.lineHeight;
              return (
                <tspan key={i}>
                  {line.bullet && (
                    <tspan x={left} y={lineY}>
                      {BULLETS[line.indent] ?? "•"}
                    </tspan>
                  )}
                  <tspan x={left + LIST_BULLET_EM * layout.px} y={lineY} xmlSpace="preserve">
                    {line.text || " "}
                  </tspan>
                </tspan>
              );
            })}
          </text>
        </>
      );
    }

    case "emoji":
      return (
        <>
          <rect x={x} y={y} width={width} height={height} fill="transparent" />
          <text
            x={x + width / 2}
            y={y + height / 2}
            fontSize={Math.min(width, height) * 0.82}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {el.text}
          </text>
        </>
      );

    case "image":
    case "svg":
      return el.assetKey ? (
        <image
          href={assetUrl(el.assetKey)}
          x={x}
          y={y}
          width={width}
          height={height}
          preserveAspectRatio="none"
        />
      ) : (
        <rect x={x} y={y} width={width} height={height} className="fill-divider" />
      );

    case "chart":
      return <Chart el={el} data={el.chart} />;

    case "frame":
      return (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={radius || undefined}
          className="fill-card"
          style={{ stroke: "var(--chrome)" }}
        />
      );
  }
}

/** Wrapped lines as one <text> with a <tspan> per line. */
function TextLines({
  el,
  lines,
  px,
  lineHeight,
  top,
  left,
  width,
  color,
}: {
  el: BoardElement;
  lines: string[];
  px: number;
  lineHeight: number;
  top: number;
  left: number;
  width: number;
  color: string;
}) {
  const align = el.textAlign ?? "left";
  const anchorX = { left, center: left + width / 2, right: left + width }[align];
  return (
    <text
      style={{ fill: color, fontFamily: fontStack(el.font ?? "sans") }}
      fontSize={px}
      fontWeight={weightOf(el)}
      textAnchor={ANCHOR[align]}
      dominantBaseline="central"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={anchorX} y={top + (i + 0.5) * lineHeight} xmlSpace="preserve">
          {line || " "}
        </tspan>
      ))}
    </text>
  );
}

// ── Charts (tools.md §1, tool 16): scaled by hand into the element's box ──

const CHART_PAD = 14;
const LABEL_SPACE = 20;

/** An SVG arc path for a pie slice (or a donut ring segment when `inner` > 0). */
function slicePath(cx: number, cy: number, r: number, inner: number, from: number, to: number) {
  const point = (radius: number, angle: number) =>
    `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  const large = to - from > Math.PI ? 1 : 0;
  if (inner <= 0) {
    return `M${cx},${cy} L${point(r, from)} A${r},${r} 0 ${large} 1 ${point(r, to)} Z`;
  }
  return `M${point(r, from)} A${r},${r} 0 ${large} 1 ${point(r, to)} L${point(inner, to)} A${inner},${inner} 0 ${large} 0 ${point(inner, from)} Z`;
}

function Chart({ el, data }: { el: BoardElement; data: ChartData | undefined }) {
  const { x, y, width, height } = el;
  const rows = data?.rows ?? [];
  const labelStyle = { fill: "var(--muted-foreground)" };
  const frame = (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      style={{ fill: el.fill ? displayColor(el.fill) : "var(--card)", stroke: "var(--divider)" }}
    />
  );
  if (!data || rows.length === 0) return frame;

  if (data.kind === "pie" || data.kind === "donut") {
    const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
    const legend = width > height * 1.3;
    const plotWidth = legend ? width * 0.6 : width;
    const r = Math.max(0, Math.min(plotWidth, height) / 2 - CHART_PAD);
    const cx = x + plotWidth / 2;
    const cy = y + height / 2;
    const inner = data.kind === "donut" ? r * 0.55 : 0;
    let angle = -Math.PI / 2;
    return (
      <>
        {frame}
        {total > 0 &&
          rows.map((row, i) => {
            const share = Math.max(0, row.value) / total;
            if (share === 0) return null;
            const from = angle;
            angle += share * Math.PI * 2;
            const color = CHART_COLORS[i % CHART_COLORS.length];
            // A full circle can't be one arc; draw it as two halves.
            const d =
              share >= 0.9999
                ? `${slicePath(cx, cy, r, inner, from, from + Math.PI)} ${slicePath(cx, cy, r, inner, from + Math.PI, from + Math.PI * 2)}`
                : slicePath(cx, cy, r, inner, from, angle);
            return (
              <path key={i} d={d} fill={color} stroke="var(--card)" strokeWidth={1.5}>
                <title>{`${row.label}: ${row.value}`}</title>
              </path>
            );
          })}
        {legend &&
          rows.map((row, i) => {
            const rowY = y + CHART_PAD + 8 + i * 18;
            if (rowY > y + height - CHART_PAD) return null;
            return (
              <g key={i}>
                <rect
                  x={x + plotWidth}
                  y={rowY - 5}
                  width={10}
                  height={10}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
                <text
                  x={x + plotWidth + 16}
                  y={rowY}
                  fontSize={11}
                  dominantBaseline="central"
                  className="font-sans"
                  style={labelStyle}
                >
                  {`${row.label} (${row.value})`}
                </text>
              </g>
            );
          })}
      </>
    );
  }

  const values = rows.map((row) => row.value);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const left = x + CHART_PAD;
  const top = y + CHART_PAD;
  const plotWidth = Math.max(1, width - 2 * CHART_PAD);
  const plotHeight = Math.max(1, height - 2 * CHART_PAD - LABEL_SPACE);
  const valueY = (value: number) => top + ((max - value) / span) * plotHeight;
  const baseY = valueY(0);
  const step = plotWidth / rows.length;
  const centerX = (i: number) => left + step * (i + 0.5);

  return (
    <>
      {frame}
      <line
        x1={left}
        x2={left + plotWidth}
        y1={baseY}
        y2={baseY}
        style={{ stroke: "var(--muted-foreground)" }}
        strokeWidth={1}
      />
      {data.kind === "bar"
        ? rows.map((row, i) => {
            const barWidth = step * 0.6;
            const valueTop = valueY(row.value);
            return (
              <rect
                key={i}
                x={centerX(i) - barWidth / 2}
                y={Math.min(valueTop, baseY)}
                width={barWidth}
                height={Math.abs(baseY - valueTop)}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
              >
                <title>{`${row.label}: ${row.value}`}</title>
              </rect>
            );
          })
        : (() => {
            const points = rows.map((row, i) => `${centerX(i)},${valueY(row.value)}`).join(" ");
            return (
              <>
                <polyline
                  points={points}
                  fill="none"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />
                {rows.map((row, i) => (
                  <circle
                    key={i}
                    cx={centerX(i)}
                    cy={valueY(row.value)}
                    r={3.5}
                    fill={CHART_COLORS[0]}
                  >
                    <title>{`${row.label}: ${row.value}`}</title>
                  </circle>
                ))}
              </>
            );
          })()}
      {rows.map((row, i) => (
        <text
          key={i}
          x={centerX(i)}
          y={y + height - CHART_PAD - LABEL_SPACE / 2 + 4}
          fontSize={11}
          textAnchor="middle"
          dominantBaseline="central"
          className={cn("font-sans")}
          style={labelStyle}
        >
          {row.label}
        </text>
      ))}
    </>
  );
}

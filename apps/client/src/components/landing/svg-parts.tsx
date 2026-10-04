// Small SVG building blocks shared by the board preview and the feature illustrations.
// Colors come from the theme tokens via Tailwind fill-/stroke- classes.

const cursorTones = {
  pink: { body: "fill-brand", text: "fill-onyx" },
  brand: { body: "fill-brand", text: "fill-onyx" },
  onyx: { body: "fill-onyx", text: "fill-neon" },
  sky: { body: "fill-sky", text: "fill-slate" },
} as const;

/** Collaborator pointer + name tag. (x, y) is the pointer tip. */
export function SvgCursor({
  x,
  y,
  name,
  tone,
  tagWidth,
}: {
  x: number;
  y: number;
  name: string;
  tone: keyof typeof cursorTones;
  tagWidth: number;
}) {
  const { body, text } = cursorTones[tone];
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className={body} d="M0 0v21.5l5.6-5.3 3.7 7.8 3.4-1.6-3.6-7.6H17Z" />
      <rect className={body} x="14" y="22" width={tagWidth} height="26" />
      <text
        className={`${text} font-sans text-[13px] font-semibold`}
        x={14 + tagWidth / 2}
        y="39.5"
        textAnchor="middle"
      >
        {name}
      </text>
    </g>
  );
}

/** Square sticky note with centered handwritten lines, rotated around its center. */
export function SvgSticky({
  x,
  y,
  size,
  rotate,
  fill,
  lines,
  fontSize,
}: {
  x: number;
  y: number;
  size: number;
  rotate: number;
  fill: string;
  lines: string[];
  fontSize: number;
}) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const lineHeight = fontSize * 1.05;
  const firstBaseline = cy - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.3;
  return (
    <g transform={`rotate(${rotate} ${cx} ${cy})`}>
      <rect className={fill} x={x} y={y} width={size} height={size} />
      <text className="fill-slate font-hand" style={{ fontSize }} textAnchor="middle">
        {lines.map((line, i) => (
          <tspan key={line} x={cx} y={firstBaseline + i * lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/** Arrowhead marker; reference it with markerEnd={`url(#${id})`}. */
export function ArrowMarker({ id }: { id: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path className="fill-onyx" d="M0 0 10 5 0 10Z" />
    </marker>
  );
}

/** Neon corner squares that mark a card on the board. */
export function SvgCornerMarks({
  x,
  y,
  width,
  height,
  size,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
}) {
  const h = size / 2;
  return (
    <g className="fill-neon">
      <rect x={x - h} y={y - h} width={size} height={size} />
      <rect x={x + width - h} y={y - h} width={size} height={size} />
      <rect x={x - h} y={y + height - h} width={size} height={size} />
      <rect x={x + width - h} y={y + height - h} width={size} height={size} />
    </g>
  );
}

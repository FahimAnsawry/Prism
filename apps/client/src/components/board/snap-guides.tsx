import type { GapMark, SnapGuides } from "./snapping";

const GUIDE = "#f24e9c";
const TICK = 5;

/** The guide lines and equal-gap marks a drag snapped to, over the board (never exported). */
export function SnapGuidesView({ guides, zoom }: { guides: SnapGuides; zoom: number }) {
  const width = 1 / zoom;
  return (
    <g pointerEvents="none" stroke={GUIDE} strokeWidth={width} fill="none">
      {guides.lines.map((line) =>
        line.axis === "x" ? (
          <line key={`x${line.at}`} x1={line.at} x2={line.at} y1={line.from} y2={line.to} />
        ) : (
          <line key={`y${line.at}`} y1={line.at} y2={line.at} x1={line.from} x2={line.to} />
        ),
      )}
      {guides.gaps.map((gap) => (
        <GapView key={`${gap.axis}${gap.from}:${gap.to}:${gap.at}`} gap={gap} zoom={zoom} />
      ))}
    </g>
  );
}

/** One gap of an equal-spacing run: a line with end ticks and its size in a small tag. */
function GapView({ gap, zoom }: { gap: GapMark; zoom: number }) {
  const tick = TICK / zoom;
  const size = Math.round((gap.to - gap.from) * 10) / 10;
  const mid = (gap.from + gap.to) / 2;
  const horizontal = gap.axis === "x";
  const cx = horizontal ? mid : gap.at;
  const cy = horizontal ? gap.at : mid;
  return (
    <>
      {horizontal ? (
        <>
          <line x1={gap.from} x2={gap.to} y1={gap.at} y2={gap.at} />
          <line x1={gap.from} x2={gap.from} y1={gap.at - tick} y2={gap.at + tick} />
          <line x1={gap.to} x2={gap.to} y1={gap.at - tick} y2={gap.at + tick} />
        </>
      ) : (
        <>
          <line y1={gap.from} y2={gap.to} x1={gap.at} x2={gap.at} />
          <line y1={gap.from} y2={gap.from} x1={gap.at - tick} x2={gap.at + tick} />
          <line y1={gap.to} y2={gap.to} x1={gap.at - tick} x2={gap.at + tick} />
        </>
      )}
      <g transform={`translate(${cx} ${cy}) scale(${1 / zoom})`}>
        <rect x={-14} y={-8} width={28} height={16} rx={3} fill={GUIDE} stroke="none" />
        <text
          textAnchor="middle"
          y={4}
          fontSize={10}
          fontWeight={600}
          fill="#fff"
          stroke="none"
          style={{ fontFamily: "inherit" }}
        >
          {size}
        </text>
      </g>
    </>
  );
}

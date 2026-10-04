import { cn } from "@/lib/utils";

/**
 * A board thumbnail as plain shapes. Coordinates are copied from the Miro dashboard frames, so
 * each thumbnail keeps its own viewBox and scales to whatever box the card gives it.
 */
export type SketchShape =
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      /** Tailwind fill class, e.g. "fill-ice". */
      fill: string;
      /** Tailwind stroke class; omit for no outline. */
      stroke?: string;
    }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number };

export function Sketch({
  width,
  height,
  shapes,
  className,
}: {
  width: number;
  height: number;
  shapes: readonly SketchShape[];
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={cn("block size-full", className)}
    >
      {shapes.map((shape, i) =>
        shape.kind === "rect" ? (
          <rect
            key={i}
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            className={cn(shape.fill, shape.stroke ?? "stroke-none")}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <line
            key={i}
            x1={shape.x1}
            y1={shape.y1}
            x2={shape.x2}
            y2={shape.y2}
            className="stroke-foreground"
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}
    </svg>
  );
}

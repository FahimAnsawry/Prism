import { useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { type BoardElement, displayColor, FONT_SIZES, type StrokeStyle } from "./board-model";
import type { ToolId } from "./tools";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const FONT_CLASS = { sans: "font-sans", caveat: "font-hand", mono: "font-mono" } as const;
const SELECTION = "#5882ff"; // --color-blue
/** The selection frame sits 8px outside the element; the rotate handle 30px above it. */
const PAD = 8;

function dashArray(style: StrokeStyle, width: number) {
  if (style === "dashed") return `${width * 4} ${width * 3}`;
  if (style === "dotted") return `0 ${width * 2.5}`;
  return undefined;
}

export function BoardCanvas({
  elements,
  selectedId,
  tool,
  grid,
  camera,
  onCameraChange,
  onSelect,
}: {
  elements: BoardElement[];
  selectedId: string | null;
  tool: ToolId;
  grid: boolean;
  camera: Camera;
  onCameraChange: (camera: Camera) => void;
  onSelect: (id: string | null) => void;
}) {
  const pan = useRef<{ x: number; y: number; camera: Camera } | null>(null);
  const [panning, setPanning] = useState(false);
  const ordered = [...elements].sort((a, b) => a.z - b.z);
  const selected = elements.find((el) => el.id === selectedId);

  // Hand tool: drag to pan (tools.md §1). Select tool: a click on empty canvas clears selection.
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (tool === "hand") {
      event.currentTarget.setPointerCapture(event.pointerId);
      pan.current = { x: event.clientX, y: event.clientY, camera };
      setPanning(true);
    } else if (tool === "select") {
      onSelect(null);
    }
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = pan.current;
    if (!start) return;
    onCameraChange({
      ...start.camera,
      x: start.camera.x + event.clientX - start.x,
      y: start.camera.y + event.clientY - start.y,
    });
  };
  const endPan = () => {
    pan.current = null;
    setPanning(false);
  };

  const selectElement = (event: PointerEvent, id: string) => {
    if (tool !== "select") return;
    event.stopPropagation();
    onSelect(id);
  };

  return (
    <svg
      aria-label="Board canvas"
      role="application"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      className={cn(
        "absolute inset-0 size-full touch-none select-none",
        tool === "hand" && (panning ? "cursor-grabbing" : "cursor-grab"),
      )}
    >
      <defs>
        {/* 2px dots every 16px, as in the Miro canvas image. */}
        <pattern id="dot-grid" width="16" height="16" y="8" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="1" className="fill-grid-dot" />
        </pattern>
      </defs>

      <g
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          transformOrigin: "center",
          transformBox: "view-box",
        }}
      >
        {grid && <rect x="-8000" y="-8000" width="16000" height="16000" fill="url(#dot-grid)" />}

        {ordered.map((el) => (
          <g
            key={el.id}
            opacity={el.opacity}
            onPointerDown={(event) => selectElement(event, el.id)}
            className={cn(tool === "select" && "cursor-move", el.locked && "cursor-default")}
          >
            <ElementShape el={el} />
          </g>
        ))}

        {selected && <SelectionFrame el={selected} />}
      </g>
    </svg>
  );
}

function ElementShape({ el }: { el: BoardElement }) {
  const ink = displayColor(el.stroke);
  const stroke = {
    style: { stroke: ink },
    strokeWidth: el.strokeWidth,
    strokeDasharray: dashArray(el.strokeStyle, el.strokeWidth),
    strokeLinecap: el.strokeStyle === "dotted" ? ("round" as const) : undefined,
  };
  // A transparent fill keeps the inside clickable when the fill is "none".
  const fill = el.fill ?? "transparent";

  switch (el.type) {
    case "rect":
      return <rect x={el.x} y={el.y} width={el.width} height={el.height} fill={fill} {...stroke} />;

    case "diamond": {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const points = `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`;
      return <polygon points={points} fill={fill} strokeLinejoin="round" {...stroke} />;
    }

    case "arrow": {
      const x2 = el.x + el.width;
      const y2 = el.y + el.height;
      const angle = Math.atan2(el.height, el.width);
      const length = 8 + el.strokeWidth * 2;
      const half = 4 + el.strokeWidth;
      const back = (offset: number) =>
        `${x2 - length * Math.cos(angle) - offset * Math.sin(angle)},${y2 - length * Math.sin(angle) + offset * Math.cos(angle)}`;
      // The line stops at the arrowhead's base so a thick stroke doesn't poke through the tip.
      return (
        <>
          <line
            x1={el.x}
            y1={el.y}
            x2={x2 - length * Math.cos(angle)}
            y2={y2 - length * Math.sin(angle)}
            {...stroke}
          />
          {/* Wide invisible hit area so a 1px arrow is still easy to click. */}
          <line x1={el.x} y1={el.y} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
          <polygon points={`${x2},${y2} ${back(half)} ${back(-half)}`} style={{ fill: ink }} />
        </>
      );
    }

    case "sticky":
      return (
        <>
          <rect x={el.x} y={el.y} width={el.width} height={el.height} fill={el.fill ?? "#ecffa3"} />
          <foreignObject x={el.x} y={el.y} width={el.width} height={el.height}>
            <div
              className={cn(
                "flex size-full items-center p-4 leading-tight text-slate",
                FONT_CLASS[el.font ?? "sans"],
                {
                  left: "text-left",
                  center: "justify-center text-center",
                  right: "justify-end text-right",
                }[el.textAlign ?? "center"],
              )}
              style={{ fontSize: FONT_SIZES[el.font ?? "sans"][el.fontSize ?? "M"] }}
            >
              {el.text}
            </div>
          </foreignObject>
        </>
      );

    case "text": {
      const align = el.textAlign ?? "left";
      const x = { left: el.x, center: el.x + el.width / 2, right: el.x + el.width }[align];
      return (
        <>
          <rect x={el.x} y={el.y} width={el.width} height={el.height} fill="transparent" />
          <text
            x={x}
            y={el.y + el.height / 2}
            dominantBaseline="central"
            textAnchor={({ left: "start", center: "middle", right: "end" } as const)[align]}
            style={{ fill: ink }}
            fontSize={FONT_SIZES[el.font ?? "sans"][el.fontSize ?? "M"]}
            fontWeight={el.fontWeight === "bold" ? 700 : 400}
            className={FONT_CLASS[el.font ?? "sans"]}
          >
            {el.text}
          </text>
        </>
      );
    }
  }
}

/** Selection: box, 8 square handles and a rotate handle above (Miro frame 10). */
function SelectionFrame({ el }: { el: BoardElement }) {
  const left = Math.min(el.x, el.x + el.width) - PAD;
  const top = Math.min(el.y, el.y + el.height) - PAD;
  const width = Math.abs(el.width) + PAD * 2;
  const height = Math.abs(el.height) + PAD * 2;
  const midX = left + width / 2;
  const handles: [number, number][] = [
    [left, top],
    [midX, top],
    [left + width, top],
    [left + width, top + height / 2],
    [left + width, top + height],
    [midX, top + height],
    [left, top + height],
    [left, top + height / 2],
  ];

  return (
    <g pointerEvents="none" stroke={SELECTION} strokeWidth={2}>
      <rect x={left} y={top} width={width} height={height} fill="none" />
      {!el.locked && (
        <>
          <line x1={midX} y1={top - 24} x2={midX} y2={top} />
          <circle cx={midX} cy={top - 30} r={6} className="fill-card" />
          {handles.map(([x, y], i) => (
            <rect
              key={i}
              x={x - 5}
              y={y - 5}
              width={10}
              height={10}
              strokeWidth={1.5}
              className="fill-card"
            />
          ))}
        </>
      )}
    </g>
  );
}

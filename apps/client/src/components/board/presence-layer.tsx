// Other people on the board: their cursors with name tags, what they have selected, and, when an
// AI editor changes the board, its cursor gliding to each element it touched while the elements
// light up. All drawn in board space inside the canvas, so it pans and zooms with the board;
// the cursors keep their size on screen. Nothing here is saved: it follows Socket.IO events.

import {
  type BoardElement,
  type CursorUpdate,
  type EditUpdate,
  type LeaveUpdate,
  type Peer,
  type PresenceBox,
  type SelectionUpdate,
} from "@prism/shared";
import { motion } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/realtime";
import { elementBounds } from "./geometry";
import { onLocalCursor } from "./presence-bus";

/** A cursor that hasn't moved for this long fades out (it comes back when it moves). */
export const CURSOR_IDLE_MS = 5_000;
/** A cursor gone this long is forgotten. */
const CURSOR_FORGET_MS = 60_000;
/** How long an AI editor's cursor stays on one element before gliding to the next. */
const VISIT_STEP_MS = 750;
/** How long a changed element stays lit. */
const FLASH_MS = 1_600;

interface CursorView {
  peer: Peer;
  x: number;
  y: number;
  /** When it last moved. */
  at: number;
}

interface SelectionView {
  peer: Peer;
  elementIds: string[];
}

interface FlashView {
  key: number;
  box: PresenceBox;
  color: string;
}

/** Where an AI editor's cursor points on an element: near its middle, never off a huge box. */
const tipOn = (box: PresenceBox) => ({
  x: box.x + Math.min(box.width / 2, 160),
  y: box.y + Math.min(box.height / 2, 90),
});

export const PresenceLayer = memo(function PresenceLayer({
  boardId,
  elements,
  zoom,
}: {
  boardId: string;
  elements: BoardElement[];
  zoom: number;
}) {
  const [cursors, setCursors] = useState<Record<string, CursorView>>({});
  const [selections, setSelections] = useState<Record<string, SelectionView>>({});
  const [flashes, setFlashes] = useState<FlashView[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const hasCursors = Object.keys(cursors).length > 0;

  useEffect(() => {
    const socket = getSocket();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    /** An AI editor's pending moves, so a newer edit takes over its cursor. */
    const visits = new Map<string, ReturnType<typeof setTimeout>[]>();
    let flashKey = 0;
    const later = (ms: number, run: () => void) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        run();
      }, ms);
      timers.add(timer);
      return timer;
    };

    const moveCursor = (peer: Peer, x: number, y: number) => {
      if (peer.id === socket.id) return;
      setCursors((all) => ({ ...all, [peer.id]: { peer, x, y, at: Date.now() } }));
    };
    const light = (box: PresenceBox, color: string) => {
      const key = ++flashKey;
      setFlashes((all) => [...all.slice(-60), { key, box, color }]);
      later(FLASH_MS, () => setFlashes((all) => all.filter((flash) => flash.key !== key)));
    };

    const onCursor = (update: CursorUpdate) => {
      if (update.boardId === boardId) moveCursor(update.peer, update.x, update.y);
    };
    const onSelection = (update: SelectionUpdate) => {
      if (update.boardId !== boardId || update.peer.id === socket.id) return;
      setSelections((all) => {
        if (update.elementIds.length === 0) {
          const { [update.peer.id]: _gone, ...rest } = all;
          return rest;
        }
        return { ...all, [update.peer.id]: { peer: update.peer, elementIds: update.elementIds } };
      });
    };
    const onEdit = (update: EditUpdate) => {
      if (update.boardId !== boardId) return;
      for (const timer of visits.get(update.peer.id) ?? []) clearTimeout(timer);
      const visited = new Set(update.visit.map((box) => box.id));
      const pending = update.visit.map((box, i) =>
        later(i * VISIT_STEP_MS, () => {
          const tip = tipOn(box);
          moveCursor(update.peer, tip.x, tip.y);
          light(box, update.peer.color);
        }),
      );
      visits.set(update.peer.id, pending);
      // The changes the cursor doesn't go to light up as it starts.
      for (const box of update.flash) if (!visited.has(box.id)) light(box, update.peer.color);
    };
    const onLeave = (update: LeaveUpdate) => {
      if (update.boardId !== boardId) return;
      setCursors((all) => {
        const { [update.peerId]: _gone, ...rest } = all;
        return rest;
      });
      setSelections((all) => {
        const { [update.peerId]: _gone, ...rest } = all;
        return rest;
      });
    };

    // An AI editor's cursor while this tab reveals what it is building (remote-reveal.ts).
    const stopLocal = onLocalCursor((peer, x, y) => moveCursor(peer, x, y));
    socket.on("presence:cursor", onCursor);
    socket.on("presence:selection", onSelection);
    socket.on("presence:edit", onEdit);
    socket.on("presence:leave", onLeave);
    return () => {
      stopLocal();
      socket.off("presence:cursor", onCursor);
      socket.off("presence:selection", onSelection);
      socket.off("presence:edit", onEdit);
      socket.off("presence:leave", onLeave);
      for (const timer of timers) clearTimeout(timer);
      setCursors({});
      setSelections({});
      setFlashes([]);
    };
  }, [boardId]);

  // Idle cursors fade, long-gone ones are dropped.
  useEffect(() => {
    if (!hasCursors) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      setCursors((all) => {
        const kept = Object.entries(all).filter(([, c]) => time - c.at < CURSOR_FORGET_MS);
        return kept.length === Object.keys(all).length ? all : Object.fromEntries(kept);
      });
    }, 1_000);
    return () => clearInterval(timer);
  }, [hasCursors]);

  // Outlines of what the others have selected.
  const outlined = useMemo(() => {
    const entries = Object.values(selections);
    if (entries.length === 0) return [];
    const wanted = new Set(entries.flatMap((s) => s.elementIds));
    const found = new Map(
      elements.filter((el) => wanted.has(el.id)).map((el) => [el.id, elementBounds(el)]),
    );
    return entries.flatMap(({ peer, elementIds }) =>
      elementIds.flatMap((id) => {
        const box = found.get(id);
        return box ? [{ key: `${peer.id}:${id}`, peer, box, tag: elementIds[0] === id }] : [];
      }),
    );
  }, [selections, elements]);

  return (
    <g pointerEvents="none" aria-hidden="true">
      {outlined.map(({ key, peer, box, tag }) => (
        <g key={key}>
          <rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            fill="none"
            stroke={peer.color}
            strokeWidth={1.5 / zoom}
          />
          {tag && (
            <SelectionTag peer={peer} x={box.x + box.width} y={box.y + box.height} zoom={zoom} />
          )}
        </g>
      ))}

      {flashes.map(({ key, box, color }) => (
        <motion.rect
          key={key}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          rx={4 / zoom}
          fill={color}
          fillOpacity={0.2}
          stroke={color}
          strokeWidth={2 / zoom}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: FLASH_MS / 1000, times: [0, 0.15, 0.55, 1], ease: "easeOut" }}
        />
      ))}

      {Object.values(cursors).map((cursor) => (
        <PeerCursor
          key={cursor.peer.id}
          cursor={cursor}
          idle={now - cursor.at > CURSOR_IDLE_MS}
          zoom={zoom}
        />
      ))}
    </g>
  );
});

const TAG_HEIGHT = 20;
const tagWidth = (name: string) => Math.ceil(name.length * 6.6) + 16;

/** The arrow and name tag. Drawn at (0, 0) = the pointer's tip, in screen px. */
function CursorShape({ peer }: { peer: Peer }) {
  const width = tagWidth(peer.name);
  return (
    <>
      <path
        d="M0 0v18.5l4.7-4.5 3.1 6.6 2.9-1.4-3.1-6.4H14Z"
        fill={peer.color}
        stroke="#fff"
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
      <g transform="translate(11 19)">
        <rect width={width} height={TAG_HEIGHT} rx={4} fill={peer.color} />
        <text
          x={8}
          y={14}
          fontSize={11}
          fontWeight={600}
          fill="#fff"
          style={{ fontFamily: "inherit" }}
        >
          {peer.name}
        </text>
      </g>
    </>
  );
}

const GLIDE = { type: "spring", stiffness: 260, damping: 32, mass: 0.7 } as const;

function PeerCursor({ cursor, idle, zoom }: { cursor: CursorView; idle: boolean; zoom: number }) {
  // It appears where it first is; every later position is glided to.
  return (
    <motion.g
      initial={{ x: cursor.x, y: cursor.y, opacity: 0 }}
      animate={{ x: cursor.x, y: cursor.y, opacity: idle ? 0 : 1 }}
      transition={{ x: GLIDE, y: GLIDE, opacity: { duration: idle ? 0.8 : 0.2 } }}
    >
      <g transform={`scale(${1 / zoom})`}>
        <CursorShape peer={cursor.peer} />
      </g>
    </motion.g>
  );
}

/** The name of whoever has an element selected, at its bottom right corner. */
function SelectionTag({ peer, x, y, zoom }: { peer: Peer; x: number; y: number; zoom: number }) {
  const width = tagWidth(peer.name);
  return (
    <g transform={`translate(${x} ${y}) scale(${1 / zoom})`}>
      <g transform={`translate(${-width} 2)`}>
        <rect width={width} height={TAG_HEIGHT - 2} rx={3} fill={peer.color} />
        <text x={8} y={13} fontSize={10.5} fontWeight={600} fill="#fff">
          {peer.name}
        </text>
      </g>
    </g>
  );
}

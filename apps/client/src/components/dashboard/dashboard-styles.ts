import {
  Box,
  Camera,
  Code,
  Coffee,
  Compass,
  Dumbbell,
  Gamepad2,
  Gauge,
  GraduationCap,
  Handshake,
  HeartPulse,
  House,
  Layers,
  Leaf,
  type LucideIcon,
  MapPin,
  MessageCircle,
  Music,
  Newspaper,
  Palette,
  Plane,
  Rocket,
  Shapes,
  ShoppingBag,
  Sparkles,
  Star,
  Wallet,
  Zap,
} from "lucide-react";
import { createContext } from "react";

// Class names and colors shared by the dashboard pages.

/**
 * Projects have no logo or color of their own yet, so each gets an icon picked from its name and
 * description ("Apon Health" → a heart), and a color from a fixed set in the order the projects
 * were made. The same project looks the same in the sidebar, on its boards and in lists.
 */
/** A board cover's colors: a diagonal wash and the three dots under the icon. */
export type Cover = { from: string; to: string; dots: readonly [string, string, string] };

const INK = "#2b2b38";

const COLORS = [
  {
    bg: "bg-[#f2c94c]",
    fg: "text-slate",
    cover: { from: "#f6df80", to: "#fbf3cf", dots: ["#f3d34a", "#e6d9a0", INK] },
  },
  {
    bg: "bg-[#1e3fa8]",
    fg: "text-white",
    cover: { from: "#b9cdfb", to: "#e3ecfd", dots: ["#1e3fa8", "#dbe5fb", INK] },
  },
  {
    bg: "bg-[#1d5c3c]",
    fg: "text-white",
    cover: { from: "#a6dcc2", to: "#dff3e8", dots: ["#1d5c3c", "#d3ecdf", INK] },
  },
  {
    bg: "bg-[#c4462c]",
    fg: "text-white",
    cover: { from: "#f5b9a8", to: "#fde3da", dots: ["#c4462c", "#f7d4c9", INK] },
  },
  {
    bg: "bg-violet",
    fg: "text-white",
    cover: { from: "#cdb8f5", to: "#ece3fb", dots: ["#7b5cd6", "#e3d9f8", INK] },
  },
  {
    bg: "bg-pink",
    fg: "text-slate",
    cover: { from: "#f8b9d6", to: "#fde0ee", dots: ["#ee6fa8", "#f9d3e5", INK] },
  },
  {
    bg: "bg-sky",
    fg: "text-slate",
    cover: { from: "#a9dcf5", to: "#def2fc", dots: ["#3aa7dc", "#cfe9f7", INK] },
  },
  {
    bg: "bg-coral",
    fg: "text-slate",
    cover: { from: "#f9c0a4", to: "#fde5d8", dots: ["#f08a5d", "#f7d6c5", INK] },
  },
] as const;

/** Covers for boards outside any project, picked from the board id. */
export const LOOSE_COVERS: readonly Cover[] = [
  { from: "#86f0c8", to: "#c9f7e2", dots: ["#1fd69a", "#cdf5e6", "#3d3b4f"] },
  { from: "#b9cdfb", to: "#fbd0ea", dots: ["#b9cdfb", "#f6a9d0", "#e3ee8a"] },
  { from: "#c3b8f5", to: "#f3d9f2", dots: ["#8f7be0", "#ecd9f4", INK] },
] as const;

/** Words in a project's name or description, and the icon they suggest. First match wins. */
const ICON_WORDS: [RegExp, LucideIcon][] = [
  [/health|clinic|medic|hospital|doctor|care|patient|pharma/, HeartPulse],
  [/crm|sales|lead|deal|client|customer/, Handshake],
  [/ledger|financ|bank|pay|invoice|budget|money|account/, Wallet],
  [/cms|blog|news|publish|magazine|article|content|press/, Newspaper],
  [/shop|store|commerce|cart|retail|market|product/, ShoppingBag],
  [/tea|coffee|cafe|restaurant|food|menu|kitchen|recipe/, Coffee],
  [/travel|trip|flight|hotel|tour|booking/, Plane],
  [/music|audio|podcast|sound/, Music],
  [/photo|camera|gallery|image|video/, Camera],
  [/game|play/, Gamepad2],
  [/learn|school|course|edu|class|student/, GraduationCap],
  [/chat|message|social|community/, MessageCircle],
  [/map|location|delivery|ride|logistic/, MapPin],
  [/fitness|gym|sport|workout|run/, Dumbbell],
  [/code|dev|api|engineer|software/, Code],
  [/design|brand|style|theme|rebrand/, Palette],
  [/dashboard|analytic|metric|report|admin/, Gauge],
  [/home|house|real estate|property|rent/, House],
  [/eco|green|plant|garden|farm/, Leaf],
];

/** For projects whose name suggests nothing, in turn. */
const FALLBACK_ICONS: LucideIcon[] = [Rocket, Shapes, Compass, Layers, Zap, Box, Sparkles, Star];

export type ProjectLook = { bg: string; fg: string; cover: Cover; Icon: LucideIcon };

export function projectLooks(
  projects: { id: string; name: string; description: string | null; createdAt: string }[],
) {
  const ordered = projects.toSorted(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
  );
  let fallback = 0;
  return new Map<string, ProjectLook>(
    ordered.map((p, i) => {
      const text = `${p.name} ${p.description ?? ""}`.toLowerCase();
      const Icon =
        ICON_WORDS.find(([words]) => words.test(text))?.[1] ??
        FALLBACK_ICONS[fallback++ % FALLBACK_ICONS.length] ??
        Box;
      const color = COLORS[i % COLORS.length] ?? COLORS[0];
      return [p.id, { ...color, Icon }];
    }),
  );
}

/** Every project's look, from the page (see projectLooks). */
export const ProjectLookContext = createContext<ReadonlyMap<string, ProjectLook>>(new Map());

/** Opens the "Connect AI tools" dialog (DashboardShell provides it). */
export const ConnectAiContext = createContext<() => void>(() => {});

/** The outlined secondary button pages use beside the green one. */
export const outlineButton =
  "inline-flex h-[38px] shrink-0 items-center justify-center gap-2 border border-input bg-card px-4 text-[13px] font-bold text-foreground transition-colors duration-150 ease-standard hover:bg-hover [&_svg]:size-4 [&_svg]:shrink-0";

/** The green button for a page's main action. */
export const primaryButton =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 border border-transparent bg-brand px-5 text-[15px] font-bold text-slate transition-colors duration-150 ease-standard select-none hover:bg-brand/80 max-sm:w-full [&_svg]:size-4 [&_svg]:shrink-0";

import { Globe, Lock, SquareTerminal } from "lucide-react";
import type { ReactNode } from "react";
import { PrismMark } from "@/components/prism-logo";
import { cn } from "@/lib/utils";

// Pieces of the AI editor consent card (routes/oauth.consent.tsx), from the board's
// "/oauth/consent" frames.

/**
 * The editor and Prism side by side, joined by a dashed link: a lock when the access stays on this
 * computer, a red globe when it leaves it.
 */
export function Handshake({ local }: { local: boolean }) {
  return (
    <div aria-hidden="true" className="flex items-center">
      <span className="flex size-11 items-center justify-center bg-slate text-canvas sm:size-12">
        <SquareTerminal className="size-5 sm:size-5.5" />
      </span>
      <span className="relative flex h-11 w-20 items-center sm:h-12 sm:w-24">
        <span className="mx-1 w-full border-t-[1.5px] border-dashed border-edge" />
        <span
          className={cn(
            "absolute top-1/2 left-1/2 flex size-7 -translate-1/2 items-center justify-center border [&_svg]:size-3.5",
            local
              ? "border-brand bg-seafoam text-green-900"
              : "border-destructive bg-destructive/10 text-destructive",
          )}
        >
          {local ? <Lock /> : <Globe />}
        </span>
      </span>
      <span className="flex size-11 items-center justify-center border border-divider bg-card sm:size-12">
        <PrismMark className="size-6" />
      </span>
    </div>
  );
}

/**
 * One row of the details box (goes in a `<dl>`): a mono label, the value and a status chip. The
 * label sits above the value on phones, beside it from sm up.
 */
export function DetailRow({
  label,
  value,
  chip,
}: {
  label: string;
  value: string;
  chip: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-0">
      <dt className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase sm:w-36 sm:shrink-0">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 sm:justify-between">
        <span className="min-w-0 font-semibold [overflow-wrap:anywhere] text-foreground">
          {value}
        </span>
        {chip}
      </dd>
    </div>
  );
}

const CHIP_TONE = {
  ok: "bg-seafoam text-green-900",
  warn: "bg-amber-100 text-amber-900",
  danger: "bg-destructive/10 text-destructive",
};

/** A small status chip: green when proven, amber when unverified, red when risky. */
export function Chip({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof CHIP_TONE;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-xs font-semibold [&_svg]:size-3",
        CHIP_TONE[tone],
      )}
    >
      <span aria-hidden="true" className="contents">
        {icon}
      </span>
      {children}
    </span>
  );
}

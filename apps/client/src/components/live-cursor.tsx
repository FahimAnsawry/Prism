import { cn } from "@/lib/utils";

const tones = {
  pink: { fill: "fill-brand", tag: "bg-brand text-onyx" },
  brand: { fill: "fill-brand", tag: "bg-brand text-onyx" },
  // Claude inverts to neon at night (see svg-parts.tsx).
  onyx: { fill: "fill-onyx dark:fill-neon", tag: "bg-onyx text-neon dark:bg-neon dark:text-onyx" },
  sky: { fill: "fill-sky", tag: "bg-sky text-slate" },
} as const;

export type CursorTone = keyof typeof tones;

/** A collaborator's pointer with a name tag, as drawn on the board (17×24 arrow, tag offset 14/22). */
export function LiveCursor({
  name,
  tone,
  className,
}: {
  name: string;
  tone: CursorTone;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none relative h-6 w-[17px]", className)}>
      <svg viewBox="0 0 17 24" className={cn("absolute inset-0 size-full", tones[tone].fill)}>
        <path d="M0 0v21.5l5.6-5.3 3.7 7.8 3.4-1.6-3.6-7.6H17Z" />
      </svg>
      <span
        className={cn(
          "absolute top-[22px] left-[14px] flex h-[26px] min-w-13 items-center justify-center px-3 text-[13px] leading-none font-semibold whitespace-nowrap",
          tones[tone].tag,
        )}
      >
        {name}
      </span>
    </div>
  );
}

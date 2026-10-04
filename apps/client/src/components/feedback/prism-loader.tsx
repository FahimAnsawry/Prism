import { PrismMark } from "@/components/prism-logo";
import { cn } from "@/lib/utils";

// The four facets dim one after another (top, left, right, then the green center), like light
// passing through the prism. Reduced-motion users get the still mark.
const facetPulse =
  "motion-safe:*:animate-facet-pulse [&>path:nth-child(2)]:[animation-delay:0.2s] [&>path:nth-child(3)]:[animation-delay:0.4s] [&>path:nth-child(4)]:[animation-delay:0.6s]";

/**
 * The app's one loading indicator: the startup splash, the route pending component and every
 * Suspense fallback. `fullScreen` is a whole page in the theme's background with the mark
 * centered; otherwise it sits inline in its container.
 */
export function PrismLoader({
  fullScreen = false,
  label,
  className,
}: {
  fullScreen?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center",
        fullScreen ? "min-h-dvh w-full flex-col gap-5 bg-background" : "gap-2.5",
        className,
      )}
    >
      <PrismMark
        className={cn(fullScreen ? "size-[57.6px] animate-fade-in-slow" : "size-6", facetPulse)}
      />
      {label ? (
        <span className="type-label-xs text-muted-foreground uppercase">{label}</span>
      ) : (
        <span className="sr-only">Loading…</span>
      )}
    </div>
  );
}

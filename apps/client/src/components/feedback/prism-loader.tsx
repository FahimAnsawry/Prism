import { motion } from "motion/react";
import { PrismMark, type FacetRenderer } from "@/components/prism-logo";
import { EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";

// The four facets dim one after another (top, left, right, then the green center), like light
// passing through the prism. Reduced-motion users get the still mark. How far they dim
// (`--facet-dim`) depends on the theme: light canvas washes out faint slate and the brand green.
function facetDim() {
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--facet-dim"),
  );
  return Number.isFinite(value) ? value : 0.4;
}

function pulseFacets(dim: number): FacetRenderer {
  return ({ d, index, className }) => (
    <motion.path
      d={d}
      className={className}
      animate={{ opacity: [1, dim, 1] }}
      transition={{
        duration: 1.6,
        times: [0, 0.4, 1],
        ease: EASE_STANDARD,
        repeat: Infinity,
        delay: index * 0.2,
      }}
    />
  );
}

/**
 * The app's one loading indicator: the startup loader, the route pending component and every
 * Suspense fallback. `fullScreen` is a whole page in the theme's background with the mark
 * centered; otherwise it sits inline in its container.
 */
export function PrismLoader({
  fullScreen = false,
  label,
  className,
  fadeIn = fullScreen,
}: {
  fullScreen?: boolean;
  label?: string;
  className?: string;
  /** How the mark fades in (PrismMark's `fadeIn`); full-screen loaders fade in by default. */
  fadeIn?: boolean | number;
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
        className={fullScreen ? "size-[57.6px]" : "size-6"}
        fadeIn={fadeIn}
        renderFacet={pulseFacets(facetDim())}
      />
      {label ? (
        <span className="type-label-xs text-muted-foreground uppercase">{label}</span>
      ) : (
        <span className="sr-only">Loading…</span>
      )}
    </div>
  );
}

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { PrismMark, type FacetRenderer } from "@/components/prism-logo";
import { EASE_SPRING_OUT } from "@/lib/motion";

// The mark with its facets knocked apart: one idea, broken. Each facet's offset and the way it
// drifts afterwards, in the mark's svg units. Facets rotate around their own centers, and the
// svg must not clip them.
const BROKEN = [
  { x: -1, y: -4, rotate: -9, drift: { x: 0, y: -1.5 } },
  { x: -4, y: 2, rotate: -7, drift: { x: -1.5, y: 1 } },
  { x: 5, y: 1, rotate: 11, drift: { x: 1.5, y: 1 } },
  { x: 1, y: 4, rotate: 4, drift: { x: 0, y: 1.5 } },
];

const WHOLE = { x: 0, y: 0, rotate: 0 };
const facetBox = { transformBox: "fill-box", transformOrigin: "center" } as const;

// Starts whole, breaks apart, then drifts. Reduced-motion users get the still, broken mark.
const breakingFacet: FacetRenderer = ({ d, index, className }) => {
  const { drift, ...broken } = BROKEN[index] as (typeof BROKEN)[number];
  return (
    <motion.g
      animate={{ x: [0, drift.x, 0], y: [0, drift.y, 0] }}
      transition={{ duration: 3.6, ease: "easeInOut", delay: 1.1, repeat: Infinity }}
    >
      <motion.path
        d={d}
        className={className}
        style={facetBox}
        initial={WHOLE}
        animate={broken}
        transition={{ duration: 0.9, ease: EASE_SPRING_OUT, delay: 0.2 }}
      />
    </motion.g>
  );
};

const brokenFacet: FacetRenderer = ({ d, index, className }) => {
  const { drift: _drift, ...broken } = BROKEN[index] as (typeof BROKEN)[number];
  return (
    <motion.path d={d} className={className} style={facetBox} initial={false} animate={broken} />
  );
};

/**
 * Full-page layout shared by the 404 and error screens. It uses no router hooks, so the
 * top-level error boundary can render it outside the RouterProvider.
 */
export function StatusScreen({
  eyebrow,
  title,
  description,
  actions,
  animateMark = false,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions: ReactNode;
  animateMark?: boolean;
  children?: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-(--page-gutter) py-16">
      <motion.div
        className="flex w-full max-w-xl flex-col items-center text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <PrismMark
          className="size-20 overflow-visible sm:size-24"
          renderFacet={animateMark ? breakingFacet : brokenFacet}
        />
        <p className="mt-10 type-label-xs text-muted-foreground uppercase">{eyebrow}</p>
        <h1 className="mt-3 font-display text-[2.5rem] leading-[0.95] font-bold tracking-display text-balance text-foreground sm:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-md text-lg leading-[1.45] tracking-body text-pretty text-muted-foreground">
          {description}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">{actions}</div>
        {children}
      </motion.div>
    </main>
  );
}

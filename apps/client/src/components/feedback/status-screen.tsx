import type { ReactNode } from "react";
import { PrismMark } from "@/components/prism-logo";
import { cn } from "@/lib/utils";

// The mark with its facets knocked apart: one idea, broken. Each facet's offset lives in
// --facet-break (and its drift direction in --facet-drift) so the animation can reuse it.
// Facets rotate around their own centers, and the svg must not clip them.
const brokenFacets =
  "overflow-visible *:origin-center *:[transform-box:fill-box] *:[transform:var(--facet-break)] [&>path:nth-child(1)]:[--facet-break:translate(-1px,-4px)_rotate(-9deg)] [&>path:nth-child(1)]:[--facet-drift:0_-1.5px] [&>path:nth-child(2)]:[--facet-break:translate(-4px,2px)_rotate(-7deg)] [&>path:nth-child(2)]:[--facet-drift:-1.5px_1px] [&>path:nth-child(3)]:[--facet-break:translate(5px,1px)_rotate(11deg)] [&>path:nth-child(3)]:[--facet-drift:1.5px_1px] [&>path:nth-child(4)]:[--facet-break:translate(1px,4px)_rotate(4deg)] [&>path:nth-child(4)]:[--facet-drift:0_1.5px]";

// Starts whole, breaks apart, then drifts. Reduced-motion users get the still, broken mark.
const breakingFacets = "motion-safe:*:animate-facet-break";

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
      <div className="flex w-full max-w-xl animate-fade-in-slow flex-col items-center text-center">
        <PrismMark
          className={cn("size-20 sm:size-24", brokenFacets, animateMark && breakingFacets)}
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
      </div>
    </main>
  );
}

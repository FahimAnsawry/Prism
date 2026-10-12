import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Gap between siblings that reveal together, and the most steps a group can stack up. */
const STEP_MS = 80;
const MAX_STEPS = 5;

/**
 * Fades its children in and up once, when they scroll into view (styles: `[data-reveal]` in
 * index.css, which also turns the effect off for reduced motion). `step` staggers siblings that
 * enter together: 0 plays right away, each step after waits another 80ms (capped at 5 steps).
 * Layout classes for the wrapper go in `className`.
 *
 * With `whole` it waits until the content is completely on screen. A plain full-height wrapper is
 * what gets watched (the content itself sits 24px low until it shows, which would skew the
 * measurement), and `className` styles the content that fades in.
 */
export function Reveal({
  step = 0,
  whole = false,
  className,
  children,
}: {
  step?: number;
  whole?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Without IntersectionObserver there is nothing to wait for, so content shows straight away.
  const [shown, setShown] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    // Fire a little before the element is fully in, and for tall elements as soon as they enter.
    // `whole` waits for (nearly) all of it: a sliver short of 1 absorbs sub-pixel rounding.
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => (whole ? entry.intersectionRatio >= 0.98 : entry.isIntersecting))
        ) {
          setShown(true);
          observer.disconnect();
        }
      },
      whole ? { threshold: [0.98, 1] } : { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [whole]);

  const style = step
    ? ({ "--reveal-delay": `${Math.min(step, MAX_STEPS) * STEP_MS}ms` } as CSSProperties)
    : undefined;

  if (whole) {
    return (
      <div ref={ref} className="h-full">
        <div data-reveal={shown ? "in" : "out"} style={style} className={className}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} data-reveal={shown ? "in" : "out"} style={style} className={className}>
      {children}
    </div>
  );
}

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EASE_DECELERATE } from "@/lib/motion";

/** Gap between siblings that reveal together, and the most steps a group can stack up. */
const STEP_SECONDS = 0.08;
const MAX_STEPS = 5;

/**
 * Fades its children in and up once, when they scroll into view: the content rises 24px and
 * fades in, and only opacity and transform change, so nothing shifts. With reduced motion the
 * content just shows. `step` staggers siblings that enter together: 0 plays right away, each
 * step after waits another 80ms (capped at 5 steps). Layout classes for the wrapper go in
 * `className`.
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
  const reducedMotion = useReducedMotion();
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

  const content = {
    initial: false,
    animate: shown || reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    transition: {
      duration: 0.7,
      ease: EASE_DECELERATE,
      delay: Math.min(step, MAX_STEPS) * STEP_SECONDS,
    },
    className,
  };

  if (whole) {
    return (
      <div ref={ref} className="h-full">
        <motion.div {...content}>{children}</motion.div>
      </div>
    );
  }

  return (
    <motion.div ref={ref} {...content}>
      {children}
    </motion.div>
  );
}

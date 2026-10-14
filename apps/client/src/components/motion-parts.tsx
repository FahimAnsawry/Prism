import { ChevronDown, ChevronUp, LoaderCircle } from "lucide-react";
import { motion } from "motion/react";
import { EASE_STANDARD, type Bezier } from "@/lib/motion";

const MotionChevronDown = motion.create(ChevronDown);
const MotionChevronUp = motion.create(ChevronUp);
const MotionLoader = motion.create(LoaderCircle);

/** A chevron that turns half way round when `turned` (a menu or section opening). */
export function TurningChevron({
  turned,
  up = false,
  seconds = 0.15,
  ease = EASE_STANDARD,
  className,
}: {
  turned: boolean;
  /** Draw the chevron pointing up while not turned. */
  up?: boolean;
  seconds?: number;
  ease?: Bezier;
  className?: string;
}) {
  const Chevron = up ? MotionChevronUp : MotionChevronDown;
  return (
    <Chevron
      aria-hidden="true"
      className={className}
      initial={false}
      animate={{ rotate: turned ? 180 : 0 }}
      transition={{ duration: seconds, ease }}
    />
  );
}

/** The busy spinner: a loader circle turning once a second (Tailwind's old `animate-spin`). */
export function Spinner({ className }: { className?: string }) {
  return (
    <MotionLoader
      aria-hidden="true"
      className={className}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, ease: "linear", repeat: Infinity }}
    />
  );
}

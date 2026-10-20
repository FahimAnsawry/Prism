import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

const tones = { lime: "bg-lime", peach: "bg-peach" } as const;

/**
 * A sticky note as drawn on the board: pastel fill, handwriting, soft drop shadow. It is a motion
 * div, so callers can animate it (`initial`, `animate`, `transition`).
 */
export function Sticky({
  children,
  tone = "lime",
  className,
  ...motionProps
}: HTMLMotionProps<"div"> & { tone?: keyof typeof tones }) {
  return (
    <motion.div
      className={cn(
        "font-hand text-slate shadow-[0_12px_24px_-8px_rgb(61_59_80/0.2)]",
        tones[tone],
        className,
      )}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

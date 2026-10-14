import { motion, type Variants } from "motion/react";
import { type MouseEvent, useId } from "react";
import { EASE_STANDARD, EASE_TOGGLE, HOVER_SECONDS } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Four-point sparkle centered on (cx, cy). */
const sparkle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;

const STARS = [
  { cx: 15.5, cy: 5.5, r: 2.4 },
  { cx: 19.5, cy: 10.5, r: 1.6 },
];

/** Everything turns around, and is measured from, the 24×24 icon. */
const iconBox = { transformBox: "view-box" } as const;
const aroundCenter = { ...iconBox, originX: "12px", originY: "12px" } as const;

/** The long, soft landing every part of the morph moves with (opacity is a little quicker). */
const move = { duration: 0.5, ease: EASE_TOGGLE };
const fade = { duration: 0.3, ease: EASE_TOGGLE };

// The button's variants: "light" and "dark" are the two themes; "lightHover" and "darkHover" are
// those themes while the pointer is over the button. Every part of the icon picks its own.
const icon: Variants = {
  light: { rotate: 0, transition: move },
  lightHover: { rotate: 0, transition: move },
  dark: { rotate: 0, transition: move },
  darkHover: { rotate: -12, transition: move },
};
const core: Variants = {
  light: { scale: 0.5, transition: move },
  dark: { scale: 1, transition: move },
};
// The mask circle slides over the core to cut the crescent.
const bite: Variants = {
  light: { x: 9, y: -9, transition: move },
  dark: { x: 0, y: 0, transition: move },
};
// The sun turns an eighth on hover; the moon has its rays folded away.
const rays: Variants = {
  light: { rotate: 0, transition: move },
  lightHover: { rotate: 45, transition: move },
  dark: { rotate: -45, transition: move },
  darkHover: { rotate: -45, transition: move },
};
// The rays retract one after another.
const ray = (i: number): Variants => {
  const delay = (i * 25) / 1000;
  return {
    light: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        scale: { ...move, delay },
        rotate: { ...move, delay },
        opacity: { ...fade, delay },
      },
    },
    dark: {
      opacity: 0,
      scale: 0.4,
      rotate: -30,
      transition: {
        scale: { ...move, delay },
        rotate: { ...move, delay },
        opacity: { ...fade, delay },
      },
    },
  };
};
// Two small stars come out at night, after the crescent has formed.
const star = (i: number): Variants => {
  const delay = (200 + i * 80) / 1000;
  return {
    light: {
      opacity: 0,
      scale: 0,
      rotate: -90,
      transition: { scale: move, rotate: move, opacity: fade },
    },
    dark: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: {
        scale: { ...move, delay },
        rotate: { ...move, delay },
        opacity: { ...fade, delay },
      },
    },
  };
};

/**
 * Day/night switch: a sun that becomes a crescent moon. The core circle grows and a mask circle
 * slides over it to cut the crescent, the rays retract and two stars come out. Callers size and
 * outline it to match the bar it sits in.
 */
export function ThemeToggle({
  className,
  hoverBackground = "var(--hover)",
}: {
  className?: string;
  /** The color the button takes under the pointer. */
  hoverBackground?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const maskId = `${useId()}-moon`;
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Keyboard clicks report 0,0, so the reveal starts from the button's center either way.
    const box = event.currentTarget.getBoundingClientRect();
    toggleTheme({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "theme-toggle inline-flex shrink-0 items-center justify-center text-foreground",
        className,
      )}
      initial={false}
      animate={theme}
      variants={{
        lightHover: { backgroundColor: hoverBackground },
        darkHover: { backgroundColor: hoverBackground },
      }}
      whileHover={theme === "dark" ? "darkHover" : "lightHover"}
      transition={{ duration: HOVER_SECONDS, ease: EASE_STANDARD }}
    >
      <motion.svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" variants={icon}>
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <motion.circle variants={bite} style={iconBox} cx="16" cy="8" r="8" fill="black" />
        </mask>
        <motion.circle
          variants={core}
          style={aroundCenter}
          cx="12"
          cy="12"
          r="9"
          fill="currentColor"
          mask={`url(#${maskId})`}
        />
        <motion.g
          variants={rays}
          style={aroundCenter}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {RAY_ANGLES.map((angle, i) => (
            // The angle sits on a wrapper: the animated transform on the line would replace it.
            <g key={angle} transform={`rotate(${angle} 12 12)`}>
              <motion.line variants={ray(i)} style={aroundCenter} x1="12" y1="2.5" x2="12" y2="5" />
            </g>
          ))}
        </motion.g>
        {STARS.map((s, i) => (
          <motion.path
            key={i}
            variants={star(i)}
            style={{ ...iconBox, originX: `${s.cx}px`, originY: `${s.cy}px` }}
            d={sparkle(s.cx, s.cy, s.r)}
            fill="currentColor"
          />
        ))}
      </motion.svg>
    </motion.button>
  );
}

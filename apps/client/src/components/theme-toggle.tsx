import { type CSSProperties, type MouseEvent, useId } from "react";
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

/**
 * Day/night switch: a sun that becomes a crescent moon (the morph lives in index.css under
 * "Theme switch"). Callers size and outline it to match the bar it sits in.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const maskId = `${useId()}-moon`;
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Keyboard clicks report 0,0, so the reveal starts from the button's center either way.
    const box = event.currentTarget.getBoundingClientRect();
    toggleTheme({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "theme-toggle inline-flex shrink-0 items-center justify-center text-foreground transition-colors duration-150 ease-standard hover:bg-background",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-toggle__icon size-5">
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <circle className="theme-toggle__bite" cx="16" cy="8" r="8" fill="black" />
        </mask>
        <circle
          className="theme-toggle__core"
          cx="12"
          cy="12"
          r="9"
          fill="currentColor"
          mask={`url(#${maskId})`}
        />
        <g
          className="theme-toggle__rays"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {RAY_ANGLES.map((angle, i) => (
            // The angle sits on a wrapper: the CSS transform on the line would replace it.
            <g key={angle} transform={`rotate(${angle} 12 12)`}>
              <line
                className="theme-toggle__ray"
                style={{ "--i": i } as CSSProperties}
                x1="12"
                y1="2.5"
                x2="12"
                y2="5"
              />
            </g>
          ))}
        </g>
        {STARS.map((star, i) => (
          <path
            key={i}
            className="theme-toggle__star"
            style={{ "--i": i, "--origin": `${star.cx}px ${star.cy}px` } as CSSProperties}
            d={sparkle(star.cx, star.cy, star.r)}
            fill="currentColor"
          />
        ))}
      </svg>
    </button>
  );
}

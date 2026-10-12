import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * The prism mark (36×36 on the board): one triangle cut into four facets. The corner facets
 * take the svg's fill; the center facet is always brand green.
 */
export function PrismMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className={cn("size-9 fill-foreground", className)}>
      <path d="M18 0 25.86 15.72H10.14Z" />
      <path d="M7.86 20.28 15.72 36H0Z" />
      <path d="M28.14 20.28 36 36H20.28Z" />
      <path className="fill-brand" d="M10.14 18.54h15.72L18 34.26Z" />
    </svg>
  );
}

/** The board's logo is a 28px mark beside a 24px word; `compact` is the dashboard navbar's size. */
export function PrismLogo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      to="/"
      aria-label="Prism home"
      className={cn(
        "inline-flex items-center text-foreground",
        compact ? "gap-2" : "gap-3",
        className,
      )}
    >
      <PrismMark className={compact ? "size-[25px]" : "size-7"} />
      <span
        className={cn(
          "font-display leading-none font-bold tracking-[-0.03em]",
          compact ? "text-xl" : "text-2xl",
        )}
      >
        Prism
      </span>
    </Link>
  );
}

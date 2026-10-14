import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useId, useState } from "react";
import { EASE_SPRING_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

type NavItem = { label: string; to: "/" | "/docs" | "/about"; newTab?: boolean };

// The docs open in a new tab, so a reader keeps their place on the page they came from.
const ITEMS: NavItem[] = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Docs", to: "/docs", newTab: true },
];

/** The highlight's glide between items: quick, with a soft landing and no overshoot. */
const GLIDE = { type: "spring", stiffness: 520, damping: 44, mass: 0.8 } as const;

function useActiveItem() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (item: NavItem) =>
    !item.newTab && (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to));
}

function newTabProps(item: NavItem) {
  return item.newTab ? ({ target: "_blank", rel: "noopener" } as const) : {};
}

/**
 * The bar's page links. One muted highlight follows the pointer (or keyboard focus) from item to
 * item instead of each link lighting up on its own; the current page carries a brand-green rule
 * that sits on the bar's bottom border.
 */
export function NavLinks({ className }: { className?: string }) {
  const isActive = useActiveItem();
  const [hovered, setHovered] = useState<string | null>(null);
  const highlightId = useId();

  return (
    <ul className={cn("flex items-center", className)} onPointerLeave={() => setHovered(null)}>
      {ITEMS.map((item) => {
        const active = isActive(item);
        const lit = hovered === item.label;
        return (
          <li key={item.label}>
            <Link
              to={item.to}
              {...newTabProps(item)}
              aria-current={active ? "page" : undefined}
              onPointerEnter={() => setHovered(item.label)}
              onFocus={() => setHovered(item.label)}
              onBlur={() => setHovered(null)}
              className={cn(
                "group relative isolate inline-flex h-[38px] items-center gap-1 px-3.5 text-sm font-medium transition-colors duration-150 ease-standard",
                active || lit ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {lit && (
                <motion.span
                  layoutId={highlightId}
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 bg-muted"
                  transition={GLIDE}
                />
              )}
              {item.label}
              {item.newTab && (
                <>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-3.5 opacity-50 transition duration-200 ease-standard group-hover:translate-x-px group-hover:-translate-y-px group-hover:opacity-100"
                  />
                  <span className="sr-only"> (opens in a new tab)</span>
                </>
              )}
              {active && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-x-3.5 -bottom-[11px] h-0.5 origin-left bg-brand"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.4, ease: EASE_SPRING_OUT, delay: 0.15 }}
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The same links as full-width rows for the burger menu, with the current page marked. */
export function MenuLinks({ onNavigate }: { onNavigate: () => void }) {
  const isActive = useActiveItem();
  return (
    <ul className="-mx-3">
      {ITEMS.map((item) => {
        const active = isActive(item);
        const Icon = item.newTab ? ArrowUpRight : ChevronRight;
        return (
          <li key={item.label}>
            <Link
              to={item.to}
              {...newTabProps(item)}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center justify-between border-l-2 px-3 py-3 text-base font-medium transition-colors duration-150 ease-standard hover:bg-muted",
                active
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              {item.newTab && <span className="sr-only"> (opens in a new tab)</span>}
              <Icon
                aria-hidden="true"
                className={cn(
                  "size-4 opacity-50 transition duration-200 ease-standard group-hover:opacity-100",
                  item.newTab
                    ? "group-hover:translate-x-px group-hover:-translate-y-px"
                    : "group-hover:translate-x-0.5",
                )}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

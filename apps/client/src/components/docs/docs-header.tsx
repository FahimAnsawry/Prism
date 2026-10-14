import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { pageContainer } from "@/components/landing/page-container";
import { PrismLogo } from "@/components/prism-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { DocsNav } from "./docs-nav";
import { DocsSearch } from "./docs-search";
import type { DocPage } from "./docs-types";

/** Below this (Tailwind's lg) the sidebar folds into the burger menu. */
const SIDEBAR_QUERY = "(min-width: 64rem)";

export function DocsHeader({ current }: { current: DocPage }) {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Escape closes the menu (focus goes back to the burger), and so does a press outside the
  // header or a window wide enough to show the sidebar.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(SIDEBAR_QUERY);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onQueryChange = () => {
      if (query.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    query.addEventListener("change", onQueryChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      query.removeEventListener("change", onQueryChange);
    };
  }, [open]);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-border bg-background">
      <div className={cn(pageContainer, "flex h-16 items-center gap-4 sm:gap-6")}>
        <PrismLogo compact />

        <div className="hidden flex-1 md:block">
          <DocsSearch />
        </div>

        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <div className="md:hidden">
            <DocsSearch compact />
          </div>
          <ThemeToggle className="size-[38px] border border-input" hoverBackground="var(--muted)" />
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="docs-menu"
            className="inline-flex size-[38px] shrink-0 items-center justify-center border border-input text-foreground transition-colors duration-150 ease-standard hover:bg-muted lg:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="docs-menu"
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-background shadow-[0_10px_24px_-14px_rgb(42_42_42/0.35)] lg:hidden dark:shadow-[0_10px_24px_-14px_rgb(0_0_0/0.8)]"
        >
          <div className={cn(pageContainer, "py-6")}>
            <DocsNav current={current} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}

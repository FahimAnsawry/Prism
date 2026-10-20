import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { PrismLogo } from "@/components/prism-logo";
import { EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { FacetField } from "./facet-field";
import { PrismPanel } from "./prism-panel";

/** The "Back to home" link, shared by the split and crystal layouts. */
function BackToHome() {
  return (
    <motion.span className="inline-flex" whileHover="hover">
      <Link
        to="/"
        className="inline-flex min-h-6 items-center gap-2 text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-ink hover:underline"
      >
        <motion.span
          className="inline-flex"
          variants={{ hover: { x: -2 } }}
          transition={{ duration: 0.15, ease: EASE_STANDARD }}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </motion.span>
        Back to home
      </Link>
    </motion.span>
  );
}

/**
 * The login screen's "Faceted geometry" look from the board: a full-bleed crystal facet field
 * with the form on a lit card in the middle.
 */
function CrystalLayout({
  children,
  footer,
  size,
}: {
  children: ReactNode;
  footer?: ReactNode;
  size: "narrow" | "medium" | "wide";
}) {
  return (
    // Focused fields get the dashboard search box's look: green border and soft green halo (red when
    // invalid), no black outline.
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground [&_input]:transition-[border-color,box-shadow] [&_input:focus-visible:not([aria-invalid])]:border-[#28e99f] [&_input:focus-visible:not([aria-invalid])]:shadow-[0_0_0_4px_rgba(40,233,159,0.3)] [&_input:focus-visible:not([aria-invalid])]:outline-none [&_input[aria-invalid]:focus-visible]:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_4px_color-mix(in_srgb,var(--destructive)_30%,transparent)] [&_input[aria-invalid]:focus-visible]:outline-none">
      <FacetField className="absolute inset-0 -z-10 size-full" />
      <header className="relative z-10 flex items-center justify-between gap-4 px-(--page-gutter) py-6 short:py-3 lg:absolute lg:inset-x-0 lg:top-0 lg:px-8">
        <PrismLogo />
        <span className="border border-divider px-4 py-1.5">
          <BackToHome />
        </span>
      </header>
      <main className="flex min-h-0 flex-1 px-(--page-gutter) py-6 lg:py-14">
        <div
          className={cn(
            "relative m-auto w-full border border-divider bg-card px-6 py-8 shadow-[0_32px_64px_-24px_rgb(61_59_79/0.4)] sm:px-12 sm:py-12 short:py-8 short:[&_h1]:text-4xl tiny:[zoom:0.88]",
            { narrow: "max-w-120", medium: "max-w-130 sm:px-10 sm:py-10", wide: "max-w-170" }[size],
          )}
        >
          {children}
          {footer && <p className="mt-6 text-xs text-muted-foreground">{footer}</p>}
        </div>
      </main>
    </div>
  );
}

/**
 * Split auth screen from the board: form column (640/1440, 448px form) beside the dark prism
 * panel. `panel={false}` drops the panel and centers the form (e.g. the AI editor consent page).
 * The panel layouts (login and signup) also get a "Back to home" link beside the logo.
 * `crystal` swaps the whole split for the crystal-facet card (`"medium"` for the AI editor consent
 * card, `"wide"` for two-column forms). `panelButton` is the label in the panel's code card;
 * `footer` is the fine print at the bottom.
 */
export function AuthLayout({
  children,
  panel = true,
  panelButton = "Log in",
  footer,
  crystal = false,
}: {
  children: ReactNode;
  panel?: boolean;
  panelButton?: string;
  footer?: ReactNode;
  crystal?: boolean | "medium" | "wide";
}) {
  if (crystal) {
    return (
      <CrystalLayout footer={footer} size={crystal === true ? "narrow" : crystal}>
        {children}
      </CrystalLayout>
    );
  }
  return (
    <div
      className={cn(
        "grid min-h-screen grid-cols-[minmax(0,1fr)] bg-background",
        panel && "lg:grid-cols-[640fr_800fr]",
      )}
    >
      <main
        className={cn(
          "flex flex-col px-(--page-gutter) py-8",
          panel ? "lg:pr-12 lg:pl-24" : "lg:px-24",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <PrismLogo />
          {panel && <BackToHome />}
        </div>
        <div className={cn("my-auto w-full max-w-112 py-6", !panel && "mx-auto")}>{children}</div>
        {footer && (
          <p className={cn("text-xs text-muted-foreground", !panel && "mx-auto w-full max-w-112")}>
            {footer}
          </p>
        )}
      </main>
      {panel && <PrismPanel button={panelButton} />}
    </div>
  );
}

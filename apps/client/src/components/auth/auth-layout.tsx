import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { PrismLogo } from "@/components/prism-logo";
import { EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PrismPanel } from "./prism-panel";

/**
 * Split auth screen from the board: form column (640/1440, 448px form) beside the dark prism
 * panel. `panel={false}` drops the panel and centers the form (e.g. the AI editor consent page).
 * The panel layouts (login and signup) also get a "Back to home" link beside the logo.
 * `panelButton` is the label in the panel's code card; `footer` is the fine print at the bottom.
 */
export function AuthLayout({
  children,
  panel = true,
  panelButton = "Log in",
  footer,
}: {
  children: ReactNode;
  panel?: boolean;
  panelButton?: string;
  footer?: ReactNode;
}) {
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
          {panel && (
            <motion.span className="inline-flex" whileHover="hover">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-ink hover:underline"
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
          )}
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

import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { PrismLogo } from "@/components/prism-logo";
import { PrismPanel } from "./prism-panel";

/** Split auth screen from the board: form column (640/1440) beside the dark prism panel. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[640fr_800fr]">
      <main className="flex flex-col px-(--page-gutter) pt-8 pb-12 lg:px-20 lg:pt-14 lg:pb-14">
        <div className="flex items-center justify-between gap-6">
          <PrismLogo />
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.08em] text-slate uppercase underline-offset-4 transition-colors hover:text-onyx hover:underline [&_svg]:size-3.5"
          >
            <ArrowLeft aria-hidden="true" />
            Back home
          </Link>
        </div>
        <div className="my-auto w-full max-w-100 pt-12 lg:ml-10 lg:pt-10">{children}</div>
      </main>
      <PrismPanel />
    </div>
  );
}

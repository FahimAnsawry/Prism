import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ctaVariants } from "@/components/cta";
import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="border-b border-dashed border-border">
      <div className={cn(pageContainer, "flex flex-col items-center pt-24 pb-16 text-center")}>
        <h2
          id="closing-title"
          className="font-display text-[2.5rem] leading-[0.95] font-bold tracking-display text-balance text-foreground md:text-6xl lg:text-[4.25rem]"
        >
          Start with a blank board.
        </h2>
        <p className="mt-8 max-w-[40rem] text-lg leading-[1.45] tracking-body text-muted-foreground lg:text-xl">
          Open a board in your browser and share the link. Nothing to install.
        </p>
        <Link to="/signup" className={cn(ctaVariants({ size: "lg" }), "mt-10 w-[198px]")}>
          Start a board
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

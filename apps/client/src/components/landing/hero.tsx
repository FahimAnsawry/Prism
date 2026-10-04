import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ctaVariants } from "@/components/cta";
import { LiveCursor } from "@/components/live-cursor";
import { cn } from "@/lib/utils";
import { BoardPreview } from "./board-preview";
import { pageContainer } from "./page-container";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="border-b border-dashed border-border">
      <div className={cn(pageContainer, "relative pt-[52px] pb-20")}>
        <h1
          id="hero-title"
          className="font-display text-5xl leading-[0.92] font-bold tracking-display text-foreground sm:text-[4rem] md:text-[5rem] lg:text-[5.75rem] lg:leading-[0.9]"
        >
          One idea, broken <br className="max-sm:hidden" />
          into many views.
        </h1>

        <p className="mt-10 max-w-[38rem] text-lg leading-[1.45] tracking-body text-foreground md:text-[22px] lg:mt-[124px]">
          Sketch, wireframe and plan together on one live canvas. Every stroke syncs as you draw,
          and Claude can draw right alongside you.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-6">
          <Link to="/signup" className={ctaVariants({ variant: "primary", size: "lg" })}>
            Start a board
            <ArrowRight aria-hidden="true" />
          </Link>
          <a href="#how-it-works" className={ctaVariants({ variant: "secondary", size: "lg" })}>
            See how it works
          </a>
          <p className="-rotate-3 font-hand text-[26px] md:text-[32px] leading-none text-foreground md:ml-6">
            <span aria-hidden="true">← </span>no install, just share a link
          </p>
        </div>

        {/* Collaborators floating over the hero, as on the board */}
        <LiveCursor
          name="Fahim"
          tone="brand"
          className="absolute top-[112px] right-[163px] max-xl:hidden"
        />
        <LiveCursor
          name="Claude"
          tone="onyx"
          className="absolute top-[376px] right-[143px] max-xl:hidden"
        />

        <div className="mt-10 lg:mt-14">
          <BoardPreview />
        </div>
      </div>
    </section>
  );
}

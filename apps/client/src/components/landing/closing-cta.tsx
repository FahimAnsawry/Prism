import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ctaVariants } from "@/components/cta";
import { LiveCursor } from "@/components/live-cursor";
import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";
import { Reveal } from "./reveal";
import { Sticky } from "./sticky";

/**
 * The closing call to action, drawn as a board (1280×460): a sticky note, Fahim's cursor and a
 * second note around the heading. The notes need the full width, so they only show from xl.
 */
export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="border-b border-border">
      <div className={cn(pageContainer, "py-16 md:py-24 lg:py-32")}>
        <div className="dot-grid relative border border-border px-5 py-14 text-center sm:px-6 sm:py-16 xl:h-[460px] xl:p-0">
          <Reveal step={3} className="absolute top-8 left-10 w-60 max-xl:hidden">
            <Sticky className="p-6 text-left">
              <p className="text-[40px] leading-[1.05]">
                your idea
                <br />
                goes here
              </p>
            </Sticky>
          </Reveal>
          <LiveCursor
            name="Fahim"
            tone="brand"
            className="absolute top-[34px] left-[calc(50%+226px)] max-xl:hidden"
          />

          <div className="flex flex-col items-center xl:pt-[88px]">
            <Reveal>
              <h2
                id="closing-title"
                className="font-display text-[2.5rem] leading-[1.05] font-bold tracking-display text-balance text-foreground sm:text-5xl"
              >
                Start with one sticky note.
              </h2>
            </Reveal>
            <Reveal step={1}>
              <p className="mt-6 max-w-[40rem] text-lg leading-normal text-foreground md:text-xl">
                Open a board in your browser and share the link. Nothing to install.
              </p>
            </Reveal>
            <Reveal step={2} className="mt-8 md:mt-10 xl:mt-[79px]">
              <Link to="/signup" className={ctaVariants({ size: "lg" })}>
                Start a board
                <ArrowRight aria-hidden="true" />
              </Link>
            </Reveal>
          </div>

          <Reveal step={4} className="absolute top-[272px] right-[72px] w-75 max-xl:hidden">
            <Sticky tone="peach" className="p-6 text-left">
              <p className="text-[40px] leading-[1.05]">
                then ask Claude
                <br />
                for the screens
              </p>
            </Sticky>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

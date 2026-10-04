import { createFileRoute } from "@tanstack/react-router";
import { ClaudeSection } from "@/components/landing/claude-section";
import { ClosingCta } from "@/components/landing/closing-cta";
import { Hero } from "@/components/landing/hero";
import { LoopSection } from "@/components/landing/loop-section";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { ViewsSection } from "@/components/landing/views-section";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Prism · One idea broken into many views." }] }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ViewsSection />
        <ClaudeSection />
        <LoopSection />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}

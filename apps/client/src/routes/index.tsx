import { createFileRoute } from "@tanstack/react-router";
import { ClosingCta } from "@/components/landing/closing-cta";
import { EditorsSection } from "@/components/landing/editors-section";
import { Hero } from "@/components/landing/hero";
import { SharingSection } from "@/components/landing/sharing-section";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SpecSection } from "@/components/landing/spec-section";
import { redirectIfSignedIn } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Prism - One idea broken into many views." }] }),
  beforeLoad: redirectIfSignedIn,
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <SiteHeader flight />
      <main>
        <Hero />
        <EditorsSection />
        <SpecSection />
        <SharingSection />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}

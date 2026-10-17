import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/about/about-page";
import { redirectIfSignedIn } from "@/lib/auth-client";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About - Prism" }] }),
  beforeLoad: redirectIfSignedIn,
  component: AboutPage,
});

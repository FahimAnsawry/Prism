import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/about/about-page";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About - Prism" }] }),
  component: AboutPage,
});

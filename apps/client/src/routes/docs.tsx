import { createFileRoute } from "@tanstack/react-router";
import { DocsShell } from "@/components/docs/docs-shell";
import { redirectIfSignedIn } from "@/lib/auth-client";

export const Route = createFileRoute("/docs")({
  // The layout route, so /docs/ and /docs/$ are covered too.
  beforeLoad: redirectIfSignedIn,
  component: DocsShell,
});

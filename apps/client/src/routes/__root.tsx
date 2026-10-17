import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ErrorPage } from "@/components/feedback/error-page";
import { NotFoundPage } from "@/components/feedback/not-found-page";

/** Route loaders start their pages' queries with this, alongside the page's code. */
export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: "Prism" }] }),
  component: RootLayout,
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
});

// Loaded with the first page that follows: it brings socket.io-client, which the landing page,
// sign-in and docs don't need.
const AiBoardFollower = lazy(() =>
  import("@/components/ai-board-follower").then((m) => ({ default: m.AiBoardFollower })),
);

/** Signed-in pages, where the tab follows boards an AI editor opens (signed-out sockets are refused). */
const FOLLOWING_ROUTES = new Set<string>(["/dashboard", "/board/$boardId"]);

function RootLayout() {
  const following = useRouterState({
    select: (state) => state.matches.some((match) => FOLLOWING_ROUTES.has(match.routeId)),
  });
  return (
    <>
      <HeadContent />
      <Outlet />
      {following && (
        <Suspense fallback={null}>
          <AiBoardFollower />
        </Suspense>
      )}
    </>
  );
}

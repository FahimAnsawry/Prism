import { HeadContent, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { AiBoardFollower } from "@/components/ai-board-follower";
import { ErrorPage } from "@/components/feedback/error-page";
import { NotFoundPage } from "@/components/feedback/not-found-page";

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: "Prism" }] }),
  component: RootLayout,
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
});

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
      {following && <AiBoardFollower />}
    </>
  );
}

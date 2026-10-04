import { HeadContent, Outlet, createRootRoute } from "@tanstack/react-router";
import { ErrorPage } from "@/components/feedback/error-page";
import { NotFoundPage } from "@/components/feedback/not-found-page";

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: "Prism" }] }),
  component: RootLayout,
  errorComponent: ErrorPage,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}

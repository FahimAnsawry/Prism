import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "./components/feedback/app-error-boundary";
import { AppSplash } from "./components/feedback/app-splash";
import { ErrorPage } from "./components/feedback/error-page";
import { NotFoundPage } from "./components/feedback/not-found-page";
import { PrismLoader } from "./components/feedback/prism-loader";
import { ThemeProvider } from "./components/theme-provider";
import { installGlobalErrorHandlers, reportError } from "./lib/errors";
import { routeTree } from "./routeTree.gen";
import "./index.css";

installGlobalErrorHandlers();

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => reportError(error, { source: "query", queryKey: query.queryKey }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      reportError(error, { source: "mutation", mutationKey: mutation.options.mutationKey }),
  }),
});

const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPendingComponent: () => <PrismLoader fullScreen />,
  defaultErrorComponent: ErrorPage,
  defaultNotFoundComponent: NotFoundPage,
  defaultOnCatch: (error, info) =>
    reportError(error, { source: "router", componentStack: info.componentStack ?? undefined }),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

/** True when no route matches the URL, i.e. the router will render the 404 page. */
function isUnknownPath(pathname: string) {
  // Same rule as the router's own matching: no route at all, or only a partial (`**`) match.
  const [, rawParams, foundRoute] = router.getMatchedRoutes(pathname);
  return foundRoute ? foundRoute.path !== "/" && Boolean(rawParams["**"]) : true;
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element in index.html");

const reactError = (error: unknown, info: { componentStack?: string }) =>
  reportError(error, { source: "react", componentStack: info.componentStack });

createRoot(rootElement, {
  onCaughtError: reactError,
  onUncaughtError: reactError,
  onRecoverableError: reactError,
}).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<PrismLoader fullScreen />}>
            <RouterProvider router={router} />
          </Suspense>
          {/* A 404 opens straight onto the not-found page, with no splash. */}
          <AppSplash skip={isUnknownPath(router.state.location.pathname)} />
        </QueryClientProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
);

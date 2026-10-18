import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
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
  context: { queryClient },
  // Hovering or focusing a link loads the page's code (and its loader's cheap queries) ahead.
  defaultPreload: "intent",
  // TanStack Query decides when data is stale; the router always runs the loader.
  defaultPreloadStaleTime: 0,
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

/**
 * The startup loader belongs to the marketing pages (landing and About), whose entrances wait
 * for it. App pages (the dashboard, boards, sign-in) and the docs open straight away.
 */
const SPLASH_PATH = /^\/(about\/?)?$/;

/** The longest the startup cover waits for the first page. */
const FIRST_PAGE_MAX_MS = 10_000;

/**
 * Settles once the router has resolved the first page (after its session check, loader and
 * code, and any redirect). Until then the router draws nothing for up to `defaultPendingMs`,
 * so app pages keep the startup cover up until this.
 */
const firstPageReady = new Promise<void>((resolve) => {
  const unsubscribe = router.subscribe("onResolved", () => {
    unsubscribe();
    resolve();
  });
  // Never left covering the app, whatever happens to that load.
  setTimeout(resolve, FIRST_PAGE_MAX_MS);
});

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
      {/* Reduced motion drops movement (transforms, layout) from every motion component but keeps
          fades and color changes, so state changes still show. */}
      <MotionConfig reducedMotion="user">
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <Suspense fallback={<PrismLoader fullScreen />}>
              <RouterProvider router={router} />
            </Suspense>
            {/* Only the landing page opens behind the loader. */}
            <AppSplash
              skip={!SPLASH_PATH.test(router.state.location.pathname)}
              ready={firstPageReady}
            />
          </QueryClientProvider>
        </ThemeProvider>
      </MotionConfig>
    </AppErrorBoundary>
  </StrictMode>,
);

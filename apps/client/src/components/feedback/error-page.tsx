import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { ctaVariants } from "@/components/cta";
import { toError } from "@/lib/errors";
import { StatusScreen } from "./status-screen";

/**
 * The error screen without router hooks, so the top-level boundary can use it too. The caller
 * decides how "Go home" navigates. Error detail shows only in dev.
 */
export function ErrorScreen({
  error,
  onRetry,
  onGoHome,
}: {
  error: unknown;
  onRetry: () => void;
  onGoHome: () => void;
}) {
  const { message, stack } = toError(error);

  return (
    <StatusScreen
      eyebrow="Something broke"
      title="This view didn't render."
      description="An unexpected error stopped this page from loading. Try again, or head back home."
      actions={
        <>
          <button type="button" onClick={onRetry} className={ctaVariants({ size: "lg" })}>
            <RotateCcw aria-hidden="true" />
            Try again
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className={ctaVariants({ variant: "secondary", size: "lg" })}
          >
            Go home
          </button>
        </>
      }
    >
      {import.meta.env.DEV && (
        <pre className="mt-12 max-h-72 w-full overflow-auto border border-dashed border-border p-4 text-left font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
          <strong className="text-foreground">{message}</strong>
          {stack && `\n\n${stack}`}
        </pre>
      )}
    </StatusScreen>
  );
}

/** Router defaultErrorComponent. Retrying re-runs the route's loaders as well as re-rendering. */
export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <ErrorScreen
      error={error}
      onRetry={() => {
        reset();
        void router.invalidate();
      }}
      // Client-side: navigate first, then clear the boundary so the broken view isn't retried.
      onGoHome={() => void router.navigate({ to: "/" }).then(reset)}
    />
  );
}

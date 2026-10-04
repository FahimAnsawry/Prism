import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { ctaVariants } from "@/components/cta";
import { StatusScreen } from "./status-screen";

/** Unknown URLs and `notFound()` thrown from loaders (router defaultNotFoundComponent). */
export function NotFoundPage() {
  const router = useRouter();
  // Read once, on arrival: leaving via "Go home" pushes a history entry while the 404 is still
  // on screen (the next route's chunk is loading), which would flash the "Go back" button.
  const canGoBackNow = useCanGoBack();
  const [canGoBack] = useState(canGoBackNow);

  return (
    <StatusScreen
      eyebrow="Error 404"
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved. Check the URL, or return to the homepage."
      animateMark
      actions={
        <>
          <Link to="/" className={ctaVariants({ size: "lg" })}>
            Go home
          </Link>
          {canGoBack && (
            <button
              type="button"
              onClick={() => router.history.back()}
              className={ctaVariants({ variant: "secondary", size: "lg" })}
            >
              <ArrowLeft aria-hidden="true" />
              Go back
            </button>
          )}
        </>
      }
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignupForm } from "@/components/auth/signup-form";
import { redirectIfSignedIn } from "@/lib/auth-client";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create an account - Prism" }] }),
  // Kept as-is: an AI editor's sign-in arrives with a signed query (see inOAuthFlow).
  validateSearch: (search: Record<string, unknown>) => search,
  beforeLoad: redirectIfSignedIn,
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}

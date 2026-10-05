import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfSignedIn } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in - Prism" }] }),
  // Better Auth sends failed Google/GitHub sign-ins back here with ?error=<code>
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    typeof search["error"] === "string" ? { error: search["error"] } : {},
  beforeLoad: redirectIfSignedIn,
  component: LoginPage,
});

function LoginPage() {
  const { error } = Route.useSearch();
  return (
    <AuthLayout>
      <LoginForm key={error} oauthError={error} />
    </AuthLayout>
  );
}

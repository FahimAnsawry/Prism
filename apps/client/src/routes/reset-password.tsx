import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { redirectIfSignedIn } from "@/lib/auth-client";

interface ResetPasswordSearch {
  token?: string;
  error?: string;
}

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password - Prism" }] }),
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => ({
    token: typeof search["token"] === "string" ? search["token"] : undefined,
    error: typeof search["error"] === "string" ? search["error"] : undefined,
  }),
  beforeLoad: redirectIfSignedIn,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  return (
    <AuthLayout panel={false}>
      <ResetPasswordForm token={token} tokenError={error} />
    </AuthLayout>
  );
}

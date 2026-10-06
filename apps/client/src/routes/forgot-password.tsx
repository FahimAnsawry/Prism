import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { redirectIfSignedIn } from "@/lib/auth-client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password - Prism" }] }),
  beforeLoad: redirectIfSignedIn,
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <AuthLayout panel={false}>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}

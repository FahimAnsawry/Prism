import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in · Prism" }] }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}

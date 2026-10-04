import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignupForm } from "@/components/auth/signup-form";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create an account · Prism" }] }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}

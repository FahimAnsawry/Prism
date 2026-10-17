import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@prism/shared";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ctaVariants } from "@/components/cta";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage, inOAuthFlow, runAuthAction } from "@/lib/auth-client";
import { rememberLastSignIn } from "@/lib/last-sign-in";
import { AuthHeading } from "./auth-heading";
import { FormError, FormField, PasswordToggle } from "./form-field";
import { OrDivider, SocialSignIn } from "./social-sign-in";

/** `oauthError` is the `?error=` code Better Auth adds when a Google/GitHub sign-in fails. */
export function LoginForm({ oauthError }: { oauthError?: string }) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState(() =>
    oauthError ? authErrorMessage(oauthError) : undefined,
  );
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async ({ email, password }: LoginInput) => {
    setFormError(undefined);
    const message = await runAuthAction(() => authClient.signIn.email({ email, password }));
    if (message) {
      setFormError(message);
      return;
    }
    rememberLastSignIn("email");
    // An AI editor's sign-in continues on its own (Better Auth's client follows the redirect).
    if (inOAuthFlow()) return;
    await navigate({ to: "/dashboard" });
  };

  return (
    <>
      <AuthHeading
        prompt="New to Prism?"
        link={
          <Link
            to="/signup"
            // Keeps an AI editor's sign-in request, so it continues after sign-up.
            search={(prev) => prev}
          >
            Create an account
          </Link>
        }
      >
        Log in to Prism
      </AuthHeading>

      <div className="mt-8">
        <SocialSignIn layout="stacked" />
      </div>
      <OrDivider className="mt-6" />

      <FormError message={formError} className="mt-6" />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6">
        <FormField
          id="login-email"
          label="Email"
          variant="plain"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="maya@lattice.dev"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          id="login-password"
          label="Password"
          variant="plain"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          className="mt-6"
          labelAside={
            <Link
              to="/forgot-password"
              className="-my-1 inline-flex min-h-6 items-center font-mono text-xs font-bold tracking-[0.08em] text-foreground uppercase underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Forgot?
            </Link>
          }
          inputAside={
            <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />
          }
          error={errors.password?.message}
          {...register("password")}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className={ctaVariants({ size: "lg", className: "mt-8 w-full" })}
        >
          {isSubmitting ? "Logging in…" : "Log in"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </form>
    </>
  );
}

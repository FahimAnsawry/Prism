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
import { FormError, FormField } from "./form-field";
import { OrDivider, SocialSignIn } from "./social-sign-in";

/** `oauthError` is the `?error=` code Better Auth adds when a Google/GitHub sign-in fails. */
export function LoginForm({ oauthError }: { oauthError?: string }) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState(() =>
    oauthError ? authErrorMessage(oauthError) : undefined,
  );
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
      <h1 className="font-display text-[2.25rem] leading-[1.1] sm:text-[2.875rem] lg:whitespace-nowrap font-bold tracking-display text-foreground">
        Log in to Prism
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        New to Prism?{" "}
        <Link
          to="/signup"
          // Keeps an AI editor's sign-in request, so it continues after sign-up.
          search={(prev) => prev}
          className="text-foreground underline underline-offset-[3px] transition-colors hover:text-ink"
        >
          Create an account
        </Link>
      </p>

      <div className="mt-8">
        <SocialSignIn layout="stacked" />
      </div>
      <OrDivider className="mt-6" />

      <FormError message={formError} className="mt-5" />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-5">
        <FormField
          id="login-email"
          label="Work email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="fahim@studio.dev"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          className="mt-[18px]"
          labelAside={
            <Link
              to="/forgot-password"
              className="font-mono text-xs tracking-[0.08em] text-foreground uppercase underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Forgot?
            </Link>
          }
          error={errors.password?.message}
          {...register("password")}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className={ctaVariants({ size: "block", className: "mt-7" })}
        >
          {isSubmitting ? "Logging in…" : "Log in"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </form>

      <p className="mt-5 text-[13px] text-muted-foreground">
        By continuing you agree to the Terms and the Privacy Policy.
      </p>
    </>
  );
}

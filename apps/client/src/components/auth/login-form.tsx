import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@prism/shared";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { ctaVariants } from "@/components/cta";
import { Button } from "@/components/ui/button";
import { rememberLastSignIn } from "@/lib/last-sign-in";
import { FormField } from "./form-field";
import { OrDivider, SocialSignIn } from "./social-sign-in";

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (_values: LoginInput) => {
    rememberLastSignIn("email");
    // TODO(better-auth): await authClient.signIn.email({ ..._values, callbackURL: "/" })
  };

  return (
    <>
      <h1 className="font-display text-[2.25rem] leading-[1.1] sm:text-[2.875rem] lg:whitespace-nowrap font-bold tracking-display text-slate">
        Log in to Prism
      </h1>
      <p className="mt-3 text-base text-graphite">
        New to Prism?{" "}
        <Link
          to="/signup"
          className="text-slate underline underline-offset-[3px] transition-colors hover:text-onyx"
        >
          Create an account
        </Link>
      </p>

      <div className="mt-8">
        <SocialSignIn layout="stacked" />
      </div>
      <OrDivider className="mt-6" />

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
            // TODO: route to the password reset flow once it exists.
            <button
              type="button"
              className="font-mono text-xs tracking-[0.08em] text-slate uppercase underline-offset-4 transition-colors hover:text-onyx hover:underline"
            >
              Forgot?
            </button>
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

      <p className="mt-5 text-[13px] text-graphite">
        By continuing you agree to the Terms and the Privacy Policy.
      </p>
    </>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@prism/shared";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ctaVariants } from "@/components/cta";
import { Button } from "@/components/ui/button";
import { authClient, inOAuthFlow, runAuthAction } from "@/lib/auth-client";
import { rememberLastSignIn } from "@/lib/last-sign-in";
import { FormError, FormField } from "./form-field";
import { PasswordStrength } from "./password-strength";
import { OrDivider, SocialSignIn } from "./social-sign-in";

export function SignupForm() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  const password = useWatch({ control, name: "password" });

  const onSubmit = async ({ name, email, password }: SignupInput) => {
    setFormError(undefined);
    // Better Auth signs the new user in straight away (autoSignIn), so this also starts a session.
    const message = await runAuthAction(() => authClient.signUp.email({ name, email, password }));
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
        Create an account
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/login"
          search={(prev) => prev}
          className="text-foreground underline underline-offset-[3px] transition-colors hover:text-ink"
        >
          Log in
        </Link>
      </p>

      <div className="mt-5">
        <SocialSignIn layout="split" />
      </div>
      <OrDivider className="mt-4" />

      <FormError message={formError} className="mt-4" />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-3">
        <FormField
          id="signup-name"
          label="Full name"
          autoComplete="name"
          placeholder="Fahim"
          error={errors.name?.message}
          {...register("name")}
        />
        <FormField
          id="signup-email"
          label="Work email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="fahim@studio.dev"
          className="mt-4"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          id="signup-password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          className="mt-4"
          aria-describedby="signup-password-strength"
          inputAside={
            <button
              type="button"
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((shown) => !shown)}
              className="absolute inset-y-0 right-0 px-4 font-mono text-xs tracking-[0.08em] text-foreground uppercase transition-colors hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          }
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordStrength id="signup-password-strength" password={password} />

        <FormField
          id="signup-confirm-password"
          label="Confirm password"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          className="mt-4"
          inputAside={
            <button
              type="button"
              aria-pressed={showConfirmPassword}
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              onClick={() => setShowConfirmPassword((shown) => !shown)}
              className="absolute inset-y-0 right-0 px-4 font-mono text-xs tracking-[0.08em] text-foreground uppercase transition-colors hover:text-ink"
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          }
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className={ctaVariants({ size: "block", className: "mt-5" })}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </form>

      <p className="mt-5 text-[13px] text-muted-foreground">
        By creating an account you agree to the Terms and the Privacy Policy.
      </p>
    </>
  );
}

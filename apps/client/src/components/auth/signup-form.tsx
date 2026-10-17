import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@prism/shared";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ctaVariants } from "@/components/cta";
import { Button } from "@/components/ui/button";
import { appUrl, authClient, runAuthAction } from "@/lib/auth-client";
import { rememberLastSignIn } from "@/lib/last-sign-in";
import { AuthHeading } from "./auth-heading";
import { FormError, FormField, PasswordToggle } from "./form-field";
import { PasswordMeter } from "./password-strength";
import { OrDivider, SocialSignIn } from "./social-sign-in";
import { VerifyEmailNotice } from "./verify-email-notice";

export function SignupForm() {
  const [formError, setFormError] = useState<string>();
  const [verifyEmail, setVerifyEmail] = useState<string>();
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
  const [password, confirmPassword] = useWatch({ control, name: ["password", "confirmPassword"] });
  const passwordsMatch =
    confirmPassword.length > 0 && confirmPassword === password && !errors.confirmPassword;

  const onSubmit = async ({ name, email, password }: SignupInput) => {
    setFormError(undefined);
    // Better Auth signs the new user in straight away (autoSignIn), so this also starts a session.
    // The server requires a verified email, so sign-up starts no session: it emails a link, and
    // opening the link signs the user in and lands them on the dashboard.
    const message = await runAuthAction(() =>
      authClient.signUp.email({ name, email, password, callbackURL: appUrl("/dashboard") }),
    );
    if (message) {
      setFormError(message);
      return;
    }
    rememberLastSignIn("email");
    setVerifyEmail(email);
  };

  if (verifyEmail) return <VerifyEmailNotice email={verifyEmail} />;

  return (
    <>
      <AuthHeading
        prompt="Already have an account?"
        link={
          <Link to="/login" search={(prev) => prev}>
            Log in
          </Link>
        }
      >
        Start your
        <br />
        first board.
      </AuthHeading>

      <div className="mt-7">
        <SocialSignIn layout="split" />
      </div>
      <OrDivider className="mt-5" />

      <FormError message={formError} className="mt-5" />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-5">
        <FormField
          id="signup-name"
          label="Full name"
          variant="plain"
          autoComplete="name"
          placeholder="Maya Okafor"
          error={errors.name?.message}
          {...register("name")}
        />
        <FormField
          id="signup-email"
          label="Email"
          variant="plain"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="maya@lattice.dev"
          className="mt-5"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          id="signup-password"
          label="Password"
          variant="plain"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          className="mt-5"
          aria-describedby="signup-password-strength"
          inputAside={
            <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />
          }
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordMeter id="signup-password-strength" password={password} />

        <FormField
          id="signup-confirm-password"
          label="Confirm password"
          variant="plain"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          className="mt-5"
          inputAside={
            <PasswordToggle
              label="confirm password"
              shown={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((s) => !s)}
            />
          }
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <p
          aria-live="polite"
          className="mt-2 flex min-h-[15px] items-center gap-1.5 text-xs text-muted-foreground"
        >
          {passwordsMatch && (
            <>
              <Check aria-hidden="true" className="size-3.5 text-brand-ink" />
              Passwords match
            </>
          )}
        </p>

        <Button
          type="submit"
          disabled={isSubmitting}
          className={ctaVariants({ size: "lg", className: "mt-7 w-full" })}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </form>
    </>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@prism/shared";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ctaVariants } from "@/components/cta";
import { Button } from "@/components/ui/button";
import { appUrl, authClient, runAuthAction } from "@/lib/auth-client";
import { FormError, FormField } from "./form-field";

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string>();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: ForgotPasswordInput) => {
    setFormError(undefined);
    const message = await runAuthAction(() =>
      authClient.requestPasswordReset({
        email,
        redirectTo: appUrl("/reset-password"),
      }),
    );
    if (message) {
      setFormError(message);
      return;
    }
    setSubmittedEmail(email);
  };

  if (submittedEmail) {
    return (
      <>
        <h1 className="font-display text-[2.25rem] leading-[1.1] sm:text-[2.875rem] font-bold tracking-display text-foreground">
          Check your email
        </h1>
        <div className="mt-4 border border-brand bg-card p-6 text-foreground">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1 flex size-5 shrink-0 items-center justify-center bg-brand text-slate">
              <Check className="size-3.5 stroke-[3]" />
            </span>
            <div>
              <p className="text-base text-foreground">
                We sent a password reset link to{" "}
                <span className="font-medium text-foreground">{submittedEmail}</span>.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The link expires in 1 hour. Check your spam folder too.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            to="/login"
            className={ctaVariants({ size: "block" })}
          >
            Back to log in
            <ArrowRight aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setSubmittedEmail(null)}
            className="mt-2 text-center font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground hover:underline"
          >
            Send again with another email
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-[2.25rem] leading-[1.1] sm:text-[2.875rem] font-bold tracking-display text-foreground">
        Forgot password?
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        Enter the email you use for Prism and we&apos;ll send you a link to reset your password.
      </p>

      <FormError message={formError} className="mt-5" />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-5">
        <FormField
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="fahim@studio.dev"
          error={errors.email?.message}
          {...register("email")}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className={ctaVariants({ size: "block", className: "mt-7" })}
        >
          {isSubmitting ? "Sending reset link…" : "Send reset link"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </form>

      <p className="mt-5 text-base text-muted-foreground">
        Remembered it?{" "}
        <Link
          to="/login"
          className="font-medium text-foreground underline underline-offset-[3px] transition-colors hover:text-ink"
        >
          Back to log in
        </Link>
      </p>

      <p className="mt-5 text-[13px] text-muted-foreground">
        The link expires in 1 hour. Check your spam folder too.
      </p>
    </>
  );
}

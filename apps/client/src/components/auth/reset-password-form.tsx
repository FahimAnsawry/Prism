import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@prism/shared";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ctaVariants } from "@/components/cta";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage, runAuthAction } from "@/lib/auth-client";
import { FormError, FormField } from "./form-field";
import { PasswordStrength } from "./password-strength";

export function ResetPasswordForm({
  token,
  tokenError,
}: {
  token?: string;
  tokenError?: string;
}) {
  const [formError, setFormError] = useState<string | undefined>(() =>
    tokenError ? authErrorMessage(tokenError) : undefined,
  );
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = async ({ password }: ResetPasswordInput) => {
    if (!token) {
      setFormError("This reset link is missing a valid token. Please request a new one.");
      return;
    }
    setFormError(undefined);
    const message = await runAuthAction(() =>
      authClient.resetPassword({
        newPassword: password,
        token,
      }),
    );
    if (message) {
      setFormError(message);
      return;
    }
    setIsSuccess(true);
  };

  if (!token || tokenError) {
    return (
      <>
        <h1 className="font-display text-[2.25rem] leading-[1.1] sm:text-[2.875rem] font-bold tracking-display text-foreground">
          Reset password
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          This password reset link is invalid or has expired.
        </p>

        <FormError
          message={formError ?? "Invalid or expired reset link."}
          className="mt-5"
        />

        <div className="mt-6 flex flex-col gap-3">
          <Link
            to="/forgot-password"
            className={ctaVariants({ size: "block" })}
          >
            Request new reset link
            <ArrowRight aria-hidden="true" />
          </Link>
          <p className="mt-4 text-base text-muted-foreground">
            Remembered it?{" "}
            <Link
              to="/login"
              className="font-medium text-foreground underline underline-offset-[3px] transition-colors hover:text-ink"
            >
              Back to log in
            </Link>
          </p>
        </div>
      </>
    );
  }

  if (isSuccess) {
    return (
      <>
        <h1 className="font-display text-[2.25rem] leading-[1.1] sm:text-[2.875rem] font-bold tracking-display text-foreground">
          Password reset
        </h1>
        <div className="mt-4 border border-brand bg-card p-6 text-foreground">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1 flex size-5 shrink-0 items-center justify-center bg-brand text-slate">
              <Check className="size-3.5 stroke-[3]" />
            </span>
            <div>
              <p className="text-base font-medium text-foreground">
                Your password has been successfully reset.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                You have been signed out of Prism on every other device. You can now log in with your new password.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link
            to="/login"
            className={ctaVariants({ size: "block" })}
          >
            Log in
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-[2.25rem] leading-[1.1] sm:text-[2.875rem] font-bold tracking-display text-foreground">
        Reset password
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        Remembered it?{" "}
        <Link
          to="/login"
          className="font-medium text-foreground underline underline-offset-[3px] transition-colors hover:text-ink"
        >
          Back to log in
        </Link>
      </p>

      <FormError message={formError} className="mt-5" />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-5">
        <FormField
          id="reset-new-password"
          label="New password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          aria-describedby="reset-password-strength"
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
        <PasswordStrength id="reset-password-strength" password={password} />

        <FormField
          id="reset-confirm-password"
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
          className={ctaVariants({ size: "block", className: "mt-7" })}
        >
          {isSubmitting ? "Resetting password…" : "Reset password"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </form>

      <p className="mt-5 text-[13px] text-muted-foreground">
        Saving signs you out of Prism on every other device.
      </p>
    </>
  );
}

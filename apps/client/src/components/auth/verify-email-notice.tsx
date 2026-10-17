import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { ctaVariants } from "@/components/cta";
import { Button } from "@/components/ui/button";
import { appUrl, authClient, runAuthAction } from "@/lib/auth-client";
import { FormError } from "./form-field";

/** Seconds before "Send it again" works again, so the button can't be used to spam an inbox. */
const RESEND_COOLDOWN_S = 30;

/** Shown after sign-up: the account exists, but a session starts only once the link is opened. */
export function VerifyEmailNotice({ email }: { email: string }) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [sending, setSending] = useState(false);
  const [sentAgain, setSentAgain] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setError(undefined);
    setSending(true);
    const message = await runAuthAction(() =>
      authClient.sendVerificationEmail({ email, callbackURL: appUrl("/dashboard") }),
    );
    setSending(false);
    if (message) {
      setError(message);
      return;
    }
    setSentAgain(true);
    setCooldown(RESEND_COOLDOWN_S);
  };

  return (
    <>
      <h1 className="font-display text-[2.25rem] leading-[1.1] sm:text-[2.875rem] font-bold tracking-display text-foreground">
        Check your email
      </h1>
      <div className="mt-4 border border-brand bg-card p-6 text-foreground">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1 flex size-5 shrink-0 items-center justify-center bg-brand text-slate"
          >
            <Check className="size-3.5 stroke-[3]" />
          </span>
          <div>
            <p className="text-base text-foreground">
              We sent a verification link to{" "}
              <span className="font-medium text-foreground">{email}</span>. Open it to finish
              creating your account.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              The link expires in 1 hour. Check your spam folder too.
            </p>
          </div>
        </div>
      </div>

      <FormError message={error} className="mt-5" />
      <p aria-live="polite" className="mt-4 min-h-5 text-sm text-muted-foreground">
        {sentAgain && "Sent again. It can take a minute to arrive."}
      </p>

      <div className="mt-2 flex flex-col gap-3">
        <Button
          type="button"
          onClick={resend}
          disabled={sending || cooldown > 0}
          className={ctaVariants({ size: "block" })}
        >
          {sending ? "Sending…" : cooldown > 0 ? `Send it again in ${cooldown}s` : "Send it again"}
          <ArrowRight aria-hidden="true" />
        </Button>
        <Link
          to="/login"
          className="mt-2 text-center font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase transition-colors hover:text-foreground hover:underline"
        >
          Back to log in
        </Link>
      </div>
    </>
  );
}

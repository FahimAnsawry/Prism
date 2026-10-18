import { PASSWORD_MIN_LENGTH } from "@prism/shared";
import { cn } from "@/lib/utils";

const RULES = [
  {
    label: `${PASSWORD_MIN_LENGTH} or more characters`,
    test: (p: string) => p.length >= PASSWORD_MIN_LENGTH,
  },
  { label: "One number", test: (p: string) => /\d/.test(p) },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const LEVELS = ["", "Weak", "Fair", "Good", "Strong"];

/** Four-segment meter plus the rule checklist shown under the reset password. */
export function PasswordStrength({ password, id }: { password: string; id: string }) {
  const results = RULES.map((rule) => rule.test(password));
  const score = password ? results.filter(Boolean).length : 0;
  const barColor = score >= 3 ? "bg-brand" : "bg-coral";

  return (
    <div id={id} className="mt-3">
      <div className="flex items-center justify-between gap-4">
        <div className="grid w-73 grid-cols-4 gap-2" aria-hidden="true">
          {RULES.map((rule, i) => (
            <span key={rule.label} className={cn("h-2", i < score ? barColor : "bg-divider")} />
          ))}
        </div>
        <p
          aria-live="polite"
          className="font-mono text-[11px] tracking-[0.08em] text-foreground uppercase"
        >
          {score > 0 && (
            <>
              <span className="sr-only">Password strength: </span>
              {LEVELS[score]}
            </>
          )}
        </p>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {RULES.map((rule, i) => (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-2 text-[13px] leading-[19px]",
              results[i] ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-2.5 shrink-0",
                results[i] ? "bg-brand" : "border border-input bg-background",
              )}
            />
            {rule.label}
            <span className="sr-only">{results[i] ? "(done)" : "(not yet)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The signup meter from the board: four thin bars and one line ("Strong · 14 characters").
 * Before anything is typed it shows the length rule instead.
 */
export function PasswordMeter({ password, id }: { password: string; id: string }) {
  const score = password ? RULES.filter((rule) => rule.test(password)).length : 0;
  const tooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const barColor = score >= 3 && !tooShort ? "bg-brand" : "bg-coral";
  const characters = `${password.length} character${password.length === 1 ? "" : "s"}`;

  return (
    <div id={id} className="mt-2 flex items-center justify-between gap-3">
      <div className="grid w-[314px] max-w-[45%] grid-cols-4 gap-1" aria-hidden="true">
        {RULES.map((rule, i) => (
          <span key={rule.label} className={cn("h-1", i < score ? barColor : "bg-divider")} />
        ))}
      </div>
      <p aria-live="polite" className="text-right text-xs text-muted-foreground">
        {!password ? (
          `${PASSWORD_MIN_LENGTH} or more characters`
        ) : (
          <>
            <span className="sr-only">Password strength: </span>
            {tooShort ? "Too short" : LEVELS[score]} · {characters}
          </>
        )}
      </p>
    </div>
  );
}

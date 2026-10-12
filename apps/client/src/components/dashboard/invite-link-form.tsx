import { useNavigate } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The invite or share link someone pasted, as the page it leads to. Accepts a whole link
 * (`…/invite/<token>`, `…/s/<token>`) or the token alone.
 */
function linkTarget(text: string) {
  const value = text.trim();
  if (!value) return undefined;
  const path = (() => {
    try {
      return new URL(value).pathname;
    } catch {
      return value.startsWith("/") ? value : undefined;
    }
  })();
  if (path) {
    const match = /^\/(invite|s)\/([^/?#]+)/.exec(path);
    if (!match?.[2]) return undefined;
    return { kind: match[1] === "s" ? ("share" as const) : ("invite" as const), token: match[2] };
  }
  return /^[\w-]{8,}$/.test(value) ? { kind: "invite" as const, token: value } : undefined;
}

/** Paste an invite link to open it here; the invite page takes it from there. */
export function InviteLinkForm({
  className,
  autoFocus,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const errorId = useId();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const target = linkTarget(value);
    if (!target) {
      setError("That isn't a Prism invite link. Paste the whole link from the invite.");
      return;
    }
    if (target.kind === "share")
      void navigate({ to: "/s/$token", params: { token: target.token } });
    else void navigate({ to: "/invite/$token", params: { token: target.token } });
  };

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Invite link</span>
          <Link2
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="url"
            value={value}
            autoFocus={autoFocus}
            onChange={(event) => {
              setValue(event.target.value);
              setError(undefined);
            }}
            placeholder="Paste the invite link"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-[38px] w-full border bg-background pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-brand focus-visible:outline-none",
              error ? "border-destructive" : "border-input",
            )}
          />
        </label>
        <button
          type="submit"
          className="h-[38px] shrink-0 bg-secondary px-5 text-[13px] font-bold text-secondary-foreground transition-colors duration-150 ease-standard hover:bg-secondary/85"
        >
          Join
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

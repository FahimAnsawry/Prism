import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { readLastSignIn, rememberLastSignIn, type SignInMethod } from "@/lib/last-sign-in";
import { cn } from "@/lib/utils";

type Provider = Extract<SignInMethod, "google" | "github">;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.27a12 12 0 0 0 0 10.8l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5 fill-foreground">
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

const PROVIDERS: Record<Provider, { name: string; icon: () => ReactNode }> = {
  google: { name: "Google", icon: GoogleIcon },
  github: { name: "GitHub", icon: GitHubIcon },
};

function signInWith(provider: Provider) {
  rememberLastSignIn(provider);
  // TODO(better-auth): authClient.signIn.social({ provider, callbackURL: "/" })
}

/**
 * Google + GitHub buttons. `stacked` is the login layout (full-width "Continue with …");
 * `split` is the signup layout (two half-width buttons).
 */
export function SocialSignIn({ layout }: { layout: "stacked" | "split" }) {
  // Only meaningful on login; read once so the tag reflects the previous visit.
  const [lastUsed] = useState(() => (layout === "stacked" ? readLastSignIn() : null));

  return (
    <div className={cn(layout === "split" ? "grid grid-cols-2 gap-4" : "grid gap-3")}>
      {(Object.keys(PROVIDERS) as Provider[]).map((provider) => {
        const { name, icon: Icon } = PROVIDERS[provider];
        return (
          <div key={provider} className="relative">
            <Button
              type="button"
              variant="outline"
              onClick={() => signInWith(provider)}
              className="h-[38px] w-full gap-2.5 rounded-none border-input bg-card text-xs font-semibold text-foreground hover:border-foreground hover:bg-card active:bg-background dark:bg-card dark:hover:bg-card dark:active:bg-background"
            >
              <Icon />
              {layout === "stacked" ? `Continue with ${name}` : name}
            </Button>
            {lastUsed === provider && (
              <span className="pointer-events-none absolute -top-[11px] right-1 flex h-[22px] items-center bg-neon px-2.5 font-mono text-[10px] font-bold tracking-[0.08em] text-slate">
                LAST USED
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Dashed "OR" separator between social and email sign-in. */
export function OrDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="h-px flex-1 border-t border-dashed border-border" />
      <span className="font-mono text-xs tracking-[0.08em] text-muted-foreground">OR</span>
      <span className="h-px flex-1 border-t border-dashed border-border" />
    </div>
  );
}

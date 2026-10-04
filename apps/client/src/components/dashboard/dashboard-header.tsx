import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { type RefObject, useEffect, useRef } from "react";
import { PrismLogo } from "@/components/prism-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient, runAuthAction } from "@/lib/auth-client";

/** Ctrl K (⌘K on macOS) jumps to search from anywhere on the dashboard. */
function useSearchShortcut(input: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [input]);
}

export function DashboardHeader({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchRef);
  const navigate = useNavigate();
  // The route guard already loaded the session, so this is normally filled on first render.
  const user = authClient.useSession().data?.user;

  const logOut = async () => {
    // Don't leave the user stuck here if the server is unreachable
    await runAuthAction(() => authClient.signOut());
    await navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-card">
      <div className="grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 md:grid-cols-[1fr_minmax(0,30rem)_1fr] md:px-10">
        <PrismLogo compact className="justify-self-start" />

        <label className="relative block">
          <span className="sr-only">Search boards and projects</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search boards and projects"
            className="h-9 w-full border border-input bg-background pr-4 pl-4 text-sm text-foreground placeholder:text-muted-foreground sm:pr-18 [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden h-6 w-[52px] -translate-y-1/2 items-center justify-center border border-divider bg-card font-mono text-3xs text-muted-foreground sm:flex">
            Ctrl K
          </kbd>
        </label>

        <div className="flex items-center gap-2.5 justify-self-end">
          <ThemeToggle className="mr-2 size-9 border border-divider md:mr-4" />
          {/* Avatar only; name and email stay available to hover and screen readers. */}
          {user && (
            <span title={`${user.name} · ${user.email}`} className="shrink-0">
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-8 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-full bg-brand font-mono text-[13px] font-bold text-slate uppercase"
                >
                  {(user.name || user.email).charAt(0)}
                </span>
              )}
              <span className="sr-only">Signed in as {user.name}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => void logOut()}
            aria-label="Log out"
            title="Log out"
            className="ml-2 flex size-9 items-center justify-center border border-divider text-foreground transition-colors hover:text-ink md:ml-4"
          >
            <LogOut aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

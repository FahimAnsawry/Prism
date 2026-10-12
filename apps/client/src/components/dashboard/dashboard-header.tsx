import { Menu } from "@base-ui/react/menu";
import { LogOut, Menu as MenuIcon, Moon, Sparkles, Sun, X } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { PrismLogo } from "@/components/prism-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useSignOut } from "@/lib/use-sign-out";
import { AiAccessDialog } from "./ai-access-dialog";

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
  const logOut = useSignOut();
  const [aiOpen, setAiOpen] = useState(false);
  // The route guard already loaded the session, so this is normally filled on first render.
  const user = authClient.useSession().data?.user;

  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-card">
      {/* One row at every width: on phones the search box shrinks to fit between the logo and the menu. */}
      <div className="grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 md:grid-cols-[1fr_minmax(0,30rem)_1fr] md:gap-4 md:px-10">
        <PrismLogo compact className="justify-self-start" />

        <label className="group relative block min-w-0">
          <span className="sr-only">Search boards and projects</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search boards and projects"
            className="h-9 w-full min-w-0 rounded-[10px] border border-input bg-background pr-2 pl-3 text-sm text-ellipsis text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] duration-200 ease-standard focus-visible:border-brand focus-visible:bg-card focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand)_30%,transparent)] focus-visible:outline-none motion-reduce:transition-none sm:pr-18 sm:pl-4 [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden h-6 transition-opacity duration-200 ease-standard group-focus-within:opacity-0 motion-reduce:transition-none w-[52px] -translate-y-1/2 items-center justify-center rounded-[6px] border border-divider bg-card font-mono text-3xs text-muted-foreground sm:flex">
            Ctrl K
          </kbd>
        </label>

        <MobileMenu
          name={user?.name}
          email={user?.email}
          onConnectAi={() => setAiOpen(true)}
          onLogOut={() => void logOut()}
        />

        <div className="hidden items-center gap-2.5 justify-self-end md:flex">
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            title="Connect an AI editor (Claude Code, Codex…)"
            className="flex h-9 items-center gap-2 border border-divider px-3 text-sm text-foreground transition-colors hover:text-ink"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            Connect AI
          </button>
          <ThemeToggle className="size-9 border border-divider md:mr-4" />
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
            className="flex size-9 items-center justify-center border border-divider text-foreground transition-colors hover:text-ink md:ml-4"
          >
            <LogOut aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      <AiAccessDialog open={aiOpen} onOpenChange={setAiOpen} />
    </header>
  );
}

const menuItem =
  "flex h-10 cursor-default items-center gap-3 px-3 text-sm text-foreground outline-none select-none data-highlighted:bg-seafoam dark:data-highlighted:bg-seafoam/12 [&_svg]:size-4";

/** Below `md` the header's actions fold into one hamburger menu. */
function MobileMenu({
  name,
  email,
  onConnectAi,
  onLogOut,
}: {
  name: string | undefined;
  email: string | undefined;
  onConnectAi: () => void;
  onLogOut: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Menu"
        className="flex size-9 items-center justify-center justify-self-end border border-divider text-foreground transition-colors duration-150 ease-standard hover:text-ink data-popup-open:border-input data-popup-open:text-ink md:hidden"
      >
        <MenuIcon aria-hidden="true" className="size-5 in-data-popup-open:hidden" />
        <X aria-hidden="true" className="hidden size-5 in-data-popup-open:block" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
          <Menu.Popup className="w-60 max-w-[calc(100vw-2rem)] origin-(--transform-origin) border border-input bg-popover p-1 outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
            {(name || email) && (
              <div className="min-w-0 border-b border-divider px-3 pt-2 pb-3">
                {name && <p className="truncate text-sm font-bold text-foreground">{name}</p>}
                {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
              </div>
            )}
            <Menu.Item onClick={onConnectAi} className={cn(menuItem, "mt-1")}>
              <Sparkles aria-hidden="true" />
              Connect AI
            </Menu.Item>
            <Menu.Item
              closeOnClick={false}
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                toggleTheme({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
              }}
              className={menuItem}
            >
              {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              {dark ? "Light mode" : "Dark mode"}
            </Menu.Item>
            <Menu.Separator className="my-1 h-px bg-divider" />
            <Menu.Item onClick={onLogOut} className={menuItem}>
              <LogOut aria-hidden="true" />
              Log out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

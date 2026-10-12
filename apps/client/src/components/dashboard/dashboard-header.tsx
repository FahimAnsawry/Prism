import { Dialog } from "@base-ui/react/dialog";
import { Link } from "@tanstack/react-router";
import { LogOut, Menu as MenuIcon, Moon, PlugZap, Search, Sun, X } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { PrismLogo } from "@/components/prism-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import { useSignOut } from "@/lib/use-sign-out";
import { SidebarNav, type SidebarProps } from "./dashboard-sidebar";

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

type User = { name: string; email: string; image?: string | null; imageKey?: unknown };

const iconButton =
  "flex size-9 items-center justify-center border border-divider text-foreground transition-colors duration-150 ease-standard hover:text-ink";

export function DashboardHeader({
  query,
  onQueryChange,
  onConnectAi,
  nav,
  autoFocusSearch = false,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onConnectAi: () => void;
  /** What the phone drawer lists (the same as the desktop sidebar). */
  nav: SidebarProps;
  /** Puts the cursor in search on arrival (a search carried over from another page). */
  autoFocusSearch?: boolean;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchRef);
  const logOut = useSignOut();
  // The route guard already loaded the session, so this is normally filled on first render.
  const user = authClient.useSession().data?.user;

  return (
    <header className="sticky top-0 z-30 border-b border-divider bg-card">
      {/* One row at every width: on phones the search box shrinks to fit between the logo and the menu. */}
      <div className="grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 md:gap-4 md:px-6 lg:grid-cols-[16rem_minmax(0,1fr)_auto] lg:gap-8 lg:pr-8 lg:pl-0">
        <PrismLogo compact className="justify-self-start lg:pl-6" />

        <label className="group relative block w-full max-w-[30rem] min-w-0 lg:justify-self-center">
          <span className="sr-only">Search boards and projects</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchRef}
            autoFocus={autoFocusSearch}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search boards and projects"
            className="h-10 w-full min-w-0 rounded-full border border-input bg-background pr-2 pl-10 text-sm text-ellipsis text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] duration-200 ease-standard focus-visible:border-brand focus-visible:bg-card focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand)_30%,transparent)] focus-visible:outline-none motion-reduce:transition-none sm:pr-18 [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 hidden h-6 w-[52px] -translate-y-1/2 items-center justify-center rounded-full border border-divider bg-card font-mono text-3xs text-muted-foreground transition-opacity duration-200 ease-standard group-focus-within:opacity-0 motion-reduce:transition-none sm:flex">
            Ctrl K
          </kbd>
        </label>

        <MobileDrawer
          user={user}
          nav={nav}
          onConnectAi={onConnectAi}
          onLogOut={() => void logOut()}
        />

        <div className="hidden items-center gap-2.5 justify-self-end lg:flex">
          <button
            type="button"
            onClick={onConnectAi}
            title="Connect AI tools (Claude Code, Codex, Cursor…)"
            className="flex h-9 items-center gap-2 border border-divider px-3 text-sm text-foreground transition-colors hover:text-ink"
          >
            <PlugZap aria-hidden="true" className="size-4" />
            Connect AI tools
          </button>
          <ThemeToggle className="size-9 border border-divider" />
          {/* Avatar only, opening the profile; name and email stay available to hover. */}
          {user && (
            <Link
              to="/profile"
              title={`${user.name} · ${user.email}`}
              className="mx-1.5 shrink-0 rounded-full ring-brand ring-offset-2 ring-offset-card transition-shadow hover:ring-2 data-[status=active]:ring-2"
            >
              <UserAvatar user={user} />
              <span className="sr-only">Profile ({user.name})</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => void logOut()}
            aria-label="Log out"
            title="Log out"
            className={iconButton}
          >
            <LogOut aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

const drawerItem =
  "flex h-11 w-full items-center gap-3 px-3 text-left text-sm text-foreground transition-colors duration-150 ease-standard hover:bg-background [&_svg]:size-4 [&_svg]:shrink-0";

/** Below `lg` the sidebar and the header's actions fold into a drawer from the left. */
function MobileDrawer({
  user,
  nav,
  onConnectAi,
  onLogOut,
}: {
  user: User | undefined;
  nav: SidebarProps;
  onConnectAi: () => void;
  onLogOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger aria-label="Menu" className={`${iconButton} justify-self-end lg:hidden`}>
        <MenuIcon aria-hidden="true" className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate/50 transition-opacity duration-200 ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 lg:hidden dark:bg-black/60" />
        <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col overflow-y-auto border-r border-divider bg-card px-4 pt-4 pb-4 outline-none transition-transform duration-200 ease-(--ease-decelerate) data-ending-style:-translate-x-full data-starting-style:-translate-x-full motion-reduce:transition-none lg:hidden">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <div className="flex items-center justify-between">
            <PrismLogo compact />
            <Dialog.Close aria-label="Close menu" className={iconButton}>
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>

          {user && (
            <Link
              to="/profile"
              onClick={close}
              className="mt-5 flex min-w-0 items-center gap-3 border-b border-divider pb-5"
            >
              <UserAvatar user={user} className="size-10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{user.name}</p>
                <p className="truncate font-mono text-2xs text-muted-foreground">{user.email}</p>
              </div>
            </Link>
          )}

          <div className="mt-5">
            <SidebarNav {...nav} onNavigate={close} />
          </div>

          <div className="mt-auto flex flex-col border-t border-divider pt-3">
            <button
              type="button"
              onClick={() => {
                close();
                onConnectAi();
              }}
              className={drawerItem}
            >
              <PlugZap aria-hidden="true" />
              Connect AI tools
            </button>
            <button
              type="button"
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                toggleTheme({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
              }}
              className={drawerItem}
            >
              {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              {dark ? "Light mode" : "Dark mode"}
            </button>
            <button type="button" onClick={onLogOut} className={drawerItem}>
              <LogOut aria-hidden="true" />
              Log out
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

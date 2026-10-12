import { LogOut, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { authClient } from "@/lib/auth-client";
import { type Theme, useTheme } from "@/lib/theme";
import { useSignOut } from "@/lib/use-sign-out";
import { cn } from "@/lib/utils";
import { Panel } from "./profile-parts";
import { panelButton } from "./profile-styles";

const CHOICES: { id: Theme | "system"; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
];

/** Light, dark, or the device's setting. Kept per browser, like the header's switch. */
export function Appearance() {
  const { choice, setChoice } = useTheme();
  return (
    <Panel
      id="appearance"
      title="Appearance"
      description="Boards and the dashboard follow this. System uses your device setting."
      action={
        <div
          role="radiogroup"
          aria-label="Theme"
          className="flex border border-divider bg-background p-[3px] max-sm:w-full"
        >
          {CHOICES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={choice === id}
              onClick={() => setChoice(id)}
              className={cn(
                "flex h-8 flex-1 items-center justify-center gap-2 px-3.5 text-[13px] transition-colors duration-150 ease-standard",
                choice === id
                  ? "bg-secondary font-bold text-secondary-foreground"
                  : "text-foreground hover:bg-card",
              )}
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      }
    />
  );
}

/** Signing out everywhere and deleting the account. */
export function DangerZone() {
  const logOut = useSignOut();
  const [confirm, setConfirm] = useState<"sign-out" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const close = (open: boolean) => {
    if (open) return;
    setConfirm(null);
    setError(undefined);
  };

  const signOutEverywhere = async () => {
    setPending(true);
    const { error: failed } = await authClient
      .revokeSessions()
      .catch(() => ({ error: { message: undefined } }));
    setPending(false);
    if (failed) return setError(failed.message || "Couldn't sign out everywhere. Try again.");
    await logOut();
  };

  const deleteAccount = async () => {
    setPending(true);
    const { error: failed } = await authClient
      .deleteUser()
      .catch(() => ({ error: { message: undefined, code: undefined } }));
    setPending(false);
    if (failed) {
      // Better Auth asks for a recent sign-in before deleting.
      return setError(
        failed.code === "SESSION_EXPIRED"
          ? "For safety, log out and sign in again, then delete your account."
          : failed.message || "Couldn't delete your account. Try again.",
      );
    }
    // The same clean-up as logging out: nothing of the account stays in this tab.
    await logOut();
  };

  return (
    <Panel
      id="danger"
      tone="danger"
      title="Danger zone"
      description="These actions affect your whole account."
    >
      <div className="mt-4 divide-y divide-divider border-t border-divider">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Sign out everywhere</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Ends every browser session. Editors stay connected until you revoke them above.
            </p>
          </div>
          <button type="button" onClick={() => setConfirm("sign-out")} className={panelButton}>
            <LogOut aria-hidden="true" />
            Sign out everywhere
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Delete account</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Removes your boards, projects and tokens for good. This can't be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirm("delete")}
            className={cn(
              panelButton,
              "border-destructive text-destructive hover:bg-destructive/10",
            )}
          >
            <Trash2 aria-hidden="true" />
            Delete account
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "sign-out"}
        onOpenChange={close}
        title="Sign out everywhere?"
        description="Every browser signed in to Prism, this one too, goes back to the login page."
        confirmLabel="Sign out everywhere"
        pending={pending}
        error={confirm === "sign-out" ? error : undefined}
        onConfirm={() => void signOutEverywhere()}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={close}
        title="Delete your account?"
        description="Your boards, projects, tokens and shares are removed for good. People you shared with lose access."
        confirmLabel="Delete account"
        tone="danger"
        pending={pending}
        error={confirm === "delete" ? error : undefined}
        onConfirm={() => void deleteAccount()}
      />
    </Panel>
  );
}

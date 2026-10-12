import { PASSWORD_MIN_LENGTH } from "@prism/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GitBranch, Globe, KeyRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormError } from "@/components/auth/form-field";
import { signInMethodsQuery } from "@/lib/account";
import { appUrl, authClient } from "@/lib/auth-client";
import { Panel, PanelRow, StatusBadge } from "./profile-parts";
import { panelButton, panelInput } from "./profile-styles";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

const PROVIDERS = [
  { id: "google", label: "Google", Icon: Globe },
  { id: "github", label: "GitHub", Icon: GitBranch },
] as const;

/** Google, GitHub and a password: any of them signs in to the same account. */
export function SignInMethods() {
  const queryClient = useQueryClient();
  const methods = useQuery(signInMethodsQuery);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [changingPassword, setChangingPassword] = useState(false);

  const accounts = methods.data ?? [];
  const linked = (provider: string) => accounts.find((a) => a.providerId === provider);
  const password = linked("credential");
  // The last way in can't be removed.
  const onlyOne = accounts.length <= 1;

  const connect = async (provider: "google" | "github") => {
    setBusy(provider);
    setError(undefined);
    // Leaves for the provider and comes back here.
    const { error: failed } = await authClient
      .linkSocial({ provider, callbackURL: appUrl("/profile") })
      .catch(() => ({ error: { message: undefined } }));
    if (failed) {
      setError(failed.message || "Couldn't connect that account. Try again.");
      setBusy(null);
    }
  };

  const disconnect = async (provider: string, accountId: string) => {
    setBusy(provider);
    setError(undefined);
    const { error: failed } = await authClient
      .unlinkAccount({ accountId })
      .catch(() => ({ error: { message: undefined } }));
    if (failed) setError(failed.message || "Couldn't disconnect that account. Try again.");
    await queryClient.invalidateQueries({ queryKey: signInMethodsQuery.queryKey });
    setBusy(null);
  };

  return (
    <Panel
      id="sign-in"
      title="Sign-in methods"
      description="Any of these signs you in to the same account."
    >
      {methods.isError ? (
        <FormError
          message="Couldn't load your sign-in methods. Reload to try again."
          className="mt-5"
        />
      ) : (
        <ul className="mt-4 border-t border-divider">
          {PROVIDERS.map(({ id, label, Icon }) => {
            const account = linked(id);
            return (
              <PanelRow
                key={id}
                Icon={Icon}
                title={label}
                detail={methods.isPending ? "…" : account ? "Signs you in" : "Not connected"}
              >
                {account && <StatusBadge>CONNECTED</StatusBadge>}
                {!methods.isPending &&
                  (account ? (
                    <button
                      type="button"
                      disabled={busy !== null || onlyOne}
                      title={onlyOne ? "Add another way to sign in first" : undefined}
                      onClick={() => void disconnect(id, account.id)}
                      className={panelButton}
                    >
                      {busy === id ? "Disconnecting…" : "Disconnect"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void connect(id)}
                      className={panelButton}
                    >
                      {busy === id ? "Opening…" : "Connect"}
                    </button>
                  ))}
              </PanelRow>
            );
          })}
          <PanelRow
            Icon={KeyRound}
            title="Password"
            detail={
              methods.isPending
                ? "…"
                : password
                  ? `Last changed ${dateFormat.format(new Date(password.updatedAt))}`
                  : "Not set"
            }
          >
            {!methods.isPending &&
              (password ? (
                <button
                  type="button"
                  aria-expanded={changingPassword}
                  onClick={() => setChangingPassword((open) => !open)}
                  className={panelButton}
                >
                  Change password
                </button>
              ) : (
                // Setting a first password goes through the reset link.
                <Link to="/forgot-password" className={panelButton}>
                  Set a password
                </Link>
              ))}
          </PanelRow>
        </ul>
      )}
      {changingPassword && <ChangePassword onDone={() => setChangingPassword(false)} />}
      <FormError message={error} className="mt-4" />
    </Panel>
  );
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!current) return setError("Enter your current password.");
    if (next.length < PASSWORD_MIN_LENGTH)
      return setError(`Use ${PASSWORD_MIN_LENGTH} or more characters.`);
    if (next !== confirm) return setError("The new passwords don't match.");
    setSaving(true);
    setError(undefined);
    const { error: failed } = await authClient
      .changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true })
      .catch(() => ({ error: { message: undefined } }));
    setSaving(false);
    if (failed) {
      setError(failed.message || "Couldn't change your password. Try again.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: signInMethodsQuery.queryKey });
    onDone();
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="mt-2 border border-divider bg-background p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Current password", current, setCurrent, "current-password"],
            ["New password", next, setNext, "new-password"],
            ["Repeat new password", confirm, setConfirm, "new-password"],
          ] as const
        ).map(([label, value, set, autoComplete]) => (
          <label key={label} className="block text-[13px] font-bold text-foreground">
            {label}
            <input
              type="password"
              value={value}
              autoComplete={autoComplete}
              onChange={(event) => {
                set(event.target.value);
                setError(undefined);
              }}
              className={`${panelInput} mt-1.5 bg-card font-normal`}
            />
          </label>
        ))}
      </div>
      <FormError message={error} className="mt-3" />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Your other devices are signed out.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className={panelButton}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-[34px] bg-brand px-3.5 text-[13px] font-bold text-slate hover:bg-brand/80 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Change password"}
          </button>
        </div>
      </div>
    </form>
  );
}

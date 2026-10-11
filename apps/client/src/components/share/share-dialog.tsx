import { Dialog } from "@base-ui/react/dialog";
import type { ShareKind, ShareMember, ShareRole, ShareSettings } from "@prism/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, Link2, RefreshCw, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormError, fieldInputClass } from "@/components/auth/form-field";
import { ctaVariants } from "@/components/cta";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { apiErrorMessage } from "@/lib/api";
import {
  shareSettingsQuery,
  useCancelInvite,
  useChangeMemberRole,
  useInviteMember,
  useRemoveMember,
  useShareLink,
} from "@/lib/sharing";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<ShareRole, string> = { editor: "Can edit", viewer: "Can view" };

const sectionLabel =
  "font-mono text-3xs font-bold tracking-[0.08em] text-muted-foreground uppercase";

/**
 * The owner's Share dialog for a board or a project: invite team members by email as editors
 * or viewers, manage them and pending invites, and turn the public view-only link on or off.
 */
export function ShareDialog({
  kind,
  id,
  name,
  open,
  onOpenChange,
}: {
  kind: ShareKind;
  id: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate/40 transition-opacity duration-150 ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[36rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-input bg-popover p-6 outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-nested-dialog-open:opacity-60 data-starting-style:scale-[0.98] data-starting-style:opacity-0 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-[26px] leading-8 font-bold text-ink">
                Share “{name}”
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {kind === "project"
                  ? "Members get every board in this project, including new ones."
                  : "Invite your team to edit or view this board."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
            </Dialog.Close>
          </div>
          <ShareSettingsView kind={kind} id={id} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Mounted with the popup, so the invite result is forgotten once the dialog closes.
function ShareSettingsView({ kind, id }: { kind: ShareKind; id: string }) {
  const settings = useQuery(shareSettingsQuery(kind, id));
  if (settings.error) {
    return <FormError message={apiErrorMessage(settings.error)} className="mt-6" />;
  }
  if (!settings.data) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;
  }
  return (
    <>
      <InviteForm kind={kind} id={id} />
      <People kind={kind} id={id} settings={settings.data} />
      <PublicLink kind={kind} id={id} settings={settings.data} />
    </>
  );
}

function InviteForm({ kind, id }: { kind: ShareKind; id: string }) {
  const invite = useInviteMember(kind, id);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [result, setResult] = useState<
    { email: string; status: "added" } | { email: string; status: "invited"; url: string } | null
  >(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    invite.mutate(
      { email: address, role },
      {
        onSuccess: (reply) => {
          setEmail("");
          setResult(
            reply.status === "invited" && reply.url
              ? { email: address, status: "invited", url: reply.url }
              : { email: address, status: "added" },
          );
        },
      },
    );
  };

  return (
    <section className="mt-6">
      <FormError
        message={invite.error ? apiErrorMessage(invite.error) : undefined}
        className="mb-4"
      />
      <form noValidate onSubmit={submit} className="flex flex-wrap items-stretch gap-2">
        <label htmlFor="share-email" className="sr-only">
          Email address
        </label>
        <input
          id="share-email"
          type="email"
          autoComplete="off"
          placeholder="teammate@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={cn(
            fieldInputClass,
            "h-[38px] min-w-0 flex-1 basis-48 border text-sm md:text-sm",
          )}
        />
        <RoleSelect value={role} onChange={setRole} label="Role for the invite" />
        <button
          type="submit"
          disabled={invite.isPending || !email.trim()}
          className={ctaVariants({ size: "sm" })}
        >
          {invite.isPending ? "Inviting…" : "Invite"}
        </button>
      </form>

      <div role="status" aria-live="polite">
        {result?.status === "added" && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-foreground">
            <Check aria-hidden="true" className="size-3.5 text-brand" />
            {result.email} has access now.
          </p>
        )}
        {result?.status === "invited" && (
          <div className="mt-4">
            <p className="text-[13px] text-foreground">
              {result.email} doesn't have a Prism account yet. Send them this invite link; it works
              once they sign up or sign in with that email.
            </p>
            <CopyField text={result.url} label="Invite link" className="mt-2" />
          </div>
        )}
      </div>
    </section>
  );
}

function People({ kind, id, settings }: { kind: ShareKind; id: string; settings: ShareSettings }) {
  const cancelInvite = useCancelInvite(kind, id);
  const error = cancelInvite.error;

  return (
    <section className="mt-8">
      <h3 className={sectionLabel}>People with access</h3>
      <FormError message={error ? apiErrorMessage(error) : undefined} className="mt-3" />
      <ul className="mt-3 divide-y divide-divider border border-divider">
        <li className="flex items-center gap-3 px-4 py-3">
          <PersonAvatar
            name={settings.owner.name}
            email={settings.owner.email}
            image={settings.owner.image}
          />
          <PersonText name={settings.owner.name} email={settings.owner.email} />
          <span className="shrink-0 font-mono text-3xs text-muted-foreground uppercase">Owner</span>
        </li>
        {settings.members.map((member) => (
          <MemberRow key={member.userId} kind={kind} id={id} member={member} />
        ))}
        {settings.invites.map((invite) => (
          <li key={invite.id} className="flex items-center gap-3 px-4 py-3">
            <PersonAvatar name="" email={invite.email} image={null} pending />
            <PersonText
              name={invite.email}
              email={`Invited · ${ROLE_LABELS[invite.role].toLowerCase()}`}
            />
            <CopyButton text={invite.url} label={`Copy the invite link for ${invite.email}`} />
            <button
              type="button"
              aria-label={`Cancel the invite for ${invite.email}`}
              title="Cancel invite"
              disabled={cancelInvite.isPending}
              onClick={() => cancelInvite.mutate(invite.id)}
              className="flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 ease-standard hover:text-destructive"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {settings.members.length === 0 && settings.invites.length === 0 && (
        <p className="mt-2 text-[13px] text-muted-foreground">Only you so far.</p>
      )}
    </section>
  );
}

function MemberRow({ kind, id, member }: { kind: ShareKind; id: string; member: ShareMember }) {
  const changeRole = useChangeMemberRole(kind, id);
  const remove = useRemoveMember(kind, id);
  const [confirm, setConfirm] = useState(false);
  const error = changeRole.error ?? remove.error;

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <PersonAvatar name={member.name} email={member.email} image={member.image} />
        <PersonText name={member.name} email={member.email} />
        <RoleSelect
          value={member.role}
          label={`Role for ${member.name}`}
          disabled={changeRole.isPending}
          onChange={(role) => changeRole.mutate({ userId: member.userId, role })}
        />
        <button
          type="button"
          aria-label={`Remove ${member.name}`}
          title="Remove"
          onClick={() => setConfirm(true)}
          className="flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 ease-standard hover:text-destructive"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-destructive">{apiErrorMessage(error)}</p>}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Remove ${member.name}?`}
        description={`They lose access to this ${kind} right away, including any tab they have open.`}
        confirmLabel="Remove"
        tone="danger"
        pending={remove.isPending}
        error={remove.error ? apiErrorMessage(remove.error) : undefined}
        onConfirm={() => remove.mutate(member.userId, { onSuccess: () => setConfirm(false) })}
      />
    </li>
  );
}

function PublicLink({
  kind,
  id,
  settings,
}: {
  kind: ShareKind;
  id: string;
  settings: ShareSettings;
}) {
  const link = useShareLink(kind, id);
  const [confirm, setConfirm] = useState<"regenerate" | "disable" | null>(null);
  const on = settings.link !== null;

  return (
    <section className="mt-8 border-t border-divider pt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={sectionLabel}>Public link</h3>
          <p className="mt-1.5 text-[13px] text-foreground">
            {kind === "project"
              ? "Anyone with the link can view this project and all its boards, without an account. They can't change anything."
              : "Anyone with the link can view this board, without an account. They can't change anything."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Public link"
          disabled={link.isPending}
          onClick={() => (on ? setConfirm("disable") : link.mutate("enable"))}
          className={cn(
            "relative mt-0.5 h-6 w-11 shrink-0 border transition-colors duration-150 ease-standard disabled:opacity-60",
            on ? "border-transparent bg-brand" : "border-input bg-card",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-0.5 size-[18px] transition-[left] duration-150 ease-standard",
              on ? "left-[22px] bg-slate" : "left-0.5 bg-muted-foreground",
            )}
          />
        </button>
      </div>

      <FormError message={link.error ? apiErrorMessage(link.error) : undefined} className="mt-3" />

      {settings.link && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CopyField text={settings.link} label="Public link" className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => setConfirm("regenerate")}
            disabled={link.isPending}
            className={ctaVariants({ variant: "secondary", size: "sm" })}
          >
            <RefreshCw aria-hidden="true" />
            New link
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={confirm === "disable" ? "Turn off the public link?" : "Replace the public link?"}
        description={
          confirm === "disable"
            ? "The link stops working right away, also for anyone viewing it now. Team members keep their access."
            : "The current link stops working right away, also for anyone viewing it now. Share the new one instead."
        }
        confirmLabel={confirm === "disable" ? "Turn off" : "Replace link"}
        tone="danger"
        pending={link.isPending}
        error={link.error ? apiErrorMessage(link.error) : undefined}
        onConfirm={() => {
          if (confirm) link.mutate(confirm, { onSuccess: () => setConfirm(null) });
        }}
      />
    </section>
  );
}

function RoleSelect({
  value,
  onChange,
  label,
  disabled,
}: {
  value: ShareRole;
  onChange: (role: ShareRole) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ShareRole)}
        className="h-[38px] appearance-none border border-input bg-card pr-8 pl-3 text-[13px] text-foreground disabled:opacity-60"
      >
        <option value="editor">{ROLE_LABELS.editor}</option>
        <option value="viewer">{ROLE_LABELS.viewer}</option>
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

function PersonAvatar({
  name,
  email,
  image,
  pending = false,
}: {
  name: string;
  email: string;
  image: string | null;
  pending?: boolean;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        className="size-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-bold uppercase",
        pending ? "border border-dashed border-input text-muted-foreground" : "bg-brand text-slate",
      )}
    >
      {(name || email).charAt(0)}
    </span>
  );
}

function PersonText({ name, email }: { name: string; email: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-ink">{name}</p>
      <p className="truncate text-[13px] text-muted-foreground">{email}</p>
    </div>
  );
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    });
  };
  return { copied, copy };
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy(text);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : "Copy link"}
      className="flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink"
    >
      {copied ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <Link2 aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}

function CopyField({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const { copied, copy } = useCopy(text);
  return (
    <div
      className={cn(
        "flex h-[38px] items-center gap-2 border border-divider bg-card pl-3",
        className,
      )}
    >
      <input
        readOnly
        aria-label={label}
        value={text}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 bg-transparent font-mono text-2xs text-foreground outline-none"
      />
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
        className="flex h-full shrink-0 items-center gap-1.5 border-l border-divider px-3 font-mono text-3xs font-bold text-foreground uppercase transition-colors duration-150 ease-standard hover:bg-background"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-3.5" />
        ) : (
          <Copy aria-hidden="true" className="size-3.5" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

import { PHOTO_MAX_BYTES, PHOTO_TYPES, updateNameSchema } from "@prism/shared";
import { Upload } from "lucide-react";
import { type FormEvent, useId, useRef, useState } from "react";
import { FormError } from "@/components/auth/form-field";
import { UserAvatar } from "@/components/user-avatar";
import { refreshSession, useRemovePhoto, useUploadPhoto } from "@/lib/account";
import { apiErrorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { Panel, StatusBadge } from "./profile-parts";
import { panelButton, panelInput } from "./profile-styles";

export type ProfileUser = {
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  imageKey?: unknown;
};

/** Photo, name and email: how the user appears to people they share boards with. */
export function ProfileDetails({ user }: { user: ProfileUser }) {
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const nameId = useId();
  const emailId = useId();
  const changed = name.trim() !== user.name;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = updateNameSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setSaving(true);
    setError(undefined);
    const { error: failed } = await authClient
      .updateUser({ name: parsed.data.name })
      .catch(() => ({ error: { message: undefined } }));
    if (failed) {
      setError(failed.message || "Couldn't save your name. Try again.");
    } else {
      await refreshSession().catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    }
    setSaving(false);
  };

  return (
    <Panel
      id="profile"
      title="Profile"
      description="This is how you appear to people you share boards with."
    >
      <PhotoPicker user={user} />

      <form onSubmit={(event) => void onSubmit(event)} className="mt-6" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={nameId} className="text-[13px] font-bold text-foreground">
              Name
            </label>
            <input
              id={nameId}
              value={name}
              autoComplete="name"
              onChange={(event) => {
                setName(event.target.value);
                setError(undefined);
              }}
              className={`${panelInput} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor={emailId} className="text-[13px] font-bold text-foreground">
              Email
            </label>
            <div className="relative mt-1.5">
              <input
                id={emailId}
                value={user.email}
                readOnly
                className={`${panelInput} pr-24 text-muted-foreground`}
              />
              {user.emailVerified && (
                <span className="absolute top-1/2 right-3 -translate-y-1/2">
                  <StatusBadge>VERIFIED</StatusBadge>
                </span>
              )}
            </div>
          </div>
        </div>
        <FormError message={error} className="mt-4" />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">
            Your email comes from how you sign in.
          </p>
          <div className="flex gap-2 max-sm:w-full max-sm:justify-end">
            <button
              type="button"
              disabled={!changed || saving}
              onClick={() => {
                setName(user.name);
                setError(undefined);
              }}
              className={`${panelButton} h-10 px-4`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!changed || saving}
              className="h-10 bg-brand px-4 text-[13px] font-bold text-slate transition-colors duration-150 ease-standard hover:bg-brand/80 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </Panel>
  );
}

function PhotoPicker({ user }: { user: ProfileUser }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadPhoto();
  const remove = useRemovePhoto();
  const [tooBig, setTooBig] = useState(false);
  const busy = upload.isPending || remove.isPending;
  const error = tooBig
    ? "That photo is over 2 MB. Pick a smaller one."
    : upload.error
      ? apiErrorMessage(upload.error)
      : remove.error
        ? apiErrorMessage(remove.error)
        : undefined;

  return (
    <div className="mt-5">
      <div className="flex items-center gap-5">
        <UserAvatar user={user} className="size-16 text-xl" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className={panelButton}
            >
              <Upload aria-hidden="true" />
              {upload.isPending ? "Uploading…" : "Change photo"}
            </button>
            {typeof user.imageKey === "string" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => remove.mutate()}
                className="h-[34px] px-2 text-[13px] text-muted-foreground transition-colors hover:text-ink disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-2 font-mono text-2xs text-muted-foreground">
            PNG, JPEG or WebP, up to 2 MB
          </p>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setTooBig(file.size > PHOTO_MAX_BYTES);
          if (file.size <= PHOTO_MAX_BYTES) upload.mutate(file);
        }}
      />
      <FormError message={error} className="mt-4" />
    </div>
  );
}

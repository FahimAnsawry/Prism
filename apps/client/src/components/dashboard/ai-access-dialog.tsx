import { Dialog } from "@base-ui/react/dialog";
import type { ApiToken, CreatedApiToken } from "@prism/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormError, FormField } from "@/components/auth/form-field";
import { ctaVariants } from "@/components/cta";
import { apiTokensQuery, useCreateApiToken, useRevokeApiToken } from "@/lib/ai";
import { apiErrorMessage } from "@/lib/api";
import { ConfirmDialog } from "./confirm-dialog";

/** The server's remote MCP endpoint. */
const MCP_URL = new URL("/mcp", import.meta.env.VITE_SERVER_URL).toString();

const CLAUDE_COMMAND = `claude mcp add --transport http --scope user prism ${MCP_URL}`;
const CODEX_COMMAND = `codex mcp add prism --url ${MCP_URL}`;

/** For clients that can't sign in with OAuth: the token goes in a fixed header. */
const claudeTokenCommand = (token: string) =>
  `claude mcp add --transport http --scope user prism ${MCP_URL} --header "Authorization: Bearer ${token}"`;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * How to connect an AI editor (Claude Code, Codex, any MCP client) to Prism's MCP endpoint: one
 * command, then the editor opens the browser to sign in. Personal access tokens are the
 * fallback for clients without OAuth; a token is shown once.
 */
export function AiAccessDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate/40 transition-opacity duration-150 ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[36rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-input bg-popover p-6 outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-nested-dialog-open:opacity-60 sm:p-8">
          <AiAccess />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Mounted with the popup, so a created token is forgotten once the dialog closes.
function AiAccess() {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Dialog.Title className="text-[26px] leading-8 font-bold text-ink">
            Connect an AI editor
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Let Claude Code, Codex or any MCP client draw on your boards and handle your “Ask AI”
            requests. Run one command; your editor then opens Prism to sign in and approve.
          </Dialog.Description>
        </div>
        <Dialog.Close
          aria-label="Close"
          className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
        </Dialog.Close>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        <CopyBlock
          label="Claude Code (then run /mcp and choose Authenticate)"
          text={CLAUDE_COMMAND}
        />
        <CopyBlock label="Codex (opens the browser to sign in)" text={CODEX_COMMAND} />
        <CopyBlock label="Any other MCP client: server URL" text={MCP_URL} />
        <p className="text-xs text-muted-foreground">
          In Claude Code, type <code className="font-mono">/mcp__prism__watch_edits</code> to have
          it handle your Ask AI requests, or{" "}
          <code className="font-mono">/mcp__prism__design_screen</code> to start a design.
        </p>
      </div>

      <details className="group mt-8 border-t border-divider pt-5">
        <summary className="cursor-pointer font-mono text-xs tracking-[0.08em] text-foreground uppercase">
          Access tokens (clients without OAuth sign-in)
        </summary>
        <AccessTokens />
      </details>
    </>
  );
}

function AccessTokens() {
  const tokens = useQuery(apiTokensQuery);
  const create = useCreateApiToken();
  const [name, setName] = useState("My AI editor");
  const [created, setCreated] = useState<CreatedApiToken | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ name }, { onSuccess: setCreated });
  };

  return (
    <>
      {created ? (
        <div className="mt-6 flex flex-col gap-5">
          <p className="text-sm text-foreground">Copy your token now. It won't be shown again.</p>
          <CopyBlock label="Token" text={created.token} />
          <CopyBlock label="Claude Code with a token" text={claudeTokenCommand(created.token)} />
          <p className="text-xs text-muted-foreground">
            Other clients: send it as <code className="font-mono">Authorization: Bearer …</code> to{" "}
            <code className="font-mono">{MCP_URL}</code>. A token acts as you, on your boards only.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setCreated(null)}
              className={ctaVariants({ variant: "secondary", size: "sm" })}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="mt-5">
          <FormError
            message={create.error ? apiErrorMessage(create.error) : undefined}
            className="mb-5"
          />
          <div className="flex items-end gap-3">
            <FormField
              id="token-name"
              label="Token name"
              autoComplete="off"
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-w-0 flex-1"
            />
            <button
              type="submit"
              disabled={create.isPending || !name.trim()}
              className={ctaVariants({ size: "sm" })}
            >
              {create.isPending ? "Creating…" : "Create token"}
            </button>
          </div>
        </form>
      )}

      <section className="mt-8">
        <h3 className="font-mono text-xs tracking-[0.08em] text-foreground uppercase">
          Your tokens
        </h3>
        {tokens.error ? (
          <FormError message={apiErrorMessage(tokens.error)} className="mt-3" />
        ) : tokens.data?.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No tokens yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-divider border border-divider">
            {tokens.data?.map((token) => (
              <TokenRow key={token.id} token={token} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function TokenRow({ token }: { token: ApiToken }) {
  const revoke = useRevokeApiToken();
  const [confirm, setConfirm] = useState(false);
  const used = token.lastUsedAt
    ? `last used ${dateFormat.format(new Date(token.lastUsedAt))}`
    : "never used";

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{token.name}</p>
        <p className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">
          {token.start}… · created {dateFormat.format(new Date(token.createdAt))} · {used}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className={ctaVariants({ variant: "secondary", size: "sm" })}
      >
        Revoke
      </button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Revoke “${token.name}”?`}
        description="AI editors using this token lose access to your boards right away."
        confirmLabel="Revoke"
        tone="danger"
        pending={revoke.isPending}
        error={revoke.error ? apiErrorMessage(revoke.error) : undefined}
        onConfirm={() => revoke.mutate(token.id, { onSuccess: () => setConfirm(false) })}
      />
    </li>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    });
  };
  return (
    <div>
      <p className="mb-1.5 font-mono text-3xs tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex items-start gap-2 border border-divider bg-card p-3">
        <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-2xs leading-relaxed whitespace-pre-wrap break-all text-foreground">
          {text}
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : `Copy ${label}`}
          className="flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:text-ink"
        >
          {copied ? (
            <Check aria-hidden="true" className="size-3.5" />
          ) : (
            <Copy aria-hidden="true" className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

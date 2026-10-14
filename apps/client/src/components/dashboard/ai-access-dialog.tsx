import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion } from "motion/react";
import { backdropMotion, dialogPopup, usePopupExit } from "@/components/popup-motion";
import type { ApiToken, CreatedApiToken } from "@prism/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check, ChevronLeft, Circle, Copy, PlugZap, Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormError, FormField } from "@/components/auth/form-field";
import { ctaVariants } from "@/components/cta";
import { TurningChevron } from "@/components/motion-parts";
import { editorsQuery } from "@/lib/account";
import { apiTokensQuery, MCP_URL, useCreateApiToken, useRevokeApiToken } from "@/lib/ai";
import { apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AI_TOOLS, toolForEditor, type AiTool } from "./ai-tools";
import { ConfirmDialog } from "./confirm-dialog";
import { EditorLogo } from "./editor-logo";
import { timeAgo } from "./workspace-data";

/** For clients that can't sign in with OAuth: the token goes in a fixed header. */
const claudeTokenCommand = (token: string) =>
  `claude mcp add --transport http --scope user prism ${MCP_URL} --header "Authorization: Bearer ${token}"`;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * How to connect an AI tool (Claude Code, Codex, Antigravity, Cursor, GitHub Copilot, any MCP
 * client) to Prism's MCP endpoint: a grid of tools, then one page per tool with what to run or
 * paste. Personal access tokens are the fallback for clients without OAuth, on the "Any MCP
 * client" page; a token is shown once.
 */
export function AiAccessDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { actionsRef, onExitComplete } = usePopupExit(open);
  return (
    <Dialog.Root actionsRef={actionsRef} open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal keepMounted>
            <Dialog.Backdrop
              className="fixed inset-0 z-50 bg-slate/40 dark:bg-black/60"
              render={<motion.div {...backdropMotion} />}
            />
            <Dialog.Popup
              className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[55rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col border border-input bg-popover shadow-lg outline-none"
              render={dialogPopup(onExitComplete)}
            >
              <AiAccess />
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

// Mounted with the popup, so the chosen tool and a created token are forgotten once it closes.
function AiAccess() {
  const [toolId, setToolId] = useState<AiTool["id"] | null>(null);
  const editors = useQuery(editorsQuery).data ?? [];
  const tool = AI_TOOLS.find((t) => t.id === toolId);

  return (
    <>
      <header className="flex items-center gap-4 border-b border-divider px-6 py-5 sm:px-8">
        <Dialog.Title className="font-display text-[26px] leading-8 font-bold tracking-[-0.01em] text-ink">
          Connect AI tools
        </Dialog.Title>
        <div className="flex items-center gap-2">
          {editors.slice(0, 3).map((editor) => (
            <span
              key={editor.clientId}
              title={editor.name}
              className="flex size-8 items-center justify-center border border-divider bg-white"
            >
              <EditorLogo name={editor.name} className="size-5" />
            </span>
          ))}
          <button
            type="button"
            onClick={() => setToolId(null)}
            aria-label="All tools"
            title="All tools"
            className="flex size-8 items-center justify-center border border-divider bg-card text-foreground transition-colors duration-150 ease-standard hover:border-input"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
        <Dialog.Close
          aria-label="Close"
          className="-mr-2 ml-auto flex size-10 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink"
        >
          <X aria-hidden="true" className="size-5" />
        </Dialog.Close>
      </header>

      <Dialog.Description className="sr-only">
        Add Prism to Claude Code, Codex, Antigravity, Cursor, GitHub Copilot or any MCP client.
      </Dialog.Description>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
        {tool ? (
          <ToolPage
            tool={tool}
            editor={editors.find((e) => toolForEditor(e.name)?.id === tool.id)}
            onBack={() => setToolId(null)}
          />
        ) : (
          <ToolGrid
            connected={new Set(editors.map((e) => toolForEditor(e.name)?.id))}
            onPick={setToolId}
          />
        )}
      </div>

      <footer className="flex items-center justify-between gap-4 border-t border-divider px-6 py-5 sm:px-8">
        <a
          href="/#how-it-works"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm font-bold text-foreground underline-offset-4 hover:underline"
        >
          Learn more
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </a>
        <Dialog.Close className={ctaVariants({ variant: "secondary", size: "sm" })}>
          Done
        </Dialog.Close>
      </footer>
    </>
  );
}

function ToolLogo({ tool, size }: { tool: AiTool; size: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center border border-divider",
        tool.logo ? "bg-white" : "border-transparent bg-slate text-fog",
        big ? "size-20" : "size-12",
      )}
    >
      {tool.logo ? (
        <img
          src={tool.logo}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={big ? "size-11" : "size-7"}
        />
      ) : (
        <PlugZap aria-hidden="true" className={big ? "size-9" : "size-[22px]"} />
      )}
    </span>
  );
}

function ToolGrid({
  connected,
  onPick,
}: {
  connected: Set<AiTool["id"] | undefined>;
  onPick: (id: AiTool["id"]) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex items-start gap-4 border border-divider bg-card p-6 shadow-sm">
        <PlugZap aria-hidden="true" className="mt-0.5 size-[22px] shrink-0 text-foreground" />
        <div>
          <h2 className="text-base font-bold text-foreground">Connect Prism with your AI tools</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Read, edit and create board content straight from your editor: screens, flows, schemas
            and mind maps, drawn live on the board you have open.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-foreground">AI tools you can connect to Prism</h2>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            {open ? "Collapse" : "Expand"}
            <TurningChevron up turned={!open} seconds={0.2} className="size-4" />
          </button>
        </div>
        {open && (
          <ul className="mt-4 grid grid-cols-1 gap-4 min-[40rem]:grid-cols-2 lg:grid-cols-3">
            {AI_TOOLS.map((tool) => (
              <li key={tool.id} className="flex">
                <button
                  type="button"
                  onClick={() => onPick(tool.id)}
                  className="flex w-full flex-col gap-4 border border-divider bg-card p-6 text-left shadow-sm transition-colors duration-150 ease-standard hover:border-input"
                >
                  <span className="flex items-center gap-4">
                    <ToolLogo tool={tool} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold text-foreground">
                        {tool.name}
                      </span>
                      <span className="mt-1 block truncate text-[13px] text-muted-foreground">
                        {tool.id === "other" ? tool.by : `by ${tool.by}`}
                      </span>
                    </span>
                    {connected.has(tool.id) && (
                      <>
                        <Check
                          aria-hidden="true"
                          strokeWidth={2.5}
                          className="size-5 shrink-0 text-[#14804a] dark:text-brand"
                        />
                        <span className="sr-only">Connected</span>
                      </>
                    )}
                  </span>
                  <span className="text-sm leading-6 text-muted-foreground">{tool.blurb}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ToolPage({
  tool,
  editor,
  onBack,
}: {
  tool: AiTool;
  editor: { lastUsedAt: string | null } | undefined;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 self-start text-[15px] font-bold text-foreground"
      >
        <ChevronLeft aria-hidden="true" className="size-[18px]" />
        All tools
      </button>

      <div className="flex flex-wrap items-center gap-5">
        <ToolLogo tool={tool} size="lg" />
        <div className="min-w-0">
          <h2 className="font-display text-[34px] leading-tight font-bold tracking-[-0.01em] text-ink">
            {tool.name}
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {tool.id === "other" ? tool.by : `by ${tool.by}`}
          </p>
        </div>
        {tool.id !== "other" && (
          <span
            className={cn(
              "ml-auto flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold",
              editor
                ? "bg-seafoam text-[#0f5c35] dark:bg-seafoam/14 dark:text-brand"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {editor ? (
              <Check aria-hidden="true" strokeWidth={2.5} className="size-4" />
            ) : (
              <Circle aria-hidden="true" className="size-4" />
            )}
            {editor
              ? `Connected${editor.lastUsedAt ? ` · last call ${timeAgo(editor.lastUsedAt)}` : ""}`
              : "Not connected yet"}
          </span>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Add the Prism MCP server</h3>
          <p className="mt-1 text-[15px] text-muted-foreground">{tool.setup.intro}</p>
        </div>
        <CommandBlock text={tool.setup.code} label={`Copy the ${tool.name} setup`} />
      </section>

      {tool.id === "other" && (
        <section className="flex flex-col gap-4 border-t border-divider pt-8">
          <div>
            <h3 className="text-lg font-bold text-foreground">Access tokens</h3>
            <p className="mt-1 text-[15px] text-muted-foreground">
              For clients without OAuth sign-in. A token acts as you, on your boards only.
            </p>
          </div>
          <AccessTokens />
        </section>
      )}
    </div>
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
        <div className="flex flex-col gap-5">
          <p className="text-sm text-foreground">Copy your token now. It won't be shown again.</p>
          <CommandBlock text={created.token} label="Copy the token" />
          <CommandBlock
            text={claudeTokenCommand(created.token)}
            label="Copy the Claude Code command"
          />
          <p className="text-xs text-muted-foreground">
            Other clients: send it as <code className="font-mono">Authorization: Bearer …</code> to{" "}
            <code className="font-mono">{MCP_URL}</code>.
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
        <form noValidate onSubmit={submit}>
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

      <div>
        <h4 className="font-mono text-xs tracking-[0.08em] text-foreground uppercase">
          Your tokens
        </h4>
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
      </div>
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

/** Text to copy (a command, a config, a URL) in a dark block with a Copy button. */
function CommandBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    });
  };
  return (
    <div className="flex items-center gap-4 bg-slate py-4 pr-4 pl-5 dark:bg-black/40">
      <pre className="min-w-0 flex-1 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fog">
        {text}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : label}
        className="flex h-9 shrink-0 items-center gap-2 bg-fog px-3.5 text-sm font-bold text-slate transition-colors duration-150 ease-standard hover:bg-white"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <Copy aria-hidden="true" className="size-4" />
        )}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

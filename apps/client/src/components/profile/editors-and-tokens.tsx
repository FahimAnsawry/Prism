import type { ApiToken, ConnectedEditor } from "@prism/shared";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Sparkles, SquareTerminal } from "lucide-react";
import { use, useState } from "react";
import { FormError } from "@/components/auth/form-field";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ConnectAiContext } from "@/components/dashboard/dashboard-styles";
import { timeAgo } from "@/components/dashboard/workspace-data";
import { editorsQuery, useRevokeEditor } from "@/lib/account";
import { apiTokensQuery, useRevokeApiToken } from "@/lib/ai";
import { apiErrorMessage } from "@/lib/api";
import { Panel, PanelRow, StatusBadge } from "./profile-parts";
import { panelButton } from "./profile-styles";

/** AI editors signed in through the browser, and personal access tokens. */
export function EditorsAndTokens() {
  const connectAi = use(ConnectAiContext);
  const editors = useQuery(editorsQuery);
  const tokens = useQuery(apiTokensQuery);
  const pending = editors.isPending || tokens.isPending;
  const failed = editors.isError || tokens.isError;
  const empty = !pending && !editors.data?.length && !tokens.data?.length;

  return (
    <Panel
      id="editors"
      title="Editors and tokens"
      description="These can draw on your boards as you. A token is shown once; Prism keeps only a hash."
      action={
        <button type="button" onClick={connectAi} className={panelButton}>
          <KeyRound aria-hidden="true" />
          Connect or new token
        </button>
      }
    >
      {failed ? (
        <FormError message="Couldn't load your editors. Reload to try again." className="mt-5" />
      ) : pending ? (
        <p className="mt-5 font-mono text-2xs text-muted-foreground">Loading…</p>
      ) : empty ? (
        <p className="mt-5 text-[13px] text-muted-foreground">
          No AI editor is connected yet. Add Prism to Claude Code or Codex with one command.
        </p>
      ) : (
        <ul className="mt-4 border-t border-divider">
          {editors.data?.map((editor) => (
            <EditorRow key={editor.clientId} editor={editor} />
          ))}
          {tokens.data?.map((token) => (
            <TokenRow key={token.id} token={token} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function EditorRow({ editor }: { editor: ConnectedEditor }) {
  const revoke = useRevokeEditor();
  const [confirm, setConfirm] = useState(false);
  const claude = /claude/i.test(editor.name);
  return (
    <PanelRow
      Icon={claude ? Sparkles : SquareTerminal}
      iconClass={
        claude
          ? "border-transparent bg-seafoam text-slate"
          : "border-transparent bg-lime text-slate"
      }
      title={editor.name}
      detail={`Browser sign-in${editor.lastUsedAt ? ` · last call ${timeAgo(editor.lastUsedAt)}` : ""}`}
    >
      <StatusBadge tone="blue">OAUTH</StatusBadge>
      <button type="button" onClick={() => setConfirm(true)} className={panelButton}>
        Revoke
      </button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Sign ${editor.name} out?`}
        description="It loses access to your boards right away. Signing in from the editor again brings it back."
        confirmLabel="Revoke"
        tone="danger"
        pending={revoke.isPending}
        error={revoke.error ? apiErrorMessage(revoke.error) : undefined}
        onConfirm={() => revoke.mutate(editor.clientId, { onSuccess: () => setConfirm(false) })}
      />
    </PanelRow>
  );
}

function TokenRow({ token }: { token: ApiToken }) {
  const revoke = useRevokeApiToken();
  const [confirm, setConfirm] = useState(false);
  return (
    <PanelRow
      Icon={KeyRound}
      title={token.name}
      detail={`${token.start}… · ${token.lastUsedAt ? `last used ${timeAgo(token.lastUsedAt)}` : "never used"}`}
    >
      <StatusBadge tone="gray">TOKEN</StatusBadge>
      <button type="button" onClick={() => setConfirm(true)} className={panelButton}>
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
    </PanelRow>
  );
}

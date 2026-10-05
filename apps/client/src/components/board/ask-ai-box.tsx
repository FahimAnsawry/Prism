import { EDIT_PROMPT_MAX, type EditRequest } from "@prism/shared";
import { ArrowUp, CircleAlert, CircleCheck, LoaderCircle, Sparkles, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiErrorMessage } from "@/lib/api";
import { useCreateEdit } from "@/lib/ai";
import { cn } from "@/lib/utils";

/** How long a finished request's result stays before it hides itself. */
const DONE_VISIBLE_MS = 12_000;

/**
 * "Ask AI" (tools.md §5): a prompt for the current selection. The request waits on the server
 * until an AI editor connected through the MCP bridge picks it up and reports back; each
 * request's status shows above the box.
 */
export function AskAiBox({
  boardId,
  selectedIds,
  requests,
}: {
  boardId: string;
  /** The selection the prompt is about. The prompt box shows only while something is selected. */
  selectedIds: string[];
  /** Requests to show the status of (this session's), newest first. */
  requests: EditRequest[];
}) {
  const [prompt, setPrompt] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const create = useCreateEdit(boardId);

  const dismiss = useCallback((id: string) => setDismissed((set) => new Set(set).add(id)), []);
  const visible = requests.filter((r) => !dismissed.has(r.id)).slice(0, 3);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || create.isPending) return;
    create.mutate({ prompt: text, elementIds: selectedIds }, { onSuccess: () => setPrompt("") });
  };

  if (selectedIds.length === 0 && visible.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 z-20 flex w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2">
      {visible.length > 0 && (
        <ul aria-label="AI requests" aria-live="polite" className="flex flex-col gap-1.5">
          {visible.map((request) => (
            <RequestStatus key={request.id} request={request} onDismiss={dismiss} />
          ))}
        </ul>
      )}

      {selectedIds.length > 0 && (
        <form onSubmit={submit} className="flex flex-col border border-chrome bg-card">
          <div className="flex items-center gap-2 pr-1.5 pl-3">
            <Sparkles aria-hidden="true" className="size-4 shrink-0 text-violet" />
            <label className="min-w-0 flex-1">
              <span className="sr-only">Ask AI to change the selection</span>
              <input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") event.currentTarget.blur();
                }}
                maxLength={EDIT_PROMPT_MAX}
                placeholder={
                  selectedIds.length === 1
                    ? "Ask AI to change this… e.g. make the corners rounded"
                    : `Ask AI to change these ${selectedIds.length} items…`
                }
                className="h-11 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              type="submit"
              disabled={!prompt.trim() || create.isPending}
              aria-label="Send to AI"
              title="Send to AI (Enter)"
              className="flex size-8 shrink-0 items-center justify-center bg-secondary text-secondary-foreground transition-opacity duration-150 ease-standard disabled:opacity-40"
            >
              {create.isPending ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <ArrowUp aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
          {create.error && (
            <p role="alert" className="border-t border-divider px-3 py-2 text-xs text-foreground">
              {apiErrorMessage(create.error)}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

const STATUS_TEXT: Record<EditRequest["status"], string> = {
  pending: "Waiting for an AI editor. Ask yours to watch Prism for edits.",
  working: "AI is working on it…",
  done: "Done",
  failed: "The AI couldn't do this",
};

function RequestStatus({
  request,
  onDismiss,
}: {
  request: EditRequest;
  onDismiss: (id: string) => void;
}) {
  const finished = request.status === "done" || request.status === "failed";
  useEffect(() => {
    if (request.status !== "done") return;
    const timer = setTimeout(() => onDismiss(request.id), DONE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [request.status, request.id, onDismiss]);
  const Icon =
    request.status === "done"
      ? CircleCheck
      : request.status === "failed"
        ? CircleAlert
        : LoaderCircle;

  return (
    <li
      className={cn(
        "flex items-start gap-2.5 border bg-card px-3 py-2.5 text-sm",
        request.status === "failed" ? "border-coral" : "border-chrome",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          finished
            ? request.status === "done"
              ? "text-brand"
              : "text-coral"
            : "animate-spin text-violet",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-foreground" title={request.prompt}>
          {request.prompt}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {(finished && request.note) || STATUS_TEXT[request.status]}
        </p>
      </div>
      {finished && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => onDismiss(request.id)}
          className="-mr-1 flex size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-ink"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </li>
  );
}

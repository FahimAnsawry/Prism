import { EDIT_PROMPT_MAX, type EditRequest } from "@prism/shared";
import {
  ArrowUp,
  Check,
  CircleAlert,
  CircleCheck,
  CirclePause,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { type FormEvent, memo, useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/motion-parts";
import { apiErrorMessage } from "@/lib/api";
import { useCreateEdit, useDeleteEdit, useStopEdit, useUpdateEdit } from "@/lib/ai";
import { EASE_STANDARD } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** How long a finished request's result stays before it hides itself. */
const DONE_VISIBLE_MS = 12_000;

/**
 * "Ask AI" (tools.md §5): a prompt for the current selection. The request waits on the server
 * until an AI editor connected through the MCP bridge picks it up and reports back; each
 * request's status shows above the box.
 */
// Memoized: the board editor re-renders on every pan and zoom frame.
export const AskAiBox = memo(AskAiBoxView);

function AskAiBoxView({
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
            <RequestStatus
              key={request.id}
              boardId={boardId}
              request={request}
              onDismiss={dismiss}
            />
          ))}
        </ul>
      )}

      {selectedIds.length > 0 && (
        <form
          onSubmit={submit}
          className="flex flex-col border border-chrome bg-card shadow-sm focus-within:border-foreground"
        >
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
            <motion.button
              type="submit"
              disabled={!prompt.trim() || create.isPending}
              aria-label="Send to AI"
              title="Send to AI (Enter)"
              className="flex size-8 shrink-0 items-center justify-center bg-secondary text-secondary-foreground"
              initial={false}
              animate={{ opacity: !prompt.trim() || create.isPending ? 0.4 : 1 }}
              transition={{ duration: 0.15, ease: EASE_STANDARD }}
            >
              {create.isPending ? (
                <Spinner className="size-4" />
              ) : (
                <ArrowUp aria-hidden="true" className="size-4" />
              )}
            </motion.button>
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
  paused: "Paused. AI editors skip it until you resume.",
  working: "AI is working on it…",
  done: "Done",
  failed: "The AI couldn't do this",
};

function RequestStatus({
  boardId,
  request,
  onDismiss,
}: {
  boardId: string;
  request: EditRequest;
  onDismiss: (id: string) => void;
}) {
  const update = useUpdateEdit(boardId);
  const remove = useDeleteEdit(boardId);
  const stop = useStopEdit(boardId);
  const [editRequested, setEditing] = useState(false);
  const [draft, setDraft] = useState(request.prompt);
  /** Editing a waiting request holds it back from AI editors; this puts it back after. */
  const resumeAfterEdit = useRef(false);

  const finished = request.status === "done" || request.status === "failed";
  const paused = request.status === "paused";
  // Only a request no AI editor has picked up yet can change.
  const changeable = request.status === "pending" || paused;
  // An AI editor that picks it up mid-edit ends the edit: nothing left to change.
  const editing = editRequested && changeable;

  useEffect(() => {
    if (request.status !== "done") return;
    const timer = setTimeout(() => onDismiss(request.id), DONE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [request.status, request.id, onDismiss]);

  const startEdit = () => {
    setDraft(request.prompt);
    resumeAfterEdit.current = request.status === "pending";
    setEditing(true);
    if (request.status === "pending") update.mutate({ id: request.id, paused: true });
  };
  const stopEdit = (save: boolean) => {
    const text = draft.trim();
    const prompt = save && text && text !== request.prompt ? text : undefined;
    const paused = resumeAfterEdit.current ? false : undefined;
    setEditing(false);
    if (prompt !== undefined || paused !== undefined) {
      update.mutate({
        id: request.id,
        ...(prompt !== undefined && { prompt }),
        ...(paused !== undefined && { paused }),
      });
    }
  };

  const Icon =
    request.status === "done"
      ? CircleCheck
      : request.status === "failed"
        ? CircleAlert
        : paused
          ? CirclePause
          : LoaderCircle;

  return (
    <li
      className={cn(
        "flex items-start gap-2.5 border bg-card px-3 py-2.5 text-sm",
        request.status === "failed" ? "border-danger" : "border-chrome",
      )}
    >
      {!finished && !paused ? (
        <Spinner className="mt-0.5 size-4 shrink-0 text-violet" />
      ) : (
        <Icon
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-4 shrink-0",
            finished
              ? request.status === "done"
                ? "text-brand-ink"
                : "text-danger"
              : "text-muted-foreground",
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              stopEdit(true);
            }}
          >
            <label>
              <span className="sr-only">Edit the request</span>
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") stopEdit(false);
                }}
                maxLength={EDIT_PROMPT_MAX}
                className="h-7 w-full border border-chrome bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-violet"
              />
            </label>
          </form>
        ) : (
          <p className="truncate text-foreground" title={request.prompt}>
            {request.prompt}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {update.error || stop.error
            ? apiErrorMessage(update.error ?? stop.error)
            : editing
              ? "Held back while you edit. Enter to save, Esc to cancel."
              : (finished && request.note) || STATUS_TEXT[request.status]}
        </p>
      </div>
      {editing ? (
        <>
          <IconButton label="Save" onClick={() => stopEdit(true)} disabled={!draft.trim()}>
            <Check aria-hidden="true" className="size-3.5" />
          </IconButton>
          <IconButton label="Cancel" onClick={() => stopEdit(false)}>
            <X aria-hidden="true" className="size-3.5" />
          </IconButton>
        </>
      ) : (
        <>
          {changeable && (
            <>
              <IconButton
                label={paused ? "Resume" : "Pause"}
                disabled={update.isPending}
                onClick={() => update.mutate({ id: request.id, paused: !paused })}
              >
                {paused ? (
                  <Play aria-hidden="true" className="size-3.5" />
                ) : (
                  <Pause aria-hidden="true" className="size-3.5" />
                )}
              </IconButton>
              <IconButton label="Edit" onClick={startEdit}>
                <Pencil aria-hidden="true" className="size-3.5" />
              </IconButton>
            </>
          )}
          {request.status === "working" && (
            <IconButton
              label="Stop"
              disabled={stop.isPending}
              onClick={() => stop.mutate(request.id)}
            >
              <Square aria-hidden="true" className="size-3.5" />
            </IconButton>
          )}
          {finished && (
            <IconButton label="Dismiss" onClick={() => onDismiss(request.id)}>
              <X aria-hidden="true" className="size-3.5" />
            </IconButton>
          )}
          <IconButton
            label={finished ? "Delete" : "Cancel and delete"}
            disabled={remove.isPending}
            onClick={() => remove.mutate(request.id)}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </IconButton>
        </>
      )}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="-mr-1 flex size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

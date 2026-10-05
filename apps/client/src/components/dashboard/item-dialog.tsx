import { Dialog } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createBoardSchema,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  type CreateBoardInput,
} from "@prism/shared";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  FieldError,
  fieldInputClass,
  fieldLabelClass,
  FormError,
  FormField,
} from "@/components/auth/form-field";
import { ctaVariants } from "@/components/cta";
import { Label } from "@/components/ui/label";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  useCreateBoard,
  useCreateProject,
  useUpdateBoard,
  useUpdateProject,
} from "@/lib/workspace";
import { ConfirmDialog } from "./confirm-dialog";
import type { WorkspaceItem } from "./workspace-data";

export type CreateKind = "project" | "whiteboard";

/** What the dialog is for: making something new, or editing an existing item. */
export type ItemDialogTarget =
  /** `projectId` preselects the project a new whiteboard goes into. */
  { mode: "create"; kind: CreateKind; projectId?: string } | { mode: "edit"; item: WorkspaceItem };

type Copy = { title: string; description: string; submit: string; pending: string };

function copyFor(target: ItemDialogTarget): Copy {
  if (target.mode === "create") {
    return target.kind === "project"
      ? {
          title: "New project",
          description: "A folder that holds many boards.",
          submit: "Create project",
          pending: "Creating…",
        }
      : {
          title: "New whiteboard",
          description: "One canvas for one idea.",
          submit: "Create board",
          pending: "Creating…",
        };
  }
  const saving = { submit: "Save changes", pending: "Saving…" };
  return target.item.kind === "project"
    ? { title: "Edit project", description: "Rename it or update its description.", ...saving }
    : {
        title: "Edit whiteboard",
        description: "Rename it, update its description, or move it to another project.",
        ...saving,
      };
}

const isProject = (target: ItemDialogTarget) =>
  target.mode === "create" ? target.kind === "project" : target.item.kind === "project";

/**
 * Creates or edits a project or whiteboard. A new whiteboard opens right away.
 * Closing with unsaved input asks first. `target` stays set while the dialog animates closed,
 * so the title doesn't change mid-fade.
 */
export function ItemDialog({
  open,
  target,
  onOpenChange,
  projects,
}: {
  open: boolean;
  target: ItemDialogTarget;
  onOpenChange: (open: boolean) => void;
  /** Projects a whiteboard can go into. */
  projects: { id: string; name: string }[];
}) {
  // Reported by the form, read when something asks the dialog to close.
  const formState = useRef({ dirty: false, submitting: false });
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestOpenChange = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (formState.current.submitting) return;
    if (formState.current.dirty) return setConfirmDiscard(true);
    onOpenChange(false);
  };

  const discardTitle =
    target.mode === "edit"
      ? "Discard your changes?"
      : `Discard this new ${isProject(target) ? "project" : "whiteboard"}?`;
  const discardDescription =
    target.mode === "edit"
      ? `Your edits to “${target.item.name}” won't be saved.`
      : "What you've entered won't be saved.";

  return (
    <Dialog.Root open={open} onOpenChange={requestOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate/40 transition-opacity duration-150 ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/60" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[30rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-input bg-popover p-6 outline-none transition-[scale,opacity] duration-150 ease-standard data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-nested-dialog-open:opacity-60 sm:p-8">
          <ItemForm
            target={target}
            projects={projects}
            onStateChange={(state) => {
              formState.current = state;
            }}
            onDone={() => onOpenChange(false)}
          />
        </Dialog.Popup>
      </Dialog.Portal>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={discardTitle}
        description={discardDescription}
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        tone="danger"
        onConfirm={() => {
          setConfirmDiscard(false);
          onOpenChange(false);
        }}
      />
    </Dialog.Root>
  );
}

// Mounted with the popup, so every opening starts from a fresh form.
function ItemForm({
  target,
  projects,
  onStateChange,
  onDone,
}: {
  target: ItemDialogTarget;
  projects: { id: string; name: string }[];
  onStateChange: (state: { dirty: boolean; submitting: boolean }) => void;
  onDone: () => void;
}) {
  const copy = copyFor(target);
  const project = isProject(target);
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const createBoard = useCreateBoard();
  const updateProject = useUpdateProject();
  const updateBoard = useUpdateBoard();

  const defaultValues: CreateBoardInput =
    target.mode === "create"
      ? {
          name: project ? "Untitled project" : "Untitled board",
          description: "",
          projectId: target.projectId ?? "",
        }
      : {
          name: target.item.name,
          description: target.item.description ?? "",
          projectId: target.item.kind === "board" ? (target.item.projectId ?? "") : "",
        };

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CreateBoardInput>({
    resolver: zodResolver(createBoardSchema),
    defaultValues,
  });

  // Block bodies on purpose: an effect must return nothing or a cleanup function.
  useEffect(() => {
    onStateChange({ dirty: isDirty, submitting: isSubmitting });
  }, [isDirty, isSubmitting, onStateChange]);

  // Select the name so typing replaces it.
  useEffect(() => {
    setFocus("name", { shouldSelect: true });
  }, [setFocus]);

  // A new whiteboard opens straight away, so fetch the board page's code while the user types.
  const router = useRouter();
  const opensBoard = target.mode === "create" && !project;
  useEffect(() => {
    if (!opensBoard) return;
    router.loadRouteChunk(router.routesByPath["/board/$boardId"])?.catch(() => {
      // Not critical: navigating loads it anyway.
    });
  }, [opensBoard, router]);

  const onSubmit = async ({ name, description, projectId = "" }: CreateBoardInput) => {
    try {
      if (target.mode === "edit") {
        // Nothing changed: Save just closes.
        if (isDirty) {
          if (target.item.kind === "project") {
            await updateProject.mutateAsync({ id: target.item.id, name, description });
          } else {
            await updateBoard.mutateAsync({ id: target.item.id, name, description, projectId });
          }
        }
        onDone();
      } else if (project) {
        await createProject.mutateAsync({ name, description });
        onDone();
      } else {
        const board = await createBoard.mutateAsync({ name, description, projectId });
        // Don't close first: the dialog stays up (still "Creating…") until the board page
        // replaces the dashboard, so the dashboard never flashes in between.
        await navigate({ to: "/board/$boardId", params: { boardId: board.id } });
      }
    } catch (error) {
      const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};
      for (const field of ["name", "description", "projectId"] as const) {
        const message = fieldErrors[field]?.[0];
        if (message) setError(field, { message });
      }
      setError("root", { message: apiErrorMessage(error) });
    }
  };

  const sortedProjects = projects.toSorted((a, b) => a.name.localeCompare(b.name));
  const optional = <span className="font-mono text-3xs text-muted-foreground">OPTIONAL</span>;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Dialog.Title className="text-[26px] leading-8 font-bold text-ink">
            {copy.title}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {copy.description}
          </Dialog.Description>
        </div>
        <Dialog.Close
          aria-label="Close"
          className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
        </Dialog.Close>
      </div>

      <FormError message={errors.root?.message} className="mt-5" />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6">
        <FormField
          id="item-name"
          label="Name"
          autoComplete="off"
          maxLength={NAME_MAX_LENGTH}
          error={errors.name?.message}
          {...register("name")}
        />
        <FormField
          id="item-description"
          label="Description"
          labelAside={optional}
          autoComplete="off"
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder={project ? "What is this project for?" : "What is this board about?"}
          className="mt-[18px]"
          error={errors.description?.message}
          {...register("description")}
        />

        {!project && sortedProjects.length > 0 && (
          <div className="mt-[18px]">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="item-project" className={fieldLabelClass}>
                Project
              </Label>
              {optional}
            </div>
            <div className="relative mt-1">
              <select
                id="item-project"
                aria-invalid={errors.projectId ? true : undefined}
                aria-describedby={errors.projectId ? "item-project-error" : undefined}
                className={cn(fieldInputClass, "w-full appearance-none border pr-11")}
                {...register("projectId")}
              >
                <option value="">No project (standalone board)</option>
                {sortedProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
              />
            </div>
            <FieldError id="item-project-error" message={errors.projectId?.message} />
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <Dialog.Close
            type="button"
            disabled={isSubmitting}
            className={ctaVariants({ variant: "secondary", size: "sm" })}
          >
            Cancel
          </Dialog.Close>
          <button type="submit" disabled={isSubmitting} className={ctaVariants({ size: "sm" })}>
            {isSubmitting ? copy.pending : copy.submit}
          </button>
        </div>
      </form>
    </>
  );
}

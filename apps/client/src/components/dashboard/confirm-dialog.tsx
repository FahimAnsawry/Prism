import { AlertDialog } from "@base-ui/react/alert-dialog";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { FormError } from "@/components/auth/form-field";
import { ctaVariants } from "@/components/cta";
import { backdropMotion, popupMotion, usePopupExit } from "@/components/popup-motion";
import { cn } from "@/lib/utils";

/**
 * A yes/no question that must be answered before going on: deleting, or discarding edits.
 * When opened over another dialog it stacks on top (Base UI nested dialogs), with no second backdrop.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  pending = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" paints the confirm button red. */
  tone?: "default" | "danger";
  /** While true the buttons are disabled and the dialog can't be dismissed. */
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
}) {
  const { actionsRef, onExitComplete } = usePopupExit(open);
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      actionsRef={actionsRef}
    >
      <AnimatePresence>
        {open && (
          <AlertDialog.Portal keepMounted>
            <AlertDialog.Backdrop
              className="fixed inset-0 z-50 bg-slate/40 dark:bg-black/60"
              render={<motion.div {...backdropMotion} />}
            />
            <AlertDialog.Popup
              className={cn(
                "fixed top-1/2 left-1/2 z-50 w-[26rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 border border-input bg-popover p-6 outline-none sm:p-7",
              )}
              render={<motion.div {...popupMotion} onAnimationComplete={onExitComplete} />}
            >
              <AlertDialog.Title className="text-[22px] leading-7 font-bold text-ink">
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
                {description}
              </AlertDialog.Description>
              <FormError message={error} className="mt-4" />
              <div className="mt-7 flex flex-wrap justify-end gap-3">
                <AlertDialog.Close
                  disabled={pending}
                  className={ctaVariants({ variant: "secondary", size: "sm" })}
                >
                  {cancelLabel}
                </AlertDialog.Close>
                <button
                  type="button"
                  disabled={pending}
                  onClick={onConfirm}
                  className={ctaVariants({
                    variant: tone === "danger" ? "danger" : "primary",
                    size: "sm",
                  })}
                >
                  {confirmLabel}
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        )}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}

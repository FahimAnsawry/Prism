import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** The board's input: 48px tall, card fill, edge border, the global focus outline. */
export const fieldInputClass =
  "h-12 rounded-none border-input bg-card px-4 text-[15px] text-foreground placeholder:text-muted-foreground md:text-[15px] dark:bg-card aria-invalid:border-destructive aria-invalid:ring-0 aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)] dark:aria-invalid:border-destructive";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-foreground">
      <span aria-hidden="true" className="mt-[5px] size-2 shrink-0 bg-destructive" />
      {message}
    </p>
  );
}

/** A whole-form error (e.g. wrong password), announced to screen readers when it appears. */
export function FormError({ message, className }: { message?: string; className?: string }) {
  return (
    // The live region stays mounted so the message is announced; spacing only applies when shown.
    <div role="alert" className={message ? className : undefined}>
      {message && (
        <p className="flex items-start gap-2 border border-destructive bg-card px-4 py-3 text-[13px] leading-snug text-foreground">
          <span aria-hidden="true" className="mt-[5px] size-2 shrink-0 bg-destructive" />
          {message}
        </p>
      )}
    </div>
  );
}

type FormFieldProps = ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string;
  /** Rendered at the right of the label row, e.g. a "Forgot?" link. */
  labelAside?: ReactNode;
  /** Rendered inside the input on the right, e.g. a show/hide toggle. */
  inputAside?: ReactNode;
};

export function FormField({
  id,
  label,
  error,
  labelAside,
  inputAside,
  className,
  "aria-describedby": describedBy,
  ...inputProps
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const describedByIds = [error ? errorId : undefined, describedBy].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <Label
          htmlFor={id}
          className="font-mono text-xs leading-4 font-normal tracking-[0.08em] text-foreground uppercase"
        >
          {label}
        </Label>
        {labelAside}
      </div>
      <div className="relative mt-1">
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedByIds || undefined}
          className={cn(fieldInputClass, inputAside && "pr-20")}
          {...inputProps}
        />
        {inputAside}
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

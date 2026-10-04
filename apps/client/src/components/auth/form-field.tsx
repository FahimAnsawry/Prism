import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** The board's input: 48px tall, fog fill, edge border, the global focus outline. */
export const fieldInputClass =
  "h-12 rounded-none border-edge bg-fog px-4 text-[15px] text-slate placeholder:text-graphite md:text-[15px] aria-invalid:border-danger aria-invalid:ring-0 aria-invalid:shadow-[inset_0_0_0_1px_var(--color-danger)]";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-slate">
      <span aria-hidden="true" className="mt-[5px] size-2 shrink-0 bg-danger" />
      {message}
    </p>
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
          className="font-mono text-xs leading-4 font-normal tracking-[0.08em] text-slate uppercase"
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

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { fillPlaceholders } from "./docs-markdown";
import { useCopy } from "./use-copy";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const { copied, copy } = useCopy();
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={() => void copy(text)}
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs font-bold tracking-[0.08em] uppercase transition-colors duration-150 ease-standard hover:text-brand",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** A dark title-barred panel for code, as the board draws it, with a COPY button. */
export function CodePanel({
  title,
  code,
  command = false,
  tabs,
}: {
  title: string;
  code: string;
  /** Terminal input: a green $ before the text. */
  command?: boolean;
  /** Alternative versions of the same code, switched in the title bar. */
  tabs?: { label: string; code: string }[];
}) {
  const [active, setActive] = useState(0);
  const current = tabs ? (tabs[active] ?? tabs[0]) : undefined;
  const shown = fillPlaceholders(current?.code ?? code);

  return (
    <figure className="my-6 overflow-hidden bg-inverse-panel text-fog">
      <figcaption className="flex items-center justify-between gap-4 bg-inverse-bar/50 px-4 py-2 font-mono text-xs text-ash">
        {tabs ? (
          <div role="tablist" aria-label="Format" className="flex gap-4">
            {tabs.map((tab, index) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={index === active}
                onClick={() => setActive(index)}
                className={cn(
                  "border-b-2 py-0.5 transition-colors duration-150 ease-standard",
                  index === active
                    ? "border-brand text-fog"
                    : "border-transparent text-ash hover:text-fog",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <span>{title}</span>
        )}
        <CopyButton text={shown} className="text-ash" />
      </figcaption>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed">
        <code>
          {command && (
            <span aria-hidden="true" className="mr-3 text-brand select-none">
              $
            </span>
          )}
          {shown}
        </code>
      </pre>
    </figure>
  );
}

/** A line to type to the editor, as the board shows it: neon text after a > on the panel. */
export function PromptLine({ text }: { text: string }) {
  return (
    <div className="my-6 flex items-start justify-between gap-4 bg-inverse-panel px-4 py-3.5 font-mono text-[13px] text-neon">
      <p className="min-w-0 break-words">
        <span aria-hidden="true" className="mr-2 select-none">
          &gt;
        </span>
        {text}
      </p>
      <CopyButton text={text} className="shrink-0 text-ash" />
    </div>
  );
}

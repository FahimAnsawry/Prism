// The properties panel's font chooser (tools.md §3): the self-hosted fonts grouped by kind, the
// Google fonts this board added, and a field to add another Google font by name.

import { type FontFamily, googleFontNameSchema } from "@prism/shared";
import { ChevronDown, X } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  BUILTIN_FONT_IDS,
  FONT_CATEGORIES,
  fontInfo,
  fontStack,
  googleFontId,
  loadFont,
} from "./fonts";

export function FontPicker({
  value,
  customFonts,
  onPick,
  onAddFont,
  onRemoveFont,
}: {
  value: FontFamily;
  /** Google Fonts family names the board added. */
  customFonts: string[];
  onPick: (font: FontFamily) => void;
  /** Called once the font has loaded. */
  onAddFont: (family: string) => void;
  onRemoveFont: (family: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const info = fontInfo(value);

  const pick = (font: FontFamily) => {
    onPick(font);
    setOpen(false);
  };

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between border border-divider bg-background px-2.5 text-left text-sm text-foreground hover:bg-divider"
      >
        <span className="truncate" style={{ fontFamily: info.stack }}>
          {info.label}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div id={listId} className="mt-1 border border-divider bg-background">
          <div className="max-h-64 overflow-y-auto py-1">
            {FONT_CATEGORIES.map((category) => (
              <FontGroup
                key={category.id}
                label={category.label}
                fonts={BUILTIN_FONT_IDS.filter((id) => fontInfo(id).category === category.id)}
                value={value}
                onPick={pick}
              />
            ))}
            {customFonts.length > 0 && (
              <FontGroup
                label="Added to this board"
                fonts={customFonts.map(googleFontId)}
                value={value}
                onPick={pick}
                onRemove={(font) => onRemoveFont(font.slice(3))}
              />
            )}
          </div>
          <AddFontForm
            onAdded={(family) => {
              onAddFont(family);
              pick(googleFontId(family));
            }}
          />
        </div>
      )}
    </div>
  );
}

function FontGroup({
  label,
  fonts,
  value,
  onPick,
  onRemove,
}: {
  label: string;
  fonts: FontFamily[];
  value: FontFamily;
  onPick: (font: FontFamily) => void;
  onRemove?: (font: FontFamily) => void;
}) {
  return (
    <div role="group" aria-label={label} className="pb-1">
      <p className="px-2.5 pt-1.5 pb-1 font-mono text-3xs text-muted-foreground uppercase">
        {label}
      </p>
      {fonts.map((font) => (
        <div key={font} className="group flex items-center">
          <button
            type="button"
            aria-pressed={font === value}
            onClick={() => onPick(font)}
            className={cn(
              "h-8 min-w-0 flex-1 truncate px-2.5 text-left text-[15px]",
              font === value
                ? "bg-secondary text-secondary-foreground"
                : "text-foreground hover:bg-divider",
            )}
            style={{ fontFamily: fontStack(font) }}
          >
            {fontInfo(font).label}
          </button>
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove ${fontInfo(font).label} from this board`}
              onClick={() => onRemove(font)}
              className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-divider hover:text-ink"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AddFontForm({ onAdded }: { onAdded: (family: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const errorId = useId();

  const submit = async () => {
    const parsed = googleFontNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "That isn't a font name.");
      return;
    }
    // Google's family names are title case ("open sans" → "Open Sans").
    const family = parsed.data
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    setBusy(true);
    setError(null);
    const ok = await loadFont(googleFontId(family));
    setBusy(false);
    if (!ok) {
      setError(`Google Fonts has no font called "${family}".`);
      return;
    }
    setName("");
    onAdded(family);
  };

  return (
    // A <div>, not a nested <form>; Enter in the field adds the font.
    <div className="border-t border-divider p-2.5">
      <label
        htmlFor={inputId}
        className="mb-1.5 block font-mono text-3xs text-muted-foreground uppercase"
      >
        Add a Google font
      </label>
      <div className="flex gap-1">
        <input
          id={inputId}
          value={name}
          placeholder="e.g. Lobster"
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          className={cn(
            "h-7 min-w-0 flex-1 border bg-card px-2 text-xs text-foreground outline-none",
            error ? "border-coral" : "border-divider focus:border-foreground",
          )}
        />
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void submit()}
          className="h-7 bg-secondary px-3 font-mono text-2xs text-secondary-foreground disabled:opacity-60"
        >
          {busy ? "…" : "Add"}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-3xs text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

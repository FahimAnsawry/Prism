import { PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";

/** The editors' own marks, in `public/editors/`. */
const LOGOS = {
  "claude-code": "/editors/claude-code.svg",
  claude: "/editors/claude.svg",
  codex: "/editors/codex.svg",
  antigravity: "/editors/antigravity.svg",
  cursor: "/editors/cursor.svg",
  copilot: "/editors/github-copilot.svg",
} as const;

/** The mark for an AI editor, by the name it registered with when it signed in. */
function logoFor(name: string): string | null {
  if (/antigravity/i.test(name)) return LOGOS.antigravity;
  if (/codex|openai/i.test(name)) return LOGOS.codex;
  if (/cursor/i.test(name)) return LOGOS.cursor;
  if (/copilot|github/i.test(name)) return LOGOS.copilot;
  if (/claude.?code/i.test(name)) return LOGOS["claude-code"];
  if (/claude|anthropic/i.test(name)) return LOGOS.claude;
  return null;
}

/** The logo of a connected AI editor; an editor we don't know gets a neutral plug. */
export function EditorLogo({ name, className }: { name: string; className?: string }) {
  const src = logoFor(name);
  if (!src) {
    return (
      <PlugZap
        aria-hidden="true"
        className={cn("size-4 shrink-0 text-muted-foreground", className)}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn(
        "size-4 shrink-0",
        // These two marks are plain black, so they sit on white to stay visible at night.
        (src === LOGOS.cursor || src === LOGOS.copilot) && "bg-white p-px",
        className,
      )}
    />
  );
}

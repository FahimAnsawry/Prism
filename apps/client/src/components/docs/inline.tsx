import { Fragment } from "react";
import { fillPlaceholders } from "./docs-markdown";

/** Prose with `code` spans set in mono. Placeholders like {{mcp}} are filled in. */
export function Inline({ text }: { text: string }) {
  // Splitting on a capture group puts the code spans at the odd positions.
  const parts = fillPlaceholders(text).split(/`([^`]+)`/);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <code
            key={index}
            className="bg-muted px-1.5 py-0.5 font-mono text-[0.85em] break-words text-foreground"
          >
            {part}
          </code>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

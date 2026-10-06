import {
  type BoardElement,
  MIND_LINE_HEIGHT,
  MIND_PAD_X,
  MIND_PAD_Y,
  MIND_TEXT_COLOR,
} from "@prism/shared";
import { type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { displayColor, STICKY_DEFAULT } from "./board-model";
import { type Camera, worldToScreen } from "./camera";
import { fontStack, weightOf } from "./fonts";
import { center } from "./geometry";
import {
  fitTextBox,
  layoutSticky,
  fontPx,
  letterSpacingOf,
  lineHeightOf,
  listToText,
  STICKY_PADDING,
  textToList,
} from "./text-layout";

const INDENT = "    ";

/**
 * Editing text in place (tools.md §1, tool 3): an HTML <textarea> laid over the element, scaled and
 * turned with it. Each keystroke updates the element live (without history); closing the editor
 * makes the whole edit one undo step.
 */
export function TextEditor({
  el,
  camera,
  viewport,
  onChange,
  onDone,
  onAddChild,
}: {
  el: BoardElement;
  camera: Camera;
  viewport: { width: number; height: number };
  onChange: (el: BoardElement) => void;
  onDone: () => void;
  /** Mind map nodes: Tab finishes and adds a child to type into next. */
  onAddChild?: () => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const isList = el.type === "list";
  const mind = el.type === "mindnode";
  const [value, setValue] = useState(() =>
    isList ? listToText(el.items ?? [{ text: "", indent: 0 }]) : (el.text ?? ""),
  );

  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  const update = (text: string) => {
    setValue(text);
    onChange(fitTextBox(isList ? { ...el, items: textToList(text) } : { ...el, text }));
  };

  /** Replaces the textarea's selection range and keeps the caret where it belongs. */
  const edit = (text: string, caret: number) => {
    update(text);
    requestAnimationFrame(() => textarea.current?.setSelectionRange(caret, caret));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onDone();
      return;
    }
    // Ctrl+Enter finishes, like most whiteboards.
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onDone();
      return;
    }
    // A mind map node finishes on Enter (Shift+Enter breaks the line); Tab also adds a child.
    if (mind && ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab")) {
      event.preventDefault();
      onDone();
      if (event.key === "Tab") onAddChild?.();
      return;
    }
    if (!isList) return;
    const input = event.currentTarget;
    const start = input.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const line = value.slice(
      lineStart,
      value.indexOf("\n", start) === -1 ? undefined : value.indexOf("\n", start),
    );
    const lead = /^ */.exec(line)?.[0] ?? "";

    if (event.key === "Enter") {
      // A new item at the same indent.
      event.preventDefault();
      const insert = `\n${lead}• `;
      edit(value.slice(0, start) + insert + value.slice(input.selectionEnd), start + insert.length);
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        const remove = Math.min(lead.length, INDENT.length);
        if (remove === 0) return;
        edit(
          value.slice(0, lineStart) + value.slice(lineStart + remove),
          Math.max(lineStart, start - remove),
        );
      } else if (lead.length < INDENT.length * 4) {
        edit(value.slice(0, lineStart) + INDENT + value.slice(lineStart), start + INDENT.length);
      }
    }
  };

  // Place a world-size box over the element: centered on it on screen, then scaled and turned.
  const c = worldToScreen(camera, center(el), viewport.width, viewport.height);
  const sticky = el.type === "sticky";
  const px = sticky ? layoutSticky(el).px : fontPx(el);
  const width = Math.max(el.width, px);
  const height = Math.max(el.height, px * (mind ? MIND_LINE_HEIGHT : lineHeightOf(el)));
  const mindText = el.textColor ?? MIND_TEXT_COLOR;

  return (
    <div
      className="absolute z-10"
      style={{
        left: c.x - width / 2,
        top: c.y - height / 2,
        width,
        height,
        transform: `scale(${camera.zoom}) rotate(${el.rotation}deg)`,
        transformOrigin: "center",
        opacity: el.opacity,
        background: sticky
          ? (el.fill ?? STICKY_DEFAULT)
          : mind
            ? (el.fill ?? undefined)
            : undefined,
        borderRadius: mind && el.fill ? Math.min(12, height / 2) : undefined,
      }}
    >
      <textarea
        ref={textarea}
        aria-label="Edit text"
        value={value}
        spellCheck
        onChange={(event) => update(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onDone}
        // Pointer presses inside the editor must not reach the canvas (that would close it).
        onPointerDown={(event) => event.stopPropagation()}
        wrap={el.autoWidth && !mind ? "off" : "soft"}
        className={cn(
          "block size-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none",
          { left: "text-left", center: "text-center", right: "text-right" }[
            isList ? "left" : mind ? "center" : (el.textAlign ?? "left")
          ],
        )}
        style={{
          fontFamily: fontStack(el.font ?? "sans"),
          fontSize: px,
          lineHeight: mind ? MIND_LINE_HEIGHT : lineHeightOf(el),
          letterSpacing: `${letterSpacingOf(el)}em`,
          fontWeight: weightOf(el),
          color: sticky
            ? "#3d3b4f"
            : mind
              ? el.fill
                ? mindText
                : displayColor(mindText)
              : displayColor(el.stroke),
          caretColor: "#5882ff",
          padding: sticky ? STICKY_PADDING : mind ? `${MIND_PAD_Y}px ${MIND_PAD_X}px` : 0,
          whiteSpace: el.autoWidth && !mind ? "pre" : "pre-wrap",
          tabSize: 4,
        }}
      />
    </div>
  );
}

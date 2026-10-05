import { isSafeSvgAttribute, isSafeSvgStyle, SVG_ALLOWED_ELEMENTS } from "@prism/shared";

// Node has no DOMParser, so this is a small XML tokenizer that rebuilds the document from the
// allowed elements and attributes only (rules in @prism/shared). It is strict on purpose: when
// in doubt it drops things, since a sanitized SVG only needs to look right, not round-trip.

const TAG =
  /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/y;
const ATTRIBUTE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const escapeText = (text: string) => text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = (value: string) =>
  value
    .replace(/&(?![a-zA-Z]+;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

/** Returns the cleaned SVG markup, or null if `source` isn't an SVG document. */
export function sanitizeSvg(source: string, keepStyles = true): string | null {
  // Doctypes (entities), comments, processing instructions and CDATA are dropped outright.
  const input = source
    .replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");

  let out = "";
  const open: string[] = [];
  /** Depth inside a dropped element; its whole subtree is skipped. */
  let skipping = 0;
  let sawRoot = false;
  let i = 0;

  while (i < input.length) {
    const lt = input.indexOf("<", i);
    const text = input.slice(i, lt === -1 ? input.length : lt);
    if (text && !skipping && open.length > 0) {
      // Text inside <style> is only kept if it's safe CSS.
      // An unsafe one restarts without any <style> elements.
      if (open.at(-1) === "style" && !isSafeSvgStyle(text)) return sanitizeSvg(source, false);
      out += escapeText(text);
    }
    if (lt === -1) break;

    TAG.lastIndex = lt;
    const match = TAG.exec(input);
    if (!match) {
      // A stray "<": keep it as text.
      if (!skipping && open.length > 0) out += "&lt;";
      i = lt + 1;
      continue;
    }
    i = TAG.lastIndex;
    const [, closing, name = "", rawAttributes = "", selfClosing] = match;

    if (closing) {
      if (skipping) {
        skipping--;
        continue;
      }
      // Close up to the matching open element; ignore a stray closing tag.
      const at = open.lastIndexOf(name);
      if (at === -1) continue;
      while (open.length > at) out += `</${open.pop()}>`;
      continue;
    }

    const allowed =
      SVG_ALLOWED_ELEMENTS.has(name) &&
      (sawRoot || name === "svg") &&
      (keepStyles || name !== "style");
    if (skipping || !allowed) {
      if (!selfClosing) skipping++;
      continue;
    }
    sawRoot = true;

    let attributes = "";
    for (const attribute of rawAttributes.matchAll(ATTRIBUTE)) {
      const [, attributeName = "", double, single, bare] = attribute;
      const value = double ?? single ?? bare ?? "";
      if (!isSafeSvgAttribute(name, attributeName, value)) continue;
      attributes += ` ${attributeName}="${escapeAttribute(value)}"`;
    }
    if (name === "svg" && open.length === 0 && !/\sxmlns="/.test(attributes)) {
      attributes += ' xmlns="http://www.w3.org/2000/svg"';
    }

    if (selfClosing) {
      out += `<${name}${attributes}/>`;
    } else {
      out += `<${name}${attributes}>`;
      open.push(name);
    }
  }

  if (!sawRoot) return null;
  while (open.length > 0) out += `</${open.pop()}>`;
  // xlink:href needs its namespace declared, or the browser won't parse the file.
  if (/\sxlink:/.test(out) && !/\sxmlns:xlink="/.test(out)) {
    out = out.replace("<svg", '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }
  return out;
}

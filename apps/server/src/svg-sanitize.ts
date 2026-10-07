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

/**
 * What sanitizeSvg would drop from `source`, described for an AI editor: elements that aren't
 * allowed (script, foreignObject, …) and unsafe attributes (event handlers, external links).
 * Empty when the markup is clean.
 */
export function unsafeSvgParts(source: string): string[] {
  const found = new Set<string>();
  const tag = new RegExp(TAG.source, "g");
  for (const [, closing, name = "", rawAttributes = ""] of source.matchAll(tag)) {
    if (closing) continue;
    if (!SVG_ALLOWED_ELEMENTS.has(name)) {
      found.add(`<${name}>`);
      continue;
    }
    for (const [, attributeName = "", double, single, bare] of rawAttributes.matchAll(ATTRIBUTE)) {
      if (!isSafeSvgAttribute(name, attributeName, double ?? single ?? bare ?? "")) {
        found.add(`${attributeName} on <${name}>`);
      }
    }
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) found.add("a DOCTYPE or entity declaration");
  return [...found];
}

/** The size an SVG declares: width/height, else its viewBox, else 300 × 150 (as browsers do). */
export function svgSize(markup: string) {
  const root = /<svg\b([^>]*)>/i.exec(markup)?.[1] ?? "";
  const attribute = (name: string) =>
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(root)?.[1];
  const length = (name: string) => {
    const raw = attribute(name);
    const value = Number.parseFloat(raw ?? "");
    return raw && !raw.endsWith("%") && Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const box = attribute("viewBox")
    ?.split(/[\s,]+/)
    .map(Number);
  const fromBox = box?.length === 4 && box.every(Number.isFinite) ? box : undefined;
  return {
    width: length("width") ?? fromBox?.[2] ?? 300,
    height: length("height") ?? fromBox?.[3] ?? 150,
  };
}

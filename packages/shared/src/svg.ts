// The SVG sanitizing rules (tools.md §1, tool 17). The browser applies them with DOMParser before
// uploading and the server applies them again before storing, so a file that skips the client
// still can't carry script. On top of that the file is shown through <image href> and served with
// `script-src 'none'`, where nothing inside it can run anyway.

/** Elements kept; anything else (script, foreignObject, a, iframe, feImage, …) is dropped with its content. */
export const SVG_ALLOWED_ELEMENTS = new Set([
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "symbol",
  "use",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "textPath",
  "linearGradient",
  "radialGradient",
  "stop",
  "pattern",
  "clipPath",
  "mask",
  "marker",
  "image",
  "style",
  "filter",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
]);

const ATTRIBUTE_NAME = /^[a-zA-Z_][\w:.-]*$/;
/** An inline raster image; the only non-fragment link allowed (on <image>). */
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]*$/i;
/** url(...) that points anywhere but a fragment in this file. */
const EXTERNAL_URL = /url\s*\(\s*['"]?\s*(?!#)/i;
const SCRIPTY =
  /javascript:|vbscript:|data:text|expression\s*\(|@import|behavior\s*:|-moz-binding/i;

/** Whether an attribute may stay on an element. `value` is the raw attribute text. */
export function isSafeSvgAttribute(element: string, name: string, value: string) {
  if (!ATTRIBUTE_NAME.test(name)) return false;
  const lower = name.toLowerCase();
  // Event handlers: onload, onclick, onbegin, …
  if (lower.startsWith("on")) return false;
  // Entity-encoded text could hide "javascript:"; nothing legitimate needs it in a link.
  const compact = [...value].filter((ch) => ch.charCodeAt(0) > 0x20).join("");
  if (lower === "href" || lower.endsWith(":href")) {
    if (compact.startsWith("#")) return true;
    return element === "image" && DATA_IMAGE.test(value.trim());
  }
  if (SCRIPTY.test(compact)) return false;
  if (EXTERNAL_URL.test(value)) return false;
  // Animation targets could rewrite href; there are no animation elements, but be explicit.
  if (lower === "attributename") return false;
  return true;
}

/** Whether a <style> element's text is safe to keep. */
export function isSafeSvgStyle(css: string) {
  return !SCRIPTY.test(css.replace(/\s/g, "")) && !EXTERNAL_URL.test(css);
}

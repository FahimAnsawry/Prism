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
/** CSS functions that load a file from a string, without url(). */
const LOADS_FILE = /(?:-webkit-)?image-set\s*\(|\bsrc\s*\(/i;

/**
 * CSS with its escapes decoded (`\75 rl(` is `url(`) and comments dropped, so the checks below
 * see what the browser will read.
 */
function decodeCss(css: string) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(
      /\x5c([0-9a-fA-F]{1,6})\s?|\x5c([^\n0-9a-fA-F])/g,
      (_, hex?: string, char?: string) => {
        if (char !== undefined) return char;
        const code = Number.parseInt(hex ?? "", 16);
        return String.fromCodePoint(code > 0 && code <= 0x10ffff ? code : 0xfffd);
      },
    );
}

/** Whether CSS (a <style> or a style attribute's text) could run script or load a file. */
function isUnsafeCss(css: string) {
  const decoded = decodeCss(css);
  return (
    SCRIPTY.test(decoded.replace(/\s/g, "")) ||
    EXTERNAL_URL.test(decoded) ||
    LOADS_FILE.test(decoded)
  );
}

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
  // Presentation attributes and `style` hold CSS too.
  if (isUnsafeCss(value)) return false;
  // Animation targets could rewrite href; there are no animation elements, but be explicit.
  if (lower === "attributename") return false;
  return true;
}

/** Whether a <style> element's text is safe to keep. */
export function isSafeSvgStyle(css: string) {
  return !isUnsafeCss(css);
}

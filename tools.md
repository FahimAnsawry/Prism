# Prism: Tools List

The full list of tools for the custom whiteboard, built **without any drawing library** (no Excalidraw, tldraw, Konva or Fabric.js).
Everything is drawn with React + plain SVG + standard browser APIs. The server is Node + Socket.IO.
Shortcuts are suggestions based on common whiteboard conventions.

---

## 1. Canvas toolbar (left side)

| # | Tool | Shortcut | What it does | Creates element | How to build it (no library) | Difficulty |
|---|------|----------|--------------|-----------------|------------------------------|------------|
| 1 | Select | `V` | Click to select, drag to move, Shift+click to add, drag on empty canvas for marquee select | none | Pointer events (`pointerdown/move/up`) + hit-testing on each element's bounds; marquee = rectangle intersection test; selection box with 8 resize handles + 1 rotate handle | Medium |
| 2 | Hand (pan) | `H` / hold `Space` | Drag to pan the canvas | none | Camera `{x, y, zoom}` applied as one SVG `transform` on a root `<g>`; wheel = pan, Ctrl+wheel = zoom toward the cursor | Easy |
| 3 | Text | `T` | Click to place a text box and type | `text` | While editing: an HTML `<textarea>` positioned over the canvas. After: SVG `<text>` with one `<tspan>` per line. Measure width with a hidden `<canvas>` `measureText()` for wrapping | Hard |
| 4 | Handwriting | `W` | Text in the Caveat handwriting font | `text` (font: `caveat`) | Same as Text with `font: "caveat"`; load Caveat with CSS `@font-face` (self-host the font file) | Easy (after Text) |
| 5 | Sticky note | `N` | Click to drop a colored note with text | `sticky` | `<rect>` + wrapped text; shrink the font size step by step until the text fits; 6 color presets | Medium |
| 6 | Bullet list | `B` | Text box that starts as a bulleted list | `list` | Store items as `{text, indent}[]`; render "•" + text per line; Enter = new item, Tab = indent, Shift+Tab = outdent | Medium |
| 7 | Rectangle | `R` | Drag to draw a box; Shift = square | `rect` | `<rect rx>` from drag start/end points | Easy |
| 8 | Ellipse | `O` | Drag to draw an ellipse; Shift = circle | `ellipse` | `<ellipse>` centered in the drag box | Easy |
| 9 | Diamond | `D` | Drag to draw a diamond (decision shape) | `diamond` | `<polygon>` with the 4 edge midpoints of the drag box | Easy |
| 10 | Line | `L` | Drag to draw a straight line; Shift = snap to 15° | `line` | `<line>`; snap by rounding `atan2` angle to 15° steps | Easy |
| 11 | Arrow | `A` | Drag to draw an arrow; snaps to shapes and stays attached when they move | `arrow` | `<path>` + `<marker>` arrowhead in `<defs>`; store `startBinding` / `endBinding` element ids; on move, recompute the endpoint where the line meets the shape's edge | Medium |
| 12 | Pencil (freehand) | `P` | Freehand drawing | `freehand` | Collect pointer points (use `getCoalescedEvents()` for smoothness), drop points closer than 2px, then smooth into a `<path>` with quadratic curves through the midpoints of each pair of points | Medium |
| 13 | Eraser | `E` | Drag over elements to delete them | none | For each pointer move, test shapes by bounds and strokes by distance from the pointer to each segment; deletions grouped into one undo step | Medium |
| 14 | Emoji | `M` | Opens a picker; click to place an emoji | `emoji` | Picker = a hard-coded array of a few hundred emoji in a grid with category tabs; render as large SVG `<text>` | Easy |
| 15 | Image | `I` | Upload, paste or drag-drop an image | `image` | `<input type="file">`, `paste` and `drop` events; upload to the Node server (`/uploads`), render with SVG `<image href>`; keep aspect ratio on resize | Easy |
| 16 | Chart | `C` | Insert a bar, line, pie or donut chart, then edit its data in a side panel | `chart` | Scale data to the box yourself: bars = `<rect>`, line = `<polyline>`, pie/donut = `<path>` arcs (`A` command) from cumulative angles; data editor = a plain editable HTML table | Medium |
| 17 | SVG | `S` | Upload, paste or drag-drop an `.svg` file; it stays sharp at any zoom | `svg` | Read the file as text, parse it with `DOMParser` and sanitize it: drop `<script>`, `<foreignObject>`, `on*` attributes and external `href`s. Upload the cleaned file to the Node server (`/uploads`, which sanitizes again and serves it with `Content-Security-Policy: script-src 'none'`), then render with SVG `<image href>` so nothing inside it can run; size it from its `viewBox` and keep aspect ratio on resize. Later: "Convert to shapes" turns its `rect`/`ellipse`/`line`/`path` nodes into editable elements | Medium |

---

## 2. Core engine pieces (needed by every tool)

| Piece | What it does | How to build it |
|-------|--------------|-----------------|
| Camera | Pan and zoom | `{x, y, zoom}`; `screenToWorld(p) = (p - offset) / zoom` and `worldToScreen` as the inverse |
| Element store | All elements on the board | A `Map<id, Element>` in React state (`useReducer` or context); render elements sorted by `z` |
| Hit-testing | Which element is under the pointer | Rotate the pointer into the element's local space, then test bounds; strokes and lines by distance to segments |
| Transform handles | Resize and rotate | Resize = recompute `x, y, width, height` from the dragged handle; rotate = `atan2` from the element center; multi-select = transform each element relative to the group's bounding box |
| Tool state machine | Which tool is active and what the pointer is doing | One object per tool with `onPointerDown/Move/Up` handlers; states such as `idle → drawing → done` |
| History (undo/redo) | Undo any change | Two stacks of operations `{id, before, after}`; group operations per user action; one Claude command = one undo step |
| Clipboard | Copy, paste, duplicate | `navigator.clipboard.writeText(JSON)` and `readText()`; paste images through the `paste` event |
| Sketch renderer | Hand-drawn look | For each edge, split it into a few segments and offset the points by a small random amount; draw the outline twice; use a seeded random generator (seed = element id) so the wobble doesn't change on every render |
| Export | PNG, SVG, JSON | SVG = `XMLSerializer` on the `<svg>` (with fonts embedded); PNG = draw that SVG on a `<canvas>` via `Image`, then `canvas.toBlob()`; JSON = the element store |
| Sync | Real-time updates | Socket.IO events `element:create/update/delete` carrying `{id, version, changes}`; the higher `version` wins |

---

## 3. Properties panel (shown when something is selected)

| Property | Applies to | Values |
|----------|-----------|--------|
| Stroke color | all shapes, lines, arrows, freehand | Palette of 8 + custom (`<input type="color">`) |
| Fill color | rect, ellipse, diamond, sticky | Palette + none |
| Stroke width | shapes, lines, arrows, freehand | Thin / medium / thick |
| Stroke style | shapes, lines, arrows | Solid / dashed / dotted (`stroke-dasharray`) |
| **Sketch mode** | rect, ellipse, diamond, line, arrow | On / off: hand-drawn look from the sketch renderer (section 2) |
| Font | text, sticky, list | Sans / Caveat (handwriting) / Mono |
| Font size | text, sticky, list | S / M / L / XL |
| Text align | text, sticky, list | Left / center / right (`text-anchor`) |
| Opacity | all | 0–100% |
| Layer order | all | Bring forward / send backward / to front / to back (change `z`) |
| Lock | all | Locked elements can't be moved or edited |

---

## 4. Editing actions

| Action | Shortcut | Notes |
|--------|----------|-------|
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` | History stacks (section 2) |
| Copy / Paste | `Ctrl+C` / `Ctrl+V` | Paste at the cursor; pasting an image creates an `image` element |
| Duplicate | `Ctrl+D` | Copy offset by 16px |
| Delete | `Delete` / `Backspace` | |
| Select all | `Ctrl+A` | |
| Group / Ungroup | `Ctrl+G` / `Ctrl+Shift+G` | Store `groupId` on elements |
| Move | Arrow keys (`Shift` = 10px) | |
| Resize | Drag handles (`Shift` = keep ratio) | |
| Rotate | Drag rotate handle (`Shift` = 15° steps) | Store `rotation` in degrees |

---

## 5. Top bar

| Control | What it does |
|---------|--------------|
| Back | Return to the board list |
| Board name | Click to rename |
| Undo / Redo | Same as the shortcuts |
| Grid toggle | Show or hide the dot grid (an SVG `<pattern>`); snap to grid when on |
| Zoom − / % / + | Zoom out, reset to 100%, zoom in; `Shift+1` = zoom to fit |
| AI | Opens the "Ask Claude" box for the current selection (select-and-edit) |
| Export | PNG, SVG or JSON of the whole board, a frame or the selection |
| Share | Copy a room link (real-time collaboration, later phase) |

---

## 6. Claude MCP tools (used by Claude Code, not shown in the UI)

| Tool | Purpose |
|------|---------|
| `open_board` | Create or open a board and open it in the browser |
| `list_boards` | List saved boards |
| `get_board` | Read a board or one frame as simplified JSON |
| `create_screen` | Main drawing tool: send a layout tree (row, stack, grid, gap, padding); the server computes positions |
| `create_elements` | Low-level: create elements with exact x/y |
| `update_elements` | Change props, text, size or position by id |
| `delete_elements` | Remove elements by id |
| `get_selection` | What the user currently has selected |
| `get_pending_edits` | Read queued "Ask Claude" requests from the AI box |
| `complete_edit` | Mark a request done or failed, with a short note shown in the browser |
| `export_image` | PNG of a frame, the selection or given ids (Claude sees it inline) |
| `export_reference` | Write `reference.json`, PNGs and `REFERENCE.md` for building the real UI |

---

## 7. Element data model (shared by all tools)

```ts
type ElementType =
  | "text" | "sticky" | "list" | "rect" | "ellipse" | "diamond"
  | "line" | "arrow" | "freehand" | "emoji" | "image" | "svg" | "chart" | "frame";

interface BaseElement {
  id: string;          // crypto.randomUUID()
  type: ElementType;
  x: number; y: number; width: number; height: number;
  rotation: number;    // degrees
  z: number;           // layer order
  stroke: string; fill: string | null;
  strokeWidth: number; strokeStyle: "solid" | "dashed" | "dotted";
  sketch: boolean;     // hand-drawn look
  opacity: number;
  groupId?: string; locked?: boolean;
  role?: string;       // wireframe meaning: "button", "input", "card", ...
  updatedBy: "user" | "ai_agent";
  version: number;     // for conflict checks during sync
}
```

---

## 8. Dependencies

**Required (not drawing libraries):**

| Package | Used for |
|---------|----------|
| `react`, `react-dom` | UI |
| `vite` | Dev server and build |
| `socket.io` / `socket.io-client` | Real-time sync between browser, server and the MCP bridge (plain `WebSocket` + `ws` also works) |
| `@modelcontextprotocol/sdk` | MCP server for Claude Code |

**Replaced with your own code:**

| Instead of | Use |
|------------|-----|
| Excalidraw / tldraw / Konva / Fabric.js | React + SVG engine (sections 1–2) |
| `perfect-freehand` | Midpoint quadratic smoothing (tool 12) |
| `roughjs` | Seeded wobble sketch renderer (section 2) |
| `nanoid` | `crypto.randomUUID()` |
| `emoji-picker-react` | Hard-coded emoji grid (tool 14) |
| Chart libraries | SVG rect / polyline / arc math (tool 16) |
| `zustand` | React `useReducer` + context |

**Optional upgrades later:** `perfect-freehand` (pressure-style strokes) and `roughjs` (more polished sketch look). Both are tiny and MIT-licensed. Swap them in only if your own versions don't look good enough.

**Font:** Caveat (SIL Open Font License), self-hosted.

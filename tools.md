# Prism: Tools List

The full list of tools for the custom whiteboard, built **without any drawing library** (no Excalidraw, tldraw, Konva or Fabric.js).
Everything is drawn with React + plain SVG + standard browser APIs. The server is Node + Socket.IO.
Shortcuts are suggestions based on common whiteboard conventions.

---

## 1. Canvas toolbar (left side)

| # | Tool | Shortcut | What it does | Creates element | How to build it (no library) | Difficulty |
|---|------|----------|--------------|-----------------|------------------------------|------------|
| 1 | Select | `V` | Click to select, drag to move, Shift+click to add, drag on empty canvas for marquee select | none | Pointer events (`pointerdown/move/up`) + hit-testing on each element's bounds; marquee = rectangle intersection test; selection box with 8 resize handles + 1 rotate handle | Medium |
| 2 | Hand (pan) | `H` / hold `Space` / right- or middle-drag | Drag to pan the canvas; right- and middle-drag and `Space`+drag pan with any tool | none | Camera `{x, y, zoom}` applied as one SVG `transform` on a root `<g>`; wheel (and Ctrl+wheel, a trackpad pinch) = zoom toward the cursor | Easy |
| 3 | Text | `T` | Click to place a text box and type | `text` | While editing: an HTML `<textarea>` positioned over the canvas. After: SVG `<text>` with one `<tspan>` per line. Measure width with a hidden `<canvas>` `measureText()` for wrapping | Hard |
| 4 | Handwriting | `W` | Text in a handwriting font (Caveat by default) | `text` (font: `caveat`) | Same as Text with `font: "caveat"`; the panel's "Handwriting style" switches between Caveat, Nanum Pen, Kalam, Patrick Hand and Indie Flower (all self-hosted with `@fontsource`) | Easy (after Text) |
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
| 18 | Icon | `K` | Opens a searchable picker of Lucide icons; click to place one. Color, fill and line weight come from the properties panel | `icon` | Store the Lucide name (`icon: "search"`). Lucide's name → loader catalog and each icon's shapes load lazily (`lucide-react/dynamic`) and are cached; render the icon node as a nested `<svg viewBox="0 0 24 24">` in the element's box, keeping aspect ratio on resize | Easy |
| 19 | Mind map | `G` | Click to place a central topic and type. With a node selected: Tab adds a child, Enter a sibling, F2 edits; typing, Enter finishes (Shift+Enter breaks the line) and Tab finishes and adds a child. Dragging a node takes its branch along, deleting it deletes the branch, the toggle at a branch end folds it away | `mindnode` | Nodes store `parentId` (and `collapsed`); branches aren't stored but drawn as cubic curves from each node to its parent, so they follow every move. Levels are styled like XMind (dark central topic, tinted main branches, underlined sub-topics). A tidy layout (`packages/shared/src/mindmap.ts`) spreads branches right and left, keeping each on its side and in its order; it reruns when nodes are added, resized by typing, folded or deleted, and from the panel's "Tidy up" | Medium |

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
| Stroke color | all shapes, lines, arrows, freehand; **text color** on text, handwriting and lists (bullets included) | Palette of 8 + the board's saved colors + "+" |
| Fill color | rect, ellipse, diamond, sticky | Palette + the board's saved colors + "+" + none |
| Stroke width | shapes, lines, arrows, freehand | Thin / medium / thick |
| Stroke style | shapes, lines, arrows | Solid / dashed / dotted (`stroke-dasharray`) |
| Shadow | rect, ellipse, diamond, frame, image, SVG, chart | None / small / medium / large (`shadow: "sm" \| "md" \| "lg"`): an SVG `<filter>` per element that blurs the shape's alpha, offsets it down and tints it, one or two layers per preset |
| **Sketch mode** | rect, ellipse, diamond, line, arrow | On / off: hand-drawn look from the sketch renderer (section 2) |
| Font | text, sticky, list | Dropdown grouped Sans (DM Sans, Inter, Roboto, Open Sans, Montserrat, Poppins, Lato) / Serif (Playfair Display, Merriweather) / Mono (Space Mono) / Handwriting (Caveat, Nanum Pen, Kalam, Patrick Hand, Indie Flower), all self-hosted; plus Google fonts added to the board by name (stored as `font: "gf:<Family>"`) |
| Font weight | text, sticky, list | The weights the chosen font ships (Light 300 to Black 900), each previewed as "Aa" in itself; stored as a number in `fontWeight` (older `"normal"` / `"bold"` still read as 400 / 700). Switching fonts moves the weight to the new font's closest one. Added Google fonts offer Regular / Bold |
| Handwriting style | text, sticky, list using a handwriting font | The five handwriting fonts, each previewed in itself |
| Font size | text, sticky, list | S / M / L / XL presets, or a free size in px (6–400, stored as `fontSizePx`, which wins over the preset). Dragging a text or list by a corner or the top / bottom handle scales its text freely (the opposite corner stays put); the left / right handles change the wrap width. Group resizes from a corner scale text too |
| Text align | text, sticky, list | Left / center / right (`text-anchor`) |
| Line height | text, sticky, list | 50–300% of the text size (default 125%), stored as a multiple in `lineHeight`; sets the gap between `<tspan>` lines and the editor's `line-height` |
| Letter spacing | text, sticky, list | −20% to 100% of the text size (default 0), stored in ems in `letterSpacing`; drawn with CSS `letter-spacing` and added per character to the `measureText()` width so wrapping still matches |
| Opacity | all | 0–100% |

**Custom colors.** "+" opens a hand-built picker (saturation/brightness square, hue strip, editable hex accepting `#RGB`/`#RRGGBB`). "Add" applies the color and saves it to the board (`board.customColors`, newest first, max 16, removable), so everyone editing the board sees the same swatches. Added Google fonts are saved the same way (`board.customFonts`, max 20) via `PATCH /api/boards/:id/style`. Fonts load (`document.fonts.load`) before text using them is measured.
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
| Zoom in / out / 100% / fit | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` / `Shift+1` | Around the middle of the view; fit never zooms past 100% |
| Collapse / show toolbar | `Ctrl+B` | Folds the tool rail down to the active tool; tool shortcuts still work. The choice is remembered |
| Shortcut list | `?` | A dialog with every tool key, canvas gesture and editing shortcut |

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
| `create_project` | Create a project: the boards of one app, sharing one theme |
| `get_theme` | A project's theme: shadcn/ui color tokens (light and dark), radius, fonts and the type scale (`$display`, `$h1`–`$h4`, `$body-lg`, `$body`, `$body-sm`, `$caption`, `$label`; exported as Tailwind `--text-*` so `$h1` codes as `text-h1`) as `$tokens` with their values, plus the Tailwind v4 CSS for the app's global CSS |
| `set_theme` | Set a project's theme from the app's global CSS (`:root` / `.dark` variables, `var()` followed) and/or changed values. Colors, radius and fonts in `create_screen`, `create_elements` and `update_elements` take `$tokens` (`$primary`, `$radius-lg`, `$heading`); text takes `textStyle: "$h2"`; elements remember them (`tokens`), so `get_board` reads `$primary` back for the code (`bg-primary`). A saved theme is strict by default: the drawing tools refuse plain colors, radius, fonts and text sizes on UI elements (not stickies, arrows, mind maps or charts); `set_theme { strict: false }` turns it off |
| `list_boards` | List saved boards |
| `define_component` | Define a project component (Button, Input, Card, Sidebar, …): a layout tree with `{{prop}}` placeholders, named variants (prop sets) and `slot` nodes for content. Every variant is checked to lay out and, in a strict project, to use the theme's tokens |
| `list_components` / `delete_component` | Read a project's components (with a ready `use` node for each) / remove one no other component uses |
| `get_board` | Read a board or one frame as simplified JSON |
| `create_mindmap` | A mind map from a nested outline (or new branches under an existing node via `parentId`): nodes styled by level, sized by an open board tab's text measuring (`layout:mindmap`) or estimated, the whole map tidied, one undo step |
| `create_screen` | Main drawing tool: send a layout tree and get positioned elements. `{ type: "use", component, variant, props, children }` places a project component (expanded server-side; each instance is one group and its elements carry `component`, e.g. `Sidebar > NavItem:active`). Containers `stack` / `row` / `grid` (gap, padding, align, justify, width/height as px, `"fill"` or hug, optional background with fill, stroke, radius, shadow); leaves `text`, `icon`, `box`, `spacer` (fixed or flexible), `divider`. The engine (`packages/shared/src/layout.ts`) is a small flexbox; an open board tab runs it with the canvas's own text measuring (`layout:screen` over Socket.IO), else the server estimates text widths. Optional device frame; the screen is one undo step |
| `create_elements` | Low-level: create elements with exact x/y |
| `update_elements` | Change props, text, size or position by id |
| `delete_elements` | Remove elements by id |
| `get_selection` | What the user currently has selected |
| `get_pending_edits` | Read queued "Ask Claude" requests from the AI box |
| `complete_edit` | Mark a request done or failed, with a short note shown in the browser |
| `export_image` | PNG of a frame, given ids or the whole board (Claude sees it inline). The user's open board tab draws it over Socket.IO (`export:image` with an ack): the canvas's own `ElementShape` into an offscreen SVG, computed colors inlined, images and the used `@font-face` subsets embedded as data URLs, then drawn on a `<canvas>`. PNG, or JPEG when large |
| `export_reference` | Write `reference.json`, PNGs and `REFERENCE.md` for building the real UI |

---

## 7. Element data model (shared by all tools)

```ts
type ElementType =
  | "text" | "sticky" | "list" | "rect" | "ellipse" | "diamond"
  | "line" | "arrow" | "freehand" | "emoji" | "image" | "svg" | "chart" | "frame" | "icon"
  | "mindnode";

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
  tokens?: { stroke?, fill?, textColor?, radius?, font?, textStyle? }; // theme tokens behind those values (packages/shared/src/theme.ts)
  component?: string;  // the project component instance that drew it (packages/shared/src/components.ts)
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

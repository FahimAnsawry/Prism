# Prism: Future Implementation

The plan for turning Prism into a **UI reference tool** driven by Claude Code.
Read `tools.md` first: this file adds to it and follows the same rules (§8, no drawing libraries).

---

## Goal

1. **UI reference:** take visual references from Mobbin and create a **new** screen inspired by them (for example, 3 Mobbin screens → 1 new concept).
2. **User flows:** screens connected by labeled arrows and decisions.
3. **Database design:** table (ER) diagrams.
4. **Text reference:** one exported spec folder that Claude Code reads to build the real UI.

---

## Approach

Follow **Miro's approach** (HTML for screens, native board items, Mermaid for diagrams), not MagicPath's (live code components on the canvas).

| | MagicPath approach | Miro approach (chosen) |
|---|---|---|
| New screen from references | Live React components; changed only by re-prompting | Static HTML converted into editable Prism elements |
| User flows and ER diagrams | Not its focus | Mermaid `flowchart` and `erDiagram` |
| Security | Runs generated code in the browser | Static HTML, scripts stripped, nothing runs |
| Fits the SVG engine | No, needs a live iframe layer | Yes, everything ends up as normal elements |

**Key rules:**

- Claude writes what it writes best: **HTML + CSS** for screens, **Mermaid** for diagrams. It never computes x/y by hand.
- Everything Claude creates becomes **normal, editable Prism elements**. Export, sync and undo work unchanged.
- `get_board` returns the **same formats** Claude writes (HTML, Mermaid), with element ids, so Claude can read, change and write back.

**Full workflow:**

```
3 Mobbin screens → images in a "References" frame → Claude analyzes them (sticky notes)
→ Claude writes a new screen as static HTML/CSS
→ Prism converts it into editable elements in a "Concept" frame
→ the user refines it on the board
→ export_reference → .prism/specs/ (HTML + PNG + Mermaid + REFERENCE.md)
```

---

## Phase 1: MCP bridge

The foundation. Every later phase is an MCP tool on top of it.

| Item | Details |
|------|---------|
| Package | New workspace package `packages/mcp` using `@modelcontextprotocol/sdk` |
| Connection | Connects to the server with `socket.io-client` and sends normal `element:create/update/delete` events `{id, version, changes}` with `updatedBy: "ai_agent"` |
| Auth | A personal API token per user; the bridge can only access that user's boards |
| Tools | `list_boards`, `open_board`, `get_board`, `create_elements`, `update_elements`, `delete_elements`, `get_selection` |
| Undo | One Claude command = one undo step (tools.md §2) |

**Done when:** Claude Code draws a rectangle on an open board and it appears live in the browser.

---

## Phase 2: Mobbin references on the board

| Item | Details |
|------|---------|
| MCP tool | `add_image({ boardId, frameId, url })` |
| Server | Downloads the image into S3 storage (`apps/server/src/storage.ts`) and creates an `image` element |
| Flow | Claude searches with the Mobbin MCP (`search_screens`, `search_flows`), places 3 screens in a "References" frame and writes its analysis as sticky notes next to each one ("Ref A: big balance card") |
| Licensing | Keep Mobbin screenshots private, as inspiration only. Check Mobbin's terms. Never include them in shipped output |

**Done when:** "Get 3 banking home screens from Mobbin" fills a frame on the board.

---

## Phase 3: HTML → editable screen (core feature)

| Item | Details |
|------|---------|
| MCP tool | `create_screen({ frameId, device: "mobile" \| "tablet" \| "desktop", html })` |
| Input | Static HTML + inline CSS. No scripts and no event handlers. Interactivity is limited to CSS `:hover`/`:focus` |
| Sanitize | Strip `<script>`, `on*` attributes and external resources except images (same approach as `svg-sanitize.ts`) |
| Render | In the browser, load the HTML into a hidden `<iframe sandbox="allow-same-origin">` (no `allow-scripts`, so nothing can run, but Prism can still read its layout) at the device width |
| Convert | Walk the DOM and read `getBoundingClientRect()` + `getComputedStyle()` for each node |
| Mapping | Box with background or border → `rect` (radius, fill, stroke) · text → `text` (font, size, weight, color) · `<img>` → `image` · inline `<svg>` → `svg` |
| Semantics | Set `role` from the tag or `data-role` (`button`, `input`, `nav`, `card`, …) and group the screen inside the frame |
| Look | A **clean render mode** (`sketch: false`) plus **shadow** support so screens look like real UI |
| Fonts | Map CSS `font-family` to the fonts Prism already ships (Inter, Roboto, Poppins, …) |

**v1 scope:** boxes, text, images and icons. **v2:** gradients, shadows, per-corner radius.

**Done when:** Claude writes a screen inspired by the 3 references, and the user can drag its button around on the board.

---

## Phase 4: User flows and ER diagrams (Mermaid)

| Item | Details |
|------|---------|
| MCP tool | `create_diagram({ frameId, mermaid })` |
| Parser | A hand-written parser for a small Mermaid subset. `flowchart`: nodes, edges, edge labels, decision (diamond) shapes. `erDiagram`: tables, columns, PK/FK, relationships |
| New element | `table`: a name plus rows of `{name, type, pk, fk, nullable}` for ER entities |
| Relations | Arrows bound to tables (existing `startBinding`/`endBinding`) with cardinality markers (one, many, crow's foot) |
| Layout | A simple hand-written layered layout, or allow `dagre` as a **layout-only** dependency (add it to tools.md §8 if chosen) |
| Bonus | `import_prisma_schema` draws `apps/server/prisma/schema.prisma` as an ER diagram; `export_prisma_schema` turns a diagram back into a schema |

**Done when:** Claude draws a login flow and the database tables for it from Mermaid code.

---

## Phase 5: Read-back and export

| Item | Details |
|------|---------|
| `get_board` | Returns screens as HTML and diagrams as Mermaid, with element ids |
| `export_image` | PNG of a frame, the selection or given ids, so Claude can compare its result with the references |
| `export_reference` | Writes the spec folder below |

```
.prism/specs/<board>/
  REFERENCE.md      ← screens, annotations, "idea ← from Ref A", flows, tables
  screens/*.html    ← each concept screen
  screens/*.png
  flows/*.mmd
  database.mmd      ← or schema.prisma
```

**Done when:** Claude Code builds a real screen in the app using only the spec folder.

---

## Order and effort

| Phase | Effort | Value |
|-------|--------|-------|
| 1. MCP bridge | Medium | Everything depends on it |
| 2. Mobbin images | Small | Quick win |
| 3. HTML → elements | **Large** | Core of the product |
| 4. Mermaid flows + ER | Medium-large | Covers user flows and database design |
| 5. Read-back + export | Medium | Closes the loop with Claude Code |

---

## Not planned

- **Live code components on the canvas (MagicPath style).** Mobbin already provides the hi-fi visuals, and live iframes bring security, performance and export problems. Revisit only if converted screens don't look polished enough.

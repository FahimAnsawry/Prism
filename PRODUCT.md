# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers who use Claude Code and want to plan UI visually before writing it. They work with a terminal (Claude Code) and a browser (the Prism board) side by side. They sketch, wireframe and diagram on the board, Claude draws and edits on the same board, and the result is handed back to Claude Code to build the real interface.

Real-time collaboration with teammates is supported, but teams are a secondary audience, not the primary one.

## Product Purpose

Prism is a real-time whiteboard and wireframing tool where Claude is a first-class participant. It exists so a developer and Claude can work out a screen, flow or plan in one shared visual space, then turn that plan into code without retyping it.

Success means a developer goes from an idea to a board Claude helped draw to a built UI, and the board and the code don't drift apart.

Slogan: "One idea broken into many views." One idea can take many forms on the board: a wireframe, a flowchart, notes, a sketch or a chart.

## Positioning

Claude works on the board through an MCP bridge rather than as a chat sidebar. It can open boards, read a board or frame, draw whole screens from a layout tree (`create_screen`), edit elements by id, see what the user has selected, and answer "Ask Claude" requests made on a selection in the browser. It can also export a reference package (`reference.json`, PNGs, `REFERENCE.md`) for building the real UI. Every element records whether a user or Claude last changed it, and wireframe elements can carry a semantic `role` (button, input, card), so the board is readable by code, not just by eye.

Prism is open source and self-hostable, and the drawing engine is written from scratch in React and plain SVG.

## Operating Context

- Used next to Claude Code during development: the developer asks Claude to wireframe something, watches it appear, adjusts it by hand or with "Ask Claude", and then asks Claude Code to build from the exported reference.
- Boards hold frames, shapes, attached arrows, freehand strokes, text, handwriting, sticky notes, bullet lists, emoji, images and charts. An optional sketch mode gives shapes a hand-drawn look.
- Sharing a room link brings teammates onto the same board with live cursors and instant sync. Room-link sharing is a later phase.
- Self-hosters need a Neon PostgreSQL project, Google and GitHub OAuth apps, and an S3-compatible bucket (Neon Object Storage by default, Cloudflare R2 also works).

## Capabilities and Constraints

- The full tool list, engine pieces, properties, data model and dependency rules are in `tools.md`; that file is the product spec.
- No drawing libraries (Excalidraw, tldraw, Konva, Fabric.js). Also excluded: `zustand`, `nanoid`, `perfect-freehand`, `roughjs`, `emoji-picker-react` and chart libraries; each has a hand-written replacement.
- Sync events are `element:create/update/delete` carrying `{id, version, changes}`; the higher `version` wins. One Claude command is one undo step.
- Exports: PNG, SVG and JSON of a board, a frame or the selection.
- Sign-in with Google, GitHub or email and password.
- Current state: the landing page, login and signup exist. The board editor and the MCP bridge are not built yet.
- Undecided: the open-source license (no LICENSE file yet), and whether a hosted version will be offered.

## Brand Commitments

- Name: **Prism** (formerly Wireboard). Slogan: "One idea broken into many views."
- Logo: the Facets mark, a triangle cut into four facets with a brand-green center (`apps/client/src/components/prism-logo.tsx`, `apps/client/public/favicon.svg`). Chosen on 2026-10-04 from three concepts on the Miro board "Prism · Landing + Login" (frames 07 and 08).
- The prism-refraction idea (one beam labelled Idea splitting into wireframe, flowchart, notes, sketch and chart) is the product's central metaphor and already appears on the auth screens.
- Claude is named as a collaborator in product copy (live cursor labelled "Claude", "Ask Claude").

## Evidence on Hand

- Product spec: `tools.md`. Setup guide: `README.md`.
- Mobbin references and mockups for the landing, login and logo work live on the Miro board "Prism · Landing + Login".
- There are no users, customers, testimonials, usage numbers, benchmarks, press or pricing yet. Do not invent any. Names on the landing-page demo board (for example cursor labels) are illustrative, not real users.

## Product Principles

1. **Claude is a participant, not a feature.** Anything a person can do on the board, Claude should be able to read or do through the bridge, and its work should be visible and undoable like anyone else's.
2. **The board is the spec.** Boards should carry enough meaning (frames, roles, references) that code can be built from them without retyping.
3. **Built by hand, in the open.** Hand-written SVG and browser APIs instead of drawing libraries, so the engine stays small, inspectable and self-hostable.
4. **Fast enough to think in.** Drawing, syncing and Claude's edits should keep up with the speed of an idea; anything that slows sketching down is a bug.

## Accessibility & Inclusion

Target WCAG 2.2 AA for all page UI (marketing, auth, menus, panels, dialogs): contrast, keyboard access, visible focus, labels and reduced motion. The drawing canvas gets best-effort keyboard support (the tool shortcuts and arrow-key moves in `tools.md`) and accessible names for its controls.

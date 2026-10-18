# Prism

_One idea broken into many views._

Prism is a real-time whiteboard and wireframing tool where AI coding agents work on the board as collaborators. Claude Code, Codex or any other MCP client connects over remote MCP and signs in through the browser. From there it can draw screens, ER diagrams and mind maps on a board you're watching live, and read the board back as code. The drawing engine is written from scratch in React and plain SVG, with no canvas or drawing libraries.

<!-- Live demo: add the deployed URL here, e.g. **[Live demo →](https://…)** (the login form fills in the demo account) -->
<!-- Demo GIF: ![An AI editor drawing a screen on a Prism board](docs/media/demo.gif) -->

```sh
claude mcp add --transport http prism https://<your-server>/mcp
```

## What it does

- **Whiteboard and wireframes.** Frames, shapes, connectors with elbow routing, freehand, sticky notes, lists, text, icons, emoji, images, SVG, charts, mind maps and database tables. It also has snapping and alignment guides, align and distribute, grouping, undo and redo, an optional hand-drawn sketch mode, and PNG and PDF export.
- **Live collaboration.** Edits sync over Socket.IO with versioned ops. You see live cursors and presence, and a staged reveal while an AI editor draws. Boards can be shared as owner, editor or viewer through email invites, invite links or read-only public links.
- **AI editors as participants.** Agents get 26 MCP tools and 3 prompts (below). People can select something on the board and click **Ask AI**. A waiting agent picks up the request, makes the edit and marks it done.
- **Design → code, and back.** `create_screen` takes a layout tree, or HTML + Tailwind that the browser renders in a sandbox and turns into editable elements. `get_screen_code` returns each frame as a nested tree with inferred row, column, grid and overlay layout, theme tokens and component instances, ready for an agent to code. `get_theme` exports the project theme as CSS, CSS variables, JSON or Dart.
- **Schemas both ways.** `create_er_diagram` lays out tables and foreign keys. `get_schema_code` reads the diagram back as Prisma, Postgres SQL or Drizzle.
- **A design bar for agents.** `get_design_guide` sets the rules, and every `create_screen` call is linted for overflow, text wrapping, contrast, tiny text and too many sizes or accent colors. The agent gets the warnings back.
- **Project themes and components.** Each project can have a shadcn/ui-style theme (light and dark colors, radius, fonts) and reusable components with props, variants and slots. A saved theme is strict, so agents use tokens instead of raw values.

## Architecture

```mermaid
flowchart LR
  subgraph Editors["AI editors"]
    CC["Claude Code / Codex / any MCP client"]
  end
  subgraph Browser["Browser · apps/client"]
    UI["React + SVG board engine<br/>TanStack Router + Query"]
    IF["Sandboxed iframe<br/>HTML + Tailwind → elements"]
  end
  subgraph Server["Node · apps/server"]
    MCP["/mcp · Streamable HTTP<br/>OAuth 2.1 or access token"]
    API["Express REST<br/>Better Auth"]
    RT["Socket.IO<br/>ops, presence, Ask AI"]
    OPS["applyOps<br/>(single write path)"]
  end
  SH["packages/shared<br/>Zod schemas · layout · code-tree · ER · themes"]
  DB[("Neon Postgres<br/>Prisma 7")]
  S3[("S3-compatible<br/>object storage")]

  CC -- MCP tools --> MCP
  UI -- REST --> API
  UI <-- element:ops --> RT
  MCP --> OPS
  API --> OPS
  OPS --> DB
  OPS -- broadcast --> RT
  RT -- HTML, export, compare --> IF
  API --> S3
  SH -.-> UI
  SH -.-> Server
```

- **One write path.** Every element change, whether from a person, a REST call or an MCP tool, goes through `applyOps`. That function checks access and limits, writes the batch, and broadcasts it as one `element:ops` event. The browser applies each batch as a single undo step, so a whole AI edit undoes at once.
- **Shared logic, built once.** Layout, code trees, ER layout, schema generation, theme export and component expansion live in `@prism/shared`. Both the server and the client import them, and the package compiles with plain `tsc` (NodeNext).
- **The browser does the rendering.** When an agent sends HTML + Tailwind, exports an image or compares a board with a reference picture, the server asks one of the user's open board tabs to do the work over Socket.IO. Tailwind is compiled right in that tab, so what the agent gets back matches what people see.

## MCP tools

| Area          | Tools                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Boards        | `list_boards`, `open_board`, `create_project`, `get_board`, `get_selection`                                                         |
| Drawing       | `create_elements`, `update_elements`, `delete_elements`, `create_screen`, `create_mindmap`, `add_image`, `search_images`, `add_svg` |
| Code          | `get_screen_code`, `get_schema_code`, `create_er_diagram`, `export_image`, `compare_reference`                                      |
| Design system | `get_design_guide`, `get_theme`, `set_theme`, `list_components`, `define_component`, `delete_component`                             |
| Ask AI        | `wait_for_edits`, `complete_edit`                                                                                                   |
| Prompts       | `watch_edits`, `design_screen`, `build_pages` (show up as slash commands, e.g. `/mcp__prism__build_pages`)                          |

## Security

The app is meant to be exposed to the public internet with AI agents acting for users, so it has these guards:

- **OAuth 2.1** for MCP (Better Auth `jwt` + `mcp` + `cimd`), with discovery, consent and grant revocation (a token stops working once its grant is gone). Personal access tokens can expire, and only their SHA-256 hash is stored.
- **One access check** (`board-access.ts`) used by every route, socket and tool. Sockets are origin-checked and dropped when their session ends.
- **Per-user rate limits** for saves, uploads, invites, MCP calls and image downloads, plus a cap on elements per board.
- **SSRF protection.** Server-side image fetches check the resolved address at connect time, which blocks DNS rebinding. SVG uploads are sanitized.
- **Prompt-injection hygiene.** Board text reaches agents marked as untrusted content. Public-link guests get no names and no Ask AI prompts.
- **A locked public demo account.** It can't share, create tokens or change its sign-in, and its agent grants expire after a day.

## Tech stack

| Layer   | Tech                                                                                    |
| ------- | --------------------------------------------------------------------------------------- |
| Client  | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Router + Query, Motion       |
| Server  | Node, Express, Socket.IO, Better Auth, MCP TypeScript SDK v2, Zod                       |
| Data    | PostgreSQL on Neon, Prisma 7 (driver adapter, pooled at runtime), S3-compatible storage |
| Tooling | pnpm workspaces, TypeScript project references, ESLint flat config, Prettier            |

The engine has no drawing libraries (Excalidraw, tldraw, Konva, Fabric.js) and no `zustand`, `nanoid`, `perfect-freehand`, `roughjs`, emoji pickers or chart libraries. State is `useReducer` + context, IDs come from `crypto.randomUUID()`, and freehand strokes, the sketch look, charts and the emoji picker are hand-written.

## Repository layout

```
apps/
  client/            React SPA (static build)
    src/components/board/   SVG engine: canvas, gestures, snapping, text layout, sync, export
    src/routes/             file-based routes (dashboard, board, share, docs, auth)
  server/            Express + Socket.IO + MCP (long-running Node process)
    src/mcp/                MCP server, tools, design guide, screen lint, OAuth grants
    src/routes/             REST routes, element writes (applyOps), access checks, sharing
    prisma/                 schema and migrations
packages/
  shared/            Zod schemas and pure logic shared by client and server
docs/
  SETUP.md           env values, scripts, deployment
  database.md        data model design notes
```

## Running it

You need Node ≥ 22.12, pnpm 12, a Neon Postgres database and an S3-compatible bucket. Google and GitHub OAuth apps and Mailjet are needed only for social sign-in and email.

```sh
pnpm install
cp apps/server/.env.example apps/server/.env    # fill in, see docs/SETUP.md
cp apps/client/.env.example apps/client/.env
pnpm --filter @prism/server db:deploy
pnpm dev                                         # client :5173, server :4000
```

The full guide, covering where each env value comes from, every script, how `@prism/shared` resolves and deployment, is in **[docs/SETUP.md](docs/SETUP.md)**.

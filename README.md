<h1 align="center">
  <a href="https://prism-ai-app.onrender.com"><img src="docs/media/banner.png" width="100%" alt="Prism. One idea broken into many views. A line enters the Prism mark and splits into four views: UI (create_screen), Flowchart (create_elements), Database (create_er_diagram) and Code (get_screen_code)."></a>
</h1>

<p align="center">
  <b>A real-time whiteboard and wireframing tool where AI coding agents work on the board with you.</b><br>
  Claude Code, Codex or any other MCP client draws screens, ER diagrams and mind maps on the board you're watching, then reads the board back as code.
</p>

<p align="center">
  <a href="https://prism-ai-app.onrender.com"><img src="docs/media/button-live-demo.png" height="45" alt="Try the live demo"></a>
  &nbsp;
  <a href="https://prism-ai-app.onrender.com/docs"><img src="docs/media/button-docs.png" height="45" alt="Read the docs"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%E2%89%A5%2022.12-3d3b4f?style=flat-square&labelColor=2a2a2a&logo=nodedotjs&logoColor=28e99f" alt="Node 22.12 or newer">
  <img src="https://img.shields.io/badge/pnpm-12-3d3b4f?style=flat-square&labelColor=2a2a2a&logo=pnpm&logoColor=28e99f" alt="pnpm 12">
  <img src="https://img.shields.io/badge/TypeScript-6.0-3d3b4f?style=flat-square&labelColor=2a2a2a&logo=typescript&logoColor=28e99f" alt="TypeScript 6.0">
  <img src="https://img.shields.io/badge/React-19-3d3b4f?style=flat-square&labelColor=2a2a2a&logo=react&logoColor=28e99f" alt="React 19">
  <img src="https://img.shields.io/badge/MCP-Streamable%20HTTP-3d3b4f?style=flat-square&labelColor=2a2a2a&logo=modelcontextprotocol&logoColor=28e99f" alt="MCP over Streamable HTTP">
  <img src="https://img.shields.io/badge/Prisma-7-3d3b4f?style=flat-square&labelColor=2a2a2a&logo=prisma&logoColor=28e99f" alt="Prisma 7">
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#mcp-tools">MCP tools</a> ·
  <a href="#run-it-yourself">Run it yourself</a>
</p>

<br>

<p align="center">
  <a href="https://prism-ai-app.onrender.com"><img src="docs/media/landing.png" width="100%" alt="The Prism landing page: one idea, a sticky note, runs through the prism and splits into four views: UI, Flowchart, Database and Code, each labelled with the MCP tool that draws it."></a>
</p>

## Quick start

Add Prism to your editor in one line, then sign in through the browser.

```sh
# Claude Code: then run /mcp and choose Authenticate
claude mcp add --transport http prism https://prism-ai-api.onrender.com/mcp

# Codex: opens your browser to sign in
codex mcp add prism --url https://prism-ai-api.onrender.com/mcp
```

<p align="center">
  <img src="docs/media/works-with.png" width="560" alt="Works with Claude Code, Codex, Antigravity, Cursor, GitHub Copilot and any MCP client.">
</p>

Antigravity, Cursor and GitHub Copilot take a JSON config instead. The dashboard's **Connect AI tools** dialog has the snippet for each one. A client that can't sign in through the browser can send a `prism_…` personal access token, made in the same dialog, as `Authorization: Bearer`.

Then ask for a screen, a flow or a schema. It lands on the board you have open, as one step you can undo. On your own server, use `https://<your-server>/mcp`, or `http://localhost:4000/mcp` in development.

The [live demo](https://prism-ai-app.onrender.com) fills in a public demo account on its login form.

## What it does

**The whiteboard.** The drawing engine is written from scratch in React and plain SVG, with no canvas or drawing libraries. It has frames, shapes, connectors with elbow routing, freehand, sticky notes, lists, text, icons, emoji, images, SVG, charts, mind maps and database tables. It also has snapping and alignment guides, align and distribute, grouping, undo and redo, an optional hand-drawn sketch mode, and PNG and PDF export.

### AI editors on the board

<img src="docs/media/editors.png" width="100%" alt="Your AI editor draws on the same board: a Claude Code session runs get_design_guide, get_theme, create_screen and export_image for a sign-up screen, next to the one-line Claude Code and Codex setup commands.">

- **26 MCP tools and 3 prompts** (listed [below](#mcp-tools)). Whatever an agent draws arrives live, with its cursor labelled with the editor's name.
- **Ask AI.** Select something on the board and click **Ask AI**. A waiting agent picks up the request, makes the edit and marks it done.
- **A design bar for agents.** `get_design_guide` sets the rules, and every `create_screen` call is linted for overflow, text wrapping, contrast, tiny text and too many sizes or accent colors. The agent gets the warnings back.

### Design to code, and back

<img src="docs/media/design-to-code.png" width="100%" alt="The board is the spec, not a picture of one: a mobile sign-up frame on the board, with Claude's cursor on it, read back by get_screen_code as a React component. It reads back as React + Tailwind, CSS variables, Flutter, Prisma, Postgres SQL or Drizzle.">

- **Screens in, code out.** `create_screen` takes a layout tree, or HTML + Tailwind that the browser renders in a sandbox and turns into editable elements. `get_screen_code` returns each frame as a nested tree with inferred row, column, grid and overlay layout, theme tokens and component instances, ready for an agent to code.
- **Project themes and components.** Each project can have a shadcn/ui-style theme (light and dark colors, radius, fonts) and reusable components with props, variants and slots. A saved theme is strict, so agents use tokens instead of raw values. `get_theme` exports it as CSS, CSS variables, JSON or Dart.
- **Schemas both ways.** `create_er_diagram` lays out tables and foreign keys. `get_schema_code` reads the diagram back as Prisma, Postgres SQL or Drizzle.

### Live collaboration

<img src="docs/media/sharing.png" width="100%" alt="Share a link, keep the edit button: the Share dialog with an owner, an editor and a viewer, and a public view-only link.">

Edits sync over Socket.IO with versioned ops. You see live cursors and presence, and a staged reveal while an AI editor draws. Boards can be shared as owner, editor or viewer through email invites, invite links or read-only public links.

## How it works

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

  classDef editor fill:#ecffa3,stroke:#3d3b4f,color:#2a2a2a
  classDef client fill:#c5ffd6,stroke:#3d3b4f,color:#2a2a2a
  classDef server fill:#d1e5ff,stroke:#3d3b4f,color:#2a2a2a
  classDef core fill:#28e99f,stroke:#2a2a2a,color:#2a2a2a,font-weight:bold
  classDef shared fill:#ffcffe,stroke:#3d3b4f,color:#2a2a2a
  classDef store fill:#eeeeee,stroke:#3d3b4f,color:#2a2a2a
  class CC editor
  class UI,IF client
  class MCP,API,RT server
  class OPS core
  class SH shared
  class DB,S3 store
```

- **One write path.** Every element change, whether from a person, a REST call or an MCP tool, goes through `applyOps`. That function checks access and limits, writes the batch, and broadcasts it as one `element:ops` event. The browser applies each batch as a single undo step, so a whole AI edit undoes at once.
- **Shared logic, built once.** Layout, code trees, ER layout, schema generation, theme export and component expansion live in `@prism/shared`. Both the server and the client import them, and the package compiles with plain `tsc` (NodeNext).
- **The browser does the rendering.** When an agent sends HTML + Tailwind, exports an image or compares a board with a reference picture, the server asks one of the user's open board tabs to do the work over Socket.IO. Tailwind is compiled right in that tab, so what the agent gets back matches what people see.

## MCP tools

<details>
<summary><b>26 tools and 3 prompts</b>, grouped by area</summary>

<br>

| Area          | Tools                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Boards        | `list_boards`, `open_board`, `create_project`, `get_board`, `get_selection`                                                         |
| Drawing       | `create_elements`, `update_elements`, `delete_elements`, `create_screen`, `create_mindmap`, `add_image`, `search_images`, `add_svg` |
| Code          | `get_screen_code`, `get_schema_code`, `create_er_diagram`, `export_image`, `compare_reference`                                      |
| Design system | `get_design_guide`, `get_theme`, `set_theme`, `list_components`, `define_component`, `delete_component`                             |
| Ask AI        | `wait_for_edits`, `complete_edit`                                                                                                   |
| Prompts       | `watch_edits`, `design_screen`, `build_pages` (show up as slash commands, e.g. `/mcp__prism__build_pages`)                          |

</details>

## Security

The app is meant to be exposed to the public internet with AI agents acting for users, so it has these guards:

<details>
<summary><b>OAuth 2.1, one access check, rate limits, SSRF protection, prompt-injection hygiene and a locked demo</b></summary>

<br>

- **OAuth 2.1** for MCP (Better Auth `jwt` + `mcp` + `cimd`), with discovery, consent and grant revocation (a token stops working once its grant is gone). Personal access tokens can expire, and only their SHA-256 hash is stored.
- **One access check** (`board-access.ts`) used by every route, socket and tool. Sockets are origin-checked and dropped when their session ends.
- **Per-user rate limits** for saves, uploads, invites, MCP calls and image downloads, plus a cap on elements per board.
- **SSRF protection.** Server-side image fetches check the resolved address at connect time, which blocks DNS rebinding. SVG uploads are sanitized.
- **Prompt-injection hygiene.** Board text reaches agents marked as untrusted content. Public-link guests get no names and no Ask AI prompts.
- **A locked public demo account.** It can't share, create tokens or change its sign-in, and its agent grants expire after a day.

</details>

## Tech stack

| Layer   | Tech                                                                                     |
| ------- | ---------------------------------------------------------------------------------------- |
| Client  | React 19, Vite 8, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Router + Query, Motion |
| Server  | Node, Express 5, Socket.IO, Better Auth, MCP TypeScript SDK v2, Zod                      |
| Data    | PostgreSQL on Neon, Prisma 7 (driver adapter, pooled at runtime), S3-compatible storage  |
| Tooling | pnpm workspaces, TypeScript project references, ESLint flat config, Prettier             |

The engine has no drawing libraries (Excalidraw, tldraw, Konva, Fabric.js) and no `zustand`, `nanoid`, `perfect-freehand`, `roughjs`, emoji pickers or chart libraries. State is `useReducer` + context, IDs come from `crypto.randomUUID()`, and freehand strokes, the sketch look, charts and the emoji picker are hand-written.

## Repository layout

<details>
<summary><b>Three workspaces:</b> the client, the server and a shared package</summary>

<br>

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
  media/             README images
```

</details>

## Run it yourself

You need Node ≥ 22.12, pnpm 12, a Neon Postgres database and an S3-compatible bucket. Google and GitHub OAuth apps and Mailjet are needed only for social sign-in and email.

```sh
pnpm install
cp apps/server/.env.example apps/server/.env    # fill in, see docs/SETUP.md
cp apps/client/.env.example apps/client/.env
pnpm --filter @prism/server db:deploy
pnpm dev                                         # client :5173, server :4000
```

The full guide, covering where each env value comes from, every script, how `@prism/shared` resolves and deployment to Render, is in **[docs/SETUP.md](docs/SETUP.md)**.

## Documentation

<a href="https://prism-ai-app.onrender.com/docs"><img src="docs/media/docs.png" width="100%" alt="The Prism docs: What is Prism, with the board, the AI editor and the code as three connected parts, and a sidebar for getting started, design, collaboration, building and reference."></a>

- **[Docs site](https://prism-ai-app.onrender.com/docs):** quickstart, connecting Claude Code and Codex, screens, themes and components, sharing and Ask AI, design to code and exports, and a reference.
- **[docs/SETUP.md](docs/SETUP.md):** env values, scripts and deployment.
- **[docs/database.md](docs/database.md):** data model design notes.

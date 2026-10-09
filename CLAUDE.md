# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Prism**: _One idea broken into many views._

A custom real-time whiteboard and wireframing tool. AI editors (Claude Code, Codex, …) drive it through the remote MCP endpoint at `<server>/mcp`. `tools.md` is the product spec: the tools (§1), core engine pieces (§2), element data model (§7) and dependency rules (§8). Read the relevant section before building a feature.

**Status:** the foundation is set up (workspaces, dependencies, config files) but there is **no source code yet**. The first coding task must create the entry points: `apps/client/index.html`, `apps/client/src/main.tsx`, `apps/client/src/routes/`, `apps/client/src/index.css` (Tailwind and the shadcn theme), `apps/client/src/lib/utils.ts` (`cn`), `apps/server/src/index.ts` and `packages/shared/src/index.ts`.

## Commands

Run from the repo root (pnpm 12, Node ≥ 22.12):

```sh
pnpm install
pnpm dev                 # client (Vite :5173) + server (tsx watch :4000) in parallel
pnpm build               # topological: shared → client, server
pnpm typecheck           # every package
pnpm lint                # one ESLint flat config at the root (eslint.config.js)
pnpm format              # Prettier; format:check to verify

pnpm --filter @prism/client <script>   # dev | build | preview | typecheck
pnpm --filter @prism/server <script>   # dev | build | start | typecheck | db:generate | db:validate | db:migrate | db:deploy | db:studio
pnpm --filter @prism/shared <script>   # build | typecheck

pnpm --filter @prism/client exec shadcn add <component>   # adds to apps/client/src/components/ui/
```

No test runner is configured yet.

## Architecture

pnpm workspaces: `apps/client` (React SPA, static build), `apps/server` (Express + Socket.IO, long-running Node process), `packages/shared` (Zod schemas and types used by both).

### AI editors (remote MCP endpoint)

- `apps/server/src/mcp/` serves MCP (Streamable HTTP, `@modelcontextprotocol/server` v2) at `/mcp`, mounted before `express.json()`. Setup for users is one line: `claude mcp add --transport http prism <server>/mcp` (or `codex mcp add prism --url …`), then the editor signs in through the browser.
- Sign-in is OAuth 2.1 from Better Auth's `jwt` + `mcp` + `cimd` plugins (`src/auth.ts`): discovery at `/.well-known/*` (routed to Better Auth), login on the web app's `/login` (the `oauthProviderClient` plugin continues the flow after sign-in) and consent on `/oauth/consent`. A `prism_…` personal access token in `Authorization: Bearer` also works (dashboard → Connect AI); only its SHA-256 is stored.
- Tools (`mcp/tools.ts`) call server functions directly (`ai-actions.ts`, `routes/elements.ts`, `routes/workspace.ts`) as the signed-in user. `get_design_guide` (`mcp/design-guide.ts`) is the design bar editors read before their first screen, and `create_screen` returns warnings from `mcp/screen-lint.ts` (wrapping, overflow, contrast, tiny text, too many sizes or accent colors). `create_screen` also takes `html` (HTML + Tailwind): the board tab renders it in a sandboxed iframe with the project theme and reads it back as elements (`apps/client/src/components/board/html-screen.ts`, Tailwind compiled in the browser); images come back as `pending:<n>` asset keys the server stores. For coding boards, `get_screen_code` returns each frame as a nested tree (containment, groups, inferred row/column/grid/overlay layout, sizes, `$tokens`, component instances; `packages/shared/src/code-tree.ts`), and `get_theme` takes `format` css, css-vars, json or dart (`packages/shared/src/theme-code.ts`); the `build_pages` prompt detects the app's framework and styling from them. Prompts `watch_edits`, `design_screen` and `build_pages` show up as slash commands (`/mcp__prism__watch_edits`).
- Project themes (`packages/shared/src/theme.ts`, `Project.theme`): shadcn/ui color variables (light and dark), radius and fonts. Boards without a project, or projects without a saved theme, use `DEFAULT_THEME`. Tools resolve `$tokens` to values and store the token names in the element's `tokens` prop; reads show `$token` only while the value still matches, so a hand edit falls back to the raw value. A saved theme is strict by default (plain UI colors, radius, fonts, text sizes and off-grid spacing are refused).
- Project components (`packages/shared/src/components.ts`, `Project.components`): layout trees with `{{prop}}` placeholders, variants and slots. `create_screen` expands `use` nodes before resolving tokens; elements an instance draws carry `component`.
- The OAuth tables' Prisma models were written by hand from `getAuthTables()` (Better Auth's CLI can't generate them: the plugin queries its tables at startup). Better Auth stores `json` fields as text and passes `null` for unset optional lists, so those lists are `Json?` columns and `src/db/auth-prisma.ts` maps `null` to a database NULL.
- Element writes from any source go through `applyOps` in `apps/server/src/routes/elements.ts`, which the save route follows with `broadcastOps` (`apps/server/src/realtime.ts`): one `element:ops` Socket.IO event per save, skipping the tab that saved (`x-prism-socket` header). The browser applies a batch as one undo step (`remote` action in `board-model.ts`).
- Sharing (`board_member`, `project_member`, `share_invite`, `shareToken` on board and project): every access check goes through `apps/server/src/routes/board-access.ts` (`boardFor`/`projectFor` with `"view"` or `"edit"`, `accessibleBoardWhere`). Owner does everything; editors change content; viewers read only; only the owner shares, moves or deletes. A board in a project always belongs to the project's owner, even when an editor creates it. Share routes, invite links and the public `/api/share/:token` endpoints are in `routes/share.ts`; signed-out sockets join boards only through `share:join`, and `revokeBoardTabs` kicks tabs that lost access. Client: `components/share/` (Share dialog), `components/board/board-viewer.tsx` (read-only board for viewers and `/s/$token`), `/invite/$token`.
- "Ask AI" requests (`edit_request` table): the browser creates them (`routes/ai.ts`); the `wait_for_edits` tool waits for and claims them and `complete_edit` finishes them (`ai-actions.ts`).

### How `@prism/shared` resolves (spans several files)

`packages/shared/package.json` exports a custom **`source`** condition that points at `src/index.ts`, with `dist/` as the fallback. The source condition is used by:

- `tsconfig.base.json` → `customConditions: ["source"]` (editor and `typecheck`)
- `apps/client/vite.config.ts` → `resolve.conditions`
- the server `dev` script → `tsx --conditions=source`

`apps/server/tsconfig.build.json` sets `customConditions: []`, so the production server compiles against and runs from `packages/shared/dist`. That's why `pnpm build` builds shared first. Shared code must therefore compile with plain `tsc` (NodeNext, `.js` import extensions).

### Database (Prisma 7 + Neon)

- The CLI config is **`apps/server/prisma7.config.ts`**, not `prisma.config.ts`: Prisma 7.10 loads `prisma7.config.*` first. The CLI uses **`DIRECT_URL`** (non-pooled; migrations need it).
- At runtime the app must use the **pooled `DATABASE_URL`** through `@prisma/adapter-pg` (`new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`).
- The client is generated by the `prisma-client` generator (ESM, `.js` import extensions) into `apps/server/src/generated/prisma/`. That folder is gitignored and rebuilt by `db:generate`/`build`. Import from `./generated/prisma/client.js`, not from `@prisma/client`.

### Client

- **TanStack Router**, file-based. `@tanstack/router-plugin` generates `src/routeTree.gen.ts` (generated, so don't edit it; ESLint and Prettier ignore it) from `src/routes/`. In `vite.config.ts` the plugin **must stay before `react()`**. The dev server errors if `src/routes/` doesn't exist.
- **shadcn/ui**: `components.json` uses style `base-nova`, CSS variables, Lucide icons, theme CSS in `src/index.css`. The `@/*` alias points to `src/*` and is defined in `tsconfig.json`, `tsconfig.app.json` and `vite.config.ts`.
- ESLint lets route files export `Route` and exempts `src/components/ui/` from `react-refresh/only-export-components`.
- Server state goes through TanStack Query, real-time through `socket.io-client`, auth through `better-auth/react` (`createAuthClient({ baseURL: VITE_SERVER_URL })`).

### Server and env

- Better Auth is served by the Express server under `/api/auth`. OAuth callbacks are `<BETTER_AUTH_URL>/api/auth/callback/{google,github}`.
- Images go to S3-compatible object storage through `@aws-sdk/client-s3`, configured only by the provider-neutral `S3_*` env vars (endpoint, region, force-path-style, keys, bucket). Never hard-code a provider.
  - The default provider is **Neon Object Storage** (beta, AWS `us-east-2` projects only). It needs `forcePathStyle: true`. The endpoint and credentials are **per database branch** (credentials also work on descendant branches), so a Neon branch has its own files, separate from production's.
  - Cloudflare R2 works by changing env values only (`S3_REGION=auto`, `S3_FORCE_PATH_STYLE=false`).
- The server loads `apps/server/.env` via `node/tsx --env-file-if-exists=.env`. The Prisma CLI loads it via `dotenv`.
- Client env vars must start with `VITE_`. They get baked into the static build, so never put secrets there.
- Only `.env.example` files are committed.

## Rules (from tools.md §8)

- **No drawing libraries** (Excalidraw, tldraw, Konva, Fabric.js). Everything is React + plain SVG + browser APIs.
- Also excluded: `zustand` (use `useReducer` + context), `nanoid` (use `crypto.randomUUID()`), `perfect-freehand`, `roughjs`, `emoji-picker-react` and chart libraries. Each has a hand-written replacement described in tools.md.
- Sync events are `element:create/update/delete` carrying `{id, version, changes}`. The higher `version` wins.

## Git

- Remote: `origin` → https://github.com/FahimAnsawry/Prism.git
- **Never credit Claude in git history.** Commits are authored only by the repo owner's git identity. Don't add `Co-Authored-By: Claude …` trailers, "Generated with Claude Code" lines, or Claude session links to commit messages or PR descriptions. This applies whenever you commit, push or open a PR. `.claude/settings.json` (`attribution`) enforces it too.

## Version pins (don't bump blindly)

- **TypeScript ~6.0**: typescript-eslint only supports TS < 6.1. TS 6 deprecates `baseUrl`, so use `paths` without it.
- **Prisma 7.10.0**, with `@prisma/client` and `@prisma/adapter-pg` pinned to match: npm's `latest` tag is an 8.0 RC, and better-auth peer-requires Prisma ^7.
- pnpm 12 blocks dependency install scripts unless they're listed in `allowBuilds` in `pnpm-workspace.yaml`. Add new packages that need install scripts there.

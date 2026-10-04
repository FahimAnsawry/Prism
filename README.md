# Prism

_One idea broken into many views._

A custom real-time whiteboard built with React + plain SVG (no drawing libraries). See [tools.md](tools.md) for the full feature and tool list.

This repo is a pnpm-workspaces monorepo:

| Path              | Package         | What it is                                                                                                                                                                             |
| ----------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/client`     | `@prism/client` | React + Vite + TypeScript, Tailwind CSS, shadcn/ui, TanStack Router, TanStack Query, Socket.IO client, Better Auth client. Builds to a static site.                                    |
| `apps/server`     | `@prism/server` | Express + TypeScript, Socket.IO, Prisma (Neon PostgreSQL), Better Auth, AWS SDK v3 S3 client (Neon Object Storage or any S3-compatible store), Zod. Runs as a long-lived Node process. |
| `packages/shared` | `@prism/shared` | Zod schemas and TypeScript types shared by the client and server.                                                                                                                      |

## Prerequisites

- **Node.js 24 LTS** (minimum 22.12, required by Vite 8)
- **pnpm 12** (`npm install -g pnpm@12`, or `corepack enable`; the version is pinned in `package.json` → `packageManager`)
- A **Neon** PostgreSQL project, **Google** and **GitHub** OAuth apps, and an S3-compatible bucket: **Neon Object Storage** by default, or Cloudflare R2 (see below)

## Install

```sh
pnpm install
```

Then create the env files from the examples and fill them in:

```sh
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
```

Only `.env.example` files are committed; `.env` files are git-ignored.

## Where to get each env value

### Neon: `DATABASE_URL` and `DIRECT_URL` (server)

1. Create a project at <https://console.neon.tech>.
2. Open **Connect** on the project dashboard and pick your branch, database and role.
3. With **Connection pooling ON**, copy the string (its host contains `-pooler`) → `DATABASE_URL`. The app uses it at runtime.
4. With **Connection pooling OFF**, copy the string (same host without `-pooler`) → `DIRECT_URL`. The Prisma CLI uses it for migrations (configured in `apps/server/prisma7.config.ts`).

Keep `?sslmode=require` on both.

### Better Auth: `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` (server)

- `BETTER_AUTH_SECRET`: a random string of at least 32 characters, e.g. `openssl rand -base64 32`.
- `BETTER_AUTH_URL`: the server's base URL (`http://localhost:4000` locally). Better Auth is served under `/api/auth`.

### Google OAuth: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (server)

1. Google Cloud Console → **APIs & Services** → **OAuth consent screen**: configure it.
2. **Credentials** → **Create credentials** → **OAuth client ID** → application type **Web application**.
3. **Authorized JavaScript origins**: `http://localhost:5173` (plus your production client URL).
4. **Authorized redirect URIs**: `http://localhost:4000/api/auth/callback/google` (plus `https://<your-server>/api/auth/callback/google`).

### GitHub OAuth: `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (server)

1. GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. **Homepage URL**: `http://localhost:5173`.
3. **Authorization callback URL**: `http://localhost:4000/api/auth/callback/github`.
4. Generate a client secret. GitHub OAuth Apps allow only one callback URL, so create a separate app for production.

### Object storage: `S3_*` (server)

Board images go to any S3-compatible store. Only the `S3_*` values change between providers.

**Neon Object Storage (default).** It's in beta and only available for Neon projects in **AWS US East (Ohio), `us-east-2`**. Check the region under project **Settings**. Storage is per database branch: each branch has its own endpoint and files.

1. Create a bucket for the branch, in the Neon Console or with the CLI: `neon buckets create prism-uploads` → `S3_BUCKET`. Add `--access-level public_read` only if images should be publicly readable without the server.
2. Get the branch's storage endpoint: `GET https://console.neon.tech/api/v2/projects/{project_id}/branches/{branch_id}/storage` → `s3_endpoint` → `S3_ENDPOINT`. A 404 means storage isn't available, usually because of the region.
3. Create a credential with scopes `storage:read` and `storage:write`, in the Console or with `POST .../branches/{branch_id}/credentials`. Then `token_id` (`nak_live_…`) → `S3_ACCESS_KEY_ID` and `s3_secret_access_key` (`nsk_live_…`) → `S3_SECRET_ACCESS_KEY`. The secret is shown only once. Expiry isn't enforced during the beta, so revoke unused credentials yourself.
4. Keep `S3_REGION=us-east-2` and `S3_FORCE_PATH_STYLE=true`. Neon requires path-style addressing.

**Cloudflare R2 (alternative).** Create a bucket and an R2 API token with **Object Read & Write**. Then set:

- `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `S3_REGION=auto`
- `S3_FORCE_PATH_STYLE=false`
- the token's keys → `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`

### URLs and port

| Variable          | Where  | Local value             |
| ----------------- | ------ | ----------------------- |
| `PORT`            | server | `4000`                  |
| `SERVER_URL`      | server | `http://localhost:4000` |
| `CLIENT_URL`      | server | `http://localhost:5173` |
| `VITE_SERVER_URL` | client | `http://localhost:4000` |
| `VITE_CLIENT_URL` | client | `http://localhost:5173` |

Client variables must start with `VITE_`. They are baked into the static build, so never put secrets in them.

## Scripts

Run from the repo root:

| Script              | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `pnpm dev`          | Start the client (Vite) and server (tsx watch) in parallel        |
| `pnpm build`        | Build every package in dependency order (shared → client, server) |
| `pnpm typecheck`    | Type-check every package                                          |
| `pnpm lint`         | Lint the whole repo with ESLint                                   |
| `pnpm lint:fix`     | Lint and auto-fix                                                 |
| `pnpm format`       | Format the repo with Prettier                                     |
| `pnpm format:check` | Check formatting without writing                                  |

Per-package scripts (`pnpm --filter <package> <script>`):

| Package         | Scripts                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@prism/client` | `dev`, `build` (static output in `apps/client/dist`), `preview`, `typecheck`                                                                                         |
| `@prism/server` | `dev`, `build` (Prisma generate + `tsc` → `dist`), `start` (`node dist/index.js`), `typecheck`, `db:generate`, `db:validate`, `db:migrate`, `db:deploy`, `db:studio` |
| `@prism/shared` | `build`, `typecheck`                                                                                                                                                 |

## How the shared package resolves

`@prism/shared` exports a custom `source` condition that points at its TypeScript source. Vite, `tsx` (dev) and `tsc --noEmit` all use that condition, so changes show up without a build step. The server's production build (`tsconfig.build.json`) turns the condition off and uses the compiled `packages/shared/dist`, which `pnpm build` produces first.

## Client routing and UI components

- **TanStack Router** uses file-based routing. The Vite plugin (`@tanstack/router-plugin`) watches `apps/client/src/routes/` and generates `src/routeTree.gen.ts`. That file is generated, so don't edit it; it is ignored by ESLint and Prettier.
- **shadcn/ui** is configured in `apps/client/components.json` (style `base-nova`, CSS variables, Lucide icons, `@/` → `src/`). Add components from `apps/client` with `pnpm exec shadcn add <component>` (the CLI is a dev dependency); they land in `src/components/ui/`.

## Deployment

Target-neutral for now. The client is a static site (`apps/client/dist`) and can go on any static host (e.g. Vercel). The server is a long-running Node process (`pnpm --filter @prism/server build && pnpm --filter @prism/server start`) for a Node host such as Render, Railway or Fly.io. Run `pnpm --filter @prism/server db:deploy` to apply migrations on deploy.

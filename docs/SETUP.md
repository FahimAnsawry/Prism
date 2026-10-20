# Setup

How to run Prism locally and deploy it. Back to the [README](../README.md).

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

Once the env values are in, apply the migrations, optionally seed the demo account, and start both apps:

```sh
pnpm --filter @prism/server db:deploy     # apply prisma/migrations to your database
pnpm --filter @prism/server seed:demo     # optional: create the public demo account
pnpm dev                                  # client on :5173, server on :4000
```

To connect an AI editor to your local server:

```sh
claude mcp add --transport http prism http://localhost:4000/mcp
# or
codex mcp add prism --url http://localhost:4000/mcp
```

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

### Email: `MAILJET_*` and `EMAIL_FROM*` (server, optional)

Verification, welcome, password reset and share-invite emails go through Mailjet's HTTP API (some hosts, such as Render's free tier, block SMTP). Leave `MAILJET_API_KEY` empty to skip sending email.

1. Mailjet → **Account settings** → **REST API** → **API Key Management** → `MAILJET_API_KEY` and `MAILJET_SECRET_KEY`.
2. Verify a sender address under **Sender domains & addresses** → `EMAIL_FROM`. `EMAIL_FROM_NAME` is the display name (default `Prism`).

### Demo account: `DEMO_*` (server) and `VITE_DEMO_*` (client, optional)

A public account whose sign-in the login form fills in. Its password, email, name and photo are locked, it can't share boards or create tokens, and its AI-editor grants expire after a day. Set the same email and password on both sides, then run `pnpm --filter @prism/server seed:demo` (in production: `node dist/scripts/seed-demo.js`). Leave `DEMO_EMAIL` empty for no demo account.

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

The client is a static site (`apps/client/dist`). The server is a long-running Node process (`pnpm --filter @prism/server build`, then `node apps/server/dist/index.js`); migrations are applied with `pnpm --filter @prism/server db:deploy`.

### Render

`render.yaml` at the repo root is a Render Blueprint for both:

| Service           | Type        | Plan            | What it runs                                                                                             |
| ----------------- | ----------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| `prism-board-api` | Web service | Starter ($7/mo) | Express, Socket.IO and `/mcp`, in Singapore next to the Neon database. Migrations run before each deploy |
| `prism-board`     | Static site | Free            | The React app, with every path that isn't a file served `index.html`                                     |

A free instance would sleep when idle, dropping open boards' sockets and AI editors' `/mcp` connections, so the server needs a paid plan (pre-deploy migrations need one too).

1. Render dashboard → **New → Blueprint** → pick the repo. Render reads `render.yaml` and asks for every `sync: false` value. `BETTER_AUTH_SECRET` is generated.
2. Fill in the server's values as in `apps/server/.env.example`, with the production URLs:
   - `SERVER_URL` and `BETTER_AUTH_URL`: `https://prism-board-api.onrender.com`
   - `CLIENT_URL`: `https://prism-board.onrender.com`
   - `CROSS_SITE_COOKIES`: `true` (see below)
   - `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) from Neon
   - `S3_REGION` and `S3_FORCE_PATH_STYLE` for your storage provider
3. Fill in the static site's `VITE_SERVER_URL` with the server URL (and `VITE_DEMO_*` to match `DEMO_*`, or leave all of them empty).
4. If Render had to add a suffix to a service name (the name was taken), its URL differs: fix the URLs above under each service's **Environment** and redeploy. A `VITE_` change needs a new build of the static site.
5. Add the production URLs to the OAuth apps: Google's authorized JavaScript origin `CLIENT_URL` and redirect URI `<SERVER_URL>/api/auth/callback/google`; a separate GitHub OAuth app with callback `<SERVER_URL>/api/auth/callback/github`.
6. Optional demo account: run `node apps/server/dist/scripts/seed-demo.js` once from the server's **Shell** tab.

AI editors connect with `claude mcp add --transport http prism <SERVER_URL>/mcp`.

**Cookies across two `onrender.com` hosts.** `onrender.com` is a public suffix, so `prism-board.onrender.com` and `prism-board-api.onrender.com` are different sites, and the browser won't send the default `SameSite=Lax` session cookie from one to the other. `CROSS_SITE_COOKIES=true` makes the cookies `SameSite=None`, which works in Chrome and Firefox, but Safari blocks those third-party cookies and its users can't stay signed in. The fix is a domain of your own (the Hobby plan includes two custom domains): put the app on `example.com` (or `app.example.com`) and the server on `api.example.com`, update the URLs above, and set `CROSS_SITE_COOKIES` empty.

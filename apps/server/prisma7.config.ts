// Prisma CLI config (migrate, generate, studio). Prisma 7.10+ loads `prisma7.config.ts`
// first and treats `prisma.config.ts` as a legacy fallback.
//
// The CLI connects through Neon's DIRECT (non-pooled) connection string, because
// migrations need a session that PgBouncer's transaction pooling can't provide.
// The app itself connects at runtime through the POOLED DATABASE_URL via @prisma/adapter-pg.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // process.env (not env()) so `prisma generate` also works without credentials, e.g. in CI builds
    url: process.env["DIRECT_URL"],
  },
});

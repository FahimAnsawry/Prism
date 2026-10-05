import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";

// Runtime connections go through Neon's POOLED url; the CLI uses DIRECT_URL (prisma7.config.ts).
const connectionString = process.env["DATABASE_URL"];
if (!connectionString) throw new Error("DATABASE_URL is not set");

export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
    // pg's default closes idle connections after 10s, and reopening one (TLS + auth) costs several
    // round trips. Keep them for 5 minutes, Prisma 6's default.
    idleTimeoutMillis: 5 * 60_000,
    // pg waits forever for a connection by default; fail like Prisma 6 did instead of hanging.
    connectionTimeoutMillis: 5_000,
  }),
});

import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { jwt } from "better-auth/plugins";
import { authPrisma } from "./db/auth-prisma.js";
import { prisma } from "./db/client.js";
import { claimInvites } from "./invites.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const baseURL = requireEnv("BETTER_AUTH_URL");
const clientUrl = requireEnv("CLIENT_URL");

/** The remote MCP endpoint (apps/server/src/mcp): the resource MCP access tokens are bound to. */
export const MCP_RESOURCE = new URL("/mcp", baseURL).toString();

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Whether every redirect URI is an http(s) loopback address, as a CLI's sign-in uses. */
function onlyLoopbackRedirects(uris: unknown) {
  if (!Array.isArray(uris) || uris.length === 0) return false;
  return uris.every((uri) => {
    try {
      const url = new URL(String(uri));
      return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
    } catch {
      return false;
    }
  });
}

export const auth = betterAuth({
  baseURL,
  secret: requireEnv("BETTER_AUTH_SECRET"),
  trustedOrigins: [clientUrl],
  database: prismaAdapter(authPrisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }, _request) => {
      // In development or until an email provider (Resend, SES) is attached, log the reset URL.
      console.info(
        `[auth] Password reset requested for ${user.email}:\n` +
          `  Reset URL: ${url}\n` +
          `  Token: ${token}`,
      );
    },
  },
  socialProviders: {
    google: {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    },
    github: {
      clientId: requireEnv("GITHUB_CLIENT_ID"),
      clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
    },
  },

  hooks: {
    // MCP clients (Claude Code, Codex, …) register themselves with loopback redirect URIs but may
    // leave out application_type, which then defaults to "web", and web clients must use https.
    // A client whose redirects are all loopback is a native app (RFC 8252), so say so.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/oauth2/register") return;
      const body = ctx.body as Record<string, unknown> | undefined;
      if (!body || body["application_type"] !== undefined) return;
      if (!onlyLoopbackRedirects(body["redirect_uris"])) return;
      return { context: { ...ctx, body: { ...body, application_type: "native" } } };
    }),
  },

  plugins: [
    // Signs the OAuth access tokens MCP clients receive (JWKS at /api/auth/jwks).
    jwt(),
    // Prism as an OAuth 2.1 authorization server for MCP clients (Claude Code, Codex, …): they
    // discover it from /.well-known metadata, send the user to log in and approve, and get a
    // token bound to MCP_RESOURCE. The login and consent pages are the web app's.
    mcp({
      resource: MCP_RESOURCE,
      loginPage: new URL("/login", clientUrl).toString(),
      consentPage: new URL("/oauth/consent", clientUrl).toString(),
      // Clients that don't publish a Client ID Metadata Document register themselves.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
    }),
    // Clients identified by a metadata document URL (the MCP 2026-07-28 way).
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
  ],

  user: {
    additionalFields: {
      // Set only by the server's upload route, never by the client
      imageKey: { type: "string", required: false, input: false },
    },
  },

  // One email = one user. A social sign-in whose email matches an existing user adds
  // an Account row to that user instead of creating a second user.
  account: {
    accountLinking: {
      enabled: true,
      // Google always verifies emails. GitHub links only when it reports the email as verified,
      // since a GitHub account can carry an unverified address that belongs to someone else.
      trustedProviders: ["google"],
      // Email/password users aren't verified (no email sending yet); without this, linking a
      // social login to them is refused. The account.create hook below keeps that safe.
      requireLocalEmailVerified: false,
      // Copy name and image from the newly linked provider. An uploaded photo lives in
      // imageKey, so it is never overwritten.
      updateUserInfoOnLink: true,
    },
  },

  databaseHooks: {
    session: {
      create: {
        // Signing in with a verified email accepts the share invites sent to it.
        after: async (session) => {
          await claimInvites(session.userId).catch((error: unknown) =>
            console.error("[Prism] Couldn't accept share invites:", error),
          );
        },
      },
    },
    account: {
      create: {
        // Someone may have signed up with this email and a password without owning the
        // mailbox. When a provider proves ownership of an unverified user's email, drop that
        // unproven password and its sessions so they can't be used to reach the linked account.
        before: async (account) => {
          if (account.providerId === "credential") return;
          const user = await prisma.user.findUnique({
            where: { id: account.userId },
            select: { emailVerified: true },
          });
          if (!user || user.emailVerified) return;
          const { count } = await prisma.account.deleteMany({
            where: { userId: account.userId, providerId: "credential" },
          });
          if (count > 0) await prisma.session.deleteMany({ where: { userId: account.userId } });
        },
      },
    },
  },
});

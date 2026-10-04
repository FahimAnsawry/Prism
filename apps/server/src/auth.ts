import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db/client.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const auth = betterAuth({
  baseURL: requireEnv("BETTER_AUTH_URL"),
  secret: requireEnv("BETTER_AUTH_SECRET"),
  trustedOrigins: [requireEnv("CLIENT_URL")],
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: { enabled: true },
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

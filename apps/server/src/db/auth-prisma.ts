import { prisma } from "./client.js";
import { Prisma } from "./generated/client.js";

/**
 * Optional lists in Better Auth's OAuth tables. Its adapter passes null when one isn't set, and
 * null means something different from [] (e.g. "any scope" vs "none"), so they're nullable
 * Json columns (prisma/schema.prisma), and a plain null must become a database NULL for Prisma.
 */
const NULLABLE_LISTS: Record<string, readonly string[]> = {
  OauthClient: [
    "scopes",
    "clientCredentialsScopes",
    "contacts",
    "postLogoutRedirectUris",
    "grantTypes",
    "responseTypes",
  ],
  OauthResource: ["allowedScopes"],
  OauthRefreshToken: ["resources", "requestedUserInfoClaims"],
  OauthAccessToken: ["resources", "requestedUserInfoClaims"],
  OauthConsent: ["resources", "requestedUserInfoClaims"],
};

function nullToDbNull(data: unknown, fields: readonly string[]) {
  if (Array.isArray(data)) {
    for (const row of data) nullToDbNull(row, fields);
    return;
  }
  if (!data || typeof data !== "object") return;
  const row = data as Record<string, unknown>;
  for (const field of fields) if (row[field] === null) row[field] = Prisma.DbNull;
}

/** The Prisma client Better Auth's adapter uses (src/auth.ts). */
export const authPrisma = prisma.$extends({
  query: {
    $allModels: {
      $allOperations({ model, args, query }) {
        const fields = NULLABLE_LISTS[model];
        if (fields && args && typeof args === "object") {
          const { data, create, update } = args as Record<string, unknown>;
          for (const part of [data, create, update]) nullToDbNull(part, fields);
        }
        return query(args);
      },
    },
  },
});

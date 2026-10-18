/**
 * Creates the public demo account (DEMO_EMAIL, DEMO_PASSWORD and optional DEMO_NAME from .env),
 * or resets it: its password, name and verified email go back to the seeded values. It goes
 * through Better Auth's own adapter and password hashing, so the account signs in like any other,
 * and no verification or welcome email is sent.
 *
 *   pnpm --filter @prism/server seed:demo        (development, from source)
 *   node dist/scripts/seed-demo.js               (production, after build)
 */
import { auth } from "../auth.js";
import { prisma } from "../db/client.js";
import { DEMO_EMAIL } from "../demo.js";

async function main() {
  const password = process.env["DEMO_PASSWORD"];
  const name = process.env["DEMO_NAME"]?.trim() || "Demo User";
  if (!DEMO_EMAIL || !password) throw new Error("Set DEMO_EMAIL and DEMO_PASSWORD first.");

  const context = await auth.$context;
  const hash = await context.password.hash(password);
  const found = await context.internalAdapter.findUserByEmail(DEMO_EMAIL, {
    includeAccounts: true,
  });

  if (!found) {
    const user = await context.internalAdapter.createUser(
      { email: DEMO_EMAIL, name, emailVerified: true },
      { method: "admin" },
    );
    await context.internalAdapter.createAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hash,
    });
    console.log(`[Prism] Created the demo account ${DEMO_EMAIL}.`);
    return;
  }

  const { user, accounts } = found;
  await context.internalAdapter.updateUser(user.id, { name, emailVerified: true });
  if (accounts.some((account) => account.providerId === "credential")) {
    await context.internalAdapter.updatePassword(user.id, hash);
  } else {
    await context.internalAdapter.createAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hash,
    });
  }
  // Signs out every open demo session, so the reset takes effect everywhere.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`[Prism] Reset the demo account ${DEMO_EMAIL}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("[Prism] Couldn't seed the demo account:", error);
    process.exit(1);
  });

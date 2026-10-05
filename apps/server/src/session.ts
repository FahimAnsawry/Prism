import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express types are a global namespace
  namespace Express {
    interface Locals {
      /** Set by requireUser. */
      userId: string;
    }
  }
}

/** Rejects requests without a Better Auth session; otherwise puts the user's id on res.locals. */
export const requireUser: RequestHandler = async (req, res, next) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  res.locals.userId = session.user.id;
  next();
};

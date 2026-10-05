import {
  API_TOKENS_MAX,
  createApiTokenSchema,
  type ApiToken,
  type CreatedApiToken,
} from "@prism/shared";
import { Router } from "express";
import { prisma } from "../db/client.js";
import { badRequest, notFound, parseBody } from "../errors.js";
import { hashToken, newToken, requireUser } from "../session.js";
import { uuidParam } from "./board-access.js";

/** Characters of the token shown in the list (the prefix plus a few random ones). */
const START_LENGTH = 12;

const tokenSelect = {
  id: true,
  name: true,
  start: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

type TokenRow = {
  id: string;
  name: string;
  start: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

const toApiToken = (row: TokenRow): ApiToken => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
});

/**
 * Personal access tokens: an alternative to OAuth sign-in for the MCP endpoint (clients that
 * can only send a fixed header). Managed from the dashboard.
 */
export const tokensRouter = Router();

tokensRouter.use("/tokens", requireUser);

tokensRouter.get("/tokens", async (_req, res) => {
  const rows = await prisma.apiToken.findMany({
    where: { userId: res.locals.userId },
    orderBy: { createdAt: "desc" },
    select: tokenSelect,
  });
  res.json({ tokens: rows.map(toApiToken) });
});

tokensRouter.post("/tokens", async (req, res) => {
  const userId = res.locals.userId;
  const { name } = parseBody(createApiTokenSchema, req.body);
  const count = await prisma.apiToken.count({ where: { userId } });
  if (count >= API_TOKENS_MAX) {
    throw badRequest(`You can have up to ${API_TOKENS_MAX} tokens. Revoke one you don't use.`);
  }
  const token = newToken();
  const row = await prisma.apiToken.create({
    data: { userId, name, tokenHash: hashToken(token), start: token.slice(0, START_LENGTH) },
    select: tokenSelect,
  });
  const created: CreatedApiToken = { ...toApiToken(row), token };
  res.status(201).json(created);
});

tokensRouter.delete("/tokens/:tokenId", async (req, res) => {
  const id = uuidParam(req.params.tokenId);
  const { count } = id
    ? await prisma.apiToken.deleteMany({ where: { id, userId: res.locals.userId } })
    : { count: 0 };
  if (count === 0) throw notFound("That token no longer exists.");
  res.json({ id });
});

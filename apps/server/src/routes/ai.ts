import { createEditRequestSchema } from "@prism/shared";
import { Router } from "express";
import { editSelect, toEditRequest, wakeEditWaiters } from "../ai-actions.js";
import { prisma } from "../db/client.js";
import { parseBody } from "../errors.js";
import { broadcastEdit } from "../realtime.js";
import { requireUser } from "../session.js";
import { boardFor } from "./board-access.js";

// The browser's "Ask AI" box: edit requests for the selection, which AI editors pick up through
// the MCP endpoint (wait_for_edits) and finish (complete_edit).

export const aiRouter = Router();

/** The board's recent requests, newest first, for the browser's status list. */
aiRouter.get("/boards/:boardId/edits", requireUser, async (req, res) => {
  const board = await boardFor(req.params.boardId, res.locals.userId, "view");
  const rows = await prisma.editRequest.findMany({
    where: { boardId: board.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: editSelect,
  });
  res.json({ requests: rows.map(toEditRequest) });
});

aiRouter.post("/boards/:boardId/edits", requireUser, async (req, res) => {
  const userId = res.locals.userId;
  const board = await boardFor(req.params.boardId, userId, "edit");
  const { prompt, elementIds } = parseBody(createEditRequestSchema, req.body);
  const row = await prisma.editRequest.create({
    data: { boardId: board.id, userId, prompt, elementIds: [...new Set(elementIds)] },
    select: editSelect,
  });
  const request = toEditRequest(row);
  broadcastEdit(request);
  wakeEditWaiters(userId);
  res.status(201).json(request);
});

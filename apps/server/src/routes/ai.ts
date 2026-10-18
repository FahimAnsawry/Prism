import { createEditRequestSchema, updateEditRequestSchema } from "@prism/shared";
import { Router } from "express";
import {
  deleteEdit,
  editSelect,
  stopEdit,
  toEditRequest,
  updateEdit,
  wakeEditWaiters,
} from "../ai-actions.js";
import { prisma } from "../db/client.js";
import { notFound, parseBody } from "../errors.js";
import { broadcastEdit } from "../realtime.js";
import { LIMITS, limitPerUser } from "../rate-limit.js";
import { requireUser } from "../session.js";
import { boardFor, uuidParam } from "./board-access.js";

// The browser's "Ask AI" box: edit requests for the selection, which AI editors pick up through
// the MCP endpoint (wait_for_edits) and finish (complete_edit).

export const aiRouter = Router();

function editIdParam(value: string | string[] | undefined) {
  const id = uuidParam(value);
  if (!id) throw notFound("That edit request no longer exists.");
  return id;
}

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

/** Pause, resume or reword a request no AI editor has picked up yet. */
aiRouter.patch("/boards/:boardId/edits/:editId", requireUser, async (req, res) => {
  const userId = res.locals.userId;
  const board = await boardFor(req.params.boardId, userId, "edit");
  const input = parseBody(updateEditRequestSchema, req.body);
  res.json(await updateEdit(userId, board.id, editIdParam(req.params.editId), input));
});

/** Stop a request an AI editor is working on. */
aiRouter.post("/boards/:boardId/edits/:editId/stop", requireUser, async (req, res) => {
  const userId = res.locals.userId;
  const board = await boardFor(req.params.boardId, userId, "edit");
  res.json(await stopEdit(userId, board.id, editIdParam(req.params.editId)));
});

aiRouter.delete("/boards/:boardId/edits/:editId", requireUser, async (req, res) => {
  const userId = res.locals.userId;
  const board = await boardFor(req.params.boardId, userId, "edit");
  const id = editIdParam(req.params.editId);
  await deleteEdit(userId, board.id, id);
  res.json({ id });
});

aiRouter.post(
  "/boards/:boardId/edits",
  requireUser,
  limitPerUser(LIMITS.editRequestsPerHour),
  async (req, res) => {
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
  },
);

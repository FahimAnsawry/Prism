import {
  createBoardSchema,
  createProjectSchema,
  updateBoardSchema,
  updateProjectSchema,
  type BoardSummary,
  type ProjectSummary,
  type Workspace,
} from "@prism/shared";
import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { Prisma } from "../db/generated/client.js";
import { requireUser } from "../session.js";

/** How many board tiles a project card shows. */
const PROJECT_TILES = 3;

const liveBoards = { archivedAt: null };

// The same selections everywhere, so each response shape has one source.
const boardSelect = {
  id: true,
  name: true,
  description: true,
  projectId: true,
  createdAt: true,
  editedAt: true,
  _count: { select: { elements: { where: { deletedAt: null } } } },
} as const;

const projectSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  editedAt: true,
  _count: { select: { boards: { where: liveBoards } } },
  boards: {
    where: liveBoards,
    orderBy: { editedAt: "desc" },
    take: PROJECT_TILES,
    select: { id: true, name: true },
  },
} as const;

type BoardRow = {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  createdAt: Date;
  editedAt: Date;
  _count: { elements: number };
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  editedAt: Date;
  _count: { boards: number };
  boards: { id: string; name: string }[];
};

function toBoardSummary({ _count, createdAt, editedAt, ...board }: BoardRow): BoardSummary {
  return {
    ...board,
    itemCount: _count.elements,
    createdAt: createdAt.toISOString(),
    editedAt: editedAt.toISOString(),
  };
}

function toProjectSummary({ _count, createdAt, editedAt, ...project }: ProjectRow): ProjectSummary {
  return {
    ...project,
    boardCount: _count.boards,
    createdAt: createdAt.toISOString(),
    editedAt: editedAt.toISOString(),
  };
}

/** Parses a request body, or sends a 400 with each field's first message and returns undefined. */
function parseBody<T extends z.ZodType>(schema: T, body: unknown, res: Response) {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data as z.infer<T>;
  res.status(400).json({
    error: result.error.issues[0]?.message ?? "Invalid request.",
    fieldErrors: z.flattenError(result.error).fieldErrors,
  });
  return undefined;
}

/** A route param that must be a UUID; anything else can't match a row, so it reads as "not found". */
function uuidParam(value: string | string[] | undefined) {
  const result = z.uuid().safeParse(value);
  return result.success ? result.data : undefined;
}

/** The user's live projects. */
const liveProjectWhere = (ownerId: string) => ({ ownerId, archivedAt: null });

/** The user's live boards. A board in an archived project is hidden along with it. */
const liveBoardWhere = (ownerId: string) => ({
  ownerId,
  archivedAt: null,
  OR: [{ projectId: null }, { project: { archivedAt: null } }],
});

const PROJECT_NOT_FOUND = "That project no longer exists.";
const BOARD_NOT_FOUND = "Board not found.";

// Writes check ownership in their own WHERE clause instead of a separate lookup first: every
// query is a round trip to the database, so fewer queries is what makes these routes fast.
// The project.editedAt bumps aren't in a transaction with the board write; if one fails, the
// only cost is a stale "edited" time.

/** Prisma's "no row matched the WHERE" error, from update/delete. */
function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/**
 * Marks the user's live project as edited. Returns false if it isn't theirs or doesn't exist,
 * so it doubles as the ownership check for putting a board in it (board.ownerId = project.ownerId).
 */
async function touchProject(ownerId: string, projectId: string, editedAt: Date) {
  const { count } = await prisma.project.updateMany({
    where: { id: projectId, ...liveProjectWhere(ownerId) },
    data: { editedAt },
  });
  return count > 0;
}

export const workspaceRouter = Router();

workspaceRouter.use(requireUser);

/** Everything the dashboard shows: live projects and every live board. */
workspaceRouter.get("/workspace", async (_req, res) => {
  const ownerId = res.locals.userId;
  const [projects, boards] = await Promise.all([
    prisma.project.findMany({
      where: liveProjectWhere(ownerId),
      orderBy: { editedAt: "desc" },
      select: projectSelect,
    }),
    prisma.board.findMany({
      where: liveBoardWhere(ownerId),
      orderBy: { editedAt: "desc" },
      select: boardSelect,
    }),
  ]);

  const workspace: Workspace = {
    projects: projects.map(toProjectSummary),
    boards: boards.map(toBoardSummary),
  };
  res.json(workspace);
});

workspaceRouter.post("/projects", async (req, res) => {
  const input = parseBody(createProjectSchema, req.body, res);
  if (!input) return;

  const project = await prisma.project.create({
    data: {
      ownerId: res.locals.userId,
      name: input.name,
      description: input.description || null,
    },
    select: projectSelect,
  });
  res.status(201).json(toProjectSummary(project));
});

workspaceRouter.patch("/projects/:projectId", async (req, res) => {
  const projectId = uuidParam(req.params.projectId);
  const input = parseBody(updateProjectSchema, req.body, res);
  if (!input) return;
  if (!projectId) {
    res.status(404).json({ error: PROJECT_NOT_FOUND });
    return;
  }

  try {
    const project = await prisma.project.update({
      where: { id: projectId, ...liveProjectWhere(res.locals.userId) },
      data: { name: input.name, description: input.description || null, editedAt: new Date() },
      select: projectSelect,
    });
    res.json(toProjectSummary(project));
  } catch (error) {
    if (!isNotFound(error)) throw error;
    res.status(404).json({ error: PROJECT_NOT_FOUND });
  }
});

/** Permanent: the project's boards and their elements are deleted with it (onDelete: Cascade). */
workspaceRouter.delete("/projects/:projectId", async (req, res) => {
  const projectId = uuidParam(req.params.projectId);
  const { count } = projectId
    ? await prisma.project.deleteMany({ where: { id: projectId, ownerId: res.locals.userId } })
    : { count: 0 };
  if (count === 0) {
    res.status(404).json({ error: PROJECT_NOT_FOUND });
    return;
  }
  res.json({ id: projectId });
});

workspaceRouter.post("/boards", async (req, res) => {
  const input = parseBody(createBoardSchema, req.body, res);
  if (!input) return;
  const ownerId = res.locals.userId;
  const projectId = input.projectId || null;
  const editedAt = new Date();

  // A new board counts as an edit to its project; the bump is also the ownership check.
  if (projectId && !(await touchProject(ownerId, projectId, editedAt))) {
    res.status(404).json({ error: PROJECT_NOT_FOUND });
    return;
  }

  const board = await prisma.board.create({
    data: {
      ownerId,
      projectId,
      name: input.name,
      description: input.description || null,
      editedAt,
    },
    select: boardSelect,
  });
  res.status(201).json(toBoardSummary(board));
});

workspaceRouter.get("/boards/:boardId", async (req, res) => {
  const boardId = uuidParam(req.params.boardId);
  const board = boardId
    ? await prisma.board.findFirst({
        where: { id: boardId, ...liveBoardWhere(res.locals.userId) },
        select: boardSelect,
      })
    : null;
  if (!board) {
    res.status(404).json({ error: BOARD_NOT_FOUND });
    return;
  }
  res.json(toBoardSummary(board));
});

/** Renames a board, changes its description, or moves it into, out of, or between projects. */
workspaceRouter.patch("/boards/:boardId", async (req, res) => {
  const boardId = uuidParam(req.params.boardId);
  const input = parseBody(updateBoardSchema, req.body, res);
  if (!input) return;
  const ownerId = res.locals.userId;

  // Needed for the project it may be leaving.
  const current = boardId
    ? await prisma.board.findFirst({
        where: { id: boardId, ...liveBoardWhere(ownerId) },
        select: { id: true, projectId: true },
      })
    : null;
  if (!current) {
    res.status(404).json({ error: BOARD_NOT_FOUND });
    return;
  }

  const projectId = input.projectId || null;
  const editedAt = new Date();
  // The project it joins and the one it leaves have both changed. Joining one also checks it's theirs.
  if (projectId && !(await touchProject(ownerId, projectId, editedAt))) {
    res.status(404).json({ error: PROJECT_NOT_FOUND });
    return;
  }
  const left = current.projectId !== projectId ? current.projectId : null;

  const [board] = await Promise.all([
    prisma.board.update({
      where: { id: current.id },
      data: { name: input.name, description: input.description || null, projectId, editedAt },
      select: boardSelect,
    }),
    left && touchProject(ownerId, left, editedAt),
  ]);
  res.json(toBoardSummary(board));
});

/** Permanent: the board's elements are deleted with it (onDelete: Cascade). */
workspaceRouter.delete("/boards/:boardId", async (req, res) => {
  const boardId = uuidParam(req.params.boardId);
  const ownerId = res.locals.userId;
  if (!boardId) {
    res.status(404).json({ error: BOARD_NOT_FOUND });
    return;
  }

  try {
    const { projectId } = await prisma.board.delete({
      where: { id: boardId, ownerId },
      select: { projectId: true },
    });
    // Losing a board counts as an edit to its project.
    if (projectId) await touchProject(ownerId, projectId, new Date());
    res.json({ id: boardId });
  } catch (error) {
    if (!isNotFound(error)) throw error;
    res.status(404).json({ error: BOARD_NOT_FOUND });
  }
});

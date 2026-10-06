import {
  componentsSchema,
  createBoardSchema,
  createProjectSchema,
  DEFAULT_THEME,
  themeSchema,
  themeToCss,
  updateBoardSchema,
  updateBoardStyleSchema,
  updateProjectSchema,
  type BoardSummary,
  type Components,
  type CreateBoardInput,
  type CreateProjectInput,
  type ProjectSummary,
  type ProjectTheme,
  type Theme,
  type Workspace,
} from "@prism/shared";
import { Router } from "express";
import type { Prisma } from "../db/generated/client.js";
import { prisma } from "../db/client.js";
import { notFound, orNotFound, parseBody } from "../errors.js";
import { requireUser } from "../session.js";
import { BOARD_NOT_FOUND, liveBoardWhere, uuidParam } from "./board-access.js";

/** How many board tiles a project card shows. */
const PROJECT_TILES = 3;

const liveBoards = { archivedAt: null };

// The same selections everywhere, so each response shape has one source.
const boardSelect = {
  id: true,
  name: true,
  description: true,
  projectId: true,
  customColors: true,
  customFonts: true,
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
    select: { id: true, name: true, editedAt: true, _count: boardSelect._count },
  },
} as const;

type BoardRow = {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  customColors: string[];
  customFonts: string[];
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
  boards: { id: string; name: string; editedAt: Date; _count: { elements: number } }[];
};

function toBoardSummary({ _count, createdAt, editedAt, ...board }: BoardRow): BoardSummary {
  return {
    ...board,
    itemCount: _count.elements,
    createdAt: createdAt.toISOString(),
    editedAt: editedAt.toISOString(),
  };
}

function toProjectSummary({
  _count,
  createdAt,
  editedAt,
  boards,
  ...project
}: ProjectRow): ProjectSummary {
  return {
    ...project,
    boardCount: _count.boards,
    boards: boards.map((board) => ({
      id: board.id,
      name: board.name,
      itemCount: board._count.elements,
      editedAt: board.editedAt.toISOString(),
    })),
    createdAt: createdAt.toISOString(),
    editedAt: editedAt.toISOString(),
  };
}

/** The user's live projects. */
const liveProjectWhere = (ownerId: string) => ({ ownerId, archivedAt: null });

const PROJECT_NOT_FOUND = "That project no longer exists.";

// Writes check ownership in their own WHERE clause instead of a separate lookup first: every
// query is a round trip to the database, so fewer queries is what makes these routes fast.
// The project.editedAt bumps aren't in a transaction with the board write; if one fails, the
// only cost is a stale "edited" time.

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
export async function loadWorkspace(ownerId: string): Promise<Workspace> {
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
  return { projects: projects.map(toProjectSummary), boards: boards.map(toBoardSummary) };
}

/** A new board, standalone or in one of the owner's live projects. */
export async function createBoard(ownerId: string, input: CreateBoardInput) {
  const projectId = input.projectId || null;
  const editedAt = new Date();

  // A new board counts as an edit to its project; the bump is also the ownership check.
  if (projectId && !(await touchProject(ownerId, projectId, editedAt))) {
    throw notFound(PROJECT_NOT_FOUND);
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
  return toBoardSummary(board);
}

/** The owner's live board, or a 404. */
export async function getBoardSummary(
  ownerId: string,
  boardIdParam: string | string[] | undefined,
) {
  const boardId = uuidParam(boardIdParam);
  const board = boardId
    ? await prisma.board.findFirst({
        where: { id: boardId, ...liveBoardWhere(ownerId) },
        select: boardSelect,
      })
    : null;
  if (!board) throw notFound(BOARD_NOT_FOUND);
  return toBoardSummary(board);
}

/** A new project. */
export async function createProject(ownerId: string, input: CreateProjectInput) {
  const project = await prisma.project.create({
    data: { ownerId, name: input.name, description: input.description || null },
    select: projectSelect,
  });
  return toProjectSummary(project);
}

// ── Themes (packages/shared/src/theme.ts) ──────────────────────────────────

/** A stored theme, or null for none (or one that no longer parses). */
function storedTheme(value: unknown): Theme | null {
  const result = themeSchema.safeParse(value);
  return result.success ? result.data : null;
}

const projectTheme = (projectId: string, stored: Theme | null): ProjectTheme => {
  const theme = stored ?? DEFAULT_THEME;
  return { projectId, saved: stored !== null, theme, css: themeToCss(theme) };
};

/** The user's live project's theme: its own, or the default while it has none. */
export async function getProjectTheme(ownerId: string, projectIdParam: string | undefined) {
  const projectId = uuidParam(projectIdParam);
  const project = projectId
    ? await prisma.project.findFirst({
        where: { id: projectId, ...liveProjectWhere(ownerId) },
        select: { id: true, theme: true },
      })
    : null;
  if (!project) throw notFound(PROJECT_NOT_FOUND);
  return projectTheme(project.id, storedTheme(project.theme));
}

/** Replaces the project's theme. Not a content edit, so editedAt stays. */
export async function saveProjectTheme(
  ownerId: string,
  projectIdParam: string | undefined,
  theme: Theme,
) {
  const projectId = uuidParam(projectIdParam);
  const { count } = projectId
    ? await prisma.project.updateMany({
        where: { id: projectId, ...liveProjectWhere(ownerId) },
        data: { theme: theme as Prisma.InputJsonObject },
      })
    : { count: 0 };
  if (!projectId || count === 0) throw notFound(PROJECT_NOT_FOUND);
  return projectTheme(projectId, theme);
}

// ── Components (packages/shared/src/components.ts) ─────────────────────────

/** Stored components, or none when there are none (or they no longer parse). */
function storedComponents(value: unknown): Components {
  const result = componentsSchema.safeParse(value ?? {});
  return result.success ? result.data : {};
}

/** The user's live project's components, by name. */
export async function getProjectComponents(ownerId: string, projectIdParam: string | undefined) {
  const projectId = uuidParam(projectIdParam);
  const project = projectId
    ? await prisma.project.findFirst({
        where: { id: projectId, ...liveProjectWhere(ownerId) },
        select: { id: true, components: true },
      })
    : null;
  if (!project) throw notFound(PROJECT_NOT_FOUND);
  return { projectId: project.id, components: storedComponents(project.components) };
}

/** Replaces the project's components. Not a content edit, so editedAt stays. */
export async function saveProjectComponents(
  ownerId: string,
  projectId: string,
  components: Components,
) {
  const { count } = await prisma.project.updateMany({
    where: { id: projectId, ...liveProjectWhere(ownerId) },
    data: { components: components as Prisma.InputJsonObject },
  });
  if (count === 0) throw notFound(PROJECT_NOT_FOUND);
}

/** The components a board's screens can use: its project's (none outside a project). */
export async function boardComponents(board: { projectId: string | null }): Promise<Components> {
  if (!board.projectId) return {};
  const project = await prisma.project.findUnique({
    where: { id: board.projectId },
    select: { components: true },
  });
  return storedComponents(project?.components);
}

/** The theme a board draws with: its project's, else the default. */
export async function boardTheme(board: { projectId: string | null }): Promise<Theme> {
  if (!board.projectId) return DEFAULT_THEME;
  const project = await prisma.project.findUnique({
    where: { id: board.projectId },
    select: { theme: true },
  });
  return storedTheme(project?.theme) ?? DEFAULT_THEME;
}

workspaceRouter.get("/workspace", async (_req, res) => {
  res.json(await loadWorkspace(res.locals.userId));
});

workspaceRouter.post("/projects", async (req, res) => {
  const input = parseBody(createProjectSchema, req.body);
  res.status(201).json(await createProject(res.locals.userId, input));
});

workspaceRouter.get("/projects/:projectId/theme", async (req, res) => {
  res.json(await getProjectTheme(res.locals.userId, req.params.projectId));
});

workspaceRouter.put("/projects/:projectId/theme", async (req, res) => {
  const theme = parseBody(themeSchema, req.body);
  res.json(await saveProjectTheme(res.locals.userId, req.params.projectId, theme));
});

workspaceRouter.patch("/projects/:projectId", async (req, res) => {
  const projectId = uuidParam(req.params.projectId);
  const input = parseBody(updateProjectSchema, req.body);
  if (!projectId) throw notFound(PROJECT_NOT_FOUND);

  const project = await orNotFound(
    prisma.project.update({
      where: { id: projectId, ...liveProjectWhere(res.locals.userId) },
      data: { name: input.name, description: input.description || null, editedAt: new Date() },
      select: projectSelect,
    }),
    PROJECT_NOT_FOUND,
  );
  res.json(toProjectSummary(project));
});

/** Permanent: the project's boards and their elements are deleted with it (onDelete: Cascade). */
workspaceRouter.delete("/projects/:projectId", async (req, res) => {
  const projectId = uuidParam(req.params.projectId);
  const { count } = projectId
    ? await prisma.project.deleteMany({ where: { id: projectId, ownerId: res.locals.userId } })
    : { count: 0 };
  if (count === 0) throw notFound(PROJECT_NOT_FOUND);
  res.json({ id: projectId });
});

workspaceRouter.post("/boards", async (req, res) => {
  const input = parseBody(createBoardSchema, req.body);
  res.status(201).json(await createBoard(res.locals.userId, input));
});

workspaceRouter.get("/boards/:boardId", async (req, res) => {
  res.json(await getBoardSummary(res.locals.userId, req.params.boardId));
});

/** Renames a board, changes its description, or moves it into, out of, or between projects. */
workspaceRouter.patch("/boards/:boardId", async (req, res) => {
  const boardId = uuidParam(req.params.boardId);
  const input = parseBody(updateBoardSchema, req.body);
  const ownerId = res.locals.userId;

  // Needed for the project it may be leaving.
  const current = boardId
    ? await prisma.board.findFirst({
        where: { id: boardId, ...liveBoardWhere(ownerId) },
        select: { id: true, projectId: true },
      })
    : null;
  if (!current) throw notFound(BOARD_NOT_FOUND);

  const projectId = input.projectId || null;
  const editedAt = new Date();
  // The project it joins and the one it leaves have both changed. Joining one also checks it's theirs.
  if (projectId && !(await touchProject(ownerId, projectId, editedAt))) {
    throw notFound(PROJECT_NOT_FOUND);
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

/** Replaces the board's custom swatches and/or added fonts. Not a content edit, so editedAt stays. */
workspaceRouter.patch("/boards/:boardId/style", async (req, res) => {
  const boardId = uuidParam(req.params.boardId);
  const input = parseBody(updateBoardStyleSchema, req.body);
  if (!boardId) throw notFound(BOARD_NOT_FOUND);
  const { count } = await prisma.board.updateMany({
    where: { id: boardId, ...liveBoardWhere(res.locals.userId) },
    data: input,
  });
  if (count === 0) throw notFound(BOARD_NOT_FOUND);
  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
    select: boardSelect,
  });
  res.json(toBoardSummary(board));
});

/** Permanent: the board's elements are deleted with it (onDelete: Cascade). */
workspaceRouter.delete("/boards/:boardId", async (req, res) => {
  const boardId = uuidParam(req.params.boardId);
  const ownerId = res.locals.userId;
  if (!boardId) throw notFound(BOARD_NOT_FOUND);

  const { projectId } = await orNotFound(
    prisma.board.delete({ where: { id: boardId, ownerId }, select: { projectId: true } }),
    BOARD_NOT_FOUND,
  );
  // Losing a board counts as an edit to its project.
  if (projectId) await touchProject(ownerId, projectId, new Date());
  res.json({ id: boardId });
});

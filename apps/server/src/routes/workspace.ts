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
import { HttpError, notFound, orNotFound, parseBody } from "../errors.js";
import { requireUser } from "../session.js";
import {
  accessibleBoardWhere,
  accessOf,
  boardAccessSelect,
  BOARD_NOT_FOUND,
  boardFor,
  liveBoardWhere,
  liveProjectWhere,
  PROJECT_NOT_FOUND,
  projectFor,
  sharedBoardWhere,
  sharedProjectWhere,
  uuidParam,
} from "./board-access.js";

/** How many board tiles a project card shows. */
const PROJECT_TILES = 3;

const liveBoards = { archivedAt: null };

const ownerName = { owner: { select: { name: true } } } as const;

// The same selections everywhere, so each response shape has one source. They take the
// signed-in user, whose access to the item comes with it.
const boardSelect = (userId: string) =>
  ({
    id: true,
    name: true,
    description: true,
    projectId: true,
    customColors: true,
    customFonts: true,
    createdAt: true,
    editedAt: true,
    _count: { select: { elements: { where: { deletedAt: null } } } },
    ...ownerName,
    ...boardAccessSelect(userId),
  }) as const;

const projectSelect = (userId: string) =>
  ({
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
      select: {
        id: true,
        name: true,
        editedAt: true,
        _count: { select: { elements: { where: { deletedAt: null } } } },
      },
    },
    ...ownerName,
    ownerId: true,
    members: { where: { userId }, select: { role: true } },
  }) as const;

type Role = "editor" | "viewer";

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
  owner: { name: string };
  ownerId: string;
  members: { role: Role }[];
  project: { members: { role: Role }[] } | null;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  editedAt: Date;
  _count: { boards: number };
  boards: { id: string; name: string; editedAt: Date; _count: { elements: number } }[];
  owner: { name: string };
  ownerId: string;
  members: { role: Role }[];
};

function toBoardSummary(row: BoardRow, userId: string): BoardSummary {
  const {
    _count,
    createdAt,
    editedAt,
    owner,
    ownerId: _o,
    members: _m,
    project: _p,
    ...board
  } = row;
  return {
    ...board,
    itemCount: _count.elements,
    access: accessOf(row, userId),
    ownerName: owner.name,
    createdAt: createdAt.toISOString(),
    editedAt: editedAt.toISOString(),
  };
}

function toProjectSummary(row: ProjectRow, userId: string): ProjectSummary {
  const { _count, createdAt, editedAt, boards, owner, ownerId: _o, members: _m, ...project } = row;
  return {
    ...project,
    boardCount: _count.boards,
    boards: boards.map((board) => ({
      id: board.id,
      name: board.name,
      itemCount: board._count.elements,
      editedAt: board.editedAt.toISOString(),
    })),
    access: accessOf(row, userId),
    ownerName: owner.name,
    createdAt: createdAt.toISOString(),
    editedAt: editedAt.toISOString(),
  };
}

// Writes check ownership in their own WHERE clause instead of a separate lookup first where they
// can: every query is a round trip to the database, so fewer queries is what makes these routes
// fast. The project.editedAt bumps aren't in a transaction with the board write; if one fails,
// the only cost is a stale "edited" time.

/** Marks a project as edited (a board in it was added, removed or changed). */
async function touchProject(projectId: string, editedAt: Date) {
  await prisma.project.updateMany({ where: { id: projectId }, data: { editedAt } });
}

export const workspaceRouter = Router();

workspaceRouter.use(requireUser);

/** Everything the dashboard shows: the user's live projects and boards, and what's shared with them. */
export async function loadWorkspace(userId: string): Promise<Workspace> {
  const [projects, boards, sharedProjects, sharedBoards] = await Promise.all([
    prisma.project.findMany({
      where: liveProjectWhere(userId),
      orderBy: { editedAt: "desc" },
      select: projectSelect(userId),
    }),
    prisma.board.findMany({
      where: liveBoardWhere(userId),
      orderBy: { editedAt: "desc" },
      select: boardSelect(userId),
    }),
    prisma.project.findMany({
      where: sharedProjectWhere(userId),
      orderBy: { editedAt: "desc" },
      select: projectSelect(userId),
    }),
    prisma.board.findMany({
      where: sharedBoardWhere(userId),
      orderBy: { editedAt: "desc" },
      select: boardSelect(userId),
    }),
  ]);
  return {
    projects: projects.map((p) => toProjectSummary(p, userId)),
    boards: boards.map((b) => toBoardSummary(b, userId)),
    shared: {
      projects: sharedProjects.map((p) => toProjectSummary(p, userId)),
      boards: sharedBoards.map((b) => toBoardSummary(b, userId)),
    },
  };
}

/**
 * A new board, standalone or in a live project the user owns or edits. A board in a project
 * belongs to the project's owner (board.ownerId = project.ownerId), whoever made it.
 */
export async function createBoard(userId: string, input: CreateBoardInput) {
  const projectId = input.projectId || null;
  const editedAt = new Date();
  const project = projectId ? await projectFor(projectId, userId, "edit") : null;

  const board = await prisma.board.create({
    data: {
      ownerId: project?.ownerId ?? userId,
      projectId,
      name: input.name,
      description: input.description || null,
      editedAt,
    },
    select: boardSelect(userId),
  });
  // A new board counts as an edit to its project.
  if (projectId) await touchProject(projectId, editedAt);
  return toBoardSummary(board, userId);
}

/** A live board the user may see, or a 404. */
export async function getBoardSummary(userId: string, boardIdParam: string | string[] | undefined) {
  const boardId = uuidParam(boardIdParam);
  const board = boardId
    ? await prisma.board.findFirst({
        where: { id: boardId, ...accessibleBoardWhere(userId) },
        select: boardSelect(userId),
      })
    : null;
  if (!board) throw notFound(BOARD_NOT_FOUND);
  return toBoardSummary(board, userId);
}

/** A new project. */
export async function createProject(ownerId: string, input: CreateProjectInput) {
  const project = await prisma.project.create({
    data: { ownerId, name: input.name, description: input.description || null },
    select: projectSelect(ownerId),
  });
  return toProjectSummary(project, ownerId);
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

/** A live project's theme (one the user may see): its own, or the default while it has none. */
export async function getProjectTheme(userId: string, projectIdParam: string | undefined) {
  const { id } = await projectFor(projectIdParam, userId, "view");
  const project = await prisma.project.findUniqueOrThrow({
    where: { id },
    select: { theme: true },
  });
  return projectTheme(id, storedTheme(project.theme));
}

/** Replaces the project's theme. Not a content edit, so editedAt stays. */
export async function saveProjectTheme(
  userId: string,
  projectIdParam: string | undefined,
  theme: Theme,
) {
  const { id } = await projectFor(projectIdParam, userId, "edit");
  await prisma.project.update({
    where: { id },
    data: { theme: theme as Prisma.InputJsonObject },
  });
  return projectTheme(id, theme);
}

// ── Components (packages/shared/src/components.ts) ─────────────────────────

/** Stored components, or none when there are none (or they no longer parse). */
function storedComponents(value: unknown): Components {
  const result = componentsSchema.safeParse(value ?? {});
  return result.success ? result.data : {};
}

/** A live project's components (one the user may see), by name. */
export async function getProjectComponents(userId: string, projectIdParam: string | undefined) {
  const { id } = await projectFor(projectIdParam, userId, "view");
  const project = await prisma.project.findUniqueOrThrow({
    where: { id },
    select: { components: true },
  });
  return { projectId: id, components: storedComponents(project.components) };
}

/** Replaces the project's components. Not a content edit, so editedAt stays. */
export async function saveProjectComponents(
  userId: string,
  projectId: string,
  components: Components,
) {
  const { id } = await projectFor(projectId, userId, "edit");
  await prisma.project.update({
    where: { id },
    data: { components: components as Prisma.InputJsonObject },
  });
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

// ── Design sites (mcp/site-context.ts) ─────────────────────────────────────

/** What the design guide needs of an element: where it is, its group, fill, font and image. */
export type SiteElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string | null;
  groupId: string | null;
  font?: string;
  /** The stored file it shows (an image element's, or a shape's image fill), e.g. "3f…a1.jpg". */
  image?: string;
};

/** Element types whose props are small and say something the design guide reads (font, image). */
const SITE_PROP_TYPES = ["text", "image", "rect", "ellipse", "frame"] as const;

/** A website: a project and its boards, or a board outside any project. */
export type DesignSite = {
  name: string;
  /** The project's saved theme; null for the default theme or a board without a project. */
  theme: Theme | null;
  boards: { id: string; name: string; elements: SiteElement[] }[];
};

/** How many recently edited boards to look through for the user's other sites. */
const RECENT_BOARDS = 40;

/**
 * The site a board belongs to and the user's other recent sites, for the design guide: one site
 * stays consistent, different sites stay different.
 */
export async function designSites(userId: string, boardIdParam: string) {
  const boardId = uuidParam(boardIdParam);
  const siteBoard = { id: true, name: true, projectId: true } as const;
  const projectInfo = { select: { name: true, theme: true } } as const;
  const board = boardId
    ? await prisma.board.findFirst({
        where: { id: boardId, ...accessibleBoardWhere(userId) },
        select: { ...siteBoard, project: projectInfo },
      })
    : null;
  if (!board) throw notFound(BOARD_NOT_FOUND);

  const [siteBoards, latest] = await Promise.all([
    board.projectId
      ? prisma.board.findMany({
          where: { projectId: board.projectId, ...accessibleBoardWhere(userId) },
          orderBy: { createdAt: "asc" },
          select: siteBoard,
        })
      : [board],
    prisma.board.findMany({
      where: accessibleBoardWhere(userId),
      orderBy: { editedAt: "desc" },
      take: RECENT_BOARDS,
      select: { ...siteBoard, project: projectInfo },
    }),
  ]);
  const inSite = new Set(siteBoards.map((b) => b.id));
  const recent = latest.filter(
    (b) => !inSite.has(b.id) && !(board.projectId && b.projectId === board.projectId),
  );

  // Other sites, most recently edited first: a project with its boards, or a board on its own.
  const others = new Map<string, { name: string; theme: unknown; boardIds: string[] }>();
  for (const other of recent) {
    const key = other.projectId ?? other.id;
    const site = others.get(key) ?? {
      name: other.project?.name ?? other.name,
      theme: other.project?.theme ?? null,
      boardIds: [],
    };
    site.boardIds.push(other.id);
    others.set(key, site);
  }

  const boardIds = [...siteBoards.map((b) => b.id), ...recent.map((b) => b.id)];
  // Fonts and images come from props, read only for the types that have them: props can hold
  // large point lists and list items.
  const [rows, propRows] = await Promise.all([
    prisma.element.findMany({
      where: { boardId: { in: boardIds }, deletedAt: null },
      select: {
        boardId: true,
        id: true,
        type: true,
        x: true,
        y: true,
        width: true,
        height: true,
        fill: true,
        groupId: true,
      },
    }),
    prisma.element.findMany({
      where: { boardId: { in: boardIds }, deletedAt: null, type: { in: [...SITE_PROP_TYPES] } },
      select: { id: true, props: true },
    }),
  ]);
  const extras = new Map<string, Pick<SiteElement, "font" | "image">>();
  for (const { id, props } of propRows) {
    const { font, assetKey, fillImage } = (props ?? {}) as {
      font?: unknown;
      assetKey?: unknown;
      fillImage?: { assetKey?: unknown } | null;
    };
    const key = assetKey ?? fillImage?.assetKey;
    const image = typeof key === "string" ? key.split("/").pop() : undefined;
    if (typeof font === "string" || image) {
      extras.set(id, { ...(typeof font === "string" && { font }), ...(image && { image }) });
    }
  }
  const byBoard = new Map<string, SiteElement[]>();
  for (const { boardId: owner, ...row } of rows) {
    const list = byBoard.get(owner) ?? [];
    list.push({ ...row, ...extras.get(row.id) });
    byBoard.set(owner, list);
  }
  const boardsOf = (list: { id: string; name: string }[]) =>
    list.map(({ id, name }) => ({ id, name, elements: byBoard.get(id) ?? [] }));
  const recentById = new Map(recent.map((b) => [b.id, b]));

  const current: DesignSite = {
    name: board.project?.name ?? board.name,
    theme: storedTheme(board.project?.theme),
    boards: boardsOf(siteBoards),
  };
  const other: DesignSite[] = [...others.values()].map((site) => ({
    name: site.name,
    theme: storedTheme(site.theme),
    boards: boardsOf(site.boardIds.flatMap((id) => recentById.get(id) ?? [])),
  }));
  return { current, others: other };
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

/** Renames the project or changes its description. The owner's alone. */
workspaceRouter.patch("/projects/:projectId", async (req, res) => {
  const projectId = uuidParam(req.params.projectId);
  const input = parseBody(updateProjectSchema, req.body);
  const userId = res.locals.userId;
  if (!projectId) throw notFound(PROJECT_NOT_FOUND);

  const project = await orNotFound(
    prisma.project.update({
      where: { id: projectId, ...liveProjectWhere(userId) },
      data: { name: input.name, description: input.description || null, editedAt: new Date() },
      select: projectSelect(userId),
    }),
    PROJECT_NOT_FOUND,
  );
  res.json(toProjectSummary(project, userId));
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

/**
 * Renames a board or changes its description (owner or editor), or moves it into, out of, or
 * between projects (the owner, into their own projects).
 */
workspaceRouter.patch("/boards/:boardId", async (req, res) => {
  const input = parseBody(updateBoardSchema, req.body);
  const userId = res.locals.userId;
  const current = await boardFor(req.params.boardId, userId, "edit");

  const projectId = input.projectId || null;
  const editedAt = new Date();
  if (current.projectId !== projectId) {
    if (current.access !== "owner") {
      throw new HttpError(403, "Only the board's owner can move it to another project.");
    }
    // The project it joins must be the owner's own (board.ownerId = project.ownerId).
    if (projectId) {
      const { count } = await prisma.project.updateMany({
        where: { id: projectId, ...liveProjectWhere(userId) },
        data: { editedAt },
      });
      if (count === 0) throw notFound(PROJECT_NOT_FOUND);
    }
  }

  const [board] = await Promise.all([
    prisma.board.update({
      where: { id: current.id },
      data: { name: input.name, description: input.description || null, projectId, editedAt },
      select: boardSelect(userId),
    }),
    // The project it left (or stays in) has changed too.
    current.projectId && touchProject(current.projectId, editedAt),
  ]);
  res.json(toBoardSummary(board, userId));
});

/** Replaces the board's custom swatches and/or added fonts. Not a content edit, so editedAt stays. */
workspaceRouter.patch("/boards/:boardId/style", async (req, res) => {
  const input = parseBody(updateBoardStyleSchema, req.body);
  const userId = res.locals.userId;
  const { id } = await boardFor(req.params.boardId, userId, "edit");
  const board = await prisma.board.update({
    where: { id },
    data: input,
    select: boardSelect(userId),
  });
  res.json(toBoardSummary(board, userId));
});

/** Permanent: the board's elements are deleted with it (onDelete: Cascade). The owner's alone. */
workspaceRouter.delete("/boards/:boardId", async (req, res) => {
  const boardId = uuidParam(req.params.boardId);
  const ownerId = res.locals.userId;
  if (!boardId) throw notFound(BOARD_NOT_FOUND);

  const { projectId } = await orNotFound(
    prisma.board.delete({ where: { id: boardId, ownerId }, select: { projectId: true } }),
    BOARD_NOT_FOUND,
  );
  // Losing a board counts as an edit to its project.
  if (projectId) await touchProject(projectId, new Date());
  res.json({ id: boardId });
});

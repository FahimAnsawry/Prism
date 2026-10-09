import {
  boardSummarySchema,
  deletedSchema,
  projectSummarySchema,
  workspaceSchema,
  type BoardSummary,
  type CreateBoardInput,
  type CreateProjectInput,
  type ProjectSummary,
  type UpdateBoardInput,
  type UpdateBoardStyleInput,
  type UpdateProjectInput,
  type Workspace,
} from "@prism/shared";
import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";

const WORKSPACE_KEY = ["workspace"] as const;

/** The dashboard's projects and boards. */
export const workspaceQuery = queryOptions({
  queryKey: WORKSPACE_KEY,
  queryFn: () => apiFetch("/api/workspace", workspaceSchema),
});

export const boardQuery = (boardId: string) =>
  queryOptions({
    queryKey: ["board", boardId],
    queryFn: () => apiFetch(`/api/boards/${encodeURIComponent(boardId)}`, boardSummarySchema),
  });

const projectPath = (id: string) => `/api/projects/${encodeURIComponent(id)}`;
const boardPath = (id: string) => `/api/boards/${encodeURIComponent(id)}`;

/** How many board tiles the server sends per project (see PROJECT_TILES on the server). */
const PROJECT_TILES = 3;

/**
 * Applies a mutation's result to the cached workspace right away, so the dashboard updates the
 * moment the server answers. Then refetches in the background, without waiting for it, to pick up
 * anything the patch doesn't model exactly (a project's tiles after a move, server timestamps).
 */
function patchWorkspace(queryClient: QueryClient, patch: (workspace: Workspace) => Workspace) {
  queryClient.setQueryData<Workspace>(WORKSPACE_KEY, (workspace) =>
    workspace ? patch(workspace) : workspace,
  );
  void queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
}

const withProject = (workspace: Workspace, id: string, change: Partial<ProjectSummary>) => ({
  ...workspace,
  projects: workspace.projects.map((p) => (p.id === id ? { ...p, ...change } : p)),
});

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["project", "create"],
    mutationFn: (input: CreateProjectInput) =>
      apiFetch("/api/projects", projectSummarySchema, { method: "POST", body: input }),
    onSuccess: (project) =>
      patchWorkspace(queryClient, (w) => ({ ...w, projects: [project, ...w.projects] })),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["project", "update"],
    mutationFn: ({ id, ...input }: UpdateProjectInput & { id: string }) =>
      apiFetch(projectPath(id), projectSummarySchema, { method: "PATCH", body: input }),
    onSuccess: (project) => patchWorkspace(queryClient, (w) => withProject(w, project.id, project)),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["project", "delete"],
    mutationFn: (id: string) => apiFetch(projectPath(id), deletedSchema, { method: "DELETE" }),
    onSuccess: ({ id }) => {
      // Its boards went with it.
      queryClient.removeQueries({ queryKey: ["board"] });
      patchWorkspace(queryClient, (w) => ({
        ...w,
        projects: w.projects.filter((p) => p.id !== id),
        boards: w.boards.filter((b) => b.projectId !== id),
      }));
    },
  });
}

const tileOf = ({ id, name, itemCount, editedAt }: BoardSummary) => ({
  id,
  name,
  itemCount,
  editedAt,
});

/** Every board the user can open: their own and the ones shared with them. */
export const allBoards = (workspace: Workspace) => [
  ...workspace.boards,
  ...workspace.shared.boards,
];

/** Every project the user can open: their own and the ones shared with them. */
export const allProjects = (workspace: Workspace) => [
  ...workspace.projects,
  ...workspace.shared.projects,
];

/** Applies `change` to the board in whichever list holds it (the user's own or shared ones). */
function withBoard(workspace: Workspace, board: BoardSummary): Workspace {
  const swap = (list: BoardSummary[]) => list.map((b) => (b.id === board.id ? board : b));
  return {
    ...workspace,
    boards: swap(workspace.boards),
    shared: { ...workspace.shared, boards: swap(workspace.shared.boards) },
  };
}

/** A board joined `projectId`: count it and show it first among the tiles. */
function addToProject(workspace: Workspace, board: BoardSummary) {
  const project = workspace.projects.find((p) => p.id === board.projectId);
  if (!project) return workspace;
  return withProject(workspace, project.id, {
    boardCount: project.boardCount + 1,
    boards: [tileOf(board), ...project.boards].slice(0, PROJECT_TILES),
    editedAt: board.editedAt,
  });
}

/** A board left `projectId`: uncount it and drop its tile (the refetch fills the gap). */
function removeFromProject(workspace: Workspace, projectId: string | null, boardId: string) {
  const project = workspace.projects.find((p) => p.id === projectId);
  if (!project) return workspace;
  return withProject(workspace, project.id, {
    boardCount: Math.max(0, project.boardCount - 1),
    boards: project.boards.filter((b) => b.id !== boardId),
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["board", "create"],
    mutationFn: (input: CreateBoardInput) =>
      apiFetch("/api/boards", boardSummarySchema, { method: "POST", body: input }),
    onSuccess: (board) => {
      queryClient.setQueryData(boardQuery(board.id).queryKey, board);
      patchWorkspace(queryClient, (w) =>
        // A board made in a project shared with the user belongs to the project's owner.
        board.access === "owner"
          ? addToProject({ ...w, boards: [board, ...w.boards] }, board)
          : { ...w, shared: { ...w.shared, boards: [board, ...w.shared.boards] } },
      );
    },
  });
}

export function useUpdateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["board", "update"],
    mutationFn: ({ id, ...input }: UpdateBoardInput & { id: string }) =>
      apiFetch(boardPath(id), boardSummarySchema, { method: "PATCH", body: input }),
    onSuccess: (board) => {
      queryClient.setQueryData(boardQuery(board.id).queryKey, board);
      patchWorkspace(queryClient, (w) => {
        const before = w.boards.find((b) => b.id === board.id);
        let next = withBoard(w, board);
        if (before && before.projectId !== board.projectId) {
          next = addToProject(removeFromProject(next, before.projectId, board.id), board);
        } else if (board.projectId) {
          // Same project: rename its tile.
          const project = next.projects.find((p) => p.id === board.projectId);
          if (project) {
            next = withProject(next, project.id, {
              boards: project.boards.map((t) => (t.id === board.id ? tileOf(board) : t)),
              editedAt: board.editedAt,
            });
          }
        }
        return next;
      });
    },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["board", "delete"],
    mutationFn: (id: string) => apiFetch(boardPath(id), deletedSchema, { method: "DELETE" }),
    onSuccess: ({ id }) => {
      queryClient.removeQueries({ queryKey: boardQuery(id).queryKey });
      patchWorkspace(queryClient, (w) => {
        const board = w.boards.find((b) => b.id === id);
        const next = { ...w, boards: w.boards.filter((b) => b.id !== id) };
        return board ? removeFromProject(next, board.projectId, id) : next;
      });
    },
  });
}

/**
 * Saves a board's custom swatches and added fonts. The board query updates first, so the panel
 * shows the change at once; a failed save puts the previous lists back.
 */
export function useUpdateBoardStyle(boardId: string) {
  const queryClient = useQueryClient();
  const key = boardQuery(boardId).queryKey;
  return useMutation({
    mutationKey: ["board", "style", boardId],
    mutationFn: (input: UpdateBoardStyleInput) =>
      apiFetch(`${boardPath(boardId)}/style`, boardSummarySchema, { method: "PATCH", body: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardSummary>(key);
      if (previous) queryClient.setQueryData<BoardSummary>(key, { ...previous, ...input });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (board) => {
      queryClient.setQueryData(key, board);
      queryClient.setQueryData<Workspace>(WORKSPACE_KEY, (w) => (w ? withBoard(w, board) : w));
    },
  });
}

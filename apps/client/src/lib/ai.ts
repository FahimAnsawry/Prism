// AI editors: personal access tokens (dashboard) and "Ask AI" edit requests (board).

import {
  apiTokensSchema,
  createdApiTokenSchema,
  deletedSchema,
  editRequestSchema,
  editRequestsSchema,
  type CreateApiTokenInput,
  type CreateEditRequestInput,
  type EditRequest,
  type UpdateEditRequestInput,
} from "@prism/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";

/** The server's remote MCP endpoint. */
export const MCP_URL = new URL("/mcp", import.meta.env.VITE_SERVER_URL).toString();

export const CLAUDE_COMMAND = `claude mcp add --transport http --scope user prism ${MCP_URL}`;
export const CODEX_COMMAND = `codex mcp add prism --url ${MCP_URL}`;

const TOKENS_KEY = ["api-tokens"] as const;

export const apiTokensQuery = queryOptions({
  queryKey: TOKENS_KEY,
  queryFn: () => apiFetch("/api/tokens", apiTokensSchema).then((data) => data.tokens),
});

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiTokenInput) =>
      apiFetch("/api/tokens", createdApiTokenSchema, { method: "POST", body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: TOKENS_KEY }),
  });
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/tokens/${encodeURIComponent(id)}`, deletedSchema, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: TOKENS_KEY }),
  });
}

const editsPath = (boardId: string) => `/api/boards/${encodeURIComponent(boardId)}/edits`;

/**
 * The board's recent edit requests, newest first. Kept current by the board's socket, so it's
 * never refetched on its own: the board's loader fetches it fresh, and a reconnect refetches it.
 */
export const boardEditsQuery = (boardId: string) =>
  queryOptions({
    queryKey: ["board-edits", boardId],
    queryFn: () => apiFetch(editsPath(boardId), editRequestsSchema).then((data) => data.requests),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

/** Puts a created or changed request into the cached list (newest first). */
export function useMergeEdit(boardId: string) {
  const queryClient = useQueryClient();
  return (request: EditRequest) =>
    queryClient.setQueryData<EditRequest[]>(boardEditsQuery(boardId).queryKey, (list = []) => {
      const rest = list.filter((r) => r.id !== request.id);
      return [request, ...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
}

/** Pauses, resumes or rewords a request no AI editor has picked up yet. */
export function useUpdateEdit(boardId: string) {
  const merge = useMergeEdit(boardId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateEditRequestInput & { id: string }) =>
      apiFetch(`${editsPath(boardId)}/${encodeURIComponent(id)}`, editRequestSchema, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: merge,
    // An editor picked it up first (409) or it's gone: show what the server has now.
    onError: () =>
      void queryClient.invalidateQueries({ queryKey: boardEditsQuery(boardId).queryKey }),
  });
}

/** Stops a request an AI editor is working on; it stops at its next Prism action. */
export function useStopEdit(boardId: string) {
  const merge = useMergeEdit(boardId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`${editsPath(boardId)}/${encodeURIComponent(id)}/stop`, editRequestSchema, {
        method: "POST",
      }),
    onSuccess: merge,
    // It finished first (409) or is gone: show what the server has now.
    onError: () =>
      void queryClient.invalidateQueries({ queryKey: boardEditsQuery(boardId).queryKey }),
  });
}

/** Takes a deleted request out of the cached list. */
export function useRemoveEdit(boardId: string) {
  const queryClient = useQueryClient();
  return (id: string) =>
    queryClient.setQueryData<EditRequest[]>(boardEditsQuery(boardId).queryKey, (list = []) =>
      list.filter((r) => r.id !== id),
    );
}

export function useDeleteEdit(boardId: string) {
  const remove = useRemoveEdit(boardId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`${editsPath(boardId)}/${encodeURIComponent(id)}`, deletedSchema, {
        method: "DELETE",
      }),
    onSuccess: ({ id }) => remove(id),
    onError: () =>
      void queryClient.invalidateQueries({ queryKey: boardEditsQuery(boardId).queryKey }),
  });
}

export function useCreateEdit(boardId: string) {
  const merge = useMergeEdit(boardId);
  return useMutation({
    mutationFn: (input: CreateEditRequestInput) =>
      apiFetch(editsPath(boardId), editRequestSchema, { method: "POST", body: input }),
    onSuccess: merge,
  });
}

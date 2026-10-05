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
} from "@prism/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";

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

/** The board's recent edit requests, newest first. Kept current by the board's socket. */
export const boardEditsQuery = (boardId: string) =>
  queryOptions({
    queryKey: ["board-edits", boardId],
    queryFn: () => apiFetch(editsPath(boardId), editRequestsSchema).then((data) => data.requests),
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

export function useCreateEdit(boardId: string) {
  const merge = useMergeEdit(boardId);
  return useMutation({
    mutationFn: (input: CreateEditRequestInput) =>
      apiFetch(editsPath(boardId), editRequestSchema, { method: "POST", body: input }),
    onSuccess: merge,
  });
}

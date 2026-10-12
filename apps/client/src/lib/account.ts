// The profile page: the signed-in user's photo, sign-in methods and connected AI editors.

import { connectedEditorsSchema, editorRevokedSchema, photoSchema } from "@prism/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";
import { authClient } from "./auth-client";

/**
 * Reads the session again from the database. The session cookie caches the user for minutes, so
 * after a change the server made on its own (the photo) the page would show the old one.
 */
export async function refreshSession() {
  await authClient.getSession({ query: { disableCookieCache: true } });
  authClient.$store.notify("$sessionSignal");
}

/** The sign-in methods linked to the account ("credential" is the password). */
export const signInMethodsQuery = queryOptions({
  queryKey: ["account", "sign-in-methods"],
  queryFn: async () => {
    const { data, error } = await authClient.listAccounts();
    if (error) throw new Error(error.message ?? "Couldn't load your sign-in methods.");
    return data;
  },
});

export const editorsQuery = queryOptions({
  queryKey: ["account", "editors"],
  queryFn: () => apiFetch("/api/account/editors", connectedEditorsSchema).then((d) => d.editors),
});

export function useUploadPhoto() {
  return useMutation({
    mutationFn: (file: File) =>
      apiFetch("/api/account/photo", photoSchema, { method: "POST", body: file }),
    onSuccess: () => refreshSession(),
  });
}

export function useRemovePhoto() {
  return useMutation({
    mutationFn: () => apiFetch("/api/account/photo", photoSchema, { method: "DELETE" }),
    onSuccess: () => refreshSession(),
  });
}

export function useRevokeEditor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      apiFetch(`/api/account/editors/${encodeURIComponent(clientId)}`, editorRevokedSchema, {
        method: "DELETE",
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: editorsQuery.queryKey }),
  });
}

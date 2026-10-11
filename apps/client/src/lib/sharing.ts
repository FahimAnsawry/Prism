import {
  acceptedInviteSchema,
  deletedSchema,
  inviteInfoSchema,
  inviteResultSchema,
  publicBoardDataSchema,
  publicShareSchema,
  shareSettingsSchema,
  type InviteMemberInput,
  type ShareKind,
  type ShareRole,
  type ShareSettings,
} from "@prism/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";
import { workspaceQuery } from "./workspace";

// Sharing a board or project: the owner's Share dialog, invite links and public links.

const sharePath = (kind: ShareKind, id: string) => `/api/${kind}s/${encodeURIComponent(id)}/share`;

export const shareSettingsQuery = (kind: ShareKind, id: string) =>
  queryOptions({
    queryKey: ["share", kind, id],
    queryFn: () => apiFetch(sharePath(kind, id), shareSettingsSchema),
  });

/** Every change in the Share dialog answers with the new settings; they replace the cached ones. */
function useShareMutation<V>(
  kind: ShareKind,
  id: string,
  request: (variables: V) => Promise<ShareSettings>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (settings) => {
      queryClient.setQueryData(shareSettingsQuery(kind, id).queryKey, settings);
    },
  });
}

export function useInviteMember(kind: ShareKind, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteMemberInput) =>
      apiFetch(`${sharePath(kind, id)}/members`, inviteResultSchema, {
        method: "POST",
        body: input,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(shareSettingsQuery(kind, id).queryKey, result.settings);
    },
  });
}

export function useChangeMemberRole(kind: ShareKind, id: string) {
  return useShareMutation(kind, id, ({ userId, role }: { userId: string; role: ShareRole }) =>
    apiFetch(`${sharePath(kind, id)}/members/${encodeURIComponent(userId)}`, shareSettingsSchema, {
      method: "PATCH",
      body: { role },
    }),
  );
}

export function useRemoveMember(kind: ShareKind, id: string) {
  return useShareMutation(kind, id, (userId: string) =>
    apiFetch(`${sharePath(kind, id)}/members/${encodeURIComponent(userId)}`, shareSettingsSchema, {
      method: "DELETE",
    }),
  );
}

export function useCancelInvite(kind: ShareKind, id: string) {
  return useShareMutation(kind, id, (inviteId: string) =>
    apiFetch(
      `${sharePath(kind, id)}/invites/${encodeURIComponent(inviteId)}`,
      shareSettingsSchema,
      {
        method: "DELETE",
      },
    ),
  );
}

/** Turns the public link on or off, or replaces it. */
export function useShareLink(kind: ShareKind, id: string) {
  return useShareMutation(kind, id, (action: "enable" | "regenerate" | "disable") =>
    action === "disable"
      ? apiFetch(`${sharePath(kind, id)}/link`, shareSettingsSchema, { method: "DELETE" })
      : apiFetch(`${sharePath(kind, id)}/link`, shareSettingsSchema, {
          method: "POST",
          body: { action },
        }),
  );
}

/** A member leaves a board or project shared with them. */
export function useLeaveShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id, userId }: { kind: ShareKind; id: string; userId: string }) =>
      apiFetch(`${sharePath(kind, id)}/members/${encodeURIComponent(userId)}`, deletedSchema, {
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceQuery.queryKey }),
  });
}

// ── Invite links ───────────────────────────────────────────────────────────

export const inviteQuery = (token: string) =>
  queryOptions({
    queryKey: ["invite", token],
    queryFn: () => apiFetch(`/api/invites/${encodeURIComponent(token)}`, inviteInfoSchema),
    retry: false,
  });

export function useAcceptInvite(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/api/invites/${encodeURIComponent(token)}/accept`, acceptedInviteSchema, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceQuery.queryKey }),
  });
}

/** Where an invite link waits while the visitor signs in or signs up (see claimPendingInvite). */
const PENDING_INVITE_KEY = "prism:pending-invite";

export function rememberPendingInvite(token: string) {
  try {
    sessionStorage.setItem(PENDING_INVITE_KEY, token);
  } catch {
    // Storage blocked: the visitor opens the invite link again after signing in.
  }
}

/** The invite link a visitor was on before signing in, once (it's forgotten when read). */
export function claimPendingInvite() {
  try {
    const token = sessionStorage.getItem(PENDING_INVITE_KEY);
    sessionStorage.removeItem(PENDING_INVITE_KEY);
    return token;
  } catch {
    return null;
  }
}

// ── Public links (no account) ──────────────────────────────────────────────

const publicPath = (token: string) => `/api/share/${encodeURIComponent(token)}`;

export const publicShareQuery = (token: string) =>
  queryOptions({
    queryKey: ["public-share", token],
    queryFn: () => apiFetch(publicPath(token), publicShareSchema),
    retry: false,
  });

export const publicBoardQuery = (token: string, boardId: string) =>
  queryOptions({
    queryKey: ["public-board", token, boardId],
    queryFn: () =>
      apiFetch(`${publicPath(token)}/boards/${encodeURIComponent(boardId)}`, publicBoardDataSchema),
    retry: false,
    // The viewer owns the elements once loaded; live updates arrive over the socket.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

/** The board's elements behind a public link now (for a resync after reconnecting). */
export function fetchPublicBoardElements(token: string, boardId: string) {
  return apiFetch(
    `${publicPath(token)}/boards/${encodeURIComponent(boardId)}`,
    publicBoardDataSchema,
  ).then((data) => data.elements);
}

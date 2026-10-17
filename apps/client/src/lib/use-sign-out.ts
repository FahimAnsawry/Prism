import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { signOut } from "./auth-client";
import { closeSocket } from "./realtime";

/** Signs out and goes to /login at once, leaving nothing of the account behind in this tab. */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    signOut();
    closeSocket();
    await navigate({ to: "/login" });
    // Once the signed-in pages are gone, so the next account never sees this one's workspace.
    queryClient.clear();
  };
}

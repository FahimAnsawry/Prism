// When an AI editor opens a board (open_board), the user's Prism tab goes there by itself, so
// they never have to open the link. A tab the user is busy in (typing, a dialog open) asks first.

import type { ShowBoardReply, ShowBoardRequest } from "@prism/shared";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isTyping } from "@/lib/keyboard";
import { getSocket } from "@/lib/realtime";

/** True while switching the page would interrupt the user. */
function userIsBusy() {
  return (
    isTyping(document.activeElement) ||
    document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
  );
}

export function AiBoardFollower() {
  const navigate = useNavigate();
  const router = useRouter();
  /** A board the AI opened while the user was busy, waiting for them to open it. */
  const [offer, setOffer] = useState<ShowBoardRequest | null>(null);

  useEffect(() => {
    const socket = getSocket();
    // The server sends board:show to the tab the user focused last.
    const reportActive = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) socket.emit("tab:active");
    };
    const onShow = (request: ShowBoardRequest, ack: (reply: ShowBoardReply) => void) => {
      const path = `/board/${request.boardId}`;
      if (router.state.location.pathname !== path && userIsBusy()) {
        setOffer(request);
        ack("asked");
        return;
      }
      setOffer(null);
      void navigate({ to: "/board/$boardId", params: { boardId: request.boardId } });
      ack("opened");
    };
    socket.on("connect", reportActive);
    socket.on("board:show", onShow);
    window.addEventListener("focus", reportActive);
    document.addEventListener("visibilitychange", reportActive);
    if (socket.connected) reportActive();
    return () => {
      socket.off("connect", reportActive);
      socket.off("board:show", onShow);
      window.removeEventListener("focus", reportActive);
      document.removeEventListener("visibilitychange", reportActive);
    };
  }, [navigate, router]);

  if (!offer) return null;
  const open = () => {
    setOffer(null);
    void navigate({ to: "/board/$boardId", params: { boardId: offer.boardId } });
  };
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-6 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-xl border border-border bg-popover py-2 pr-2 pl-3.5 text-sm text-popover-foreground shadow-lg"
    >
      <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate">
        Your AI editor opened <span className="font-medium">“{offer.name}”</span>
      </span>
      <Button size="sm" onClick={open}>
        Open board
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => setOffer(null)}>
        <X />
      </Button>
    </div>
  );
}

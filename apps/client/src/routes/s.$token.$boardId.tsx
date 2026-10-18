import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PublicBoard } from "@/components/share/public-board";
import { publicBoardQuery, publicShareQuery } from "@/lib/sharing";

/** How long a board fetched on a hover may open it. */
const AHEAD_FRESH_MS = 15_000;

// One board of a project shared by a public link: view only, no account needed.
export const Route = createFileRoute("/s/$token/$boardId")({
  head: () => ({
    meta: [{ title: "Shared on Prism" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  // The board loads alongside the page's code instead of after it. A hover's fetch is reused
  // for a moment; opening the board after that fetches it fresh.
  loader: ({ context: { queryClient }, params: { token, boardId }, preload }) => {
    void queryClient.prefetchQuery({
      ...publicBoardQuery(token, boardId),
      staleTime: preload ? Infinity : AHEAD_FRESH_MS,
    });
  },
  component: SharedBoardPage,
});

function SharedBoardPage() {
  const { token, boardId } = Route.useParams();
  // Usually cached from the project's list; it names who shared it.
  const share = useQuery(publicShareQuery(token));
  return (
    <PublicBoard
      token={token}
      boardId={boardId}
      ownerName={share.data?.ownerName}
      fromProject={share.data?.kind === "project"}
    />
  );
}

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PublicBoard } from "@/components/share/public-board";
import { publicShareQuery } from "@/lib/sharing";

// One board of a project shared by a public link: view only, no account needed.
export const Route = createFileRoute("/s/$token/$boardId")({
  head: () => ({
    meta: [{ title: "Shared on Prism" }, { name: "robots", content: "noindex, nofollow" }],
  }),
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

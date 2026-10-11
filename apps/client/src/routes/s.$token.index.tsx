import type { PublicShare } from "@prism/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { BoardPreview } from "@/components/dashboard/board-preview";
import { plural, timeAgo } from "@/components/dashboard/workspace-data";
import { ErrorScreen } from "@/components/feedback/error-page";
import { PrismLoader } from "@/components/feedback/prism-loader";
import { PrismMark } from "@/components/prism-logo";
import { LinkGoneScreen, PublicBoard } from "@/components/share/public-board";
import { ThemeToggle } from "@/components/theme-toggle";
import { ApiError } from "@/lib/api";
import { fetchPublicBoardElements, publicShareQuery } from "@/lib/sharing";

// A public view-only link: no account needed. It opens one board, or a project's list of boards.
export const Route = createFileRoute("/s/$token/")({
  head: () => ({
    meta: [{ title: "Shared on Prism" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: SharedLinkPage,
});

function SharedLinkPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const share = useQuery(publicShareQuery(token));

  if (share.error instanceof ApiError && share.error.status === 404) return <LinkGoneScreen />;
  if (share.error) {
    return (
      <ErrorScreen
        error={share.error}
        onRetry={() => void share.refetch()}
        onGoHome={() => void navigate({ to: "/" })}
      />
    );
  }
  if (!share.data) return <PrismLoader fullScreen label="Opening link" />;
  if (share.data.kind === "board") {
    return (
      <PublicBoard token={token} boardId={share.data.board.id} ownerName={share.data.ownerName} />
    );
  }
  return <SharedProject token={token} share={share.data} />;
}

function SharedProject({
  token,
  share,
}: {
  token: string;
  share: Extract<PublicShare, { kind: "project" }>;
}) {
  const { project } = share;
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-divider bg-card">
        <div className="mx-auto flex h-14 w-full max-w-[calc(75rem+2*var(--page-gutter))] items-center justify-between gap-4 px-(--page-gutter)">
          <Link to="/" aria-label="Prism home" className="flex items-center gap-2 text-ink">
            <PrismMark className="size-6" />
            <span className="font-bold">Prism</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 border border-divider px-2 py-1 font-mono text-3xs font-bold text-muted-foreground uppercase">
              <Eye aria-hidden="true" className="size-3.5" />
              View only
            </span>
            <ThemeToggle className="size-9 border border-divider" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[calc(75rem+2*var(--page-gutter))] px-(--page-gutter) pt-10 pb-24">
        <p className="font-mono text-[13px] text-muted-foreground">Shared by {share.ownerName}</p>
        <h1 className="mt-1 text-[40px] leading-14 font-bold text-ink">{project.name}</h1>
        {project.description && (
          <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">{project.description}</p>
        )}
        <p className="mt-2 font-mono text-[13px] text-muted-foreground">
          {plural(project.boards.length, "board")}
        </p>

        {project.boards.length === 0 ? (
          <p className="mt-16 text-center text-sm text-muted-foreground">
            No boards in this project yet.
          </p>
        ) : (
          <ul className="mt-10 grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {project.boards.map((board) => (
              <li key={board.id}>
                <Link
                  to="/s/$token/$boardId"
                  params={{ token, boardId: board.id }}
                  className="flex h-[260px] flex-col border border-divider bg-card transition-colors duration-150 ease-standard hover:border-input"
                >
                  <BoardPreview
                    boardId={board.id}
                    itemCount={board.itemCount}
                    editedAt={board.editedAt}
                    load={() => fetchPublicBoardElements(token, board.id)}
                    className="h-[175px] shrink-0 border-b border-divider"
                  />
                  <div className="px-5 pt-3.5">
                    <h2 className="truncate text-[17px] leading-6 font-bold text-foreground">
                      {board.name}
                    </h2>
                    <p className="mt-0.5 truncate text-[13px] leading-[19px] text-muted-foreground">
                      {board.description ??
                        `${plural(board.itemCount, "item")} · edited ${timeAgo(board.editedAt)}`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

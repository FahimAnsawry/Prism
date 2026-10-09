import type { BoardElement } from "@prism/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { BoardViewer } from "@/components/board/board-viewer";
import { loadBoardFonts } from "@/components/board/text-layout";
import { ctaVariants } from "@/components/cta";
import { ErrorScreen } from "@/components/feedback/error-page";
import { PrismLoader } from "@/components/feedback/prism-loader";
import { StatusScreen } from "@/components/feedback/status-screen";
import { ApiError } from "@/lib/api";
import { fetchPublicBoardElements, publicBoardQuery } from "@/lib/sharing";

/** A public link that no longer opens anything (turned off, replaced, or the item is gone). */
export function LinkGoneScreen() {
  return (
    <StatusScreen
      eyebrow="Link unavailable"
      title="This link doesn't work anymore"
      description="The owner turned it off or replaced it with a new one. Ask the person who shared it for a fresh link."
      actions={
        <Link to="/" className={ctaVariants({ size: "lg" })}>
          Go to Prism
        </Link>
      }
    />
  );
}

/**
 * One board behind a public link: view only, live. `fromProject` means it was opened from a
 * shared project's list, which the back arrow returns to.
 */
export function PublicBoard({
  token,
  boardId,
  ownerName,
  fromProject = false,
}: {
  token: string;
  boardId: string;
  ownerName?: string;
  fromProject?: boolean;
}) {
  const data = useQuery(publicBoardQuery(token, boardId));
  const elements: BoardElement[] | undefined = data.data?.elements;
  const fonts = useQuery({
    queryKey: ["board-fonts", "public", boardId],
    queryFn: () => loadBoardFonts(elements ?? []),
    enabled: Boolean(elements),
    staleTime: Infinity,
  });
  const [revoked, setRevoked] = useState(false);
  const navigate = useNavigate();

  if (revoked || (data.error instanceof ApiError && data.error.status === 404)) {
    return <LinkGoneScreen />;
  }
  if (data.error) {
    return (
      <ErrorScreen
        error={data.error}
        onRetry={() => void data.refetch()}
        onGoHome={() => void navigate({ to: "/" })}
      />
    );
  }
  if (!data.data || fonts.isPending) return <PrismLoader fullScreen label="Opening board" />;

  const { board, projectName } = data.data;
  const context = [projectName, ownerName && `Shared by ${ownerName}`].filter(Boolean).join(" · ");
  return (
    <BoardViewer
      key={boardId}
      boardId={boardId}
      initial={data.data.elements}
      shareToken={token}
      fetchElements={() => fetchPublicBoardElements(token, boardId)}
      title={board.name}
      context={context || undefined}
      leading={
        fromProject ? (
          <Link
            to="/s/$token"
            params={{ token }}
            aria-label={`Back to ${projectName ?? "the project"}`}
            className="flex size-8 items-center justify-center text-foreground transition-colors duration-150 ease-standard hover:bg-background"
          >
            <ArrowLeft aria-hidden="true" className="size-[18px]" />
          </Link>
        ) : undefined
      }
      onRevoked={() => setRevoked(true)}
    />
  );
}

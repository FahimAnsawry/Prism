import { useQuery } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import { fetchBoardElements } from "@/components/board/board-sync";
import { cn } from "@/lib/utils";
import { ProjectLogo } from "./dashboard-parts";
import { loadPreviewPicture, requestPreviewPicture, usePreviewPicture } from "./preview-pictures";
import { CanvasPreview } from "./workspace-item-parts";

/**
 * A board's cover picture (preview-pictures.ts), so mounting a grid of cards costs no more than
 * their images. The picture is downloaded once the card scrolls near the viewport. A board that
 * has none, or whose picture is older than `editedAt`, is drawn by an editor's tab (the board's
 * elements load only then) and uploaded for everyone else; until a picture exists the card shows
 * its project's logo.
 */
export function BoardPreview({
  boardId,
  projectId,
  itemCount,
  editedAt,
  thumbnailEditedAt,
  canEdit = false,
  picturePath = `/api/boards/${boardId}/preview`,
  className,
}: {
  boardId: string;
  /** The board's project, whose logo stands in until there's a picture. */
  projectId: string | null;
  itemCount: number;
  editedAt: string;
  /** The board `editedAt` the server's stored picture shows; null if it has none. */
  thumbnailEditedAt: string | null;
  /** Whether this user may draw and upload the picture (an owner or editor). */
  canEdit?: boolean;
  /** Where the stored picture is downloaded from (a public link has its own). */
  picturePath?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref);
  const empty = itemCount === 0;
  const picture = usePreviewPicture(boardId);

  useEffect(() => {
    if (near && !empty && thumbnailEditedAt) {
      loadPreviewPicture(boardId, thumbnailEditedAt, picturePath);
    }
  }, [near, empty, boardId, thumbnailEditedAt, picturePath]);

  // The stored picture shows an older version of the board, or there is none.
  const drawing =
    near && !empty && canEdit && picture?.version !== editedAt && thumbnailEditedAt !== editedAt;
  const elements = useQuery({
    queryKey: ["board-preview", boardId, editedAt],
    queryFn: () => fetchBoardElements(boardId),
    enabled: drawing,
    staleTime: Infinity,
    // Big boards are heavy; the picture is all that's kept.
    gcTime: 30_000,
  });
  useEffect(() => {
    if (drawing && elements.data) requestPreviewPicture(boardId, editedAt, elements.data);
  }, [drawing, elements.data, boardId, editedAt]);

  return (
    <div ref={ref} className={className}>
      <CanvasPreview empty={empty} className="size-full">
        {empty ? null : picture ? (
          <img
            src={picture.url}
            alt=""
            draggable={false}
            className={cn(
              "pointer-events-none absolute inset-0 size-full select-none",
              picture.portrait ? "object-contain" : "object-cover object-top",
            )}
          />
        ) : (
          <ProjectLogo projectId={projectId} size="lg" pulse={drawing} />
        )}
      </CanvasPreview>
    </div>
  );
}

/** True once the element comes within a screen of the viewport (and stays true). */
function useNearViewport(ref: RefObject<HTMLElement | null>) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (near || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, near]);
  return near;
}

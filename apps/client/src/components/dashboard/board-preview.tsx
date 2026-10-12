import { type BoardElement, hiddenMindNodes } from "@prism/shared";
import { useQuery } from "@tanstack/react-query";
import { memo, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { byZ } from "@/components/board/board-model";
import { fetchBoardElements } from "@/components/board/board-sync";
import { ElementShape } from "@/components/board/element-shape";
import { MindBranches } from "@/components/board/mind-branches";
import { backdropOf } from "@/components/board/geometry";
import { loadBoardFonts } from "@/components/board/text-layout";
import { PrismLoader } from "@/components/feedback/prism-loader";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { previewBox, requestPreviewPicture, usePreviewPicture } from "./preview-pictures";
import { CanvasPreview } from "./workspace-item-parts";

/**
 * A board's content, drawn small. It shows the board's preview picture (preview-pictures.ts), so
 * mounting a grid of cards costs no more than their images. The elements load only when the
 * picture is missing or older than `editedAt`, once the card scrolls near the viewport; a board
 * with no picture yet draws live meanwhile.
 */
export function BoardPreview({
  boardId,
  itemCount,
  editedAt,
  className,
  load,
}: {
  boardId: string;
  itemCount: number;
  editedAt: string;
  className?: string;
  /** Loads the elements another way than as the signed-in user (a public link). */
  load?: () => Promise<BoardElement[]>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref);
  const empty = itemCount === 0;
  const { theme } = useTheme();
  const { picture, checked } = usePreviewPicture(boardId, theme);
  const fresh = picture?.editedAt === editedAt;
  const preview = useQuery({
    queryKey: ["board-preview", boardId, editedAt, load ? "public" : "user"],
    queryFn: async () => {
      const all = await (load ? load() : fetchBoardElements(boardId));
      // Folded mind map branches aren't shown on the board, so not here either.
      const hidden = hiddenMindNodes(all);
      const elements = byZ(all.filter((el) => !hidden.has(el.id)));
      // Text is laid out with measured widths, so its fonts must be there first.
      await loadBoardFonts(elements);
      return elements;
    },
    enabled: near && !empty && checked && !fresh,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (preview.data && !fresh && !empty) {
      requestPreviewPicture(boardId, editedAt, theme, preview.data);
    }
  }, [preview.data, fresh, empty, boardId, editedAt, theme]);

  // Pictures are decoded before they're handed out, so a card mounting (a filter switch, the
  // way back from a board) shows its picture in its first frame: `complete` is already true.
  // Only a picture still decoding, or elements still loading, show the loader meanwhile.
  const image = useRef<HTMLImageElement>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  useLayoutEffect(() => {
    const node = image.current;
    if (node?.complete && node.naturalWidth > 0) setLoadedUrl(node.src);
  }, [picture?.url]);
  const pictureShown = picture !== undefined && loadedUrl !== null;
  const drawingLive = !picture && Boolean(preview.data);
  const loading = !empty && !pictureShown && !drawingLive;

  return (
    <div ref={ref} className={className}>
      <CanvasPreview empty={empty} className="size-full">
        {empty ? null : picture ? (
          <img
            ref={image}
            src={picture.url}
            alt=""
            draggable={false}
            onLoad={(event) => setLoadedUrl(event.currentTarget.src)}
            className={cn(
              "pointer-events-none absolute inset-0 size-full object-contain select-none",
              !pictureShown && "invisible",
            )}
          />
        ) : (
          preview.data && <PreviewDrawing elements={preview.data} />
        )}
        {loading && <PrismLoader className="absolute inset-0" />}
      </CanvasPreview>
    </div>
  );
}

/** The live drawing, for a board without a picture yet. */
const PreviewDrawing = memo(function PreviewDrawing({ elements }: { elements: BoardElement[] }) {
  const below = useMemo(() => elements.map((_, i) => backdropOf(elements, i)), [elements]);
  const box = previewBox(elements);
  if (!box) return null;
  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 size-full select-none"
    >
      <MindBranches elements={elements} />
      {elements.map((el, i) => (
        <ElementShape key={el.id} el={el} below={below[i]} />
      ))}
    </svg>
  );
});

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

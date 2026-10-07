import { hiddenMindNodes } from "@prism/shared";
import { useQuery } from "@tanstack/react-query";
import { type RefObject, useEffect, useRef, useState } from "react";
import { byZ } from "@/components/board/board-model";
import { fetchBoardElements } from "@/components/board/board-sync";
import { ElementShape } from "@/components/board/element-shape";
import { MindBranches } from "@/components/board/mind-branches";
import { backdropOf, boundsOf } from "@/components/board/geometry";
import { loadBoardFonts } from "@/components/board/text-layout";
import { CanvasPreview } from "./workspace-item-parts";

/** Space around the drawing, as a share of its larger side. */
const PADDING = 0.08;
/** The smallest area shown (world px), so a lone sticky note isn't blown up to fill the card. */
const MIN_VIEW = 600;

/**
 * A board's content, drawn small. `editedAt` is part of the query key, so the preview reloads
 * after the board changes and stays cached otherwise. Elements load once the card scrolls near
 * the viewport.
 */
export function BoardPreview({
  boardId,
  itemCount,
  editedAt,
  className,
}: {
  boardId: string;
  itemCount: number;
  editedAt: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref);
  const empty = itemCount === 0;
  const preview = useQuery({
    queryKey: ["board-preview", boardId, editedAt],
    queryFn: async () => {
      const all = await fetchBoardElements(boardId);
      // Folded mind map branches aren't shown on the board, so not here either.
      const hidden = hiddenMindNodes(all);
      const elements = byZ(all.filter((el) => !hidden.has(el.id)));
      // Text is laid out with measured widths, so its fonts must be there first.
      await loadBoardFonts(elements);
      return elements;
    },
    enabled: near && !empty,
    staleTime: Infinity,
  });

  const elements = preview.data ?? [];
  const bounds = boundsOf(elements);
  let viewBox: string | undefined;
  if (bounds) {
    const pad = Math.max(bounds.width, bounds.height) * PADDING;
    const width = Math.max(bounds.width + pad * 2, MIN_VIEW);
    const height = Math.max(bounds.height + pad * 2, MIN_VIEW);
    const x = bounds.x + bounds.width / 2 - width / 2;
    const y = bounds.y + bounds.height / 2 - height / 2;
    viewBox = `${x} ${y} ${width} ${height}`;
  }

  return (
    <div ref={ref} className={className}>
      <CanvasPreview empty={empty} className="size-full">
        {viewBox && (
          <svg
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            className="pointer-events-none absolute inset-0 size-full select-none"
          >
            <MindBranches elements={elements} />
            {elements.map((el, i) => (
              <ElementShape key={el.id} el={el} below={backdropOf(elements, i)} />
            ))}
          </svg>
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

import { Database, LayoutTemplate, LogIn, type LucideIcon, Network, Plus } from "lucide-react";
import { use } from "react";
import { cn } from "@/lib/utils";
import { type Cover, LOOSE_COVERS, ProjectLookContext } from "./dashboard-styles";

/** Words in a board's name and the icon they suggest. First match wins. */
const KIND_WORDS: [RegExp, LucideIcon][] = [
  [/sign.?in|log.?in|sign.?up|register|auth|password|onboard/, LogIn],
  [/schema|database|\ber\b|tables?\b|erd|data model/, Database],
  [/map|flow|mind|sitemap|diagram|architecture|journey|structure/, Network],
];

const EMPTY_COVER: Cover = {
  from: "#ececf0",
  to: "#ececf0",
  dots: ["#ececf0", "#ececf0", "#ececf0"],
};

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/**
 * A board's cover: a soft wash in its project's color, a white tile with an icon for what the
 * board holds (picked from its name), and three palette dots. A board outside a project takes a
 * wash from its id; an empty board is gray with a plus. The tile and dots shrink with the card.
 */
export function BoardPreview({
  boardId,
  name,
  projectId,
  itemCount,
  className,
}: {
  boardId: string;
  name: string;
  /** The board's project, whose color the cover takes. */
  projectId: string | null;
  itemCount: number;
  className?: string;
}) {
  const empty = itemCount === 0;
  const look = use(ProjectLookContext).get(projectId ?? "");
  const cover = empty
    ? EMPTY_COVER
    : (look?.cover ?? LOOSE_COVERS[hash(boardId) % LOOSE_COVERS.length] ?? EMPTY_COVER);
  const Icon = empty
    ? Plus
    : (KIND_WORDS.find(([words]) => words.test(name.toLowerCase()))?.[1] ?? LayoutTemplate);

  return (
    <div
      aria-hidden="true"
      style={{ backgroundImage: `linear-gradient(135deg, ${cover.from}, ${cover.to})` }}
      className={cn(
        "@container relative flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center bg-white shadow-sm @[8rem]:size-8 @[12rem]:size-12",
          empty ? "text-muted-foreground" : "text-ink",
        )}
      >
        <Icon className="size-3.5 @[8rem]:size-4 @[12rem]:size-5" />
      </span>
      {!empty && (
        <span className="absolute bottom-3 left-3 hidden items-center gap-1 @[12rem]:flex">
          {cover.dots.map((color, i) => (
            <span
              key={i}
              style={{ backgroundColor: color }}
              className="size-3 rounded-full border border-white"
            />
          ))}
        </span>
      )}
    </div>
  );
}

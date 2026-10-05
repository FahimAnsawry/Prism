import { ctaVariants } from "@/components/cta";
import type { CreateKind } from "./item-dialog";
import { ProjectIcon, WhiteboardIcon } from "./new-menu";

/** First run: nothing in the workspace yet. */
export function EmptyWorkspace({ onCreate }: { onCreate: (kind: CreateKind) => void }) {
  return (
    <section
      aria-labelledby="empty-workspace-title"
      className="mt-8 flex flex-col items-center border border-dashed border-input bg-card px-6 py-16 text-center sm:py-20"
    >
      <div className="flex items-end gap-3" aria-hidden="true">
        <WhiteboardIcon />
        <ProjectIcon />
      </div>
      <h2 id="empty-workspace-title" className="mt-6 text-[26px] leading-8 font-bold text-ink">
        Your workspace is empty
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Start with a whiteboard for one idea, or a project to keep a set of boards together.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => onCreate("whiteboard")}
          className={ctaVariants({ size: "sm" })}
        >
          New whiteboard
        </button>
        <button
          type="button"
          onClick={() => onCreate("project")}
          className={ctaVariants({ variant: "secondary", size: "sm" })}
        >
          New project
        </button>
      </div>
    </section>
  );
}

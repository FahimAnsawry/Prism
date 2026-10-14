import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronRight, Clock, ThumbsDown, ThumbsUp } from "lucide-react";
import { Fragment, useState } from "react";
import { cn } from "@/lib/utils";
import { Blocks } from "./doc-blocks";
import { DOCS_UPDATED } from "./docs-config";
import { docsLink } from "./docs-link";
import { groupLabel, neighbours, TOOLS_OVERVIEW } from "./docs-pages";
import type { DocPage } from "./docs-types";

type Crumb = { label: string; page?: DocPage };

function crumbsFor(page: DocPage): Crumb[] {
  const crumbs: Crumb[] = [{ label: groupLabel(page.group) }];
  if (page.slug.startsWith("tools/"))
    crumbs.push({ label: TOOLS_OVERVIEW.title, page: TOOLS_OVERVIEW });
  crumbs.push({ label: page.title });
  return crumbs;
}

function Breadcrumbs({ page }: { page: DocPage }) {
  const crumbs = crumbsFor(page);
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={crumb.label}>
              <li
                aria-current={last ? "page" : undefined}
                className={cn(last && page.mono && "font-mono")}
              >
                {crumb.page ? (
                  <Link
                    {...docsLink(crumb.page)}
                    className="underline-offset-4 hover:text-ink hover:underline"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  crumb.label
                )}
              </li>
              {!last && (
                <li aria-hidden="true">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function Feedback() {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const button =
    "inline-flex h-9 items-center gap-2 border border-input px-3.5 text-sm transition-colors duration-150 ease-standard hover:bg-muted";
  return (
    <div className="mt-16 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
      <p aria-live="polite">
        {answer ? "Thanks, that helps us write better pages." : "Was this page helpful?"}
      </p>
      {!answer && (
        <div className="flex gap-2 text-foreground">
          <button type="button" onClick={() => setAnswer("yes")} className={button}>
            <ThumbsUp aria-hidden="true" className="size-4" />
            Yes
          </button>
          <button type="button" onClick={() => setAnswer("no")} className={button}>
            <ThumbsDown aria-hidden="true" className="size-4" />
            No
          </button>
        </div>
      )}
    </div>
  );
}

function PageNav({ page }: { page: DocPage }) {
  const { previous, next } = neighbours(page);
  const card =
    "group block flex-1 border border-border p-5 transition-colors duration-150 ease-standard hover:bg-muted";
  const caption =
    "flex items-center gap-2 font-mono text-xs font-bold tracking-[0.1em] uppercase text-muted-foreground";
  return (
    <nav aria-label="Previous and next pages" className="mt-8 flex flex-col gap-4 sm:flex-row">
      {previous ? (
        <Link {...docsLink(previous)} className={card}>
          <span className={caption}>
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Previous
          </span>
          <span
            className={cn(
              "mt-2 block text-base font-semibold",
              previous.mono && "font-mono text-[15px]",
            )}
          >
            {previous.title}
          </span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
      {next ? (
        <Link {...docsLink(next)} className={cn(card, "text-right")}>
          <span className={cn(caption, "justify-end")}>
            Next
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </span>
          <span
            className={cn(
              "mt-2 block text-base font-semibold",
              next.mono && "font-mono text-[15px]",
            )}
          >
            {next.title}
          </span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
    </nav>
  );
}

export function DocArticle({ page }: { page: DocPage }) {
  return (
    <article className="min-w-0 pt-8 pb-16 lg:pt-10">
      <Breadcrumbs page={page} />
      <h1
        className={cn(
          "mt-4 text-foreground",
          page.mono
            ? "font-mono text-[2rem] leading-tight font-bold break-words sm:text-[2.5rem]"
            : "font-display text-[2.5rem] leading-[1.05] font-bold tracking-display text-balance sm:text-5xl",
        )}
      >
        {page.title}
      </h1>
      <p className="mt-5 max-w-[40rem] text-lg leading-snug text-foreground sm:text-xl">
        {page.lede}
      </p>

      {page.badge ? (
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span
            className={cn(
              "px-2 py-0.5 font-mono text-xs font-bold tracking-[0.06em] text-slate",
              page.badge.label === "WRITES" ? "bg-seafoam" : "bg-ice",
            )}
          >
            {page.badge.label}
          </span>
          {page.badge.facts.map((fact, index) => (
            <Fragment key={fact}>
              {index > 0 && <span aria-hidden="true">·</span>}
              <span>{fact}</span>
            </Fragment>
          ))}
        </p>
      ) : (
        <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {page.minutes && (
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden="true" className="size-3.5" />
              {page.minutes} min read
            </span>
          )}
          <span>Updated {DOCS_UPDATED}</span>
        </p>
      )}

      <div className="mt-10 max-w-[43rem]">
        <Blocks blocks={page.blocks} />
        <Feedback key={page.slug} />
        <PageNav page={page} />
      </div>
    </article>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { DocArticle } from "@/components/docs/doc-article";
import { findPage } from "@/components/docs/docs-pages";

const page = findPage("")!;

export const Route = createFileRoute("/docs/")({
  head: () => ({ meta: [{ title: `${page.title} - Prism Docs` }] }),
  component: () => <DocArticle page={page} />,
});

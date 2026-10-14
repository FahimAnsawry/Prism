import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocArticle } from "@/components/docs/doc-article";
import { findPage } from "@/components/docs/docs-pages";

export const Route = createFileRoute("/docs/$")({
  loader: ({ params }) => {
    const page = findPage(params._splat ?? "");
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.page.title} - Prism Docs` : "Prism Docs" }],
  }),
  component: DocsPage,
});

function DocsPage() {
  const { page } = Route.useLoaderData();
  return <DocArticle page={page} />;
}

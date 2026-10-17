import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocArticle } from "@/components/docs/doc-article";

export const Route = createFileRoute("/docs/$")({
  loader: async ({ params }) => {
    const { findPage } = await import("@/components/docs/docs-pages");
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

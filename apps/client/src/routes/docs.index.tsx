import { createFileRoute } from "@tanstack/react-router";
import { DocArticle } from "@/components/docs/doc-article";

export const Route = createFileRoute("/docs/")({
  loader: async () => {
    const { findPage } = await import("@/components/docs/docs-pages");
    return { page: findPage("")! };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.page.title ?? "Docs"} - Prism Docs` }],
  }),
  component: DocsIndex,
});

function DocsIndex() {
  const { page } = Route.useLoaderData();
  return <DocArticle page={page} />;
}

import type { DocsGroupInfo } from "./docs-types";

/** The server's remote MCP endpoint, so the commands in the docs work as pasted. */
export const MCP_URL = new URL("/mcp", import.meta.env.VITE_SERVER_URL).toString();

export const GITHUB_URL = "https://github.com/FahimAnsawry/Prism";

/** When the pages were last revised, shown under each title. */
export const DOCS_UPDATED = "Oct 14, 2026";

export const GROUPS: DocsGroupInfo[] = [
  { id: "start", label: "Get started" },
  { id: "design", label: "Design" },
  { id: "collaborate", label: "Collaborate" },
  { id: "build", label: "Build" },
  { id: "reference", label: "Reference" },
];

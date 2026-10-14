import { MCP_URL } from "./docs-config";
import type { Block, DocPage } from "./docs-types";

/** Replaces the {{mcp}} placeholder with this server's MCP endpoint. */
export function fillPlaceholders(text: string): string {
  return text.replaceAll("{{mcp}}", MCP_URL);
}

function table(head: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...rows.map(line)].join("\n");
}

function blockToMarkdown(block: Block): string {
  const text = (value: string) => fillPlaceholders(value);
  switch (block.type) {
    case "h2":
      return `## ${block.title}`;
    case "p":
      return text(block.text);
    case "checks":
      return block.items.map((item) => `- [x] ${text(item)}`).join("\n");
    case "steps":
      return block.steps
        .map(
          (step, index) =>
            `### ${index + 1}. ${step.title}\n\n${step.blocks.map((b) => blockToMarkdown(b)).join("\n\n")}`,
        )
        .join("\n\n");
    case "command":
      return `${block.title}\n\n\`\`\`sh\n${text(block.command)}\n\`\`\``;
    case "code":
      return `${block.title ? `${block.title}\n\n` : ""}\`\`\`\n${text(block.code)}\n\`\`\``;
    case "tabs":
      return block.tabs
        .map((tab) => `**${tab.label}**\n\n\`\`\`\n${text(tab.code)}\n\`\`\``)
        .join("\n\n");
    case "prompt":
      return `\`\`\`\n> ${block.text}\n\`\`\``;
    case "callout":
      return `> **${block.title}**\n>\n${block.blocks
        .map((b) =>
          blockToMarkdown(b)
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n"),
        )
        .join("\n>\n")}`;
    case "table":
      return table(block.head, block.rows);
    case "defs":
      return block.rows.map((row) => `- **${row.term}**: ${row.text}`).join("\n");
    case "matrix":
      return table(
        block.head,
        block.rows.map((row) => [row.label, ...row.allowed.map((yes) => (yes ? "Yes" : "No"))]),
      );
    case "params":
      return table(
        ["Name", "Type", "Description"],
        block.rows.map((row) => [
          `\`${row.name}\`${row.required ? " (required)" : ""}`,
          row.kind,
          row.text,
        ]),
      );
    case "faq":
      return block.items.map((item) => `**${item.q}**\n\n${text(item.a)}`).join("\n\n");
    case "notes":
      return block.items.map((item) => `- ${text(item.text)}`).join("\n");
    case "figure":
      return "";
  }
}

/** A page as Markdown, for the "Copy as Markdown" button. */
export function pageToMarkdown(page: DocPage): string {
  const body = page.blocks
    .map((block) => blockToMarkdown(block))
    .filter(Boolean)
    .join("\n\n");
  return `# ${page.title}\n\n${page.lede}\n\n${body}\n`;
}

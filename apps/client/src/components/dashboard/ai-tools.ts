import { MCP_URL, CLAUDE_COMMAND, CODEX_COMMAND } from "@/lib/ai";

export type AiToolId = "claude-code" | "codex" | "antigravity" | "cursor" | "copilot" | "other";

export type AiTool = {
  id: AiToolId;
  name: string;
  by: string;
  blurb: string;
  /** In `public/editors/`; the generic MCP client has none. */
  logo: string | null;
  /** Matches the name an editor registered with when it signed in through OAuth. */
  match: RegExp | null;
  /** What to do to add Prism: a sentence, then the text to copy. */
  setup: { intro: string; code: string };
};

const json = (value: unknown) => JSON.stringify(value);

/** The AI tools shown in "Connect AI tools", in the order of the grid. */
export const AI_TOOLS: AiTool[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    by: "Anthropic",
    blurb: "Read boards from your terminal and build pages as you code.",
    logo: "/editors/claude-code.svg",
    match: /claude/i,
    setup: {
      intro: "Run this in your terminal, then run /mcp in Claude Code and choose Authenticate.",
      code: CLAUDE_COMMAND,
    },
  },
  {
    id: "codex",
    name: "Codex",
    by: "OpenAI",
    blurb: "Hand it a board as the spec and let it build the screens.",
    logo: "/editors/codex.svg",
    match: /codex|openai/i,
    setup: {
      intro: "Run this in your terminal. Codex opens your browser to sign in.",
      code: CODEX_COMMAND,
    },
  },
  {
    id: "antigravity",
    name: "Antigravity",
    by: "Google",
    blurb: "Let agents read your board and draw back into it from the editor.",
    logo: "/editors/antigravity.svg",
    match: /antigravity/i,
    setup: {
      intro: "Paste this into Antigravity's MCP config, then restart it and sign in.",
      code: json({ mcpServers: { prism: { serverUrl: MCP_URL } } }),
    },
  },
  {
    id: "cursor",
    name: "Cursor",
    by: "Anysphere",
    blurb: "Build from specs and wireframes sitting on your board.",
    logo: "/editors/cursor.svg",
    match: /cursor/i,
    setup: {
      intro: "Add this to .cursor/mcp.json, then connect prism in Cursor's MCP settings.",
      code: json({ mcpServers: { prism: { url: MCP_URL } } }),
    },
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    by: "GitHub",
    blurb: "Bring board context into agent mode in VS Code.",
    logo: "/editors/github-copilot.svg",
    match: /copilot|github/i,
    setup: {
      intro: "Add this to .vscode/mcp.json, then start prism from Copilot's tools list.",
      code: json({ servers: { prism: { type: "http", url: MCP_URL } } }),
    },
  },
  {
    id: "other",
    name: "Any MCP client",
    by: "Server URL or token",
    blurb: "Paste the Prism URL, or use a token if sign-in isn't offered.",
    logo: null,
    match: null,
    setup: { intro: "Use this as the server URL (Streamable HTTP).", code: MCP_URL },
  },
];

/** The tool a connected editor belongs to, if it is one of the known ones. */
export function toolForEditor(name: string): AiTool | undefined {
  return AI_TOOLS.find((tool) => tool.match?.test(name));
}

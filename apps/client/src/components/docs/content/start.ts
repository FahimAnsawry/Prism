import type { DocPage } from "../docs-types";

export const START_PAGES: DocPage[] = [
  {
    slug: "",
    title: "What is Prism",
    group: "start",
    minutes: 2,
    lede: "Prism is a live whiteboard for UI references, wireframes and diagrams. Your team and your AI editor work on the same board, and what's drawn there reads back as code.",
    blocks: [
      { type: "h2", title: "How it fits together" },
      {
        type: "p",
        text: "There are three parts. The board lives in your browser and syncs to everyone on it. Your AI editor reaches the same board through Prism's MCP endpoint. Your app's code is written from what the board holds, not traced from a picture of it.",
      },
      { type: "figure", name: "architecture" },
      { type: "h2", title: "One board, many views" },
      {
        type: "p",
        text: "A board holds any mix of these. Each one is drawn by a tool and read back by another.",
      },
      {
        type: "table",
        head: ["View", "Drawn with", "Reads back as"],
        mono: [1],
        rows: [
          ["UI screen", "create_screen", "A nested layout tree for any framework"],
          ["Database", "create_er_diagram", "Prisma, Postgres SQL or Drizzle"],
          ["Theme", "set_theme", "Tailwind CSS, CSS variables, JSON or Dart"],
          ["Flowchart", "create_elements", "Shapes and bound arrows, via get_board"],
          ["Mind map", "create_mindmap", "A tree of nodes, via get_board"],
        ],
      },
      { type: "h2", title: "Without an AI editor" },
      {
        type: "p",
        text: "Everything an editor draws, you can draw by hand: sticky notes, shapes, arrows, pen strokes, tables and frames. Share the board and sketch together; connect an editor later and it picks up where you left off.",
      },
      { type: "figure", name: "startNote" },
    ],
  },
  {
    slug: "quickstart",
    title: "Quickstart",
    group: "start",
    minutes: 5,
    lede: "From an empty board to a screen your editor can build, in five steps and about five minutes.",
    blocks: [
      {
        type: "steps",
        steps: [
          {
            title: "Create a board",
            blocks: [
              {
                type: "p",
                text: "Sign up with an email, Google or GitHub, then choose Start a board on your dashboard. Boards save as you draw, and every tab on a board sees the same thing.",
              },
            ],
          },
          {
            title: "Connect your editor",
            blocks: [
              {
                type: "p",
                text: "Add Prism to the editor you use. It signs in through your browser the first time it calls a tool.",
              },
              {
                type: "command",
                title: "Claude Code",
                command: "claude mcp add --transport http prism {{mcp}}",
              },
              { type: "command", title: "Codex", command: "codex mcp add prism --url {{mcp}}" },
            ],
          },
          {
            title: "Ask for a screen",
            blocks: [
              {
                type: "p",
                text: "Keep the board open in your browser and ask in plain words. The screen arrives as one undo step, so Ctrl Z takes the whole thing back.",
              },
              { type: "prompt", text: "design a booking screen for a yoga studio, mobile" },
            ],
          },
          {
            title: "Share it",
            blocks: [
              {
                type: "p",
                text: "Choose Share on the board. Invite people by email as editors or viewers, or copy a link that opens the board read-only.",
              },
            ],
          },
          {
            title: "Build it",
            blocks: [
              {
                type: "p",
                text: "In your app's folder, run the `build_pages` prompt with the project's name. Your editor detects the framework and styling, sets up the theme and codes each screen as a page.",
              },
              { type: "prompt", text: '/mcp__prism__build_pages "Yoga studio"' },
            ],
          },
        ],
      },
      {
        type: "callout",
        icon: "folder",
        title: "Put screens in a project",
        blocks: [
          {
            type: "p",
            text: "Boards in a project share one theme and one set of components, so every page of the site looks like the same product and codes the same way.",
          },
        ],
      },
    ],
  },
  {
    slug: "connect-claude-code",
    title: "Connect Claude Code",
    group: "start",
    minutes: 3,
    lede: "Add Prism to Claude Code once. After that, ask for a screen, a flow or a schema and it lands on the board you have open.",
    blocks: [
      { type: "h2", title: "Before you start" },
      {
        type: "checks",
        items: [
          "Claude Code installed in your terminal.",
          "A Prism account. Signing up takes an email or a Google or GitHub login.",
          "A board open in your browser, so you can watch the first screen arrive.",
        ],
      },
      {
        type: "steps",
        steps: [
          {
            title: "Add the server",
            blocks: [
              {
                type: "p",
                text: "Run this once in any folder. It registers Prism as a remote MCP server named `prism` for every project.",
              },
              {
                type: "command",
                title: "Terminal",
                command: "claude mcp add --transport http prism {{mcp}}",
              },
            ],
          },
          {
            title: "Sign in from Claude Code",
            blocks: [
              {
                type: "p",
                text: "Start Claude Code and type `/mcp`. Pick prism, then Authenticate. Your browser opens Prism's sign-in and a consent screen; approve it and go back to the terminal.",
              },
              {
                type: "callout",
                icon: "key",
                title: "Prefer a token?",
                blocks: [
                  {
                    type: "p",
                    text: "Create one under Dashboard, Connect AI, and send it as a header instead. Prism stores only its hash, so copy it when it's shown.",
                  },
                  {
                    type: "code",
                    title: "",
                    code: 'claude mcp add --transport http prism {{mcp}} \\\n  --header "Authorization: Bearer prism_..."',
                  },
                ],
              },
            ],
          },
          {
            title: "Ask for your first screen",
            blocks: [
              {
                type: "p",
                text: "Ask in plain words. Claude reads Prism's design guide, draws the screen with `create_screen` and checks it before it answers.",
              },
              { type: "prompt", text: "design a sign-up screen for the gym app" },
              { type: "figure", name: "boardMock" },
            ],
          },
        ],
      },
      { type: "h2", title: "Troubleshooting" },
      {
        type: "faq",
        items: [
          {
            q: "The prism tools don't show up",
            a: "Run `claude mcp list`. If prism shows as failed, remove it with `claude mcp remove prism` and add it again.",
          },
          {
            q: "Screens don't appear on my board",
            a: "Keep a Prism tab open. Claude draws into the board that tab shows, and asks you to open one if there isn't one.",
          },
          {
            q: "It signed in with the wrong account",
            a: "Log out of Prism in the browser, then run `/mcp` and choose Authenticate again.",
          },
        ],
      },
    ],
  },
  {
    slug: "connect-codex",
    title: "Connect Codex",
    group: "start",
    minutes: 3,
    lede: "Codex reaches Prism through the same MCP endpoint as Claude Code. Add it once, sign in, and ask.",
    blocks: [
      {
        type: "steps",
        steps: [
          {
            title: "Add the server",
            blocks: [
              {
                type: "p",
                text: "This writes a `prism` entry to your Codex config, so every session can use it.",
              },
              { type: "command", title: "Terminal", command: "codex mcp add prism --url {{mcp}}" },
            ],
          },
          {
            title: "Sign in",
            blocks: [
              {
                type: "p",
                text: "Your browser opens Prism's sign-in, then a consent screen that names Codex. Approve it and the terminal picks up the session.",
              },
              { type: "command", title: "Terminal", command: "codex mcp login prism" },
            ],
          },
          {
            title: "Ask for your first screen",
            blocks: [
              {
                type: "p",
                text: "Start `codex` with a board open in your browser. Prompts are slash commands here too.",
              },
              { type: "prompt", text: "sketch the checkout flow as a flowchart on my Shop board" },
            ],
          },
        ],
      },
      { type: "h2", title: "Use a token instead" },
      {
        type: "p",
        text: "On a machine without a browser, or in CI, create an access token and point Codex at it through an environment variable in `~/.codex/config.toml`.",
      },
      {
        type: "code",
        title: "~/.codex/config.toml",
        code: '[mcp_servers.prism]\nurl = "{{mcp}}"\nbearer_token_env_var = "PRISM_TOKEN"',
      },
      {
        type: "callout",
        icon: "shield",
        title: "Keep the token out of the file",
        blocks: [
          {
            type: "p",
            text: "Set `PRISM_TOKEN` in your shell or your CI secrets. A token acts as you, with every board you can open.",
          },
        ],
      },
      { type: "h2", title: "Troubleshooting" },
      {
        type: "faq",
        items: [
          {
            q: "Codex says prism needs a login",
            a: "The session expired or was revoked. Run `codex mcp login prism` again.",
          },
          {
            q: "Tools fail with 401 when using a token",
            a: "Check that `PRISM_TOKEN` is set where Codex runs, and that the token wasn't revoked on the dashboard.",
          },
        ],
      },
    ],
  },
];

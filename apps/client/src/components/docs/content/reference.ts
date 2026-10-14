import type { DocPage } from "../docs-types";

export const REFERENCE_PAGES: DocPage[] = [
  {
    slug: "elements",
    title: "Elements",
    group: "reference",
    minutes: 4,
    lede: "Everything on a board is an element: a shape, a line of text, a frame, a table. Each is a small record that every tab and every editor reads the same way.",
    blocks: [
      { type: "h2", title: "Element types" },
      {
        type: "table",
        head: ["Type", "Use it for"],
        mono: [0],
        rows: [
          ["rect  ellipse  diamond", "Containers, buttons, cards, inputs and flowchart steps"],
          ["text  sticky  list", "Copy, notes and bullet lists, with the theme's text styles"],
          [
            "line  arrow",
            "Connections that bind to elements, run straight or elbowed, and can end in crow's feet",
          ],
          ["icon  emoji", "Lucide icons by name, and emoji for notes"],
          ["image  svg", "Photos, logos and illustrations, stored with the board"],
          ["frame", "A screen or artboard, and everything whose center sits inside it"],
          ["table  mindnode", "ER diagram tables and mind map nodes"],
          ["chart  freehand", "Bar, line, pie and donut charts, and pen strokes"],
        ],
      },
      { type: "h2", title: "What an element carries" },
      {
        type: "p",
        text: "Position, size and style, plus the meaning that code needs: what the element is, what it belongs to and which theme tokens it uses.",
      },
      {
        type: "code",
        title: "get_board · one element",
        code: '{\n  "id": "1f3c8a2e-…",\n  "type": "rect",\n  "x": 120, "y": 640, "width": 316, "height": 44,\n  "version": 7,\n  "fill": "$primary", "radius": "$radius-md",\n  "role": "button",\n  "groupId": "signup-cta"\n}',
      },
      {
        type: "defs",
        rows: [
          {
            term: "role",
            mono: true,
            text: "What it is in the UI: button, input, card, nav, heading.",
          },
          {
            term: "groupId",
            mono: true,
            text: "Elements with the same id select and move together, one per component.",
          },
          {
            term: "$tokens",
            mono: true,
            text: "Theme names kept beside the values. A hand edit to another value drops the token.",
          },
          {
            term: "component",
            mono: true,
            text: "Set on everything a project component draws, so code renders the component.",
          },
        ],
      },
      { type: "h2", title: "How changes sync" },
      {
        type: "p",
        text: "Each save sends one batch of changes to every tab on the board. Every element has a version number, and when two changes to it meet, the higher version wins.",
      },
      {
        type: "callout",
        icon: "undo",
        title: "One batch, one undo",
        blocks: [
          {
            type: "p",
            text: "A batch from someone else, or from an AI editor, lands in your history as a single step. Ctrl Z takes the whole change back.",
          },
        ],
      },
    ],
  },
  {
    slug: "access-tokens",
    title: "Access tokens",
    group: "reference",
    minutes: 3,
    lede: "A personal access token signs a client in to Prism's MCP endpoint with one header, for when a browser sign-in isn't possible.",
    blocks: [
      { type: "h2", title: "When to use one" },
      {
        type: "p",
        text: "Browser sign-in is the default and the safer choice. Reach for a token when the client can only send a fixed header, on a server or in CI, or on a machine with no browser to finish the sign-in.",
      },
      { type: "h2", title: "Create a token" },
      {
        type: "p",
        text: "On your dashboard, open Connect AI and choose New token. Name it after the machine or job that will use it, then copy it right away: it starts with `prism_` and is shown only once.",
      },
      { type: "figure", name: "tokenManager" },
      { type: "h2", title: "Use it" },
      {
        type: "p",
        text: "Send it as a bearer token on every request to the MCP endpoint. Most clients take it as a header option when you add the server.",
      },
      { type: "code", title: "HTTP header", code: "Authorization: Bearer prism_8fK2xQaT..." },
      { type: "h2", title: "Limits and safety" },
      {
        type: "notes",
        items: [
          {
            icon: "alert",
            text: "A token acts as you, with every board and project you can open. Give each machine its own.",
          },
          {
            icon: "check",
            text: "Prism keeps only a SHA-256 hash and the first few characters, so a lost token can't be shown again. Make a new one.",
          },
          {
            icon: "layers",
            text: "Up to 20 tokens per account. Revoke the ones you no longer use.",
          },
          {
            icon: "link",
            text: "Revoking takes effect at once: the next call with that token is refused.",
          },
        ],
      },
    ],
  },
  {
    slug: "tools",
    title: "The seven tools",
    group: "reference",
    minutes: 2,
    lede: "Seven tools draw on a board and read it back. Editors call them for you; this section is for knowing what each one takes and returns.",
    blocks: [
      { type: "h2", title: "Draw" },
      {
        type: "defs",
        rows: [
          {
            term: "create_screen",
            mono: true,
            text: "A whole screen from a layout tree or HTML and Tailwind, measured and linted.",
          },
          {
            term: "create_elements",
            mono: true,
            text: "Shapes, text, stickies, arrows and charts at exact positions.",
          },
          {
            term: "create_er_diagram",
            mono: true,
            text: "A database schema as tables and crow's-foot relations.",
          },
          {
            term: "create_mindmap",
            mono: true,
            text: "An outline as a styled, laid-out mind map.",
          },
        ],
      },
      { type: "h2", title: "Read" },
      {
        type: "defs",
        rows: [
          {
            term: "get_screen_code",
            mono: true,
            text: "Screens as nested layout trees ready to code in any framework.",
          },
          {
            term: "get_schema_code",
            mono: true,
            text: "The ER diagram as Prisma, Postgres SQL or Drizzle.",
          },
          {
            term: "get_theme",
            mono: true,
            text: "A project's tokens, plus CSS, CSS variables, JSON or Dart to use them.",
          },
        ],
      },
      {
        type: "callout",
        icon: "puzzle",
        title: "And the small helpers",
        blocks: [
          {
            type: "p",
            text: "Editors also use smaller tools on their own, like `open_board`, `update_elements`, `export_image` and `define_component`. You rarely need to name them.",
          },
        ],
      },
    ],
  },
];

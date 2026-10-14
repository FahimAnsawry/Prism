import type { DocPage } from "../docs-types";

export const BUILD_PAGES: DocPage[] = [
  {
    slug: "design-to-code",
    title: "Design to code",
    group: "build",
    minutes: 5,
    lede: "A finished board is a reference your editor builds from. This is the loop from a screen on the board to a page in your app, and what to check along the way.",
    blocks: [
      { type: "h2", title: "The loop" },
      {
        type: "p",
        text: "Nothing is traced from a picture. Your editor reads the board's theme and each screen's layout tree, writes the pages, then looks at its own work next to the frame and fixes what differs.",
      },
      { type: "figure", name: "pipeline" },
      { type: "h2", title: "Before you build" },
      {
        type: "checks",
        items: [
          "The screens are in a project, so they share one theme and one set of components.",
          "Each frame is drawn at a real size and carries a route label, like `/pricing · desktop`.",
          "Your editor is connected to Prism and open in your app's folder.",
        ],
      },
      { type: "h2", title: "Run it" },
      {
        type: "steps",
        steps: [
          {
            title: "Name the routes",
            blocks: [
              {
                type: "p",
                text: "Write the route and state in a small label above each frame, like `/sign-up · mobile · error`. That label becomes the page's path, and the state tells the editor which variant of the page it is looking at.",
              },
            ],
          },
          {
            title: "Run build_pages",
            blocks: [
              {
                type: "p",
                text: "Pass the project's name. Add `board` to build only one board, or `framework` and `styling` when you don't want them detected.",
              },
              { type: "prompt", text: '/mcp__prism__build_pages "Yoga studio"' },
            ],
          },
          {
            title: "Let it set the app up",
            blocks: [
              {
                type: "p",
                text: "The editor writes the theme once with `get_theme`, builds each project component once, then reads every frame with `get_screen_code` and codes it as a route.",
              },
            ],
          },
          {
            title: "Compare and fix",
            blocks: [
              {
                type: "p",
                text: "Run the app and put each page beside the frame's `export_image`. Differences in spacing and wrapping show up fast, and the editor fixes them before it says it's done.",
              },
            ],
          },
        ],
      },
      { type: "h2", title: "What carries over" },
      {
        type: "table",
        head: ["On the board", "In the code"],
        mono: [],
        rows: [
          ["A frame with a route label", "A page at that route"],
          [
            "`$primary`, `$radius-md`, `$h3`",
            "Theme classes or `var(--primary)`, from the same names",
          ],
          ["A project component instance", "One component file, used wherever the board uses it"],
          ["`role`: button, input, nav, heading", "The matching element, not a generic div"],
          [
            "`row`, `column`, `grid`, `overlay`",
            "Flex, grid or relative layout with the same gap and padding",
          ],
        ],
      },
      {
        type: "callout",
        icon: "refresh",
        title: "Change the board, rebuild one page",
        blocks: [
          {
            type: "p",
            text: "When a screen changes, run `build_pages` again with that `board`. The theme and the components already in your app are reused instead of written twice.",
          },
        ],
      },
      { type: "h2", title: "When it doesn't match" },
      {
        type: "faq",
        items: [
          {
            q: "Text wraps differently",
            a: "Check that the theme's fonts are loaded in your app. The board measures text with them, so a fallback font wraps at other points.",
          },
          {
            q: "A component was written again",
            a: "Set `code` to its import path in `define_component`, so `build_pages` imports it instead of writing a new one.",
          },
          {
            q: "Colors differ in dark mode",
            a: "Screens draw with one mode at a time. Pass `mode` to `create_screen` for the dark version, and use the theme's `.dark` values in the app.",
          },
        ],
      },
    ],
  },
  {
    slug: "prompts",
    title: "Prompts",
    group: "build",
    minutes: 4,
    lede: "Prism ships three prompts, ready-made instructions for the jobs that take many tools. Editors that support MCP prompts list them as slash commands.",
    blocks: [
      { type: "h2", title: "design_screen", id: "design-screen" },
      {
        type: "p",
        text: "Designs a new screen from an idea. It opens or creates the board, sets up the theme and the shared components, gathers references when a Mobbin MCP is connected, reads the design guide, draws, checks its work and then watches for your Ask AI requests.",
      },
      {
        type: "params",
        rows: [
          {
            name: "idea",
            kind: "",
            required: true,
            text: "Required. What to design, like “landing page for a budgeting app”.",
          },
          { name: "project", kind: "", text: "The app's project, created if it doesn't exist." },
          { name: "board", kind: "", text: "Board name. Defaults to one named after the idea." },
        ],
      },
      { type: "prompt", text: '/mcp__prism__design_screen "booking flow for a yoga studio"' },
      { type: "h2", title: "build_pages", id: "build-pages" },
      {
        type: "p",
        text: "Codes a project's screens as pages of the app in the current folder. It detects the framework and styling, writes the theme once, builds each component once, then codes every frame as a route and compares it with the board.",
      },
      {
        type: "params",
        rows: [
          {
            name: "project",
            kind: "",
            required: true,
            text: "Required. The Prism project to build.",
          },
          {
            name: "board",
            kind: "",
            text: "Only this board. Defaults to every board in the project.",
          },
          {
            name: "framework",
            kind: "",
            text: "nextjs, react, vue, nuxt, svelte, sveltekit, html or flutter. Detected when left out.",
          },
          {
            name: "styling",
            kind: "",
            text: "tailwind, css or css-modules. Detected when left out.",
          },
        ],
      },
      { type: "prompt", text: '/mcp__prism__build_pages "Yoga studio"' },
      { type: "h2", title: "watch_edits", id: "watch-edits" },
      {
        type: "p",
        text: "Keeps handling your Ask AI requests until you stop it. Pass a board to watch only that one.",
      },
      {
        type: "params",
        rows: [
          { name: "board", kind: "", text: "A board name or id. Defaults to all your boards." },
        ],
      },
      { type: "prompt", text: "/mcp__prism__watch_edits" },
    ],
  },
  {
    slug: "export/react-tailwind",
    title: "React + Tailwind",
    group: "build",
    minutes: 5,
    lede: "Turn a board into pages of a React or Next.js app styled with Tailwind v4 and shadcn/ui, using the same token names the board uses.",
    blocks: [
      {
        type: "callout",
        icon: "route",
        title: "The short way",
        blocks: [
          {
            type: "p",
            text: "Run the `build_pages` prompt in your app's folder and your editor does every step below. Read on to know what it does, or to do it by hand.",
          },
        ],
      },
      {
        type: "steps",
        steps: [
          {
            title: "Write the theme once",
            blocks: [
              {
                type: "p",
                text: 'Call `get_theme` and put its css in `app/globals.css` or `src/index.css`, in place of the old `:root`, `.dark` and `@theme inline` blocks. Keep `@import "tailwindcss"` and your other rules.',
              },
            ],
          },
          {
            title: "Build each component once",
            blocks: [
              {
                type: "p",
                text: "Every project component becomes `components/<Name>.tsx` with its props and variants, or reuses the app's own, like `@/components/ui/button`.",
              },
            ],
          },
          {
            title: "Code each screen as a page",
            blocks: [
              {
                type: "p",
                text: "Read the frames with `get_screen_code` and write each as `app/<route>/page.tsx`, nesting elements as the tree does and writing `$tokens` as classes.",
              },
              {
                type: "code",
                title: "app/sign-up/page.tsx",
                code: 'export default function SignUp() {\n  return (\n    <form className="flex w-96 flex-col gap-6 rounded-lg bg-card p-8">\n      <h1 className="font-heading text-h3">Create your account</h1>\n      <Input label="Email" type="email" />\n      <Button className="w-full">Create account</Button>\n    </form>\n  );\n}',
              },
            ],
          },
          {
            title: "Compare with the board",
            blocks: [
              {
                type: "p",
                text: "Run the app, look at each page beside its frame's `export_image` and fix what differs. Then make the page responsive.",
              },
            ],
          },
        ],
      },
      { type: "h2", title: "Tokens as classes" },
      {
        type: "table",
        head: ["On the board", "In the code"],
        mono: [0, 1],
        rows: [
          ["fill $primary", "bg-primary"],
          ["color $muted-foreground", "text-muted-foreground"],
          ["radius $radius-lg", "rounded-lg"],
          ["textStyle $h3", "font-heading text-h3"],
        ],
      },
    ],
  },
  {
    slug: "export/css-variables",
    title: "CSS variables",
    group: "build",
    minutes: 3,
    lede: "For apps on plain CSS or CSS Modules: the theme as custom properties, and components that read them with var().",
    blocks: [
      { type: "h2", title: "The theme file" },
      {
        type: "p",
        text: "Ask `get_theme` for format `css-vars` and save the code as `src/styles/theme.css`, or in your global stylesheet, imported once at the root. It holds every color token, the radius scale, the fonts and type-scale classes.",
      },
      {
        type: "code",
        title: "src/styles/theme.css",
        code: ':root {\n  --background: #fcfcfd;\n  --foreground: #3d3b4f;\n  --primary: #28e99f;\n  --primary-foreground: #2a2a2a;\n  --radius-md: 8px;\n  --font-heading: "Anybody", sans-serif;\n}',
      },
      { type: "h2", title: "Use the tokens" },
      {
        type: "p",
        text: "Each `$token` on the board becomes `var(--token)` in a component's styles. Spacing and sizes come from the tree in px.",
      },
      {
        type: "code",
        title: "Button.module.css",
        code: ".button {\n  display: inline-flex;\n  gap: 8px;\n  padding: 12px 20px;\n  background: var(--primary);\n  color: var(--primary-foreground);\n  border-radius: var(--radius-md);\n}",
      },
      { type: "h2", title: "Light and dark" },
      {
        type: "p",
        text: "The file carries both sets of colors. Components only ever name the token, so switching themes needs no change in them.",
      },
      { type: "figure", name: "lightDark" },
    ],
  },
  {
    slug: "export/flutter",
    title: "Flutter",
    group: "build",
    minutes: 4,
    lede: "Screens become widgets and the project theme becomes a ThemeData, with the same token names you see on the board.",
    blocks: [
      {
        type: "steps",
        steps: [
          {
            title: "Add the theme",
            blocks: [
              {
                type: "p",
                text: "Ask `get_theme` for format `dart` and save it as `lib/theme/prism_theme.dart`. It loads the fonts through `google_fonts`, so add that package.",
              },
              { type: "command", title: "Terminal", command: "flutter pub add google_fonts" },
            ],
          },
          {
            title: "Wire it into the app",
            blocks: [
              {
                type: "code",
                title: "lib/main.dart",
                code: "MaterialApp.router(\n  theme: prismTheme(Brightness.light),\n  darkTheme: prismTheme(Brightness.dark),\n  routerConfig: router,\n);",
              },
            ],
          },
          {
            title: "Code the screens",
            blocks: [
              {
                type: "p",
                text: "Each frame becomes `lib/screens/<name>_screen.dart` with a `go_router` route, and each project component a `StatelessWidget` in `lib/widgets`. Tokens are read from the theme.",
              },
              {
                type: "code",
                title: "A card from the board",
                code: "Container(\n  padding: const EdgeInsets.all(32),\n  decoration: BoxDecoration(\n    color: PrismTokens.of(context).card,\n    borderRadius: BorderRadius.circular(12),\n  ),\n  child: Column(children: [ … ]),\n)",
              },
            ],
          },
        ],
      },
      { type: "h2", title: "Layouts as widgets" },
      {
        type: "table",
        head: ["Tree", "Widget"],
        mono: [0, 1],
        rows: [
          ["column", "Column"],
          ["row", "Row"],
          ["grid", "GridView"],
          ["overlay", "Stack + Positioned"],
          ["gap, padding", "SizedBox, Padding"],
        ],
      },
      {
        type: "callout",
        icon: "ruler",
        title: "Draw at the device size",
        blocks: [
          {
            type: "p",
            text: "Use 390 × 844 frames for phones, then let `LayoutBuilder` or flexible widgets handle other sizes.",
          },
        ],
      },
    ],
  },
  {
    slug: "export/database",
    title: "Prisma, SQL and Drizzle",
    group: "build",
    minutes: 4,
    lede: "Sketch or import a database schema as an ER diagram, change it with your team, and read it back in the dialect your app uses.",
    blocks: [
      { type: "h2", title: "The round trip" },
      { type: "figure", name: "roundTrip" },
      {
        type: "p",
        text: "Your editor reads the schema files and draws them. On the board, add tables with the Table tool, edit columns in the properties panel and set crow's-foot ends on any arrow. Then read it back.",
      },
      { type: "h2", title: "Postgres SQL" },
      {
        type: "code",
        title: 'format: "sql"',
        code: 'CREATE TABLE "User" (\n  "id" uuid PRIMARY KEY,\n  "email" text NOT NULL UNIQUE\n);\n\nCREATE TABLE "Post" (\n  "id" uuid PRIMARY KEY,\n  "authorId" uuid NOT NULL REFERENCES "User" ("id")\n);',
      },
      { type: "h2", title: "Drizzle" },
      {
        type: "code",
        title: 'format: "drizzle"',
        code: 'export const user = pgTable("User", {\n  id: uuid("id").primaryKey(),\n  email: text("email").notNull().unique(),\n});\n\nexport const post = pgTable("Post", {\n  id: uuid("id").primaryKey(),\n  authorId: uuid("authorId").notNull().references(() => user.id),\n});',
      },
      {
        type: "callout",
        icon: "database",
        title: "Migrations stay yours",
        blocks: [
          {
            type: "p",
            text: "Prism writes the schema, not the migration. Run `prisma migrate dev` or `drizzle-kit generate` the way your app already does.",
          },
        ],
      },
    ],
  },
];

import type { DocPage } from "../docs-types";

export const TOOL_PAGES: DocPage[] = [
  {
    slug: "tools/create-screen",
    title: "create_screen",
    mono: true,
    group: "reference",
    lede: "Draws a whole screen from a layout tree or from HTML and Tailwind. Prism measures the text, places every part and lints the result.",
    badge: { label: "WRITES", facts: ["One undo step", "Needs the board open in a tab"] },
    blocks: [
      { type: "h2", title: "Parameters" },
      {
        type: "params",
        rows: [
          { name: "boardId", kind: "uuid", required: true, text: "The board to draw on." },
          {
            name: "root",
            kind: "object",
            hint: "root or html",
            text: "The layout tree: stack, row, grid and overlay containers holding text, icon, box, spacer, divider and use leaves.",
          },
          {
            name: "html",
            kind: "string",
            hint: "root or html",
            text: "The page body in HTML and Tailwind v4, rendered with the project theme and read back as elements.",
          },
          {
            name: "frame",
            kind: "object",
            text: "{ width, height }: draws a frame of that size behind the screen. Leave height out to fit the content.",
          },
          {
            name: "mode",
            kind: "light | dark",
            text: "Which theme colors the $tokens take. Default light.",
          },
          {
            name: "x, y",
            kind: "number",
            text: "Where the screen goes. Default: right of the board's content.",
          },
        ],
      },
      { type: "h2", title: "Returns" },
      {
        type: "p",
        text: "The new frame's id and bounds, the elements it drew, and any warnings to fix before showing the result.",
      },
      {
        type: "code",
        title: "Response",
        code: '{\n  "frameId": "3d1b6091-…",\n  "bounds": { "x": 7920, "y": -72, "width": 1440, "height": 2397 },\n  "warnings": [\n    { "kind": "wrap", "message": "Text \\"Live and shared\\" wraps to 2 lines" }\n  ],\n  "elements": [ { "id": "…", "type": "frame" }, … ]\n}',
      },
      { type: "h2", title: "Notes" },
      {
        type: "notes",
        items: [
          {
            icon: "book",
            text: "Read `get_design_guide` before the first screen of a conversation.",
          },
          { icon: "alert", text: "Fix the warnings, then look at the frame with `export_image`." },
          { icon: "layers", text: "A whole landing page fits in one call, up to 800 nodes." },
        ],
      },
    ],
  },
  {
    slug: "tools/create-elements",
    title: "create_elements",
    mono: true,
    group: "reference",
    lede: "Places elements at exact positions: shapes, text, stickies, arrows, icons, charts and frames. Use it for flowcharts, notes and anything a layout doesn't fit.",
    badge: { label: "WRITES", facts: ["One undo step"] },
    blocks: [
      { type: "h2", title: "Parameters" },
      {
        type: "params",
        rows: [
          { name: "boardId", kind: "uuid", required: true, text: "The board to draw on." },
          {
            name: "elements",
            kind: "array",
            required: true,
            text: "Up to 500 elements, back to front. Each needs a type, x and y.",
          },
          { name: "mode", kind: "light | dark", text: "Which theme colors the $tokens take." },
        ],
      },
      { type: "h2", title: "Element fields", id: "element-fields" },
      {
        type: "defs",
        rows: [
          {
            term: "width  height  rotation",
            mono: true,
            text: "Size and turn. On lines and arrows, the offset to the end point.",
          },
          {
            term: "fill  stroke  radius  shadow",
            mono: true,
            text: "Paint, with $tokens or hex. Gradients and backdropBlur too.",
          },
          {
            term: "text  textStyle  font",
            mono: true,
            text: "Copy and type. stroke is the text color.",
          },
          {
            term: "key  startBinding  endBinding",
            mono: true,
            text: "Name elements in the call so arrows can attach to them.",
          },
          {
            term: "role  groupId",
            mono: true,
            text: "Meaning for code, and parts that move together.",
          },
        ],
      },
      { type: "h2", title: "Example" },
      {
        type: "p",
        text: "Two steps of a checkout flow and the arrow between them. The arrow binds to the keys, so it follows the boxes when someone drags them.",
      },
      {
        type: "code",
        title: "create_elements",
        code: '{ "elements": [\n  { "key": "cart", "type": "rect", "x": 0, "y": 0,\n    "width": 160, "height": 56, "radius": 8 },\n  { "key": "pay", "type": "rect", "x": 280, "y": 0,\n    "width": 160, "height": 56, "radius": 8 },\n  { "type": "arrow", "x": 160, "y": 28, "width": 120, "height": 0,\n    "startBinding": "cart", "endBinding": "pay" }\n] }',
      },
      { type: "h2", title: "Notes" },
      {
        type: "notes",
        items: [
          {
            icon: "book",
            text: "For a UI screen, prefer `create_screen`: it lays the parts out for you.",
          },
          {
            icon: "pencil",
            text: "Pictures go in with `add_image` or as a `fillImage`, logos with `add_svg`.",
          },
        ],
      },
    ],
  },
  {
    slug: "tools/create-er-diagram",
    title: "create_er_diagram",
    mono: true,
    group: "reference",
    lede: "Draws a database schema as tables and crow's-foot relations. Your editor reads the schema itself and passes it as JSON; Prism sizes, lays out and routes it.",
    badge: { label: "WRITES", facts: ["One undo step", "Up to 80 tables"] },
    blocks: [
      { type: "h2", title: "Parameters" },
      {
        type: "params",
        rows: [
          { name: "boardId", kind: "uuid", required: true, text: "The board to draw on." },
          {
            name: "tables",
            kind: "array",
            required: true,
            text: "Each with a name, an optional description and its columns: name, type, pk, fk, nullable, unique.",
          },
          {
            name: "relations",
            kind: "array",
            text: "One per foreign key: from { table, column } to { table, column }, with optional fromHead and toHead cardinality.",
          },
          {
            name: "route",
            kind: "elbow | straight",
            text: "How relation lines run. Default elbow.",
          },
          {
            name: "compact",
            kind: "boolean",
            text: "Show only key columns and a “+N more” row. Good past 15 tables.",
          },
        ],
      },
      { type: "h2", title: "Example" },
      {
        type: "code",
        title: "create_er_diagram",
        code: '{ "tables": [\n    { "name": "User", "columns": [\n      { "name": "id", "type": "uuid", "pk": true },\n      { "name": "email", "type": "text", "unique": true } ] },\n    { "name": "Post", "columns": [\n      { "name": "id", "type": "uuid", "pk": true },\n      { "name": "authorId", "type": "uuid", "fk": true } ] } ],\n  "relations": [\n    { "from": { "table": "Post", "column": "authorId" },\n      "to": { "table": "User", "column": "id" } } ] }',
      },
      { type: "figure", name: "erResult" },
      { type: "h2", title: "Notes" },
      {
        type: "notes",
        items: [
          {
            icon: "alert",
            text: "Pass database columns only. A Prisma relation field like `author User` is a relation, not a column.",
          },
          { icon: "layers", text: "A many-to-many is its join table with two relations." },
          {
            icon: "pencil",
            text: "Edit the tables on the board, then read them back with `get_schema_code`.",
          },
        ],
      },
    ],
  },
  {
    slug: "tools/create-mindmap",
    title: "create_mindmap",
    mono: true,
    group: "reference",
    lede: "Turns an outline into a styled, laid-out mind map: a central topic, colored main branches and sub-topics joined by curves.",
    badge: { label: "WRITES", facts: ["One undo step", "Up to 400 nodes"] },
    blocks: [
      { type: "h2", title: "Parameters" },
      {
        type: "params",
        rows: [
          { name: "boardId", kind: "uuid", required: true, text: "The board to draw on." },
          {
            name: "root",
            kind: "object",
            hint: "a new map",
            text: "The central topic's text and its children, nested. Keep labels to a few words.",
          },
          {
            name: "parentId",
            kind: "uuid",
            hint: "add to a map",
            text: "An existing node to branch from, with children. The whole map is tidied again.",
          },
          {
            name: "sides",
            kind: "right | both",
            text: "Main branches to the right only, or both sides. Default both.",
          },
          {
            name: "collapsed",
            kind: "boolean",
            text: "New main branches start folded. Pass false to show everything.",
          },
        ],
      },
      { type: "h2", title: "Example" },
      {
        type: "code",
        title: "create_mindmap",
        code: '{ "root": { "text": "Studio launch", "children": [\n    { "text": "Audience", "children": [{ "text": "Beginners" }] },\n    { "text": "Pricing", "children": [{ "text": "Class packs" }] },\n    { "text": "Channels", "children": [{ "text": "Local events" }] }\n  ] },\n  "collapsed": false }',
      },
      { type: "h2", title: "Notes" },
      {
        type: "notes",
        items: [
          {
            icon: "pencil",
            text: "On the board, Tab adds a child, Enter adds a sibling and the toggle folds a branch.",
          },
          {
            icon: "layers",
            text: "To grow a map later, pass `parentId` and children instead of `root`.",
          },
        ],
      },
    ],
  },
  {
    slug: "tools/get-screen-code",
    title: "get_screen_code",
    mono: true,
    group: "reference",
    lede: "Reads a board's screens as nested trees ready to code in any framework: what sits inside what, each container's layout, sizes and $tokens.",
    badge: { label: "READ-ONLY", facts: ["Works with build_pages"] },
    blocks: [
      { type: "h2", title: "Parameters" },
      {
        type: "params",
        rows: [
          { name: "boardId", kind: "uuid", required: true, text: "The board to read." },
          {
            name: "frameId",
            kind: "uuid",
            text: "Only this frame. Default: every frame on the board.",
          },
        ],
      },
      { type: "h2", title: "Returns" },
      {
        type: "p",
        text: "One entry per screen: its `frameId`, its label (the route and state written above the frame), its size and its tree. Frames inside another frame are part of it, not screens of their own.",
      },
      {
        type: "code",
        title: "screens[0].tree · excerpt",
        code: '{ "kind": "box", "name": "Sign-up card", "role": "card",\n  "width": 380, "height": "hug",\n  "layout": { "direction": "column", "gap": 24, "padding": [32, 32, 32, 32] },\n  "style": { "fill": "$card", "radius": "$radius-lg" },\n  "children": [\n    { "kind": "text", "width": "hug",\n      "style": { "text": "Create your account", "textStyle": "$h3" } },\n    …\n  ] }',
      },
      { type: "h2", title: "Layout to code" },
      {
        type: "table",
        head: ["Tree", "Web", "Flutter"],
        mono: [0, 1, 2],
        rows: [
          ["column", "flex flex-col", "Column"],
          ["row", "flex flex-row", "Row"],
          ["grid", "grid grid-cols-*", "GridView"],
          ["overlay", "relative + absolute", "Stack + Positioned"],
        ],
      },
      {
        type: "callout",
        icon: "eye",
        title: "Compare, then fix",
        blocks: [
          {
            type: "p",
            text: "After coding a page, look at the frame with `export_image` and the running page side by side. Differences in spacing and wrapping show up fast.",
          },
        ],
      },
    ],
  },
  {
    slug: "tools/get-schema-code",
    title: "get_schema_code",
    mono: true,
    group: "reference",
    lede: "Reads the ER diagram on a board back as schema code: a Prisma schema, Postgres DDL or a Drizzle pg-core schema.",
    badge: { label: "READ-ONLY", facts: ["Reads table elements and the relations between them"] },
    blocks: [
      { type: "h2", title: "Parameters" },
      {
        type: "params",
        rows: [
          { name: "boardId", kind: "uuid", required: true, text: "The board with the diagram." },
          {
            name: "format",
            kind: "string",
            text: "prisma (default), sql for Postgres, or drizzle.",
          },
          {
            name: "ids",
            kind: "uuid[]",
            text: "Only these tables, or relations, which bring both their tables. Default: every table.",
          },
        ],
      },
      { type: "h2", title: "Example" },
      {
        type: "p",
        text: "The User and Post tables from the `create_er_diagram` example, read back as Prisma.",
      },
      {
        type: "tabs",
        tabs: [
          {
            label: "prisma",
            code: "model User {\n  id    String @id @db.Uuid\n  email String @unique\n  posts Post[]\n}\n\nmodel Post {\n  id       String @id @db.Uuid\n  authorId String @db.Uuid\n  author   User   @relation(fields: [authorId], references: [id])\n}",
          },
          {
            label: "sql",
            code: 'CREATE TABLE "User" (\n  "id" uuid PRIMARY KEY,\n  "email" text NOT NULL UNIQUE\n);\n\nCREATE TABLE "Post" (\n  "id" uuid PRIMARY KEY,\n  "authorId" uuid NOT NULL REFERENCES "User" ("id")\n);',
          },
          {
            label: "drizzle",
            code: 'export const user = pgTable("User", {\n  id: uuid("id").primaryKey(),\n  email: text("email").notNull().unique(),\n});\n\nexport const post = pgTable("Post", {\n  id: uuid("id").primaryKey(),\n  authorId: uuid("authorId").notNull().references(() => user.id),\n});',
          },
        ],
      },
      { type: "h2", title: "Notes" },
      {
        type: "notes",
        items: [
          {
            icon: "alert",
            text: "A relation that doesn't end at a column on both tables is left out, and the result says how many.",
          },
          {
            icon: "pencil",
            text: "Adapt names and types to the app's conventions, then write the migration with the app's own tools.",
          },
        ],
      },
    ],
  },
  {
    slug: "tools/get-theme",
    title: "get_theme",
    mono: true,
    group: "reference",
    lede: "Reads a project's theme: its color tokens for light and dark, radius, fonts and text styles, plus the code to put in your app.",
    badge: { label: "READ-ONLY", facts: ["Pair it with set_theme to write one"] },
    blocks: [
      { type: "h2", title: "Parameters" },
      {
        type: "params",
        rows: [
          {
            name: "projectId",
            kind: "uuid",
            hint: "or boardId",
            text: "The project whose theme to read.",
          },
          {
            name: "boardId",
            kind: "uuid",
            hint: "or projectId",
            text: "Or a board: you get its project's theme, or the default.",
          },
          {
            name: "format",
            kind: "string",
            text: "css (default, Tailwind v4 and shadcn/ui), css-vars, json or dart.",
          },
        ],
      },
      { type: "h2", title: "Returns" },
      {
        type: "p",
        text: "The tokens as data, whether the theme is strict, `saved: false` when the project still has the default, and the code in the format you asked for, with a note on how to write tokens in it.",
      },
      {
        type: "tabs",
        tabs: [
          {
            label: "css",
            code: '@import "tailwindcss";\n\n:root {\n  --background: #fcfcfd;\n  --foreground: #3d3b4f;\n  --primary: #28e99f;\n  --muted-foreground: #5f5f5f;\n  --radius: 0.625rem;\n}\n\n@theme inline {\n  --color-primary: var(--primary);\n  --font-heading: "Anybody", sans-serif;\n}',
          },
          {
            label: "css-vars",
            code: ':root {\n  --background: #fcfcfd;\n  --foreground: #3d3b4f;\n  --primary: #28e99f;\n  --muted-foreground: #5f5f5f;\n  --radius-md: 8px;\n  --font-heading: "Anybody", sans-serif;\n}',
          },
        ],
      },
      { type: "h2", title: "Notes" },
      {
        type: "notes",
        items: [
          { icon: "book", text: "Read it before designing, so screens use the `$tokens`." },
          {
            icon: "pencil",
            text: "Read it before coding, and put the css in `app/globals.css` or `src/index.css`.",
          },
        ],
      },
    ],
  },
];

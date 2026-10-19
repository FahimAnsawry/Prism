import type { DocPage } from "../docs-types";

export const DESIGN_PAGES: DocPage[] = [
  {
    slug: "screens-and-frames",
    title: "Screens and frames",
    group: "design",
    minutes: 5,
    lede: "A screen is a frame and everything inside it. Describe its layout and Prism measures and places every part, the way a browser lays out a page.",
    blocks: [
      { type: "h2", title: "Frame sizes" },
      {
        type: "p",
        text: "Draw at a real device size so the code has the same proportions. Leave the height out and the frame grows with its content.",
      },
      { type: "figure", name: "frameSizes" },
      { type: "h2", title: "Describe the layout" },
      {
        type: "p",
        text: "Containers arrange their children: `stack` top to bottom, `row` left to right, `grid` in equal columns, `overlay` in layers. Each takes gap, padding, align, justify and a width or height in px, fill or hug. Leaves are text, icon, box, spacer, divider and `use`, which places a project component.",
      },
      {
        type: "code",
        title: "create_screen · root",
        code: '{ "type": "stack", "padding": 32, "gap": 24, "children": [\n  { "type": "text", "text": "Create your account", "textStyle": "$h3" },\n  { "type": "use", "component": "Input", "props": { "label": "Email" } },\n  { "type": "use", "component": "Button",\n    "props": { "label": "Create account" }, "width": "fill" }\n] }',
      },
      {
        type: "p",
        text: "Prefer markup? Pass `html` instead of `root`. The board tab renders HTML and Tailwind with the project theme, then reads it back as elements, with theme classes kept as `$tokens`.",
      },
      { type: "h2", title: "Checks that come back" },
      {
        type: "p",
        text: "Every new screen is linted. Your editor gets the warnings and fixes them before it shows you the result.",
      },
      {
        type: "notes",
        items: [
          { icon: "alert", text: "Text wrapping more than written" },
          { icon: "alert", text: "Content spilling out of its box" },
          { icon: "alert", text: "Low contrast text" },
          { icon: "alert", text: "Tiny text, too many sizes" },
          { icon: "alert", text: "Too many accent colors" },
          { icon: "alert", text: "Gray boxes where a picture belongs" },
        ],
      },
      {
        type: "callout",
        icon: "route",
        title: "Name the route",
        blocks: [
          {
            type: "p",
            text: "A small label above a frame, like `/reset-password · desktop · link sent`, tells `build_pages` which page and state the screen is.",
          },
        ],
      },
    ],
  },
  {
    slug: "themes",
    title: "Themes",
    group: "design",
    minutes: 4,
    lede: "A project's theme is its color tokens for light and dark, its radius and its fonts. Every screen in the project draws with it, and the code uses the same names.",
    blocks: [
      { type: "h2", title: "What a theme holds" },
      {
        type: "p",
        text: "The shadcn/ui color variables, each with a light and a dark value, a radius scale, three fonts (sans, heading and mono) and text styles from `$display` down to `$caption`. Boards outside a project use the default theme.",
      },
      { type: "figure", name: "swatches" },
      { type: "h2", title: "Tokens on elements" },
      {
        type: "p",
        text: "Tools resolve `$primary` to its value and keep the name on the element. A read shows `$primary` for as long as the value still matches, so a color you change by hand falls back to the plain value instead of lying about its token.",
      },
      {
        type: "code",
        title: "create_screen · a token in use",
        code: '{ "type": "row", "fill": "$primary", "radius": "$radius-md", "children": [\n  { "type": "text", "text": "Book a class", "textStyle": "$label",\n    "color": "$primary-foreground" }\n] }',
      },
      { type: "h2", title: "Strict themes" },
      {
        type: "p",
        text: "A saved theme is strict by default. Plain UI colors, radius values, fonts, text sizes and spacing off the scale are refused, so every screen stays on the design system. Stickies, arrows, charts and diagrams are free.",
      },
      {
        type: "callout",
        icon: "palette",
        title: "Start from your app",
        blocks: [
          {
            type: "p",
            text: "In your app's folder, ask your editor to import the theme. It reads the shadcn/ui variables in `app/globals.css` or `src/index.css` and saves them with `set_theme`.",
          },
        ],
      },
      { type: "h2", title: "Read it as code" },
      {
        type: "defs",
        rows: [
          {
            term: "css",
            mono: true,
            text: "Tailwind v4 and shadcn/ui variables for your global CSS",
          },
          { term: "css-vars", mono: true, text: "Plain custom properties and type-scale classes" },
          {
            term: "dart",
            mono: true,
            text: "A Flutter ThemeData with tokens, type scale and radius",
          },
          { term: "json", mono: true, text: "Design tokens for anything else" },
        ],
      },
    ],
  },
  {
    slug: "components",
    title: "Components",
    group: "design",
    minutes: 4,
    lede: "A component is a part the project reuses: a button, an input, a card, the navigation. Draw it once, place it on every screen, and it codes as one component.",
    blocks: [
      { type: "h2", title: "Define one" },
      {
        type: "p",
        text: "A component is a layout tree, like a screen's, with `{{prop}}` placeholders where its content changes. `define_component` saves it to the project.",
      },
      {
        type: "code",
        title: "define_component",
        code: '{\n  "name": "Button",\n  "props": { "label": {}, "bg": {}, "fg": {} },\n  "variants": {\n    "primary": { "bg": "$primary", "fg": "$primary-foreground" },\n    "ghost": { "bg": null, "fg": "$foreground" }\n  },\n  "code": "@/components/ui/button",\n  "root": { "type": "row", "padding": [12, 20], "fill": "{{bg}}",\n    "children": [{ "type": "text", "text": "{{label}}", "color": "{{fg}}" }] }\n}',
      },
      { type: "h2", title: "Variants and slots" },
      {
        type: "p",
        text: "Variants are named sets of props, and `null` leaves a field out. A `slot` node marks where a placed component's children go, like a card's body or a page shell's content.",
      },
      { type: "figure", name: "componentVariants" },
      { type: "h2", title: "Place it" },
      {
        type: "p",
        text: "A `use` node drops the component into any screen. Everything it draws carries the component's name, so `get_screen_code` reads it back as one instance with its props.",
      },
      {
        type: "code",
        title: "create_screen · a use node",
        code: '{ "type": "use", "component": "Button", "variant": "ghost",\n  "props": { "label": "Cancel" } }',
      },
      {
        type: "callout",
        icon: "puzzle",
        title: "Point at the component you already have",
        blocks: [
          {
            type: "p",
            text: "Set `code` to its import path, like `@/components/ui/button`, and `build_pages` reuses it instead of writing a new one.",
          },
        ],
      },
    ],
  },
  {
    slug: "design-guide",
    title: "Design guide",
    group: "design",
    minutes: 3,
    lede: "The brief your editor reads before its first screen: how to pick a direction, the type and spacing scale, a color strategy, and how to check the result.",
    blocks: [
      { type: "h2", title: "What it covers" },
      {
        type: "defs",
        rows: [
          {
            term: "Decide before you draw",
            text: "For a landing page: two or three directions, a thesis, one signature move and the category default to avoid. For app and mobile screens: the person, their task, density and states",
          },
          {
            term: "Type",
            text: "Sizes, weights and line heights per role, and fonts with a point of view",
          },
          {
            term: "Color",
            text: "Restrained, committed, full palette or drenched, picked from the scene",
          },
          {
            term: "Space and hierarchy",
            text: "A spacing scale, one primary action per view, forms that fit their answers",
          },
          {
            term: "Landing pages",
            text: "Jobs instead of a fixed list of sections, and structures to choose from",
          },
          {
            term: "Design for code",
            text: "Each page at 1440 and 390, component states, focus and names for access, a dark frame, charts that answer one question",
          },
          {
            term: "Check it",
            text: "Fix the warnings, look at the export, run the hierarchy and slop checks",
          },
        ],
      },
      { type: "h2", title: "One site, one design" },
      {
        type: "p",
        text: "Pass the `boardId` and the guide ends with that board's site. When the site already has screens, it lists them, and every new page keeps their language. When the site is new, it describes your other sites, so this one doesn't come out as the same page again.",
      },
      { type: "figure", name: "sameSite" },
      { type: "h2", title: "Call it" },
      {
        type: "p",
        text: "Editors call it on their own before the first `create_screen` of a conversation. `surface` is `landing`, `app` or `mobile`; the guide's sizes follow it.",
      },
      {
        type: "code",
        title: "get_design_guide",
        code: '{ "surface": "landing", "boardId": "b7898e7a-…" }',
      },
      {
        type: "callout",
        icon: "ruler",
        title: "Your theme wins",
        blocks: [
          {
            type: "p",
            text: "Where the guide's sizes and your project's text styles differ, the theme decides, and your request decides above both.",
          },
        ],
      },
    ],
  },
];

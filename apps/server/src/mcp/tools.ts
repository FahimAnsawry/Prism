import {
  checkComponent,
  COMPONENTS_MAX,
  componentNameSchema,
  componentSchema,
  expandComponents,
  usedComponents,
  buildMindMap,
  countMindNodes,
  countNodes,
  mindChildren,
  mindDepth,
  mindDescendants,
  mindmapInputSchema,
  MINDMAP_NODES_MAX,
  mindRoot,
  tidyMindMap,
  createBoardSchema,
  createProjectSchema,
  DEFAULT_THEME,
  EDIT_NOTE_MAX,
  estimateText,
  fontFamilySchema,
  frameLabel,
  HTML_SCREEN_MAX,
  LAYOUT_NODES_MAX,
  layoutNodeSchema,
  layoutScreen,
  elementChangesSchema,
  fontFamilyName,
  mergeTheme,
  parseThemeCss,
  themeCode,
  THEME_FORMATS,
  TOKEN_USAGE,
  PENDING_ASSET,
  RADIUS_SCALE,
  resolveElementTokens,
  resolveLayoutTokens,
  rowFillTraps,
  screenTree,
  storeLayoutImages,
  strictMessage,
  strictViolations,
  TEXT_STYLES,
  THEME_COLORS,
  THEME_MODES,
  themeColorHex,
  themePatchSchema,
  themeTokenNames,
  unknownTokensMessage,
  WAIT_EDITS_MAX_SECONDS,
  type BoardElement,
  type ElementOp,
  type ElementTokens,
  type ImageFill,
  type LayoutOptions,
  type Theme,
  type ThemeMode,
} from "@prism/shared";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  completeEdit,
  imageFillAsset,
  importImage,
  importSvg,
  storeSvg,
  loadElements,
  selectionFor,
  sourceFileStem,
  waitForEdits,
} from "../ai-actions.js";
import { HttpError } from "../errors.js";
import { colorPhotos, searchImages } from "../image-search.js";
import {
  broadcastOps,
  requestBoardImage,
  requestHtmlScreen,
  requestImageColors,
  requestReferenceComparison,
  requestMindmapLayout,
  requestScreenLayout,
  showBoardInBrowser,
} from "../realtime.js";
import { boardFor } from "../routes/board-access.js";
import { applyOps } from "../routes/elements.js";
import {
  boardComponents,
  boardTheme,
  createBoard,
  createProject,
  designSites,
  getBoardSummary,
  getProjectComponents,
  getProjectTheme,
  loadWorkspace,
  saveProjectComponents,
  saveProjectTheme,
} from "../routes/workspace.js";
import { DESIGN_SURFACES, designGuide } from "./design-guide.js";
import { photosOf, siteContext } from "./site-context.js";
import { lintScreen, type ScreenWarning } from "./screen-lint.js";
import {
  boundsOf,
  buildElements,
  compact,
  createElementInput,
  type CreateElementInput,
  insideFrame,
  layoutElementInput,
  updateChangesInput,
} from "./elements.js";

// The Prism tools AI editors call, acting as one signed-in user on that user's boards.

type ToolContent =
  { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
type ToolResult = { content: ToolContent[]; isError?: boolean };

const json = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});

/** Runs a tool body, turning expected failures into a readable tool error. */
async function run(body: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await body();
  } catch (error) {
    let text: string;
    if (error instanceof HttpError) text = error.message;
    else if (error instanceof z.ZodError) text = `Invalid input:\n${z.prettifyError(error)}`;
    else {
      console.error("[Prism] MCP tool failed:", error);
      text = "Something went wrong on the Prism server. Try again.";
    }
    return { content: [{ type: "text", text }], isError: true };
  }
}

const serverUrl = () => process.env["SERVER_URL"] ?? process.env["BETTER_AUTH_URL"] ?? "";
const clientUrl = () => process.env["CLIENT_URL"] ?? "";
const fileUrl = (assetKey: string) => new URL(`/uploads/${assetKey}`, serverUrl()).toString();
const boardUrl = (boardId: string) => new URL(`/board/${boardId}`, clientUrl()).toString();
const view = (el: BoardElement, theme?: Theme) => compact(el, fileUrl, theme);

const boardId = z.uuid().describe("The board's id (from list_boards or open_board).");
const projectId = z.uuid().describe("The project's id (from list_boards or create_project).");
const modeInput = z
  .enum(THEME_MODES)
  .optional()
  .describe('Which theme colors the $tokens take: "light" (default) or "dark" for a dark screen.');

/** Told with any read that shows theme tokens. */
const TOKENS_NOTE =
  "Values starting with $ come from the project theme (get_theme): code them as Tailwind classes (fill $primary → bg-primary, text $muted-foreground → text-muted-foreground, stroke $border → border-border, $radius-lg → rounded-lg, textStyle $h1 → text-h1, font $heading → font-heading), never as hex or px.";
const hasTokens = (elements: BoardElement[]) => elements.some((el) => el.tokens);

/** Told with any read that shows component instances. */
const COMPONENTS_NOTE =
  'Elements with the same groupId and a component ("Button:primary", "Sidebar > NavItem") are one instance of a project component (list_components): build each component once (at its code path if it has one) and reuse it, passing the instance\'s text as props.';
const hasComponents = (elements: BoardElement[]) => elements.some((el) => el.component);

/** How get_screen_code's trees map to code, in any framework. */
const LAYOUT_NOTE =
  "kind: frame = the page; box = a painted container (div / Container with decoration); group = an unpainted wrapper (div / Column, Row); component = a project component instance (render it, texts → its props); text, icon, image, divider, shape = leaves. layout.direction: column → flex flex-col / Column, row → flex flex-row / Row, grid → grid grid-cols-N / GridView or Wrap, overlay → a relative parent with absolute children at `at` {x, y} / Stack with Positioned. gap, padding [top, right, bottom, left] and box sizes are px: in Tailwind divide by `spacing` (16px with spacing 4 = p-4 or gap-4), in CSS write px or rem, in Flutter SizedBox and EdgeInsets. width/height: fill → w-full or flex-1 in a row / Expanded, hug → its content's size (w-fit / no size), a number → that px (prefer max-w-* and responsive classes over fixed widths on the web). align is cross-axis (items-*), justify main-axis (justify-*), alignSelf overrides align for one child (self-*).";

/** How to place a component, for an AI editor. */
function componentUsage(name: string, component: z.infer<typeof componentSchema>) {
  const variants = Object.keys(component.variants);
  const required = Object.entries(component.props)
    .filter(
      ([key, prop]) =>
        prop.default === undefined && !variants.some((v) => key in (component.variants[v] ?? {})),
    )
    .map(([key]) => key);
  return {
    type: "use",
    component: name,
    ...(variants.length > 0 && { variant: component.defaultVariant ?? variants[0] }),
    ...(required.length > 0 && { props: Object.fromEntries(required.map((key) => [key, "…"])) }),
  };
}

/**
 * Stores a call's images with the board: image URLs (downloaded once per call) and SVG markup.
 * One that can't be stored is skipped with a warning instead of failing the whole call, so an
 * AI editor can retry it with another URL.
 */
function imageStore(boardId: string) {
  const warnings: ScreenWarning[] = [];
  const urls = new Map<string, Promise<string | undefined>>();
  const reason = (error: unknown) =>
    error instanceof Error ? error.message : "it couldn't be stored";

  const image = (url: string) => {
    let assetKey = urls.get(url);
    if (!assetKey) {
      assetKey = imageFillAsset(boardId, url).catch((error: unknown) => {
        warnings.push({
          kind: "image",
          ids: [],
          message: `Skipped the image ${url}: ${reason(error)} The shape keeps its fill. Try another URL (search_images finds working ones).`,
        });
        return undefined;
      });
      urls.set(url, assetKey);
    }
    return assetKey;
  };

  const svg = (markup: string) =>
    storeSvg(boardId, markup).then(
      (stored) => stored.assetKey,
      (error: unknown) => {
        warnings.push({ kind: "svg", ids: [], message: `Skipped an svg: ${reason(error)}` });
        return undefined;
      },
    );

  /** An image fill given as a URL, stored; undefined when it was skipped. */
  const fill = async (
    value: { url: string; fit?: ImageFill["fit"] | undefined } | null | undefined,
  ): Promise<ImageFill | null | undefined> => {
    if (!value) return value;
    const assetKey = await image(value.url);
    return assetKey ? { assetKey, fit: value.fit ?? "cover" } : undefined;
  };

  return { image, svg, fill, warnings };
}

/** Element fields with their $tokens resolved, or a 400 that lists the valid tokens. */
function themed<T extends Record<string, unknown>>(
  fields: T,
  theme: Theme,
  mode: ThemeMode,
  current?: ElementTokens | null,
) {
  const result = resolveElementTokens(fields, theme, mode, current);
  if (result.unknown.length > 0) throw new HttpError(400, unknownTokensMessage(result.unknown));
  return {
    ...result.fields,
    ...(result.tokens !== undefined && { tokens: result.tokens }),
  } as T & { tokens?: ElementTokens | null };
}

/** create_elements values that come from the theme unless given. */
function themedDefaults(
  input: Omit<CreateElementInput, "fillImage">,
): Partial<Omit<CreateElementInput, "fillImage">> {
  if (input.type === "icon") return { stroke: "$foreground" };
  // A gradient frame's fill comes from its first color instead.
  if (input.type === "frame") return input.gradient ? {} : { fill: "$background" };
  if (input.type !== "text" && input.type !== "list") return {};
  // Text without a style or size of its own gets the body style (which sets its font too).
  const sized = input.textStyle != null || input.fontSizePx != null || input.fontSize != null;
  return { stroke: "$foreground", ...(sized ? { font: "$sans" } : { textStyle: "$body" }) };
}

/** Refuses plain UI values when the theme is strict. */
function checkStrict(
  theme: Theme,
  items: { fields: Record<string, unknown>; type: BoardElement["type"] }[],
) {
  if (!theme.strict) return;
  const violations = items.flatMap(({ fields, type }) => strictViolations(fields, type));
  if (violations.length > 0) throw new HttpError(400, strictMessage(violations));
}

/** A theme for an AI editor: each token's hex per mode, the radius scale and the fonts. */
function describeTheme(theme: Theme) {
  return {
    name: theme.name ?? null,
    colors: Object.fromEntries(
      THEME_COLORS.map((name) => [
        `$${name}`,
        { light: themeColorHex(theme, "light", name), dark: themeColorHex(theme, "dark", name) },
      ]),
    ),
    radius: {
      ...Object.fromEntries(
        Object.entries(RADIUS_SCALE).map(([name, scale]) => [
          `$${name}`,
          Math.round(theme.radius * scale * 10) / 10,
        ]),
      ),
      "$radius-full": 9999,
    },
    fonts: {
      $sans: fontFamilyName(theme.fonts.sans),
      $heading: fontFamilyName(theme.fonts.heading),
      $mono: fontFamilyName(theme.fonts.mono),
    },
    textStyles: Object.fromEntries(
      TEXT_STYLES.map((name) => {
        const style = theme.text[name];
        const font = style.font === "sans" ? "" : `font-${style.font} `;
        return [`$${name}`, { ...style, font: `$${style.font}`, tailwind: `${font}text-${name}` }];
      }),
    ),
    spacing: {
      base: theme.spacing,
      note: `Tailwind spacing: p-4 = ${theme.spacing * 4}px. Gaps and padding go in ${theme.spacing / 2}px steps.`,
    },
    strict: theme.strict,
  };
}

/** Saves AI-made ops (one undo step for the user) and sends them to open board tabs. */
async function save(userId: string, id: string, ops: ElementOp[]) {
  const board = await boardFor(id, userId, "edit");
  const result = await applyOps(board, ops);
  broadcastOps(board.id, result.applied);
  return result;
}

/**
 * create_screen with html: the user's board tab renders the page and reads it back as elements;
 * here its images are stored with the board and the elements saved as one screen.
 */
async function createHtmlScreen(
  userId: string,
  boardIdInput: string,
  html: string,
  frame: { width: number; height?: number | undefined } | undefined,
  place: { width?: number | undefined; x?: number | undefined; y?: number | undefined },
  font: z.infer<typeof fontFamilySchema> | undefined,
  mode: ThemeMode,
) {
  const board = await boardFor(boardIdInput, userId, "edit");
  const [theme, components] = await Promise.all([boardTheme(board), boardComponents(board)]);
  const existing = await loadElements(board.id);
  const content = boundsOf(existing);
  const width = frame?.width ?? place.width ?? 390;
  const options: LayoutOptions = {
    x: place.x ?? (content ? content.x + content.width + 120 : 0),
    y: place.y ?? (content ? content.y : 0),
    width,
    height: frame?.height,
    font: font ?? theme.fonts.sans,
  };
  const reply = await requestHtmlScreen(userId, {
    boardId: board.id,
    html,
    options,
    fontGiven: font !== undefined,
    mode,
    theme,
    components,
  });
  if (theme.strict && reply.violations.length > 0) {
    throw new HttpError(400, strictMessage(reply.violations));
  }

  // Images the page showed, stored once each; elements point at them as "pending:<index>".
  const images = imageStore(board.id);
  const stored = await Promise.all(
    reply.assets.map((asset) =>
      asset.kind === "url" ? images.image(asset.url) : images.svg(asset.markup),
    ),
  );
  const layerOf: (string | undefined)[] = [];
  const lastLineOf: (string | undefined)[] = [];
  const parts = reply.elements.map((raw) => {
    const { fillImage, layer, lastLine, ...fields } = raw as Record<string, unknown> & {
      fillImage?: { assetKey?: unknown; fit?: unknown };
    };
    layerOf.push(typeof layer === "string" ? layer : undefined);
    lastLineOf.push(typeof lastLine === "string" ? lastLine : undefined);
    const key = typeof fillImage?.assetKey === "string" ? fillImage.assetKey : "";
    // Only images this call stored: a tab can't point an element at another board's files.
    const assetKey = key.startsWith(PENDING_ASSET)
      ? stored[Number(key.slice(PENDING_ASSET.length))]
      : undefined;
    return layoutElementInput.parse({
      ...fields,
      ...(assetKey && { fillImage: { assetKey, fit: fillImage?.fit ?? "cover" } }),
    });
  });

  const bottom = Math.max(options.y, ...parts.map((el) => el.y + (el.height ?? 0)));
  const background = reply.background;
  const frameElement = frame && {
    type: "frame" as const,
    x: options.x,
    y: options.y,
    width,
    height: frame.height ?? Math.max(40, Math.ceil(Math.max(reply.height, bottom - options.y))),
    ...(background
      ? {
          fill: background.fill,
          ...(background.token && { tokens: { fill: background.token } }),
        }
      : {
          fill: themeColorHex(theme, mode, "background"),
          tokens: { fill: "background" },
        }),
  };
  const elements = buildElements(frameElement ? [frameElement, ...parts] : parts, existing);
  await save(
    userId,
    board.id,
    elements.map((element) => ({ op: "create", element })),
  );
  const layers = new Map<string, string>();
  const lastLines = new Map<string, string>();
  layerOf.forEach((layer, i) => {
    const id = elements[frameElement ? i + 1 : i]?.id;
    if (id && layer) layers.set(id, layer);
    const last = lastLineOf[i];
    if (id && last) lastLines.set(id, last);
  });
  const warnings: ScreenWarning[] = [
    ...reply.notes.map((message) => ({ kind: "html", ids: [], message })),
    ...images.warnings,
    ...lintScreen(elements, layers, { lastLines }),
  ];
  return json({
    frameId: frameElement ? elements[0]?.id : null,
    bounds: boundsOf(elements),
    measured: "browser (rendered HTML)",
    theme: { name: theme.name ?? null, mode },
    ...(warnings.length > 0 && { warnings }),
    elements: elements.map((el) => ({
      id: el.id,
      type: el.type,
      ...(el.role && { role: el.role }),
      ...(el.groupId && { groupId: el.groupId }),
      ...(el.text && { text: el.text.slice(0, 60) }),
    })),
    next:
      warnings.length > 0
        ? `Fix the ${warnings.length} warning${warnings.length === 1 ? "" : "s"} (in the HTML and draw it again, or with update_elements), then check it with export_image (frameId).`
        : "Check it with export_image (frameId), then fix anything off with update_elements or by drawing the HTML again.",
  });
}

/** For an item shared with the user: what they may do there and whose it is. */
const sharedBy = (item: { access: string; ownerName: string }) =>
  item.access === "owner" ? {} : { access: item.access, owner: item.ownerName };

export function registerTools(server: McpServer, userId: string) {
  // ── Boards ───────────────────────────────────────────────────────────────

  server.registerTool(
    "list_boards",
    {
      title: "List boards",
      description:
        'List the user\'s Prism boards (id, name, project, item count), most recently edited first, then the boards and projects others shared with them. access says what the user may do there: "editor" (edit content) or "viewer" (read-only: drawing tools refuse changes); the user\'s own items have no access field.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () =>
      run(async () => {
        const workspace = await loadWorkspace(userId);
        const allProjects = [...workspace.projects, ...workspace.shared.projects];
        const projects = new Map(allProjects.map((p) => [p.id, p.name]));
        return json({
          boards: [...workspace.boards, ...workspace.shared.boards].map((b) => ({
            id: b.id,
            name: b.name,
            project: b.projectId ? (projects.get(b.projectId) ?? null) : null,
            items: b.itemCount,
            editedAt: b.editedAt,
            url: boardUrl(b.id),
            ...sharedBy(b),
          })),
          projects: allProjects.map((p) => ({ id: p.id, name: p.name, ...sharedBy(p) })),
        });
      }),
  );

  server.registerTool(
    "open_board",
    {
      title: "Open or create a board",
      description:
        'Open a board by id, or by name: an existing board with that name is reused, otherwise a new one is created. If the user has Prism open in their browser, that tab switches to the board. Returns the board id, its URL and `browser`: "open" (it already was) or "opened" (the tab switched): the user is watching; "asked": the user was busy and got a prompt to open it; "no-tab": no Prism tab is open, so give the user the URL to open.',
      inputSchema: z.object({
        boardId: boardId.optional(),
        name: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .optional()
          .describe("Board name to open or create."),
        projectId: z.uuid().optional().describe("Project for a newly created board."),
      }),
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    (input) =>
      run(async () => {
        let board;
        let created = false;
        if (input.boardId) {
          board = await getBoardSummary(userId, input.boardId);
        } else if (input.name) {
          const wanted = input.name.toLowerCase();
          const { boards, shared } = await loadWorkspace(userId);
          // The user's own board first, then one shared with them.
          board = [...boards, ...shared.boards].find((b) => b.name.trim().toLowerCase() === wanted);
          if (!board) {
            board = await createBoard(
              userId,
              createBoardSchema.parse({ name: input.name, projectId: input.projectId ?? "" }),
            );
            created = true;
          }
        } else {
          throw new HttpError(400, "Give a boardId or a name.");
        }
        const browser = await showBoardInBrowser(userId, board.id, { fromOtherBoards: true });
        return json({
          board: { id: board.id, name: board.name, items: board.itemCount, ...sharedBy(board) },
          url: boardUrl(board.id),
          created,
          browser,
        });
      }),
  );

  // ── Projects and themes ──────────────────────────────────────────────────

  server.registerTool(
    "create_project",
    {
      title: "Create a project",
      description:
        "Create a Prism project: a folder of boards for one app, with one theme (colors, radius, fonts) that all its screens share. Set the theme next with set_theme, then make boards in it with open_board (projectId).",
      inputSchema: createProjectSchema.extend({
        name: createProjectSchema.shape.name.describe('The app\'s name, e.g. "ClientFlow".'),
      }),
      annotations: { openWorldHint: false },
    },
    (input) =>
      run(async () => {
        const project = await createProject(userId, input);
        return json({
          project: { id: project.id, name: project.name },
          theme: "default (neutral) until set_theme",
          next: "Set the theme with set_theme: css from the app's global CSS if it has one, else brand colors. Then open_board with this projectId.",
        });
      }),
  );

  server.registerTool(
    "get_theme",
    {
      title: "Read a project's theme",
      description: [
        "Read the theme a project's boards use: shadcn/ui color tokens (light and dark), radius and fonts, plus css, the Tailwind v4 + shadcn/ui CSS to put in the app's global CSS.",
        "Read it before designing (use the $tokens in create_screen) and before coding screens (put css in app/globals.css or src/index.css, then code $tokens as Tailwind classes).",
        'For an app without Tailwind, pass format: "css-vars" (plain CSS custom properties and type-scale classes, for plain CSS or CSS Modules), "dart" (a Flutter theme file: ThemeData, color tokens, type scale, radius and spacing) or "json" (design tokens); code and usage say where it goes and how tokens are written.',
        "saved: false means the project still has the default theme.",
      ].join(" "),
      inputSchema: z.object({
        projectId: projectId.optional(),
        boardId: boardId.optional().describe("Or a board: its project's theme."),
        format: z
          .enum(THEME_FORMATS)
          .optional()
          .describe(
            "css (default: Tailwind v4 + shadcn/ui), css-vars (plain CSS), json (design tokens) or dart (Flutter).",
          ),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input) =>
      run(async () => {
        let id = input.projectId;
        // Another format: the theme as that code, and how tokens are written in it.
        const asCode = (theme: Theme) =>
          input.format && input.format !== "css"
            ? {
                format: input.format,
                code: themeCode(theme, input.format),
                usage: TOKEN_USAGE[input.format],
              }
            : {};
        if (!id && input.boardId) {
          const board = await boardFor(input.boardId, userId, "view");
          if (!board.projectId) {
            return json({
              projectId: null,
              saved: false,
              note: "This board isn't in a project, so it uses the default theme. Move it into a project to give it one.",
              ...describeTheme(DEFAULT_THEME),
              tokens: themeTokenNames(),
              ...asCode(DEFAULT_THEME),
            });
          }
          id = board.projectId;
        }
        if (!id) throw new HttpError(400, "Give a projectId or a boardId.");
        const { projectId: pid, saved, theme, css } = await getProjectTheme(userId, id);
        const { components } = await getProjectComponents(userId, pid);
        return json({
          projectId: pid,
          saved,
          ...describeTheme(theme),
          components: Object.keys(components),
          ...(input.format && input.format !== "css" ? asCode(theme) : { css }),
        });
      }),
  );

  server.registerTool(
    "set_theme",
    {
      title: "Set a project's theme",
      description: [
        "Set the theme every board in a project draws with, and that its app's code uses.",
        "css: an app's global CSS (shadcn/ui :root and .dark variables, --radius, --font-*); Prism reads it, following var() references. Use this when the app already has a theme, so designs match it exactly.",
        'theme: values to change, e.g. { light: { primary: "#4f46e5", "primary-foreground": "#ffffff" }, radius: 12, fonts: { heading: "gf:Sora" }, text: { h1: { size: 40, weight: 800 } } }. Colors take any CSS color (hex, oklch, hsl). Give both light and dark when the app has a dark mode.',
        "text is the type scale ($display, $h1–$h4, $body-lg, $body, $body-sm, $caption, $label: font sans|heading|mono, size px, weight, lineHeight, letterSpacing in em).",
        "A project's theme is strict (strict: true): drawing tools then refuse plain colors, radius, fonts and text sizes on UI elements, so screens can't drift. Turn it off with strict: false.",
        "Both can be given: css first, then theme on top. Screens drawn before keep their colors.",
      ].join(" "),
      inputSchema: z.object({
        projectId,
        css: z.string().max(200_000).optional().describe("The app's global CSS, to import."),
        theme: themePatchSchema.optional().describe("Values to change on top."),
      }),
      annotations: { openWorldHint: false },
    },
    (input) =>
      run(async () => {
        if (!input.css && !input.theme) throw new HttpError(400, "Give css, theme or both.");
        const current = await getProjectTheme(userId, input.projectId);
        // The default theme is free-form; a project's own theme starts strict.
        let theme = current.saved ? current.theme : { ...current.theme, strict: true };
        let imported: { found: number; skipped: string[] } | undefined;
        if (input.css) {
          const parsed = parseThemeCss(input.css, theme);
          if (parsed.found.length === 0) {
            throw new HttpError(
              400,
              "No theme variables found in that CSS. Expected shadcn/ui variables such as --primary, --background and --radius in :root and .dark.",
            );
          }
          theme = { ...parsed.theme, name: "Imported" };
          imported = { found: parsed.found.length, skipped: parsed.skipped };
        }
        if (input.theme) theme = mergeTheme(theme, input.theme);
        const saved = await saveProjectTheme(userId, input.projectId, theme);
        return json({
          projectId: saved.projectId,
          ...(imported && {
            imported: {
              ...imported,
              ...(imported.skipped.length > 0 && {
                note: "Skipped variables Prism can't read (e.g. color-mix()) keep their previous value.",
              }),
            },
          }),
          ...describeTheme(saved.theme),
          next: "Design with these $tokens (create_screen). The app's CSS for this theme is in get_theme's css.",
        });
      }),
  );

  server.registerTool(
    "list_components",
    {
      title: "List a project's components",
      description:
        "The project's components (Button, Input, Card, Sidebar, …): their props, variants, layout tree and how to place one in create_screen. Read before designing so screens reuse them, and before coding so each becomes one React component.",
      inputSchema: z.object({
        projectId: projectId.optional(),
        boardId: boardId.optional().describe("Or a board: its project's components."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input) =>
      run(async () => {
        let id = input.projectId;
        if (!id && input.boardId) {
          const board = await boardFor(input.boardId, userId, "view");
          if (!board.projectId) {
            return json({
              projectId: null,
              components: {},
              note: "Components belong to a project; this board isn't in one.",
            });
          }
          id = board.projectId;
        }
        if (!id) throw new HttpError(400, "Give a projectId or a boardId.");
        const { projectId: pid, components } = await getProjectComponents(userId, id);
        const names = Object.keys(components);
        return json({
          projectId: pid,
          components: Object.fromEntries(
            names.map((name) => {
              const component = components[name]!;
              return [name, { ...component, use: componentUsage(name, component) }];
            }),
          ),
          ...(names.length === 0 && {
            next: "None yet. Define the shared parts with define_component: Button (variants primary, secondary, ghost, destructive), Input, Card, PageHeader and the app's navigation.",
          }),
        });
      }),
  );

  server.registerTool(
    "define_component",
    {
      title: "Define a project component",
      description: [
        "Create or replace a reusable component (Button, Input, Card, Sidebar, PageHeader, …) that every screen in the project places with a use node, so each looks the same everywhere and the code builds it once.",
        'root is a create_screen layout tree. Strings can hold {{prop}} placeholders: { type: "text", text: "{{label}}" }; a whole-string placeholder can carry a token or a number (fill: "{{bg}}") and a null value leaves the field out.',
        'variants are named prop sets, e.g. primary: { bg: "$primary", fg: "$primary-foreground" }, ghost: { bg: null, fg: "$foreground" }. A { type: "slot" } node marks where a use\'s children go (a Card\'s content, a page shell\'s body). Components can use other components.',
        "Every variant is checked: it must lay out and, in a strict project, use the theme's tokens. Screens drawn before keep their old look.",
      ].join(" "),
      inputSchema: z.object({
        projectId,
        name: componentNameSchema.describe('PascalCase, e.g. "Button", "PageHeader".'),
        description: z.string().max(500).optional().describe("What it is and when to use it."),
        props: componentSchema.shape.props
          .optional()
          .describe(
            'Its {{placeholders}}: { label: {}, icon: { default: "plus" } }. Without a default a prop is required.',
          ),
        variants: componentSchema.shape.variants.optional(),
        defaultVariant: componentSchema.shape.defaultVariant,
        root: z
          .record(z.string(), z.unknown())
          .describe(
            "The layout tree, as in create_screen, with {{prop}} placeholders and slot nodes.",
          ),
        code: componentSchema.shape.code.describe(
          'Where the app has it, e.g. "@/components/ui/button" (shadcn), so the code reuses it.',
        ),
      }),
      annotations: { openWorldHint: false },
    },
    (input) =>
      run(async () => {
        const [{ components }, { theme }] = await Promise.all([
          getProjectComponents(userId, input.projectId),
          getProjectTheme(userId, input.projectId),
        ]);
        const replacing = input.name in components;
        if (!replacing && Object.keys(components).length >= COMPONENTS_MAX) {
          throw new HttpError(400, `A project has at most ${COMPONENTS_MAX} components.`);
        }
        const component = componentSchema.parse({
          description: input.description,
          props: input.props,
          variants: input.variants,
          defaultVariant: input.defaultVariant,
          root: input.root,
          code: input.code,
        });
        const next = { ...components, [input.name]: component };

        // It and every component that uses it must still lay out, on the theme.
        const dependents = Object.keys(components).filter(
          (name) => name !== input.name && usedComponents(components[name]?.root).has(input.name),
        );
        const errors: string[] = [];
        for (const name of [input.name, ...dependents]) {
          const checked = checkComponent(name, next[name]!, next);
          const prefix = name === input.name ? "" : `${name} (which uses it): `;
          errors.push(...checked.errors.map((e) => prefix + e));
          for (const tree of checked.trees) {
            const resolved = resolveLayoutTokens(tree, theme, "light", undefined, theme.strict);
            if (resolved.unknown.length > 0)
              errors.push(prefix + unknownTokensMessage(resolved.unknown));
            if (resolved.violations.length > 0)
              errors.push(prefix + strictMessage(resolved.violations));
          }
        }
        if (errors.length > 0) throw new HttpError(400, [...new Set(errors)].join("\n"));

        await saveProjectComponents(userId, input.projectId, next);
        return json({
          component: input.name,
          replaced: replacing,
          variants: Object.keys(component.variants),
          use: componentUsage(input.name, component),
          ...(dependents.length > 0 && { usedBy: dependents }),
          next: "Place it in create_screen with the use node above. Check one with export_image.",
        });
      }),
  );

  server.registerTool(
    "delete_component",
    {
      title: "Delete a project component",
      description:
        "Remove a component from the project. Screens already drawn keep their elements. Refused while another component uses it.",
      inputSchema: z.object({ projectId, name: componentNameSchema }),
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    (input) =>
      run(async () => {
        const { components } = await getProjectComponents(userId, input.projectId);
        if (!(input.name in components)) {
          throw new HttpError(404, `No component "${input.name}" in this project.`);
        }
        const users = Object.keys(components).filter(
          (name) => name !== input.name && usedComponents(components[name]?.root).has(input.name),
        );
        if (users.length > 0) {
          throw new HttpError(
            400,
            `${users.join(", ")} use${users.length === 1 ? "s" : ""} it; change ${users.length === 1 ? "that" : "those"} first.`,
          );
        }
        const { [input.name]: _removed, ...rest } = components;
        await saveProjectComponents(userId, input.projectId, rest);
        return json({ deleted: input.name, remaining: Object.keys(rest) });
      }),
  );

  server.registerTool(
    "get_board",
    {
      title: "Read a board",
      description:
        "Read a board's elements as compact JSON (bottom layer first; default values left out). Pass frameId to read one frame and what lies inside it. Read before editing so you use real ids and positions.",
      inputSchema: z.object({
        boardId,
        frameId: z
          .uuid()
          .optional()
          .describe("Only this frame and the elements whose center is inside it."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ boardId: id, frameId }) =>
      run(async () => {
        const board = await boardFor(id, userId, "view");
        const theme = await boardTheme(board);
        let elements = await loadElements(board.id);
        if (frameId) {
          const frame = elements.find((el) => el.id === frameId);
          if (!frame) throw new HttpError(404, "No element with that frameId on this board.");
          elements = elements.filter((el) => el.id === frameId || insideFrame(el, frame));
        }
        return json({
          boardId: board.id,
          name: board.name,
          count: elements.length,
          bounds: boundsOf(elements),
          frames: elements
            .filter((el) => el.type === "frame")
            .map((el) => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height })),
          elements: elements.map((el) => view(el, theme)),
          ...(hasTokens(elements) && { tokens: TOKENS_NOTE }),
          ...(hasComponents(elements) && { components: COMPONENTS_NOTE }),
        });
      }),
  );

  server.registerTool(
    "get_screen_code",
    {
      title: "Read screens for code",
      description: [
        "Read a board's screens (frames) as nested trees ready to code in any framework, instead of get_board's flat x/y elements: what sits inside what, each container's layout (row, column, grid or overlay, with gap, padding, align and justify in px), each node's size (px, fill or hug), its style with $tokens kept, and project component instances with their text.",
        "Use it with build_pages: code each tree with the app's own layout primitives, then compare the page with export_image of the frame.",
      ].join(" "),
      inputSchema: z.object({
        boardId,
        frameId: z
          .uuid()
          .optional()
          .describe("Only this frame. Default: every frame on the board."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ boardId: id, frameId }) =>
      run(async () => {
        const board = await boardFor(id, userId, "view");
        const theme = await boardTheme(board);
        const elements = await loadElements(board.id);
        const frames = elements.filter(
          (el) => el.type === "frame" && (frameId === undefined || el.id === frameId),
        );
        if (frameId && frames.length === 0) {
          throw new HttpError(404, "No frame with that frameId on this board.");
        }
        if (frames.length === 0) {
          throw new HttpError(
            404,
            "This board has no frames. Screens are frames (create_screen draws one); read free-form boards with get_board.",
          );
        }
        // Frames nested in another frame are part of it, not screens of their own.
        const screens = frames.filter(
          (frame) => !frames.some((other) => other !== frame && insideFrame(frame, other)),
        );
        return json({
          boardId: board.id,
          name: board.name,
          spacing: theme.spacing,
          screens: screens.map((frame) => ({
            frameId: frame.id,
            label: frameLabel(frame, elements),
            width: frame.width,
            height: frame.height,
            tree: screenTree(frame, elements, (el) => view(el, theme)),
          })),
          layout: LAYOUT_NOTE,
          tokens: TOKENS_NOTE,
          ...(hasComponents(elements) && { components: COMPONENTS_NOTE }),
        });
      }),
  );

  server.registerTool(
    "export_image",
    {
      title: "See the board",
      description: [
        "Render a frame, some elements or the whole board as an image and look at it.",
        "Use it after drawing to check layout, alignment, spacing, overlaps and text wrapping, then fix what's off with update_elements.",
        "The user's open board tab draws it (open_board gives the URL to open), showing what's saved, in the user's current theme.",
      ].join(" "),
      inputSchema: z.object({
        boardId,
        frameId: z
          .uuid()
          .optional()
          .describe("Show this frame edge to edge, with everything on it. Usually what you want."),
        ids: z
          .array(z.uuid())
          .min(1)
          .max(500)
          .optional()
          .describe("Show only these elements (ignored when frameId is given)."),
        scale: z
          .number()
          .min(0.1)
          .max(4)
          .optional()
          .describe(
            "Image px per board px. Default: fits within 1568px, at most 2x. Raise it to read small text in a large area.",
          ),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ boardId: id, frameId, ids, scale }) =>
      run(async () => {
        const board = await boardFor(id, userId, "view");
        const elements = await loadElements(board.id);
        const image = await requestBoardImage(userId, {
          boardId: board.id,
          elements,
          ...(frameId ? { frameId } : ids ? { ids } : {}),
          ...(scale !== undefined && { scale }),
        });
        const round = (n: number) => Math.round(n * 10) / 10;
        return {
          content: [
            { type: "image", data: image.data, mimeType: image.mimeType },
            {
              type: "text",
              text: JSON.stringify({
                width: image.width,
                height: image.height,
                scale: round(image.width / image.region.width),
                region: {
                  x: round(image.region.x),
                  y: round(image.region.y),
                  width: round(image.region.width),
                  height: round(image.region.height),
                },
              }),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "compare_reference",
    {
      title: "Compare a screen with its reference",
      description: [
        "Measure how close a screen (a frame) is to a reference image on the board (one added with add_image): no picture comes back, only numbers and the biggest differences.",
        "Returns a score from 0 (unrelated) to 100 (the same picture), each one's dominant colors, the lightness of nine regions (top-left to bottom-right), how much of each is plain background, and up to three differences phrased as changes to make.",
        "Use it after export_image when a screen follows a reference: fix the differences that matter, then compare again. A layout taken from a reference but with your own brand and copy scores in the middle; that's expected.",
        "The user's open board tab measures it, so the board must be open.",
      ].join(" "),
      inputSchema: z.object({
        boardId,
        frameId: z.uuid().describe("The screen: a frame on the board."),
        referenceId: z.uuid().describe("The reference: an image element on the board."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ boardId: id, frameId, referenceId }) =>
      run(async () => {
        const board = await boardFor(id, userId, "view");
        const elements = await loadElements(board.id);
        const { ok: _, ...report } = await requestReferenceComparison(userId, {
          boardId: board.id,
          elements,
          frameId,
          referenceId,
        });
        return json(report);
      }),
  );

  // ── Elements ─────────────────────────────────────────────────────────────

  server.registerTool(
    "create_elements",
    {
      title: "Create elements",
      description: [
        "Create elements on a board. They appear live in open browser tabs, and the whole call is one undo step for the user.",
        "Types: rect (boxes, buttons, cards, inputs), ellipse, diamond, text, sticky, list, line, arrow, mindnode (a mind map node; create_mindmap is easier), icon (a Lucide icon by name: set icon, stroke for its color, 16-24px for UI), emoji, chart, frame (a screen/artboard background), freehand.",
        "Coordinates are board px; x grows right, y grows down. List elements back to front: frames and backgrounds first, then content on top.",
        "For UI mockups use sketch: false, a radius on buttons/cards, groupId per component and a role (button, input, card, …).",
        "Text sizes itself when width is left out. Arrows: set startBinding/endBinding to element ids or to keys from this call.",
        "Use the project theme's tokens ($primary, $border, $radius-lg, textStyle $h2; see get_theme). Text, lists and icons default to $foreground, text to textStyle $body, frames to a $background fill. A strict theme refuses plain colors, radius, fonts and text sizes on UI elements (not on stickies, arrows, mind maps or charts).",
      ].join(" "),
      inputSchema: z.object({
        boardId,
        elements: z.array(createElementInput).min(1).max(500),
        mode: modeInput,
      }),
      annotations: { openWorldHint: false },
    },
    ({ boardId: id, elements: inputs, mode }) =>
      run(async () => {
        const board = await boardFor(id, userId, "edit");
        const theme = await boardTheme(board);
        checkStrict(
          theme,
          inputs.map((input) => ({ fields: input, type: input.type })),
        );
        const images = imageStore(board.id);
        const stored = await Promise.all(
          inputs.map(async (input) => ({
            ...input,
            fillImage: await images.fill(input.fillImage),
          })),
        );
        const resolved = stored.map((input) =>
          themed({ ...themedDefaults(input), ...input }, theme, mode ?? "light"),
        );
        const elements = buildElements(resolved, await loadElements(board.id));
        await save(
          userId,
          board.id,
          elements.map((element) => ({ op: "create", element })),
        );
        return json({
          created: elements.map((el, i) => ({
            id: el.id,
            ...(inputs[i]?.key && { key: inputs[i]?.key }),
            type: el.type,
          })),
          ...(images.warnings.length > 0 && { warnings: images.warnings }),
        });
      }),
  );

  server.registerTool(
    "get_design_guide",
    {
      title: "Get the design guide",
      description:
        "REQUIRED before your first create_screen in a conversation: how a good screen looks (deciding a visual thesis, type sizes, color, spacing, a recipe for the surface, how to check the result). Pass the boardId: the guide then ends with the board's site (a project, or a board outside any), either the screens it already has, whose design language every new page keeps, or, for a new site, how the user's other sites look, so it doesn't repeat them. Read it once per board, design from it, and reuse it for that board's later screens.",
      inputSchema: z.object({
        surface: z
          .enum(DESIGN_SURFACES)
          .optional()
          .describe(
            "landing (marketing pages, default), app (dashboards and product screens) or mobile.",
          ),
        boardId: boardId
          .optional()
          .describe("The board you're designing on, for its site section. Recommended."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ surface, boardId: id }) =>
      run(async () => {
        const site = id ? siteContext(await designSites(userId, id)) : undefined;
        return {
          content: [{ type: "text" as const, text: designGuide(surface ?? "landing", site) }],
        };
      }),
  );

  server.registerTool(
    "create_screen",
    {
      title: "Create a screen from a layout",
      description: [
        "Call get_design_guide (with the boardId) before your first screen.",
        "The main way to draw UI: describe a screen as a layout tree (root) and Prism positions everything, flexbox-style, so spacing and alignment come out exact. Or write it as HTML + Tailwind (html): the user's board tab renders it and reads it back as elements.",
        'HTML: the page body with Tailwind v4 classes (no scripts). The project theme is loaded, so use its classes: bg-primary, text-primary-foreground, text-muted-foreground, border-border, bg-card, rounded-lg, text-h1/text-body/text-caption (the theme sizes), font-heading; they are kept as $tokens. Icons: <i data-icon="search" class="size-5 text-muted-foreground"></i> (Lucide). Photos: <img src> from search_images. Avatars: <img data-avatar="Ana Ruiz" class="size-10 rounded-full">. Logos and illustrations: inline <svg>. Components: <x-use component="Button" variant="ghost" label="Cancel"></x-use> (children fill its slot). data-name="Hero" groups an element and data-role names it. Absolutely positioned elements are overlay layers. Gradient text (bg-clip-text) works; ::before/::after content, video and canvas are not drawn. Needs the board open in the browser.',
        'Containers: stack (top to bottom), row (left to right), grid (equal columns), overlay (layers on top of each other: the first sets its size, later ones are placed by anchor and x/y and may hang past its edges, for cards floating over a product window or a badge on an avatar), with gap, padding, align, justify, width/height (px, "fill" or hug) and an optional background (fill, stroke, radius, shadow, plus gradient, image (a photo URL), backdropBlur (frosted glass); radius may be per corner).',
        'Leaves: text, icon (Lucide), box (a rect or ellipse holding a photo with image: { url } from search_images, an avatar with avatar: "Full Name", or an SVG logo or illustration with svg; never a gray placeholder), spacer (fixed, or flexible to push things apart), divider.',
        "A button is a row with padding, fill, radius, justify/align center and a text child; a card is a stack with padding, fill, radius and shadow. Give components a name (one groupId) and a role.",
        'Use the project\'s components (list_components) wherever they fit: { type: "use", component: "Button", variant: "ghost", props: { label: "Cancel" } }, with children for a component\'s slot (a Card\'s content) and width/height to resize it. Same component, same look on every screen.',
        "Colors, radius and text come from the project theme (get_theme): textStyle $h1/$h2/$body/$caption/… for every text (size, weight and font together), fill $primary with color $primary-foreground, $card, $muted-foreground, stroke $border, radius $radius-md/$radius-lg, so every screen matches and the code uses the same classes. Text defaults to $body and $foreground, icons to $foreground, dividers to $border, the frame to $background. A strict theme refuses plain colors, radius, fonts and text sizes.",
        "With frame, a frame of that size is drawn behind it (a fixed frame height lets a flexible spacer pin a bottom bar). Without x/y it goes to the right of the board's content.",
        "The whole screen is one undo step. The result lists warnings (text wrapping more than written, content spilling out of its container, low contrast, tiny text, too many sizes or accent colors, uneven side-by-side cards, blocks just off the main column, outline-only rating icons, gray placeholder boxes, images that couldn't be downloaded): fix them, then check the screen with export_image (frameId), and with compare_reference when it follows a reference image.",
      ].join(" "),
      inputSchema: z.object({
        boardId,
        root: layoutNodeSchema
          .optional()
          .describe(
            "The screen's content as a layout tree, usually a stack. It fills the screen's width. Give root or html.",
          ),
        html: z
          .string()
          .max(HTML_SCREEN_MAX)
          .optional()
          .describe(
            "The screen as HTML + Tailwind (the <body> content, or a whole document), rendered at the frame's width. Give root or html.",
          ),
        frame: z
          .object({
            width: z.number().min(40).max(4_000).describe("e.g. 390 mobile, 1440 desktop."),
            height: z
              .number()
              .min(40)
              .max(20_000)
              .optional()
              .describe("e.g. 844 mobile, 900 desktop. Left out: the content's height."),
          })
          .optional()
          .describe("Draw a device frame behind the screen (recommended)."),
        width: z
          .number()
          .min(40)
          .max(4_000)
          .optional()
          .describe("Without a frame: the screen's width. Default 390."),
        x: z
          .number()
          .optional()
          .describe("Left edge on the board. Default: right of existing content."),
        y: z
          .number()
          .optional()
          .describe("Top edge on the board. Default: top of existing content."),
        font: fontFamilySchema
          .optional()
          .describe("Font for text nodes that don't set one. Default: the theme's $sans."),
        mode: modeInput,
      }),
    },
    (input) =>
      run(async () => {
        if ((input.root === undefined) === (input.html === undefined)) {
          throw new HttpError(400, "Give the screen as root (a layout tree) or as html, not both.");
        }
        if (input.html !== undefined) {
          return createHtmlScreen(
            userId,
            input.boardId,
            input.html,
            input.frame,
            input,
            input.font,
            input.mode ?? "light",
          );
        }
        const board = await boardFor(input.boardId, userId, "edit");
        const [theme, components] = await Promise.all([boardTheme(board), boardComponents(board)]);
        const expanded = expandComponents(
          input.root ?? { type: "stack", children: [] },
          components,
        );
        if (expanded.errors.length > 0) throw new HttpError(400, expanded.errors.join("\n"));
        const nodes = countNodes(expanded.root);
        if (nodes > LAYOUT_NODES_MAX) {
          throw new HttpError(
            400,
            `Use at most ${LAYOUT_NODES_MAX} nodes per screen, components included (got ${nodes}).`,
          );
        }
        const mode = input.mode ?? "light";
        const images = imageStore(board.id);
        const withImages = await storeLayoutImages(expanded.root, images);
        const { root, unknown, violations } = resolveLayoutTokens(
          withImages,
          theme,
          mode,
          input.font,
          theme.strict,
        );
        if (unknown.length > 0) throw new HttpError(400, unknownTokensMessage(unknown));
        if (violations.length > 0) throw new HttpError(400, strictMessage(violations));
        const existing = await loadElements(board.id);
        const content = boundsOf(existing);
        const width = input.frame?.width ?? input.width ?? 390;
        const options = {
          x: input.x ?? (content ? content.x + content.width + 120 : 0),
          y: input.y ?? (content ? content.y : 0),
          width,
          height: input.frame?.height,
          font: input.font ?? theme.fonts.sans,
        };
        // An open tab measures text with the board's fonts; otherwise the server estimates.
        const measured = await requestScreenLayout(userId, { boardId: board.id, root, options });
        const laidOut = measured ?? layoutScreen(root, options, estimateText);
        const parts = laidOut.map((el) => layoutElementInput.parse(el));
        const bottom = Math.max(options.y, ...parts.map((el) => el.y + (el.height ?? 0)));
        const frame = input.frame && {
          type: "frame" as const,
          x: options.x,
          y: options.y,
          width,
          height: input.frame.height ?? Math.max(40, Math.ceil(bottom - options.y)),
          fill: themeColorHex(theme, mode, "background"),
          tokens: { fill: "background" },
        };
        const elements = buildElements(frame ? [frame, ...parts] : parts, existing);
        await save(
          userId,
          board.id,
          elements.map((element) => ({ op: "create", element })),
        );
        // Overlay layers (not stored) by element id; parts follow the frame, if any.
        const layers = new Map<string, string>();
        const lastLines = new Map<string, string>();
        laidOut.forEach((el, i) => {
          const id = elements[frame ? i + 1 : i]?.id;
          const { layer, lastLine } = el as { layer?: unknown; lastLine?: unknown };
          if (id && typeof layer === "string") layers.set(id, layer);
          if (id && typeof lastLine === "string") lastLines.set(id, lastLine);
        });
        const warnings = [
          ...images.warnings,
          ...lintScreen(elements, layers, { lastLines, rowFill: rowFillTraps(root) }),
        ];
        return json({
          frameId: frame ? elements[0]?.id : null,
          bounds: boundsOf(elements),
          measured: measured ? "browser" : "estimated (no board tab open; text sizes may be off)",
          theme: { name: theme.name ?? null, mode },
          ...(warnings.length > 0 && { warnings }),
          elements: elements.map((el) => ({
            id: el.id,
            type: el.type,
            ...(el.role && { role: el.role }),
            ...(el.groupId && { groupId: el.groupId }),
            ...(el.text && { text: el.text.slice(0, 60) }),
          })),
          next:
            warnings.length > 0
              ? `Fix the ${warnings.length} warning${warnings.length === 1 ? "" : "s"} with update_elements (or redraw that section), then check it with export_image (frameId).`
              : "Check it with export_image (frameId), then fix anything off with update_elements.",
        });
      }),
  );

  server.registerTool(
    "create_mindmap",
    {
      title: "Create a mind map",
      description: [
        "Draw a mind map from an outline: a central topic with nested children. Prism styles each level (central topic, colored main branches, underlined sub-topics), sizes the nodes to their text and lays the tree out; branches are curves drawn from each node to its parent.",
        "Or add branches to an existing map: give parentId (a mindnode id from get_board) and children; the whole map is tidied again.",
        "New main branches start folded, so the map opens as the central topic and its main branches and the user opens each with its toggle; pass collapsed: false to show everything.",
        "Keep labels to a few words. The user can keep going on the board: Tab adds a child, Enter a sibling, the toggle folds a branch.",
      ].join(" "),
      inputSchema: z.object({
        boardId,
        root: mindmapInputSchema
          .optional()
          .describe("A new map: the central topic's text and its children, nested."),
        parentId: z.uuid().optional().describe("Add to an existing map: the node to branch from."),
        children: z
          .array(mindmapInputSchema)
          .min(1)
          .max(40)
          .optional()
          .describe("With parentId: the new branches, nested."),
        sides: z
          .enum(["right", "both"])
          .optional()
          .describe("Main branches to the right only, or both sides (default both)."),
        x: z
          .number()
          .optional()
          .describe(
            "New map: left edge of the central topic. Default: right of the board's content.",
          ),
        y: z
          .number()
          .optional()
          .describe("New map: top edge. Default: top of the board's content."),
        font: fontFamilySchema.optional().describe('Default "sans".'),
        collapsed: z
          .boolean()
          .optional()
          .describe("Fold the new main branches that have children (default true)."),
      }),
    },
    (input) =>
      run(async () => {
        const nodes = input.parentId ? (input.children ?? []) : input.root ? [input.root] : [];
        if (nodes.length === 0) {
          throw new HttpError(400, "Give root (a new map), or parentId with children.");
        }
        const total = nodes.reduce((sum, node) => sum + countMindNodes(node), 0);
        if (total > MINDMAP_NODES_MAX) {
          throw new HttpError(
            400,
            `Use at most ${MINDMAP_NODES_MAX} nodes per call (got ${total}).`,
          );
        }
        const board = await boardFor(input.boardId, userId, "edit");
        const existing = await loadElements(board.id);
        const content = boundsOf(existing);

        let under;
        let font = input.font ?? "sans";
        if (input.parentId) {
          const parent = existing.find((el) => el.id === input.parentId);
          if (parent?.type !== "mindnode") {
            throw new HttpError(404, "parentId must be a mind map node on this board.");
          }
          font = input.font ?? parent.font ?? "sans";
          const siblings = mindChildren(existing).get(parent.id) ?? [];
          const depth = mindDepth(existing, parent.id);
          const parentCenter = parent.x + parent.width / 2;
          const right = siblings.filter((el) => el.x + el.width / 2 >= parentCenter).length;
          const grand = existing.find((el) => el.id === parent.parentId);
          const side: 1 | -1 =
            depth === 0
              ? right <= siblings.length - right
                ? 1
                : -1
              : !grand || parentCenter >= grand.x + grand.width / 2
                ? 1
                : -1;
          under = {
            parentId: parent.id,
            depth,
            stroke: parent.stroke,
            x: parentCenter,
            y: Math.max(parent.y, ...siblings.map((el) => el.y + el.height)) + 1,
            side,
            branches: siblings.length,
          };
        }
        const options = {
          x: input.x ?? (content ? content.x + content.width + 160 : 0),
          y: input.y ?? (content ? content.y : 0),
          font,
          sides: input.sides ?? ("both" as const),
          under,
        };
        // An open tab sizes the nodes with the board's fonts; otherwise the server estimates.
        const measured = await requestMindmapLayout(userId, { boardId: board.id, nodes, options });
        const built = measured ?? buildMindMap(nodes, options, estimateText);
        let created = buildElements(
          built.map((el) => layoutElementInput.parse(el)),
          existing,
        );
        const rootId = mindRoot(
          [...existing, ...created],
          created[0]?.parentId ?? created[0]?.id ?? "",
        );

        // New main branches start folded: the map opens as the central topic and its branches.
        if (input.collapsed ?? true) {
          const children = mindChildren([...existing, ...created]);
          created = created.map((el) =>
            el.parentId === rootId && children.has(el.id) ? { ...el, collapsed: true } : el,
          );
        }

        // Lay the whole map out again, new branches included.
        const moves = tidyMindMap([...existing, ...created], rootId);
        const placed = created.map((el) => ({ ...el, ...moves.get(el.id) }));
        const ops: ElementOp[] = placed.map((element) => ({ op: "create", element }));
        for (const el of existing) {
          const to = moves.get(el.id);
          if (!to || (to.x === el.x && to.y === el.y)) continue;
          ops.push({
            op: "update",
            id: el.id,
            version: el.version + 1,
            changes: { x: to.x, y: to.y, updatedBy: "ai_agent" },
          });
        }
        await save(userId, board.id, ops);
        return json({
          rootId,
          measured: measured ? "browser" : "estimated (no board tab open; node sizes may be off)",
          bounds: boundsOf([...placed, ...existing.filter((el) => moves.has(el.id))]),
          nodes: placed.map((el) => ({
            id: el.id,
            text: el.text,
            parentId: el.parentId,
            ...(el.collapsed && { collapsed: true }),
          })),
          next: "Check it with export_image (ids: the map's node ids, or the whole board).",
        });
      }),
  );

  server.registerTool(
    "update_elements",
    {
      title: "Update elements",
      description:
        "Change elements by id: position (x, y), size, colors, text, corner radius, font, etc. Only the given fields change; null clears an optional field. Colors, radius, fonts and text styles take theme tokens ($primary, $radius-lg, textStyle $h2); a strict theme refuses plain ones on UI elements. The whole call is one undo step.",
      inputSchema: z.object({
        boardId,
        updates: z
          .array(z.object({ id: z.uuid(), changes: updateChangesInput }))
          .min(1)
          .max(500),
        mode: modeInput,
      }),
      annotations: { openWorldHint: false },
    },
    ({ boardId: id, updates, mode }) =>
      run(async () => {
        const board = await boardFor(id, userId, "edit");
        const theme = await boardTheme(board);
        const current = new Map((await loadElements(board.id)).map((el) => [el.id, el]));
        const missing = updates.filter((u) => !current.has(u.id)).map((u) => u.id);
        if (missing.length > 0) {
          throw new HttpError(404, `Not on this board: ${missing.join(", ")}`);
        }
        checkStrict(
          theme,
          updates.map((u) => ({ fields: u.changes, type: current.get(u.id)?.type ?? "rect" })),
        );
        const images = imageStore(board.id);
        const stored = await Promise.all(
          updates.map(async ({ id: elementId, changes }) => {
            if (changes.fillImage === undefined) return { elementId, changes };
            const { fillImage, ...rest } = changes;
            const image = await images.fill(fillImage);
            // A skipped image leaves the element's current one alone.
            return {
              elementId,
              changes: image === undefined ? rest : { ...rest, fillImage: image },
            };
          }),
        );
        const ops: ElementOp[] = stored.map(({ elementId, changes }) => ({
          op: "update",
          id: elementId,
          version: (current.get(elementId)?.version ?? 0) + 1,
          changes: elementChangesSchema.parse({
            ...themed(changes, theme, mode ?? "light", current.get(elementId)?.tokens),
            updatedBy: "ai_agent",
          }),
        }));
        const result = await save(userId, board.id, ops);
        return json({
          updated: result.applied.length,
          conflicts: result.stale,
          ...(images.warnings.length > 0 && { warnings: images.warnings }),
        });
      }),
  );

  server.registerTool(
    "delete_elements",
    {
      title: "Delete elements",
      description: "Delete elements by id. Arrows attached to them go too. One undo step.",
      inputSchema: z.object({ boardId, ids: z.array(z.uuid()).min(1).max(2_000) }),
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    ({ boardId: id, ids }) =>
      run(async () => {
        const board = await boardFor(id, userId, "edit");
        const elements = await loadElements(board.id);
        const doomed = new Set(
          ids.filter((elementId) => elements.some((el) => el.id === elementId)),
        );
        // A mind map node takes its branch with it.
        for (const elementId of mindDescendants(elements, doomed)) doomed.add(elementId);
        for (const el of elements) {
          const bound =
            (el.startBinding && doomed.has(el.startBinding)) ||
            (el.endBinding && doomed.has(el.endBinding));
          if (bound) doomed.add(el.id);
        }
        if (doomed.size === 0) return json({ deleted: 0 });
        const versions = new Map(elements.map((el) => [el.id, el.version]));
        const result = await save(
          userId,
          board.id,
          [...doomed].map((elementId) => ({
            op: "delete",
            id: elementId,
            version: (versions.get(elementId) ?? 0) + 1,
          })),
        );
        return json({ deleted: result.applied.length, ids: [...doomed] });
      }),
  );

  server.registerTool(
    "add_image",
    {
      title: "Add an image",
      description:
        "Download an image from a public http(s) URL (PNG, JPEG, GIF or WebP, up to 10 MB), e.g. a Mobbin screen's image_url, store it with the board and place it. Without x/y it goes to the right of everything on the board. Phone screenshots default to 390px wide, desktop ones to 960px.",
      inputSchema: z.object({
        boardId,
        url: z.url({ protocol: /^https?$/ }).describe("Public image URL."),
        x: z.number().optional(),
        y: z.number().optional(),
        width: z
          .number()
          .positive()
          .max(10_000)
          .optional()
          .describe("Display width; height keeps the aspect ratio."),
      }),
      annotations: { openWorldHint: true },
    },
    ({ boardId: id, ...input }) =>
      run(async () => json({ element: view(await importImage(userId, id, input)) })),
  );

  server.registerTool(
    "search_images",
    {
      title: "Search for photos",
      description: [
        "Find real photos for a design (hero scenes, the customer's world, product shots, feature images) with no API key: openly licensed images from Openverse (stock photo sites first), with Wikimedia Commons as a fallback.",
        "Only licenses that allow commercial use and changes come back: CC0 and public domain (free to use) or CC BY (show the credit line, e.g. in a small caption).",
        'Use specific, photographic queries from the product\'s own world ("freight depot loading bay at dawn", "dentist chair by a window", "hands sorting seed packets") rather than generic offices or smiling portraits, and pick by subject, crop, light and orientation, not by rank. Pass the boardId to leave out photos the user\'s other sites already use. Then use a result\'s url as an image fill (create_screen: image: { url }; create_elements: fillImage: { url }) or with add_image.',
        "For avatars of made-up people use create_screen's avatar instead; for logos and illustrations draw SVG (add_svg, or svg on a box).",
      ].join(" "),
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .max(200)
          .describe("What the photo shows, in a few concrete words."),
        orientation: z
          .enum(["landscape", "portrait", "square"])
          .optional()
          .describe("landscape for heroes and cards, portrait for people, square for avatars."),
        count: z.number().int().min(1).max(20).optional().describe("Default 6."),
        color: z
          .boolean()
          .optional()
          .describe(
            "Color photos only (default true): black and white ones are left out. Checked in an open board tab; false keeps every result.",
          ),
        boardId: boardId
          .optional()
          .describe(
            "The board you're designing on: photos the user's other sites already use are left out, so sites don't share a face.",
          ),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ query, orientation, count, color, boardId: id }) =>
      run(async () => {
        const want = count ?? 6;
        const taken = id ? photosOf((await designSites(userId, id)).others) : new Set<string>();
        // Twice as many candidates when some may be left out (black and white, or already used).
        const found = await searchImages(query, {
          orientation,
          count: color === false && taken.size === 0 ? want : Math.min(20, want * 2),
        });
        const notes = [...found.notes];
        const fresh = found.images.filter((image) => !taken.has(sourceFileStem(image.url)));
        const leftOut = found.images.length - fresh.length;
        let images = fresh.slice(0, want);
        if (color !== false && fresh.length > 0) {
          const checked = await colorPhotos(fresh, want, (thumbs) =>
            requestImageColors(userId, { images: thumbs }),
          );
          images = checked.images;
          if (!checked.checked) {
            notes.push(
              "colors: no board tab is open to check them, so some photos may be black and white. Open a board and search again to leave those out.",
            );
          }
        }
        // The thumbnail is only for the color check.
        const shown = images.map(({ thumb: _, ...image }) => image);
        const used =
          leftOut > 0
            ? `${leftOut} photo${leftOut === 1 ? "" : "s"} the user's other sites already use`
            : undefined;
        if (shown.length === 0) {
          return json({
            images: [],
            ...(notes.length > 0 && { unavailable: notes }),
            ...(used && { leftOut: used }),
            next:
              notes.length > 0
                ? "The photo sources couldn't be reached. Use an SVG illustration, a gradient, or add_image with a URL you already have."
                : used
                  ? "Every match is already used on another site. Try different words, or a typographic treatment instead of a photo."
                  : "Nothing matched. Try broader or different words.",
          });
        }
        return json({
          images: shown,
          ...(notes.length > 0 && { unavailable: notes }),
          ...(used && { leftOut: used }),
        });
      }),
  );

  server.registerTool(
    "add_svg",
    {
      title: "Add an SVG",
      description: [
        "Place SVG markup you write as an editable element: fictional company logos and wordmarks, illustrations, decorative blobs and patterns, empty-state art. Use the theme's colors.",
        "Logos are always made up: never draw a real company's logo or trademark.",
        "Allowed: shapes, paths, text, gradients, patterns, masks and filters, with links only to #ids in the same SVG. Scripts, event handlers (onload, …), foreignObject and external links or url(...) references are refused, with the parts named.",
        "Without width it takes the size the SVG declares (width/height, else its viewBox); height keeps the ratio. Without x/y it goes to the right of everything on the board. Inside a create_screen layout, use svg on a box instead.",
      ].join(" "),
      inputSchema: z.object({
        boardId,
        svg: z.string().min(1).max(200_000).describe("The markup, starting with <svg>."),
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().positive().max(10_000).optional().describe("Display width in px."),
        name: z
          .string()
          .max(64)
          .optional()
          .describe("Its groupId, to move it with other parts of a component."),
        role: z.string().max(60).optional().describe('What it is: "logo", "illustration", …'),
      }),
      annotations: { openWorldHint: false },
    },
    ({ boardId: id, ...input }) =>
      run(async () => json({ element: view(await importSvg(userId, id, input)) })),
  );

  // ── Selection and "Ask AI" requests ──────────────────────────────────────

  server.registerTool(
    "get_selection",
    {
      title: "Get the user's selection",
      description:
        "The elements the user has selected right now in an open Prism tab (on boardId, or their most recently used board).",
      inputSchema: z.object({ boardId: boardId.optional() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ boardId: id }) =>
      run(async () => {
        const selection = await selectionFor(userId, id);
        const theme =
          selection.elements.length > 0 && selection.boardId
            ? await boardTheme(await boardFor(selection.boardId, userId, "view"))
            : undefined;
        return json({
          boardId: selection.boardId,
          elements: selection.elements.map((el) => view(el, theme)),
          ...(hasTokens(selection.elements) && { tokens: TOKENS_NOTE }),
        });
      }),
  );

  server.registerTool(
    "wait_for_edits",
    {
      title: "Wait for Ask AI requests",
      description: [
        'Wait for the user to send requests from Prism\'s "Ask AI" box (they select elements on a board and type what to change).',
        "Blocks until requests arrive or timeoutSeconds pass, then returns them with the selected elements.",
        "For each request: apply the change with update_elements / create_elements / delete_elements on its boardId, then call complete_edit with a short note.",
        "To keep watching, call wait_for_edits again after handling them, and also after an empty result.",
      ].join(" "),
      inputSchema: z.object({
        boardId: boardId
          .optional()
          .describe("Only this board's requests. Default: all of the user's boards."),
        timeoutSeconds: z
          .number()
          .int()
          .min(1)
          .max(WAIT_EDITS_MAX_SECONDS)
          .default(50)
          .describe("How long to wait. Keep it under your client's tool timeout. Default 50."),
      }),
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    ({ boardId: id, timeoutSeconds }, ctx) =>
      run(async () => {
        const requests = await waitForEdits(userId, id, timeoutSeconds, ctx.mcpReq.signal);
        if (requests.length === 0) {
          return json({
            requests: [],
            hint: "No requests yet. Call wait_for_edits again to keep watching.",
          });
        }
        const themes = new Map<string, Theme>();
        for (const r of requests) {
          if (!themes.has(r.boardId)) {
            themes.set(r.boardId, await boardTheme(await boardFor(r.boardId, userId, "view")));
          }
        }
        return json({
          requests: requests.map((r) => ({
            requestId: r.id,
            boardId: r.boardId,
            board: r.boardName,
            prompt: r.prompt,
            selectedElements: r.elements.map((el) => view(el, themes.get(r.boardId))),
          })),
          ...(requests.some((r) => hasTokens(r.elements)) && { tokens: TOKENS_NOTE }),
          next: "Make each change on its boardId, then call complete_edit for each requestId.",
        });
      }),
  );

  server.registerTool(
    "complete_edit",
    {
      title: "Finish an Ask AI request",
      description:
        'Report the result of an "Ask AI" request. The note shows to the user in the browser (one short sentence, e.g. "Rounded the corners to 12px.").',
      inputSchema: z.object({
        requestId: z.uuid(),
        status: z.enum(["done", "failed"]),
        note: z
          .string()
          .max(EDIT_NOTE_MAX)
          .optional()
          .describe("Short result or reason it failed."),
      }),
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    ({ requestId, status, note }) =>
      run(async () => {
        const request = await completeEdit(userId, requestId, status, note ?? "");
        return json({ requestId: request.id, status: request.status });
      }),
  );
}

/** Prompts: slash commands in clients like Claude Code (/mcp__prism__watch_edits). */
export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    "watch_edits",
    {
      title: "Watch Prism for Ask AI requests",
      description: "Keep handling the requests you send from Prism's Ask AI box until you stop it.",
      argsSchema: z.object({
        board: z.string().optional().describe("Only this board (name or id). Default: all boards."),
      }),
    },
    ({ board }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Watch Prism for "Ask AI" requests${board ? ` on the board "${board}" (find its id with list_boards)` : ""} and handle them until I stop you:`,
              "1. Call wait_for_edits.",
              "2. For each request, read the selected elements (get_board if you need context), make the change with update_elements / create_elements / delete_elements, then call complete_edit with a one-sentence note. If a request is unclear or impossible, complete it as failed and say why in the note.",
              "3. Go back to step 1, also after an empty result. Don't stop on your own and keep your messages between rounds very short.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "design_screen",
    {
      title: "Design a screen in Prism",
      description:
        "Gather references (e.g. from Mobbin), put them on a Prism board and design a new screen inspired by them.",
      argsSchema: z.object({
        idea: z.string().describe('What to design, e.g. "landing page for a budgeting app".'),
        project: z
          .string()
          .optional()
          .describe("The app's Prism project (name or id). Created if it doesn't exist."),
        board: z
          .string()
          .optional()
          .describe("Board name to use. Default: one named after the idea."),
      }),
    },
    ({ idea, project, board }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Design this in Prism: ${idea}`,
              project
                ? `1. Find the project "${project}" with list_boards (create_project if it doesn't exist), then open_board with the name "${board ?? idea}" and its projectId. Give me the board's URL unless it opened in my browser.`
                : `1. open_board with the name "${board ?? idea}". Give me its URL unless it opened in my browser.`,
              "2. Theme: get_theme (boardId). If saved is false and this folder is the app's repo with a global CSS file (app/globals.css, src/index.css) defining shadcn/ui variables, import it with set_theme (css) so the design matches the app. Otherwise keep the theme, or ask me for brand colors and set them with set_theme.",
              "3. Components: list_components. If the project has none, define its shared parts first with define_component, using the theme's tokens: Button (variants primary, secondary, outline, ghost, destructive), Input (label, placeholder), Card (a slot for content), PageHeader (title, description, a slot for actions) and the app's navigation (Sidebar or TopBar with its items). Add a component whenever a part repeats across screens.",
              "4. If a Mobbin MCP is available, search it for 3 strong references. Add each with add_image (its image_url) in a row at the top, with a sticky note beside each saying what to take from it.",
              "5. Read get_design_guide (surface landing, app or mobile, and the boardId) and write down the design's thesis, signature move, palette and type before drawing. Where the guide's sizes and the theme's text styles differ, the theme wins.",
              '6. Below the references, build the new design with create_screen (a layout tree, inside a frame at a real device size: 390x844 mobile or 1440x900 desktop), using create_elements only for extras that don\'t fit a layout. Put a small text above each frame naming its route and state, e.g. "/reset-password · desktop · link sent". Use theme tokens for every color, radius and text: textStyle $h1–$h4 for headings, $body / $body-sm for copy, $label for buttons and form labels, $caption for hints; fill $primary with $primary-foreground text, $card, $muted-foreground, stroke $border, $radius-md on buttons and inputs, $radius-lg on cards. Never hex or px sizes. Place the project components with use nodes wherever they fit instead of drawing buttons, inputs, cards and navigation again. Keep spacing on the scale from get_design_guide. Clean look (sketch: false), real copy, consistent spacing, a shadow on raised surfaces (md cards, lg modals), Lucide icons (type icon) for nav, actions and inputs, one groupId and a role per component.',
              "7. Fix the warnings create_screen returns. Then look at it with export_image (the frame's id), critique it against the thesis and references, fix anything that overlaps, is misaligned or wraps badly, check again, then summarize what you made.",
              "8. Finish by watching for my Ask AI requests (wait_for_edits, handle each, complete_edit, repeat).",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "build_pages",
    {
      title: "Build pages from Prism designs",
      description:
        "Code the screens designed in a Prism project as pages of this app, in its own framework and styling (React, Next.js, Vue, Svelte, plain HTML or Flutter; Tailwind, plain CSS or CSS Modules), using the project's theme and components.",
      argsSchema: z.object({
        project: z.string().describe("The Prism project (name or id)."),
        board: z.string().optional().describe("Only this board (name). Default: every board."),
        framework: z
          .string()
          .optional()
          .describe(
            "nextjs, react, vue, nuxt, svelte, sveltekit, html or flutter. Default: detected from the app.",
          ),
        styling: z
          .string()
          .optional()
          .describe("tailwind, css or css-modules (ignored for Flutter). Default: detected."),
      }),
    },
    ({ project, board, framework, styling }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Build the screens designed in the Prism project "${project}" as pages of this app.`,
              `1. Stack: ${framework ? `the framework is ${framework}` : "detect the framework from the app (package.json dependencies: next, nuxt, vue, @sveltejs/kit, svelte, react with vite; pubspec.yaml with flutter for Flutter; only .html files for plain HTML)"} and ${styling ? `the styling is ${styling}` : 'detect the styling (tailwindcss in the dependencies or @import "tailwindcss" in the global CSS: tailwind; *.module.css files: css-modules; else plain css)'}. If there's no app yet, ask the user which stack to use before creating one.`,
              '2. Find the project and its boards with list_boards. Call list_components with its projectId, and get_theme with its projectId and the format for the stack: Tailwind → format "css" (the default), plain CSS or CSS Modules → "css-vars", Flutter → "dart". Its usage says how $tokens are written in that code.',
              "3. Theme, once:",
              '   - Tailwind: in the global CSS (app/globals.css, src/index.css, src/app.css or assets/css/main.css), write get_theme\'s css in place of the old :root, .dark and @theme inline variables, keeping @import "tailwindcss" and other rules.',
              "   - Plain CSS or CSS Modules: put the css-vars code in the global stylesheet (or src/styles/theme.css imported once at the root) and use var(--token) in every component's styles.",
              "   - Flutter: save the dart code as lib/theme/prism_theme.dart, add google_fonts (flutter pub add google_fonts) and set MaterialApp(theme: prismTheme(Brightness.light), darkTheme: prismTheme(Brightness.dark)).",
              "   - Web fonts: load the theme's fonts (next/font/google in Next.js, @fontsource packages or a Google Fonts link elsewhere) and wire them to --font-sans, --font-heading and --font-mono.",
              "4. Components: build each project component once, with its props and variants, where the stack keeps components: components/<Name>.tsx (React, Next.js), components/<Name>.vue (Vue, Nuxt), src/lib/components/<Name>.svelte (SvelteKit), a reusable class or partial in plain HTML, lib/widgets/<name>.dart as a StatelessWidget (Flutter). Reuse the app's own component when its code path exists (e.g. @/components/ui/button with the matching variant). Navigation and page shells go in a shared layout (app/(app)/layout.tsx, a layout route, +layout.svelte, layouts/default.vue, or a Scaffold shell in Flutter).",
              `5. For ${board ? `the board "${board}"` : "each board in the project"}: get_screen_code. Each screen is a frame as a nested tree; its label (the text above the frame) names its route and state. Look at each frame with export_image too.`,
              "6. Build each screen as a page where the stack keeps routes: app/<route>/page.tsx (Next.js), the app's router (React Router, TanStack Router), pages/<route>.vue (Nuxt) or the vue-router config, src/routes/<route>/+page.svelte (SvelteKit), <route>.html (plain HTML), lib/screens/<name>_screen.dart with a go_router route (Flutter).",
              "   - Code the tree as it is nested: each box or group is one element (div, section, nav, header… / Container, Padding, Row, Column) and each layout maps as get_screen_code's layout note says (column → flex-col / Column, row → flex-row / Row, grid → grid / GridView, overlay → relative + absolute / Stack + Positioned; gap, padding, align, justify, fill and hug).",
              "   - Components are instances: render the component with the instance's texts as props, never redraw its parts.",
              "   - Write theme values as tokens in the stack's form (get_theme's usage), never as hex: bg-primary, var(--primary) or PrismTokens.of(context).primary. Plain values only where the tree has no $token.",
              "   - Use real links or routes between screens. Different states of one route are one page with that state logic.",
              "7. Make each page responsive (web: fluid widths, max-w containers, breakpoints; Flutter: LayoutBuilder or flexible widgets), run the app, compare each page with its frame's image and fix differences. Then list the routes you made.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}

import {
  createBoardSchema,
  EDIT_NOTE_MAX,
  elementChangesSchema,
  WAIT_EDITS_MAX_SECONDS,
  type BoardElement,
  type ElementOp,
} from "@prism/shared";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  completeEdit,
  importImage,
  loadElements,
  selectionFor,
  waitForEdits,
} from "../ai-actions.js";
import { HttpError } from "../errors.js";
import { broadcastOps } from "../realtime.js";
import { applyOps, ownedBoard } from "../routes/elements.js";
import { createBoard, getBoardSummary, loadWorkspace } from "../routes/workspace.js";
import {
  boundsOf,
  buildElements,
  compact,
  createElementInput,
  insideFrame,
  updateChangesInput,
} from "./elements.js";

// The Prism tools AI editors call, acting as one signed-in user on that user's boards.

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

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
const view = (el: BoardElement) => compact(el, fileUrl);

const boardId = z.uuid().describe("The board's id (from list_boards or open_board).");

/** Saves AI-made ops (one undo step for the user) and sends them to open board tabs. */
async function save(userId: string, id: string, ops: ElementOp[]) {
  const board = await ownedBoard(id, userId);
  const result = await applyOps(board, ops);
  broadcastOps(board.id, result.applied);
  return result;
}

export function registerTools(server: McpServer, userId: string) {
  // ── Boards ───────────────────────────────────────────────────────────────

  server.registerTool(
    "list_boards",
    {
      title: "List boards",
      description:
        "List the user's Prism boards (id, name, project, item count), most recently edited first.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () =>
      run(async () => {
        const workspace = await loadWorkspace(userId);
        const projects = new Map(workspace.projects.map((p) => [p.id, p.name]));
        return json({
          boards: workspace.boards.map((b) => ({
            id: b.id,
            name: b.name,
            project: b.projectId ? (projects.get(b.projectId) ?? null) : null,
            items: b.itemCount,
            editedAt: b.editedAt,
            url: boardUrl(b.id),
          })),
          projects: workspace.projects.map((p) => ({ id: p.id, name: p.name })),
        });
      }),
  );

  server.registerTool(
    "open_board",
    {
      title: "Open or create a board",
      description:
        "Open a board by id, or by name: an existing board with that name is reused, otherwise a new one is created. Returns the board id and its URL; give the URL to the user so they can watch the board update live.",
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
          const { boards } = await loadWorkspace(userId);
          board = boards.find((b) => b.name.trim().toLowerCase() === wanted);
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
        return json({
          board: { id: board.id, name: board.name, items: board.itemCount },
          url: boardUrl(board.id),
          created,
        });
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
        const board = await ownedBoard(id, userId);
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
          elements: elements.map(view),
        });
      }),
  );

  // ── Elements ─────────────────────────────────────────────────────────────

  server.registerTool(
    "create_elements",
    {
      title: "Create elements",
      description: [
        "Create elements on a board. They appear live in open browser tabs, and the whole call is one undo step for the user.",
        "Types: rect (boxes, buttons, cards, inputs), ellipse, diamond, text, sticky, list, line, arrow, emoji, chart, frame (a screen/artboard background), freehand.",
        "Coordinates are board px; x grows right, y grows down. List elements back to front: frames and backgrounds first, then content on top.",
        "For UI mockups use sketch: false, a radius on buttons/cards, groupId per component and a role (button, input, card, …).",
        "Text sizes itself when width is left out. Arrows: set startBinding/endBinding to element ids or to keys from this call.",
      ].join(" "),
      inputSchema: z.object({
        boardId,
        elements: z.array(createElementInput).min(1).max(500),
      }),
      annotations: { openWorldHint: false },
    },
    ({ boardId: id, elements: inputs }) =>
      run(async () => {
        const board = await ownedBoard(id, userId);
        const elements = buildElements(inputs, await loadElements(board.id));
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
        });
      }),
  );

  server.registerTool(
    "update_elements",
    {
      title: "Update elements",
      description:
        "Change elements by id: position (x, y), size, colors, text, corner radius, font, etc. Only the given fields change; null clears an optional field. The whole call is one undo step.",
      inputSchema: z.object({
        boardId,
        updates: z
          .array(z.object({ id: z.uuid(), changes: updateChangesInput }))
          .min(1)
          .max(500),
      }),
      annotations: { openWorldHint: false },
    },
    ({ boardId: id, updates }) =>
      run(async () => {
        const board = await ownedBoard(id, userId);
        const current = new Map((await loadElements(board.id)).map((el) => [el.id, el]));
        const missing = updates.filter((u) => !current.has(u.id)).map((u) => u.id);
        if (missing.length > 0) {
          throw new HttpError(404, `Not on this board: ${missing.join(", ")}`);
        }
        const ops: ElementOp[] = updates.map(({ id: elementId, changes }) => ({
          op: "update",
          id: elementId,
          version: (current.get(elementId)?.version ?? 0) + 1,
          changes: elementChangesSchema.parse({ ...changes, updatedBy: "ai_agent" }),
        }));
        const result = await save(userId, board.id, ops);
        return json({ updated: result.applied.length, conflicts: result.stale });
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
        const board = await ownedBoard(id, userId);
        const elements = await loadElements(board.id);
        const doomed = new Set(
          ids.filter((elementId) => elements.some((el) => el.id === elementId)),
        );
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
        return json({ boardId: selection.boardId, elements: selection.elements.map(view) });
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
        return json({
          requests: requests.map((r) => ({
            requestId: r.id,
            boardId: r.boardId,
            board: r.boardName,
            prompt: r.prompt,
            selectedElements: r.elements.map(view),
          })),
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
        board: z
          .string()
          .optional()
          .describe("Board name to use. Default: one named after the idea."),
      }),
    },
    ({ idea, board }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Design this in Prism: ${idea}`,
              `1. open_board with the name "${board ?? idea}" and give me its URL.`,
              "2. If a Mobbin MCP is available, search it for 3 strong references. Add each with add_image (its image_url) in a row at the top, with a sticky note beside each saying what to take from it.",
              "3. Below the references, create a frame at a real device size (390x844 mobile or 1440x900 desktop) and build the new design inside it with create_elements: clean look (sketch: false), real copy, consistent spacing, radius on buttons and cards, one groupId and a role per component.",
              "4. Read it back with get_board, fix anything that overlaps or is misaligned, then summarize what you made.",
              "5. Finish by watching for my Ask AI requests (wait_for_edits, handle each, complete_edit, repeat).",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}

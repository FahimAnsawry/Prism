import { requireMcpAuth } from "@better-auth/mcp";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  createMcpHandler,
  McpServer,
  type AuthInfo,
  type McpHandlerRequestOptions,
} from "@modelcontextprotocol/server";
import { API_TOKEN_PREFIX, peerName } from "@prism/shared";
import { Router } from "express";
import { auth, MCP_RESOURCE } from "../auth.js";
import { prisma } from "../db/client.js";
import { LIMITS, spend } from "../rate-limit.js";
import { userForToken } from "../session.js";
import { grantExists } from "./grants.js";
import { CONTENT_NOTE, registerPrompts, registerTools } from "./tools.js";

// The remote MCP endpoint (Streamable HTTP at /mcp). AI editors connect with just the URL:
// they discover Prism's OAuth server from the 401 challenge, send the user to log in and
// approve, and call tools as that user. A personal access token (Authorization: Bearer
// prism_…) also works, for clients that can only send a fixed header.

const INSTRUCTIONS = `Prism is a whiteboard for UI references, wireframes and diagrams. Everything you draw shows up live in the user's browser.

Building on a board:
1. open_board (by name to create or reuse one). If the user has Prism open, their tab switches to the board; give them the URL only when the result's browser is "no-tab" or "asked".
2. Before the first screen, read get_design_guide (surface landing, app or mobile, and the boardId) and decide the screen's thesis, palette and type from it. Pages of one site (a project) share one design language; different sites look different. For a screen or UI reference, use create_screen: describe it as a layout tree (stacks, rows, grids with gap and padding; text, icons, boxes) inside a frame (e.g. 390x844 for mobile, 1440x900 for desktop) and Prism positions everything. It places each new screen to the right of the last. Use create_mindmap for mind maps and brainstorms (an outline in, a styled and laid-out map out), and create_elements for free-form diagrams, notes and arrows.
3. Draw UI with create_elements: rect for containers, buttons, inputs and cards (radius, fill, strokeWidth 0 for flat fills, shadow "md" on cards and "lg" on menus or modals), text for copy (font, fontSizePx, fontWeight, stroke = text color, lineHeight ~1.1 on big headings and 1.5 on paragraphs, letterSpacing -0.02 on big headings and 0.06 on small uppercase labels), icon for icons (a Lucide name such as "search" or "bell", stroke = icon color, usually 16-24px; never emoji in UI), real photos from search_images (as fillImage or via add_image), avatars, and fictional logos and illustrations as SVG (add_svg); gradient, per-corner radius, soft custom shadows and backdropBlur (frosted glass) for richer surfaces. Never a gray box where a picture belongs. Use sketch: false for a clean look, role for meaning and one groupId per component.
4. Reference images (e.g. a Mobbin screen's image_url): add_image each one into a "References" area, with a sticky note beside it saying what to take from it.
5. Read with get_board before changing existing content; change with update_elements. Frames, sections and cards have a name ("Pricing — Pro plan card"), shown by get_board, get_selection and get_screen_code: find an element by it, and set name (create_screen nodes take name too) to rename. The user sees your cursor, labelled with your connection's name, go to what you change.
6. After drawing a screen, fix the warnings create_screen returns, then look at it with export_image (pass the frame's id) and fix what looks off. The user's board tab draws the image, so the board must be open in their browser (a Prism tab on the dashboard switches to it by itself).

"Ask AI" requests: the user can select elements in the browser and type a request. Call wait_for_edits to receive them, make each change, then complete_edit with a short note. Call wait_for_edits again to keep watching.

Trust: ${CONTENT_NOTE}`;

const USER_KEY = "prismUserId";
/** A personal access token's name, which is what its editor is called. */
const TOKEN_NAME_KEY = "prismTokenName";

/** Shown on an AI editor's cursor when the connection has no usable name. */
const EDITOR_FALLBACK = "AI";

/** OAuth clients' names, kept for a minute so a burst of edits asks the database once. */
const clientNames = new Map<string, { name: string; at: number }>();
const CLIENT_NAME_TTL_MS = 60_000;

/** What an editor is called on the board: the OAuth client's name or the token's name. */
async function editorName(clientId: string, tokenName: unknown) {
  if (typeof tokenName === "string") return peerName(tokenName, EDITOR_FALLBACK);
  if (!clientId) return EDITOR_FALLBACK;
  const known = clientNames.get(clientId);
  if (known && Date.now() - known.at < CLIENT_NAME_TTL_MS) return known.name;
  const client = await prisma.oauthClient.findUnique({
    where: { clientId },
    select: { name: true },
  });
  const name = peerName(client?.name, EDITOR_FALLBACK);
  clientNames.set(clientId, { name, at: Date.now() });
  return name;
}

const handler = createMcpHandler(({ authInfo }) => {
  const userId = authInfo?.extra?.[USER_KEY];
  // Every request passed the auth gate below, which always sets the user.
  if (typeof userId !== "string") throw new Error("MCP request without a signed-in user");
  const server = new McpServer(
    { name: "prism", title: "Prism", version: "0.2.0" },
    { instructions: INSTRUCTIONS },
  );
  let name: Promise<string> | undefined;
  registerTools(server, userId, {
    name: () => (name ??= editorName(authInfo?.clientId ?? "", authInfo?.extra?.[TOKEN_NAME_KEY])),
  });
  registerPrompts(server);
  return server;
});

const authInfoFor = (
  userId: string,
  info: Omit<AuthInfo, "extra">,
  tokenName?: string,
): AuthInfo => ({
  ...info,
  extra: { [USER_KEY]: userId, ...(tokenName && { [TOKEN_NAME_KEY]: tokenName }) },
});

/**
 * OAuth access tokens: verified against Prism's JWKS, bound to MCP_RESOURCE, and refused once the
 * user disconnected the client (grants.ts).
 */
const withOAuth = (options: McpHandlerRequestOptions | undefined) =>
  requireMcpAuth(
    auth,
    async (request, claims) => {
      const clientId = claims["azp"] ?? claims["client_id"];
      if (!claims.sub || typeof clientId !== "string") return new Response(null, { status: 401 });
      if (!(await grantExists(claims.sub, clientId))) {
        return unauthorized("This editor was disconnected from Prism. Sign in again to reconnect.");
      }
      const limited = rateLimited(claims.sub);
      if (limited) return limited;
      return handler.fetch(request, {
        ...options,
        authInfo: authInfoFor(claims.sub, {
          token: "",
          clientId,
          scopes: typeof claims["scope"] === "string" ? claims["scope"].split(" ") : [],
          ...(claims.exp && { expiresAt: claims.exp }),
        }),
      });
    },
    { resource: MCP_RESOURCE },
  );

/** A JSON-RPC error reply for a user over the MCP request limit (rate-limit.ts), else null. */
function rateLimited(userId: string) {
  try {
    spend(LIMITS.mcpCallsPerMinute, userId);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Too many requests.";
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message }, id: null },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
}

const unauthorized = (message: string) =>
  Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' } },
  );

const BEARER = /^Bearer\s+(\S+)$/i;

/** Browsers may only call /mcp from Prism itself; MCP clients send no Origin. */
function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(process.env["CLIENT_URL"] ?? "").origin;
}

async function fetchMcp(request: Request, options?: McpHandlerRequestOptions) {
  if (!originAllowed(request)) return new Response("Forbidden origin", { status: 403 });
  const token = BEARER.exec(request.headers.get("authorization") ?? "")?.[1];
  if (token?.startsWith(API_TOKEN_PREFIX)) {
    const found = await userForToken(token);
    if (!found) {
      return unauthorized(
        "That access token isn't valid or has expired. Create a new one on the dashboard.",
      );
    }
    const limited = rateLimited(found.userId);
    if (limited) return limited;
    return handler.fetch(request, {
      ...options,
      authInfo: authInfoFor(
        found.userId,
        { token, clientId: "personal-access-token", scopes: [] },
        found.name,
      ),
    });
  }
  return withOAuth(options)(request);
}

const node = toNodeHandler(
  { fetch: fetchMcp },
  { onerror: (error) => console.error("[Prism] MCP request failed:", error) },
);

/** Mount before express.json(): the adapter reads the body itself. */
export const mcpRouter = Router();

mcpRouter.all("/mcp", (req, res) => void node(req, res));

import { requireMcpAuth } from "@better-auth/mcp";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  createMcpHandler,
  McpServer,
  type AuthInfo,
  type McpHandlerRequestOptions,
} from "@modelcontextprotocol/server";
import { API_TOKEN_PREFIX } from "@prism/shared";
import { Router } from "express";
import { auth, MCP_RESOURCE } from "../auth.js";
import { userForToken } from "../session.js";
import { registerPrompts, registerTools } from "./tools.js";

// The remote MCP endpoint (Streamable HTTP at /mcp). AI editors connect with just the URL:
// they discover Prism's OAuth server from the 401 challenge, send the user to log in and
// approve, and call tools as that user. A personal access token (Authorization: Bearer
// prism_…) also works, for clients that can only send a fixed header.

const INSTRUCTIONS = `Prism is a whiteboard for UI references, wireframes and diagrams. Everything you draw shows up live in the user's browser.

Building on a board:
1. open_board (by name to create or reuse one) and give the user its URL.
2. For a screen or UI reference, first create a frame (e.g. 390x844 for mobile, 1440x900 for desktop) and draw inside its bounds. Put separate ideas side by side (leave ~120px between frames).
3. Draw UI with create_elements: rect for containers, buttons, inputs and cards (radius, fill, strokeWidth 0 for flat fills), text for copy (font, fontSizePx, fontWeight, stroke = text color), images via add_image. Use sketch: false for a clean look, role for meaning and one groupId per component.
4. Reference images (e.g. a Mobbin screen's image_url): add_image each one into a "References" area, with a sticky note beside it saying what to take from it.
5. Read with get_board before changing existing content; change with update_elements.

"Ask AI" requests: the user can select elements in the browser and type a request. Call wait_for_edits to receive them, make each change, then complete_edit with a short note. Call wait_for_edits again to keep watching.`;

const USER_KEY = "prismUserId";

const handler = createMcpHandler(({ authInfo }) => {
  const userId = authInfo?.extra?.[USER_KEY];
  // Every request passed the auth gate below, which always sets the user.
  if (typeof userId !== "string") throw new Error("MCP request without a signed-in user");
  const server = new McpServer(
    { name: "prism", title: "Prism", version: "0.2.0" },
    { instructions: INSTRUCTIONS },
  );
  registerTools(server, userId);
  registerPrompts(server);
  return server;
});

const authInfoFor = (userId: string, info: Omit<AuthInfo, "extra">): AuthInfo => ({
  ...info,
  extra: { [USER_KEY]: userId },
});

/** OAuth access tokens: verified against Prism's JWKS, bound to MCP_RESOURCE. */
const withOAuth = (options: McpHandlerRequestOptions | undefined) =>
  requireMcpAuth(
    auth,
    (request, claims) => {
      if (!claims.sub) return Promise.resolve(new Response(null, { status: 401 }));
      const clientId = claims["azp"] ?? claims["client_id"];
      return handler.fetch(request, {
        ...options,
        authInfo: authInfoFor(claims.sub, {
          token: "",
          clientId: typeof clientId === "string" ? clientId : "",
          scopes: typeof claims["scope"] === "string" ? claims["scope"].split(" ") : [],
          ...(claims.exp && { expiresAt: claims.exp }),
        }),
      });
    },
    { resource: MCP_RESOURCE },
  );

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
    const userId = await userForToken(token);
    if (!userId) {
      return unauthorized("That access token isn't valid. Create a new one on the dashboard.");
    }
    return handler.fetch(request, {
      ...options,
      authInfo: authInfoFor(userId, { token, clientId: "personal-access-token", scopes: [] }),
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

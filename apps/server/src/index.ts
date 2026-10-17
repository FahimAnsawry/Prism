import { EDITED_AT_HEADER } from "@prism/shared";
import compression from "compression";
import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { catchProcessErrors, errorHandler, notFoundHandler } from "./errors.js";
import { mcpRouter } from "./mcp/index.js";
import { attachRealtime } from "./realtime.js";
import { accountRouter, avatarFileRouter, photoRouter } from "./routes/account.js";
import { aiRouter } from "./routes/ai.js";
import { elementsRouter } from "./routes/elements.js";
import { shareRouter } from "./routes/share.js";
import { tokensRouter } from "./routes/tokens.js";
import { startTombstonePurge } from "./tombstones.js";
import { fileRouter, uploadRouter } from "./routes/uploads.js";
import { workspaceRouter } from "./routes/workspace.js";

catchProcessErrors();

const clientUrl = process.env["CLIENT_URL"];
if (!clientUrl) throw new Error("CLIENT_URL is not set");
const port = Number(process.env["PORT"] ?? 4000);

const app = express();

// credentials: the client sends the session cookie cross-origin (Vite :5173 → server :4000).
// A board's elements reply says in a header which `editedAt` it was read at.
app.use(cors({ origin: clientUrl, credentials: true, exposedHeaders: [EDITED_AT_HEADER] }));

// Better Auth reads the raw request body, so it must be mounted before express.json().
// `auth` is read per request: it's replaced if its startup failed (src/auth.ts).
const authHandler: express.RequestHandler = (req, res) => toNodeHandler(auth)(req, res);
app.all("/api/auth/*splat", authHandler);
// OAuth discovery for MCP clients (authorization server and protected resource metadata).
app.get("/.well-known/*splat", authHandler);

// The remote MCP endpoint for AI editors (Claude Code, Codex, …). Reads its own body.
app.use(mcpRouter);

// Everything after this is compressed: a board's elements are large, repetitive JSON that gzip
// shrinks several times over. MCP comes before it, since compression would hold back its
// streamed events, and any other event stream is left alone too.
app.use(
  compression({
    filter: (req, res) =>
      !String(res.getHeader("Content-Type") ?? "").startsWith("text/event-stream") &&
      compression.filter(req, res),
  }),
);

// Uploaded images and SVGs, served publicly by unguessable key (tools.md §1, tools 15 and 17).
app.use(fileRouter);
app.use(avatarFileRouter);

// These parse their own bodies (raw files, large element batches), so they come before express.json().
app.use("/api", uploadRouter);
app.use("/api", elementsRouter);
app.use("/api", photoRouter);

app.use(express.json());

// AI editors (the MCP bridge) and the browser's "Ask AI" box; personal access tokens.
app.use("/api", aiRouter);
app.use("/api", tokensRouter);
// The profile page: photo removal and connected AI editors.
app.use("/api", accountRouter);
// Sharing; its public link and invite routes work signed out, so it comes before workspaceRouter.
app.use("/api", shareRouter);
app.use("/api", workspaceRouter);

// Unknown /api paths. Requests reach it through workspaceRouter, so signed-out ones get a 401 first.
app.use("/api", notFoundHandler);

// Express 5 sends thrown errors and rejected handler promises here.
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Prism server listening on http://localhost:${port}`);
});

// Socket.IO shares the HTTP server: live element updates for open board tabs.
attachRealtime(server, clientUrl);

// Deleted elements older than 30 days are removed for good, every hour.
startTombstonePurge();

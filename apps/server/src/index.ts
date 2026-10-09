import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { catchProcessErrors, errorHandler, notFoundHandler } from "./errors.js";
import { mcpRouter } from "./mcp/index.js";
import { attachRealtime } from "./realtime.js";
import { aiRouter } from "./routes/ai.js";
import { elementsRouter } from "./routes/elements.js";
import { shareRouter } from "./routes/share.js";
import { tokensRouter } from "./routes/tokens.js";
import { fileRouter, uploadRouter } from "./routes/uploads.js";
import { workspaceRouter } from "./routes/workspace.js";

catchProcessErrors();

const clientUrl = process.env["CLIENT_URL"];
if (!clientUrl) throw new Error("CLIENT_URL is not set");
const port = Number(process.env["PORT"] ?? 4000);

const app = express();

// credentials: the client sends the session cookie cross-origin (Vite :5173 → server :4000)
app.use(cors({ origin: clientUrl, credentials: true }));

// Better Auth reads the raw request body, so it must be mounted before express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));
// OAuth discovery for MCP clients (authorization server and protected resource metadata).
app.get("/.well-known/*splat", toNodeHandler(auth));

// The remote MCP endpoint for AI editors (Claude Code, Codex, …). Reads its own body.
app.use(mcpRouter);

// Uploaded images and SVGs, served publicly by unguessable key (tools.md §1, tools 15 and 17).
app.use(fileRouter);

// These parse their own bodies (raw files, large element batches), so they come before express.json().
app.use("/api", uploadRouter);
app.use("/api", elementsRouter);

app.use(express.json());

// AI editors (the MCP bridge) and the browser's "Ask AI" box; personal access tokens.
app.use("/api", aiRouter);
app.use("/api", tokensRouter);
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

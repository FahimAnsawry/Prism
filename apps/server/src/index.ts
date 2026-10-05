import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { catchProcessErrors, errorHandler, notFoundHandler } from "./errors.js";
import { elementsRouter } from "./routes/elements.js";
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

// Uploaded images and SVGs, served publicly by unguessable key (tools.md §1, tools 15 and 17).
app.use(fileRouter);

// These parse their own bodies (raw files, large element batches), so they come before express.json().
app.use("/api", uploadRouter);
app.use("/api", elementsRouter);

app.use(express.json());

app.use("/api", workspaceRouter);

// Unknown /api paths. Requests reach it through workspaceRouter, so signed-out ones get a 401 first.
app.use("/api", notFoundHandler);

// Express 5 sends thrown errors and rejected handler promises here.
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Prism server listening on http://localhost:${port}`);
});

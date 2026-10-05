import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { workspaceRouter } from "./routes/workspace.js";

const clientUrl = process.env["CLIENT_URL"];
if (!clientUrl) throw new Error("CLIENT_URL is not set");
const port = Number(process.env["PORT"] ?? 4000);

const app = express();

// credentials: the client sends the session cookie cross-origin (Vite :5173 → server :4000)
app.use(cors({ origin: clientUrl, credentials: true }));

// Better Auth reads the raw request body, so it must be mounted before express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use("/api", workspaceRouter);

// Express 5 sends rejected handler promises here. Log the cause; don't leak it to the client.
const onError: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
};
app.use(onError);

app.listen(port, () => {
  console.log(`Prism server listening on http://localhost:${port}`);
});

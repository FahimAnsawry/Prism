import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";

const clientUrl = process.env["CLIENT_URL"];
if (!clientUrl) throw new Error("CLIENT_URL is not set");
const port = Number(process.env["PORT"] ?? 4000);

const app = express();

// credentials: the client sends the session cookie cross-origin (Vite :5173 → server :4000)
app.use(cors({ origin: clientUrl, credentials: true }));

// Better Auth reads the raw request body, so it must be mounted before express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.listen(port, () => {
  console.log(`Prism server listening on http://localhost:${port}`);
});

/**
 * Central backend error handling. Routes throw (or reject with) errors instead of writing error
 * responses; Express 5 forwards both to `errorHandler`, which picks the status and the message
 * users see and logs what we didn't expect. Every error reply has the shape
 * `{ error, fieldErrors? }` that the client's ApiError reads.
 */
import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { Prisma } from "./db/generated/client.js";

type FieldErrors = Partial<Record<string, string[]>>;

const SERVER_FAILED = "Something went wrong on our side. Please try again.";

/** An error whose message is safe to show users, sent with `status`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Per-field messages for a 400, keyed by request body field. */
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, fieldErrors?: FieldErrors) =>
  new HttpError(400, message, fieldErrors);
export const unauthorized = (message: string) => new HttpError(401, message);
export const notFound = (message: string) => new HttpError(404, message);

/** A 400 with each field's messages, headed by the first issue's message. */
function validationError(error: z.ZodError) {
  return badRequest(
    error.issues[0]?.message ?? "Invalid request.",
    z.flattenError(error).fieldErrors as FieldErrors,
  );
}

/** Parses a request body, or throws a 400 with each field's messages. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw validationError(result.error);
  return result.data;
}

/** Prisma's "no row matched the WHERE" error, from update/delete. */
function isPrismaNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/**
 * Awaits an update/delete whose WHERE also checks ownership, turning "no row matched" into a 404
 * with `message`. Without it the error handler still sends a 404, but with a generic message.
 */
export async function orNotFound<T>(query: PromiseLike<T>, message: string): Promise<T> {
  try {
    return await query;
  } catch (error) {
    if (isPrismaNotFound(error)) throw notFound(message);
    throw error;
  }
}

/** The errors express.json() (body-parser) throws for a body it can't read. */
function bodyParserError(error: unknown) {
  if (!(error instanceof Error) || !("type" in error) || !("status" in error)) return undefined;
  const status = Number(error.status);
  if (typeof error.type !== "string" || !(status >= 400 && status < 500)) return undefined;
  if (error.type === "entity.parse.failed") return badRequest("The request body isn't valid JSON.");
  if (error.type === "entity.too.large") return new HttpError(413, "The request is too large.");
  return new HttpError(status, "The request couldn't be read.");
}

/** Maps a thrown value to the reply users see. Undefined means it's a bug: a 500. */
function toHttpError(error: unknown) {
  if (error instanceof HttpError) return error;
  if (error instanceof z.ZodError) return validationError(error);
  if (isPrismaNotFound(error)) return notFound("That item no longer exists.");
  return bodyParserError(error);
}

/** Answers requests no route matched. Mount it after the routers, before `errorHandler`. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound("There's nothing here."));
};

/** The one place error replies are sent. Register it last. */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const known = toHttpError(error);
  // Expected failures (bad input, not found, signed out) are part of normal traffic; don't log them.
  if (!known) console.error(`[Prism] ${req.method} ${req.originalUrl} failed:`, error);

  // A reply is already streaming, so it can't become an error reply; Express's default
  // handler closes the connection.
  if (res.headersSent) {
    next(error);
    return;
  }

  if (!known) {
    // Log the cause; don't leak it to the client.
    res.status(500).json({ error: SERVER_FAILED });
    return;
  }
  res
    .status(known.status)
    .json(
      known.fieldErrors
        ? { error: known.message, fieldErrors: known.fieldErrors }
        : { error: known.message },
    );
};

/**
 * Logs errors that escape every request: a promise nobody awaited, or a throw outside a handler.
 * After an uncaught exception the process state is unknown, so it exits and the supervisor
 * (tsx watch in dev, the host in production) restarts it.
 */
export function catchProcessErrors() {
  process.on("unhandledRejection", (reason) => {
    console.error("[Prism] Unhandled promise rejection:", reason);
  });
  process.on("uncaughtException", (error) => {
    console.error("[Prism] Uncaught exception:", error);
    process.exit(1);
  });
}

// JSON calls to the Express server (not Better Auth, which has its own client).

export const SERVER_UNREACHABLE =
  "Can't reach the Prism server right now. Check your connection and try again.";

const SERVER_FAILED = "Something went wrong on our side. Please try again.";

/** A failed API call. `status` is 0 when the server couldn't be reached at all. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Per-field messages from a 400, keyed by request body field. */
    readonly fieldErrors: Partial<Record<string, string[]>> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ErrorBody = { error?: string; fieldErrors?: Partial<Record<string, string[]>> };

/**
 * Calls `path` on the server with the session cookie and parses the JSON reply with `schema`
 * (a Zod schema from @prism/shared). Throws ApiError for network failures and non-2xx replies.
 */
export async function apiFetch<T>(
  path: string,
  schema: { parse: (data: unknown) => T },
  {
    method = "GET",
    body,
    headers,
  }: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  // A Blob (an uploaded file) goes as-is with its own type; anything else as JSON.
  const raw = body instanceof Blob;
  let response: Response;
  try {
    response = await fetch(new URL(path, import.meta.env.VITE_SERVER_URL), {
      method,
      credentials: "include",
      headers: {
        ...headers,
        ...(body !== undefined && {
          "Content-Type": raw ? body.type || "application/octet-stream" : "application/json",
        }),
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(SERVER_UNREACHABLE, 0);
  }

  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const { error, fieldErrors } = (data ?? {}) as ErrorBody;
    throw new ApiError(error ?? SERVER_FAILED, response.status, fieldErrors);
  }
  return schema.parse(data);
}

/** A message to show for any error thrown by apiFetch or a query. */
export function apiErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : SERVER_FAILED;
}

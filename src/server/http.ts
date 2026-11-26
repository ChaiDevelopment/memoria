import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { ConfigError, rawEnv } from "./env";

/** An error that is safe to show to the client. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiErrorBody = { error: { code: string; message: string; fields?: Record<string, string> } };

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    return NextResponse.json(
      { error: { code: "invalid_input", message: Object.values(fields)[0] ?? "Invalid input", fields } },
      { status: 400 },
    );
  }
  if (err instanceof ConfigError) {
    console.error("[MEMORA]", err.message);
    return NextResponse.json({ error: { code: "not_configured", message: err.message } }, { status: 503 });
  }
  console.error("[MEMORA] Unhandled API error:", err);
  return NextResponse.json({ error: { code: "internal", message: "Something went wrong. Please try again." } }, { status: 500 });
}

/** Wraps a route handler so thrown errors become consistent JSON responses. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/**
 * CSRF defence for state-changing requests: the browser-supplied Origin (or
 * Referer) must match this app, and bodies must be JSON (which a cross-site
 * HTML form cannot send). Session cookies are also SameSite=Lax.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? refererOrigin(request.headers.get("referer"));
  // Deliberately independent of config validation: a forged request must be
  // rejected even when the server is only partially configured.
  const allowed = new Set([new URL(request.url).origin]);
  const appUrl = rawEnv("APP_URL");
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).origin);
    } catch {
      /* invalid APP_URL is reported by coreEnv() elsewhere */
    }
  }
  // Behind a proxy such as ngrok, the public host arrives in x-forwarded-host.
  const fwdHost = request.headers.get("x-forwarded-host");
  if (fwdHost) allowed.add(`${request.headers.get("x-forwarded-proto") ?? "https"}://${fwdHost}`);
  if (!origin || !allowed.has(origin)) throw new ApiError(403, "bad_origin", "Request origin not allowed.");
}

function refererOrigin(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Expected a JSON request body.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON.");
  }
  return schema.parse(body);
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

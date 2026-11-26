import "server-only";
import { z } from "zod";

/**
 * Server configuration, validated on first use. A missing or malformed
 * variable produces a clear message (shown on the login page) instead of a
 * crash deep inside a request.
 *
 * MEMORA needs no database: identity comes from "Sign in with Google", photo
 * details live in a Google Sheet, and the photos themselves stay in a Google
 * Drive folder. A Google *service account* reads both on the server.
 */

export class ConfigError extends Error {
  constructor(issues: string[]) {
    super(`MEMORA is not fully configured: ${issues.join("; ")}. See .env.example.`);
    this.name = "ConfigError";
  }
}

const required = z.string({ error: "is missing" }).trim().min(1, { error: "is missing", abort: true });

const schema = z.object({
  APP_URL: z.url("must be a full URL such as http://localhost:3000").default("http://localhost:3000"),
  SESSION_SECRET: required.refine((v) => base64Length(v) >= 32, "must be at least 32 random bytes, base64 encoded"),
  GOOGLE_CLIENT_ID: required.endsWith(".apps.googleusercontent.com", "must be a Google OAuth client ID"),
  GOOGLE_CLIENT_SECRET: required,
  /** Comma-separated Google accounts allowed into the museum. */
  ALLOWED_EMAILS: required.transform((v) =>
    v
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: required.endsWith(".iam.gserviceaccount.com", "must be a service account email"),
  /** The service account's private key (PEM). Literal "\n" sequences are accepted. */
  GOOGLE_SERVICE_ACCOUNT_KEY: required
    .transform((v) => v.replace(/\\n/g, "\n"))
    .refine((v) => v.includes("BEGIN PRIVATE KEY"), "must be the private_key value from the service account JSON"),
  /** The Drive folder whose photos make up the museum. */
  DRIVE_FOLDER_ID: required.regex(/^[A-Za-z0-9_-]{10,}$/, "must be a Drive folder id (from the folder URL)"),
  /** The Google Sheet that stores titles, years and stories. */
  SHEET_ID: required.regex(/^[A-Za-z0-9_-]{20,}$/, "must be a Google Sheet id (from the sheet URL)"),
});

export type Env = z.infer<typeof schema>;

function base64Length(v: string): number {
  try {
    return atob(v.replace(/-/g, "+").replace(/_/g, "/")).length;
  } catch {
    return 0;
  }
}

let cached: Env | null = null;

/**
 * On Cloudflare Workers, secrets and variables arrive as bindings on the
 * request context (exposed by @opennextjs/cloudflare on a global symbol);
 * on Node they are in process.env. Bindings win when present.
 */
function source(): Record<string, unknown> {
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> } | undefined>)[Symbol.for("__cloudflare-context__")];
  // Blank values (e.g. placeholder lines in an env file) never override real ones.
  const filled = (obj: Record<string, unknown>) => Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v === "string" && v.trim() !== ""));
  return { ...filled(process.env), ...filled(ctx?.env ?? {}) };
}

/** A single raw (unvalidated) variable — for code that must work even when config is incomplete. */
export function rawEnv(key: string): string | undefined {
  const v = source()[key];
  return typeof v === "string" && v.trim() ? v : undefined;
}

export function env(): Env {
  if (cached) return cached;
  const result = schema.safeParse(source());
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`));
  }
  cached = result.data;
  return cached;
}

/** For tests. */
export function resetEnvCache() {
  cached = null;
}

export function isSecureOrigin(): boolean {
  return (rawEnv("APP_URL") ?? "").startsWith("https://") || process.env.NODE_ENV === "production";
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, isAllowed } from "@/server/auth/session";
import { ConfigError, env, rawEnv } from "@/server/env";
import { exchangeCodeForIdentity } from "@/server/google/oauth";
import { ApiError } from "@/server/http";

const OAUTH_COOKIE = "memora_oauth";
const stored = z.object({ state: z.string(), verifier: z.string(), nonce: z.string(), next: z.string() });

/** Google redirects here after the user picks an account. */
export async function GET(request: Request) {
  const appUrl = rawEnv("APP_URL") ?? new URL(request.url).origin;
  const toLogin = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, appUrl));
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/api/auth" });

  try {
    const e = env();
    const url = new URL(request.url);
    if (url.searchParams.get("error")) return toLogin("cancelled");
    let parsed: z.infer<typeof stored> | null = null;
    try {
      parsed = raw ? stored.parse(JSON.parse(raw)) : null;
    } catch {
      parsed = null;
    }
    const code = url.searchParams.get("code");
    if (!parsed || !code || url.searchParams.get("state") !== parsed.state) return toLogin("expired");

    const identity = await exchangeCodeForIdentity(
      { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET, redirectUri: new URL("/api/auth/callback", e.APP_URL).toString() },
      code,
      parsed.verifier,
      parsed.nonce,
    );
    if (!isAllowed(identity.email, e.ALLOWED_EMAILS)) return toLogin("not_invited");
    await createSession(identity);
    return NextResponse.redirect(new URL(parsed.next, appUrl));
  } catch (err) {
    console.error("[MEMORA] Google sign-in failed:", err);
    if (err instanceof ConfigError) return toLogin("not_configured");
    return toLogin(err instanceof ApiError ? err.code : "failed");
  }
}

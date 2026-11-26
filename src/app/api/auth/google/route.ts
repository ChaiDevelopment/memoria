import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env, isSecureOrigin } from "@/server/env";
import { buildAuthUrl, createPkce } from "@/server/google/oauth";
import { handler } from "@/server/http";
import { safeNext } from "@/server/pageAuth";

const OAUTH_COOKIE = "memora_oauth";

/** Starts "Sign in with Google". */
export const GET = handler(async (request: Request) => {
  const e = env();
  const next = safeNext(new URL(request.url).searchParams.get("next") ?? undefined);
  const p = await createPkce();
  (await cookies()).set(OAUTH_COOKIE, JSON.stringify({ state: p.state, verifier: p.verifier, nonce: p.nonce, next }), {
    httpOnly: true,
    secure: isSecureOrigin(),
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  const redirectUri = new URL("/api/auth/callback", e.APP_URL).toString();
  return NextResponse.redirect(buildAuthUrl({ clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET, redirectUri }, p));
});

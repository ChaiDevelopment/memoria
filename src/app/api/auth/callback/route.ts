import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, getSignedInUser } from "@/server/auth/session";
import { ConfigError, env, rawEnv } from "@/server/env";
import { DRIVE_FILE_SCOPE, exchangeCode } from "@/server/google/oauth";
import { ApiError } from "@/server/http";
import { createUserFolder } from "@/server/invitationService";

const OAUTH_COOKIE = "memora_oauth";
const stored = z.object({
  state: z.string(),
  verifier: z.string(),
  nonce: z.string(),
  next: z.string(),
  /** "drive": the creator allowed MEMORA to make their invitation's folder. */
  purpose: z.literal("drive").optional(),
  keyword: z.string().optional(),
});

/** Google redirects here after the user picks an account (sign-in) or grants Drive access (invitation folder). */
export async function GET(request: Request) {
  const appUrl = rawEnv("APP_URL") ?? new URL(request.url).origin;
  const toLogin = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, appUrl));
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/api/auth" });

  let parsed: z.infer<typeof stored> | null = null;
  try {
    parsed = raw ? stored.parse(JSON.parse(raw)) : null;
  } catch {
    parsed = null;
  }
  const toInvitations = (error: string) =>
    NextResponse.redirect(new URL(`/invitations?folder_error=${error}${parsed?.keyword ? `&folder=${encodeURIComponent(parsed.keyword)}` : ""}`, appUrl));

  try {
    const e = env();
    const url = new URL(request.url);
    const drive = parsed?.purpose === "drive";
    if (url.searchParams.get("error")) return drive ? toInvitations("cancelled") : toLogin("cancelled");
    const code = url.searchParams.get("code");
    if (!parsed || !code || url.searchParams.get("state") !== parsed.state) return drive ? toInvitations("expired") : toLogin("expired");

    const { identity, accessToken, scopes } = await exchangeCode(
      { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET, redirectUri: new URL("/api/auth/callback", e.APP_URL).toString() },
      code,
      parsed.verifier,
      parsed.nonce,
    );

    if (drive && parsed.keyword) {
      // The folder is made with this access once, in the signed-in creator's own Drive.
      const user = await getSignedInUser();
      if (!user || user.email !== identity.email) return toInvitations("wrong_account");
      if (!accessToken || !scopes.includes(DRIVE_FILE_SCOPE)) return toInvitations("denied");
      await createUserFolder(parsed.keyword, user, accessToken);
      return NextResponse.redirect(new URL(parsed.next, appUrl));
    }

    // Anyone may sign in; museum access is still limited to ALLOWED_EMAILS (see session.ts).
    await createSession(identity);
    return NextResponse.redirect(new URL(parsed.next, appUrl));
  } catch (err) {
    console.error("[MEMORA] Google callback failed:", err);
    if (parsed?.purpose === "drive") return toInvitations("failed");
    if (err instanceof ConfigError) return toLogin("not_configured");
    return toLogin(err instanceof ApiError ? err.code : "failed");
  }
}

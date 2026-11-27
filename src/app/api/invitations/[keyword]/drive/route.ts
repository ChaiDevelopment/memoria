import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireSignedIn } from "@/server/auth/session";
import { env, isSecureOrigin } from "@/server/env";
import { buildAuthUrl, createPkce, DRIVE_FILE_SCOPE } from "@/server/google/oauth";
import { handler } from "@/server/http";
import { managedInvitation } from "@/server/invitationService";

type Ctx = { params: Promise<{ keyword: string }> };
const OAUTH_COOKIE = "memora_oauth";

/**
 * Step 2 of "Create your invitation": ask Google for permission to create
 * the invitation's folder in the creator's own My Drive (drive.file only —
 * MEMORA never sees the rest of their Drive). Google returns to
 * /api/auth/callback, which makes the folder.
 */
export const GET = handler(async (_request: Request, ctx: Ctx) => {
  const user = await requireSignedIn();
  const inv = await managedInvitation((await ctx.params).keyword, user);
  const e = env();
  const p = await createPkce();
  (await cookies()).set(
    OAUTH_COOKIE,
    JSON.stringify({ state: p.state, verifier: p.verifier, nonce: p.nonce, next: `/invitations?folder=${encodeURIComponent(inv.keyword)}`, purpose: "drive", keyword: inv.keyword }),
    { httpOnly: true, secure: isSecureOrigin(), sameSite: "lax", path: "/api/auth", maxAge: 600 },
  );
  const redirectUri = new URL("/api/auth/callback", e.APP_URL).toString();
  return NextResponse.redirect(buildAuthUrl({ clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET, redirectUri }, p, { extraScopes: [DRIVE_FILE_SCOPE], loginHint: user.email }));
});

import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { signValue, verifyValue } from "../crypto";
import { env, isSecureOrigin } from "../env";
import { ApiError } from "../http";

/**
 * Stateless sessions: the cookie holds the signed-in Google identity plus an
 * expiry, signed with HMAC-SHA256 (SESSION_SECRET). Nothing is stored on the
 * server, so no database is needed. The allow-list is checked on every
 * request, so removing an email from ALLOWED_EMAILS locks it out at once.
 */

export const SESSION_COOKIE = "memora_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  email: string;
  name: string | null;
  picture: string | null;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

export function isAllowed(email: string, allowed: string[]): boolean {
  return allowed.includes(email.trim().toLowerCase());
}

export async function createSession(user: SessionUser) {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const value = await signValue({ ...user, exp } satisfies SessionPayload, env().SESSION_SECRET);
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: isSecureOrigin(),
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
}

export async function readSession(value: string | undefined, secret: string, allowed: string[], now = Date.now()): Promise<SessionUser | null> {
  if (!value) return null;
  const payload = await verifyValue<SessionPayload>(value, secret);
  if (!payload || typeof payload.exp !== "number" || payload.exp <= now) return null;
  if (!isAllowed(payload.email, allowed)) return null;
  return { email: payload.email, name: payload.name, picture: payload.picture };
}

/** The signed-in user for this request (memoised), or null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const e = env();
  return readSession((await cookies()).get(SESSION_COOKIE)?.value, e.SESSION_SECRET, e.ALLOWED_EMAILS);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "unauthenticated", "Please sign in first.");
  return user;
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

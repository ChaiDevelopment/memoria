import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { env, isSecureOrigin } from "../env";
import { ApiError } from "../http";
import { worldSettings } from "../photos/service";
import { issueVisitorPass, readVisitorPass, VISITOR_COOKIE, type Visitor, type WorldSettings } from "../worldAccess";
import { getCurrentUser, type SessionUser } from "./session";

/**
 * Who is looking at the museum: an owner (signed in with Google and on the
 * allow-list — full access) or a visitor who joined with the keyword
 * (read-only). Endpoints that only read the museum accept either; anything
 * that changes it keeps using requireUser().
 */
export type Viewer = { role: "owner"; id: string; name: string; user: SessionUser } | { role: "visitor"; id: string; name: string };

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getCurrentUser();
  if (user) return { role: "owner", id: user.email, name: user.name?.trim().split(/\s+/)[0] || user.email.split("@")[0]!, user };
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!value) return null;
  const visitor = await readVisitorPass(value, env().SESSION_SECRET, await worldSettings());
  return visitor ? { role: "visitor", id: visitor.id, name: visitor.name } : null;
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError(401, "unauthenticated", "Join the museum with its keyword, or sign in.");
  return viewer;
}

export async function grantVisitorPass(visitor: Visitor, settings: WorldSettings) {
  const pass = await issueVisitorPass(visitor, settings, env().SESSION_SECRET);
  (await cookies()).set(VISITOR_COOKIE, pass.value, {
    httpOnly: true,
    secure: isSecureOrigin(),
    sameSite: "lax",
    path: "/",
    expires: pass.expires,
  });
}

export async function clearVisitorPass() {
  (await cookies()).delete(VISITOR_COOKIE);
}

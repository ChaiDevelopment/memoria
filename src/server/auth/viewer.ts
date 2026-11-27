import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { env, isSecureOrigin } from "../env";
import { ApiError } from "../http";
import { invitationByHash } from "../invitationService";
import { coupleRoleOf, type Invitation } from "../invitations";
import { worldSettings } from "../photos/service";
import { decodeVisitorPass, issueVisitorPass, keywordHash, VISITOR_COOKIE, type Visitor, type WorldSettings } from "../worldAccess";
import { getCurrentUser, getSignedInUser, type SessionUser } from "./session";

/**
 * Which world someone is in, and as whom.
 *
 * - The museum: its admins (Google + ALLOWED_EMAILS) are "owner"; anyone who
 *   joined with the museum keyword is a read-only "visitor".
 * - A wedding invitation: guests who joined with its keyword are "visitor";
 *   the two Google accounts locked into the couple's seats are "bride" and
 *   "groom" (decided here, on the server — a guest can never claim it).
 *
 * The visitor pass cookie says which world; a signed-in admin without a pass
 * is in the museum, as before.
 */
export type WorldRef = { kind: "museum"; name: string } | { kind: "invitation"; invitation: Invitation };
/** owner = the admins' museum; host = whoever created this museum world; bride / groom = a wedding's couple. */
export type ViewerRole = "owner" | "visitor" | "bride" | "groom" | "host";

export interface Viewer {
  world: WorldRef;
  role: ViewerRole;
  /** Stable id: the Google email for signed-in people, the pass id for guests. */
  id: string;
  name: string;
  /** Present for signed-in Google accounts. */
  user: SessionUser | null;
}

const firstName = (u: SessionUser) => u.name?.trim().split(/\s+/)[0] || u.email.split("@")[0]!;

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const admin = await getCurrentUser();
  const signedIn = admin ?? (await getSignedInUser());
  const pass = await decodeVisitorPass((await cookies()).get(VISITOR_COOKIE)?.value, env().SESSION_SECRET);

  if (pass) {
    const museum = await worldSettings();
    if (museum?.published && pass.kh === (await keywordHash(museum.keyword))) {
      if (admin) return { world: { kind: "museum", name: museum.name }, role: "owner", id: admin.email, name: firstName(admin), user: admin };
      return { world: { kind: "museum", name: museum.name }, role: "visitor", id: pass.id, name: pass.name, user: signedIn };
    }
    const inv = await invitationByHash(pass.kh);
    if (inv?.published) {
      if (inv.theme === "museum" && signedIn && signedIn.email.toLowerCase() === inv.owner) {
        return { world: { kind: "invitation", invitation: inv }, role: "host", id: signedIn.email, name: pass.name, user: signedIn };
      }
      const couple = inv.theme === "wedding" ? coupleRoleOf(inv, signedIn?.email) : null;
      if (couple && signedIn) return { world: { kind: "invitation", invitation: inv }, role: couple, id: signedIn.email, name: pass.name, user: signedIn };
      return { world: { kind: "invitation", invitation: inv }, role: "visitor", id: pass.id, name: pass.name, user: signedIn };
    }
  }
  if (admin) {
    const museum = await worldSettings().catch(() => null);
    return { world: { kind: "museum", name: museum?.name ?? "MEMORA" }, role: "owner", id: admin.email, name: firstName(admin), user: admin };
  }
  return null;
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new ApiError(401, "unauthenticated", "Join the museum with its keyword, or sign in.");
  return viewer;
}

export async function grantVisitorPass(visitor: Visitor, world: Pick<WorldSettings, "keyword">) {
  const pass = await issueVisitorPass(visitor, world, env().SESSION_SECRET);
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

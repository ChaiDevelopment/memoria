import { getSignedInUser, isAdmin } from "@/server/auth/session";
import { getViewer } from "@/server/auth/viewer";
import { handler, json } from "@/server/http";

/**
 * Who is here and where: the signed-in Google account (if any), the world
 * they are in (museum or invitation) and their role there.
 */
export const GET = handler(async () => {
  const [viewer, user] = await Promise.all([getViewer(), getSignedInUser()]);
  const world = !viewer
    ? null
    : viewer.world.kind === "museum"
      ? { kind: "museum" as const, name: viewer.world.name }
      : { kind: "invitation" as const, theme: viewer.world.invitation.theme, name: viewer.world.invitation.title, keyword: viewer.world.invitation.keyword };
  return json(
    {
      user: user ? { ...user, admin: isAdmin(user.email) } : null,
      viewer: viewer ? { role: viewer.role, name: viewer.name } : null,
      world,
    },
    { headers: { "cache-control": "no-store" } },
  );
});

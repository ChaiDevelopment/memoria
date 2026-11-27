import { getViewer } from "@/server/auth/viewer";
import { signValue } from "@/server/crypto";
import { env, rawEnv } from "@/server/env";
import { ApiError, handler, json } from "@/server/http";
import { keywordHash } from "@/server/worldAccess";
import { PRESENCE_ROOM, TOKEN_TTL_MS, type PresenceTokenClaims } from "@/shared/presence";

/**
 * Issues a one-minute ticket for the multiplayer presence server. Each world
 * has its own room (the museum, or one per invitation); keyword visitors are
 * marked as guests and the couple as bride / groom — decided by this server,
 * never by the browser. The presence Worker verifies it with SESSION_SECRET.
 */
export const GET = handler(async () => {
  // Signed-out visitors simply play solo: answer normally (no 401 noise in the console).
  const viewer = await getViewer();
  if (!viewer) return json({ token: null, url: null }, { headers: { "cache-control": "no-store" } });
  const url = rawEnv("PRESENCE_URL");
  if (!url) throw new ApiError(503, "presence_not_configured", "Multiplayer is not configured on this server.");
  const room = viewer.world.kind === "museum" ? PRESENCE_ROOM : `inv-${await keywordHash(viewer.world.invitation.keyword)}`;
  const exp = Date.now() + TOKEN_TTL_MS;
  const claims: PresenceTokenClaims =
    viewer.role === "owner"
      ? { email: viewer.id, name: viewer.user?.name ?? viewer.name, room, exp }
      : viewer.role === "host"
        ? { email: viewer.id, name: viewer.name, room, exp }
      : viewer.role === "bride" || viewer.role === "groom"
        ? { email: viewer.id, name: viewer.name, room, exp, couple: viewer.role }
        : { email: `guest-${viewer.id}@visitor.memora`, name: viewer.name, room, exp, guest: true };
  const token = await signValue(claims, env().SESSION_SECRET);
  return json({ token, url: url.replace(/\/+$/, "") }, { headers: { "cache-control": "no-store" } });
});

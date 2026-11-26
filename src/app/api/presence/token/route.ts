import { getViewer } from "@/server/auth/viewer";
import { signValue } from "@/server/crypto";
import { env, rawEnv } from "@/server/env";
import { ApiError, handler, json } from "@/server/http";
import { PRESENCE_ROOM, TOKEN_TTL_MS, type PresenceTokenClaims } from "@/shared/presence";

/**
 * Issues a one-minute ticket for the multiplayer presence server: to owners
 * (signed in and allow-listed) and to keyword visitors (marked as guests).
 * The presence Worker verifies it with the same SESSION_SECRET.
 */
export const GET = handler(async () => {
  // Signed-out visitors simply play solo: answer normally (no 401 noise in the console).
  const viewer = await getViewer();
  if (!viewer) return json({ token: null, url: null }, { headers: { "cache-control": "no-store" } });
  const url = rawEnv("PRESENCE_URL");
  if (!url) throw new ApiError(503, "presence_not_configured", "Multiplayer is not configured on this server.");
  const claims: PresenceTokenClaims =
    viewer.role === "owner"
      ? { email: viewer.user.email, name: viewer.user.name ?? "", room: PRESENCE_ROOM, exp: Date.now() + TOKEN_TTL_MS }
      : { email: `guest-${viewer.id}@visitor.memora`, name: viewer.name, room: PRESENCE_ROOM, exp: Date.now() + TOKEN_TTL_MS, guest: true };
  const token = await signValue(claims, env().SESSION_SECRET);
  return json({ token, url: url.replace(/\/+$/, "") }, { headers: { "cache-control": "no-store" } });
});

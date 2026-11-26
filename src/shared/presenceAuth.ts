import { verifyValue } from "../server/crypto";
import type { PresenceTokenClaims } from "./presence";

/**
 * Verifies a presence ticket (signed by the main app with SESSION_SECRET).
 * Used by the presence Worker; pure Web Crypto, so it is unit tested in Node.
 */
export async function authorize(token: string | null, secret: string | undefined, now = Date.now()): Promise<PresenceTokenClaims | null> {
  if (!token || !secret) return null;
  const claims = await verifyValue<PresenceTokenClaims>(token, secret);
  if (!claims || typeof claims.exp !== "number" || claims.exp < now) return null;
  if (typeof claims.email !== "string" || typeof claims.room !== "string") return null;
  return claims;
}

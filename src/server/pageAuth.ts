import "server-only";
import { getCurrentUser, getSignedInUser, type SessionUser } from "./auth/session";
import { ConfigError } from "./env";

/**
 * For server-rendered pages: resolves the user, but turns a missing server
 * configuration into a friendly setup message instead of an error page.
 */
export async function pageUser(): Promise<{ user: SessionUser | null; signedIn: SessionUser | null; configError: string | null }> {
  try {
    return { user: await getCurrentUser(), signedIn: await getSignedInUser(), configError: null };
  } catch (err) {
    if (err instanceof ConfigError) return { user: null, signedIn: null, configError: err.message };
    throw err;
  }
}

/** Only allow same-site relative redirect targets (prevents open redirects). */
export function safeNext(next: string | string[] | undefined, fallback = "/photos"): string {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}

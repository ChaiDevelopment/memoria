import { base64UrlDecodeText, randomToken, sha256Base64Url } from "../crypto";
import { ApiError } from "../http";

/**
 * "Sign in with Google" (OpenID Connect, authorization code + PKCE).
 * Only basic identity scopes are requested — MEMORA never touches the
 * user's own Drive; photos are read by the server's service account.
 */

export const SCOPES = ["openid", "email", "profile"];
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export async function createPkce() {
  const verifier = randomToken(48);
  return { verifier, challenge: await sha256Base64Url(verifier), state: randomToken(24), nonce: randomToken(16) };
}

export function buildAuthUrl(cfg: OAuthClientConfig, p: { state: string; challenge: string; nonce: string }): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export interface GoogleIdentity {
  email: string;
  name: string | null;
  picture: string | null;
}

/**
 * Exchanges the code and returns the verified identity. The ID token comes
 * straight from Google's token endpoint over TLS (authenticated with our
 * client secret), so per OpenID Connect §3.1.3.7 its signature need not be
 * re-checked; issuer, audience, expiry, nonce and email verification are.
 */
export async function exchangeCodeForIdentity(
  cfg: OAuthClientConfig,
  code: string,
  verifier: string,
  expectedNonce: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleIdentity> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !data.id_token) throw new ApiError(502, "google_token_error", `Google sign-in failed (${data.error ?? res.status}).`);
  return identityFromIdToken(data.id_token, cfg.clientId, expectedNonce);
}

export function identityFromIdToken(idToken: string, clientId: string, expectedNonce: string, now = Date.now()): GoogleIdentity {
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(base64UrlDecodeText(idToken.split(".")[1] ?? "")) as Record<string, unknown>;
  } catch {
    throw new ApiError(502, "google_token_error", "Google returned an unreadable sign-in token.");
  }
  const issOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const audOk = claims.aud === clientId;
  const expOk = typeof claims.exp === "number" && claims.exp * 1000 > now;
  const nonceOk = claims.nonce === expectedNonce;
  if (!issOk || !audOk || !expOk || !nonceOk) throw new ApiError(401, "google_token_invalid", "Google sign-in could not be verified. Please try again.");
  if (typeof claims.email !== "string" || claims.email_verified !== true) {
    throw new ApiError(403, "email_unverified", "Your Google account email is not verified.");
  }
  return {
    email: claims.email.toLowerCase(),
    name: typeof claims.name === "string" ? claims.name : null,
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
}

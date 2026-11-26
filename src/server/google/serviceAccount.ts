import { importRsaPrivateKey, signJwtRs256 } from "../crypto";
import { ApiError } from "../http";

/**
 * Access tokens for the Google *service account* (OAuth 2.0 JWT bearer
 * flow). The service account is a robot identity of your Google Cloud
 * project: share the Drive folder and the Sheet with its email address and
 * the server can read/write them — no user tokens need to be stored.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const SA_SCOPES = ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/spreadsheets"];

export interface ServiceAccountConfig {
  email: string;
  privateKeyPem: string;
}

let cache: { token: string; expiresAt: number; email: string } | null = null;

export async function serviceAccountToken(cfg: ServiceAccountConfig, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<string> {
  if (cache && cache.email === cfg.email && cache.expiresAt - 60_000 > now) return cache.token;

  let key: CryptoKey;
  try {
    key = await importRsaPrivateKey(cfg.privateKeyPem);
  } catch {
    throw new ApiError(503, "not_configured", "GOOGLE_SERVICE_ACCOUNT_KEY is not a valid private key. Copy the whole private_key value from the JSON key file.");
  }
  const iat = Math.floor(now / 1000);
  const assertion = await signJwtRs256({ iss: cfg.email, scope: SA_SCOPES.join(" "), aud: TOKEN_URL, iat, exp: iat + 3600 }, key);
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new ApiError(503, "service_account_error", `Google rejected the service account (${data.error_description ?? data.error ?? res.status}).`);
  }
  cache = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) * 1000, email: cfg.email };
  return data.access_token;
}

/** For tests. */
export function clearServiceAccountCache() {
  cache = null;
}

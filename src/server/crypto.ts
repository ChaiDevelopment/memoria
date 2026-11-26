/**
 * Small Web Crypto helpers. Only standard web APIs are used, so the same
 * code runs on Node (local dev) and on Cloudflare Workers (production).
 */

const encoder = new TextEncoder();

export function base64UrlEncode(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === "string" ? encoder.encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function base64UrlDecodeText(input: string): string {
  return new TextDecoder().decode(base64UrlDecode(input));
}

export function randomToken(bytes = 32): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Base64Url(value: string): Promise<string> {
  return base64UrlEncode(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", base64UrlDecode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Signs `payload` (any JSON) → "<payload>.<signature>". */
export async function signValue(payload: unknown, secret: string): Promise<string> {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${base64UrlEncode(sig)}`;
}

/** Verifies a value produced by `signValue`; returns the payload or null. Constant-time via WebCrypto verify. */
export async function verifyValue<T>(token: string, secret: string): Promise<T | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), base64UrlDecode(sig), encoder.encode(body));
    return ok ? (JSON.parse(base64UrlDecodeText(body)) as T) : null;
  } catch {
    return null;
  }
}

/** Imports a PEM (PKCS#8) RSA private key for RS256 signing. */
export async function importRsaPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export async function signJwtRs256(claims: Record<string, unknown>, key: CryptoKey): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(claims));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${base64UrlEncode(sig)}`;
}

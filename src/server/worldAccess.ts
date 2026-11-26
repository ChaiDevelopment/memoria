import { sha256Base64Url, signValue, verifyValue } from "./crypto";

/**
 * Keyword access to the museum ("Join World"). Pure logic — unit tested.
 *
 * The museum's public settings live in the Sheet's "Settings" tab
 * (Setting | Value): Keyword, Museum name, Published. Anyone who knows the
 * keyword may visit (read-only) — the keyword is an invitation, not a
 * password. Visitors get a signed, expiring visitor pass; it stops working
 * as soon as the museum is unpublished or its keyword changes.
 */

export const SETTINGS_TAB = "Settings";
export const SETTINGS_HEADER = ["Setting", "Value"] as const;
export const VISITOR_COOKIE = "memora_visitor";
export const VISITOR_PASS_DAYS = 3;
export const MAX_VISITOR_NAME = 24;
const KEYWORD_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;

export interface WorldSettings {
  keyword: string;
  name: string;
  published: boolean;
}

export interface Visitor {
  id: string;
  name: string;
}

interface VisitorPass extends Visitor {
  v: 1;
  /** Hash of the keyword the pass was issued for. */
  kh: string;
  exp: number;
}

/** Case-insensitive, whitespace-insensitive keyword form. */
export function normalizeKeyword(raw: unknown): string {
  return typeof raw === "string" ? raw.normalize("NFKC").replace(/\s+/g, "").toLowerCase() : "";
}

export function isValidKeyword(keyword: string): boolean {
  return KEYWORD_RE.test(keyword);
}

/** A display-safe visitor name, or null when nothing usable remains. */
export function sanitizeVisitorName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw
    .normalize("NFKC")
    // Control characters, angle brackets and zero-width characters.
    .replace(/[\u0000-\u001f\u007f-\u009f<>\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return [...clean].slice(0, MAX_VISITOR_NAME).join("").trim();
}

const truthy = (v: string) => /^(true|yes|ya|1|x|published)$/i.test(v.trim());

/** Reads the Setting | Value rows. Returns null when there is no keyword. */
export function parseSettings(values: readonly unknown[][]): WorldSettings | null {
  const map = new Map<string, string>();
  for (const row of values) {
    const key = String(row[0] ?? "").trim().toLowerCase();
    if (key) map.set(key, String(row[1] ?? "").trim());
  }
  const keyword = normalizeKeyword(map.get("keyword") ?? "");
  if (!isValidKeyword(keyword)) return null;
  return {
    keyword,
    name: (map.get("museum name") ?? map.get("name") ?? "").slice(0, 80) || "MEMORA",
    published: truthy(map.get("published") ?? "true"),
  };
}

export async function keywordHash(keyword: string): Promise<string> {
  return (await sha256Base64Url(`memora-world:${normalizeKeyword(keyword)}`)).slice(0, 22);
}

/** Does `keyword` open this (published) world? Unpublished worlds match nothing. */
export async function matchesWorld(keyword: string, settings: WorldSettings | null): Promise<boolean> {
  if (!settings || !settings.published) return false;
  const k = normalizeKeyword(keyword);
  if (!isValidKeyword(k)) return false;
  // Compare hashes so the comparison time doesn't depend on the keyword.
  return (await keywordHash(k)) === (await keywordHash(settings.keyword));
}

export async function issueVisitorPass(visitor: Visitor, settings: WorldSettings, secret: string, now = Date.now()): Promise<{ value: string; expires: Date }> {
  const exp = now + VISITOR_PASS_DAYS * 86_400_000;
  const pass: VisitorPass = { v: 1, id: visitor.id, name: visitor.name, kh: await keywordHash(settings.keyword), exp };
  return { value: await signValue(pass, secret), expires: new Date(exp) };
}

/** The visitor behind a pass, or null if it is forged, expired, or the world closed / changed keyword. */
export async function readVisitorPass(value: string | undefined, secret: string, settings: WorldSettings | null, now = Date.now()): Promise<Visitor | null> {
  if (!value || !settings || !settings.published) return null;
  const pass = await verifyValue<VisitorPass>(value, secret);
  if (!pass || pass.v !== 1 || typeof pass.exp !== "number" || pass.exp <= now) return null;
  if (pass.kh !== (await keywordHash(settings.keyword))) return null;
  const name = sanitizeVisitorName(pass.name);
  if (!name || typeof pass.id !== "string" || !/^[A-Za-z0-9_-]{6,40}$/.test(pass.id)) return null;
  return { id: pass.id, name };
}

/** Best-effort, per-instance attempt limiter (no database). */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

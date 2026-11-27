/**
 * Multiplayer presence protocol, shared by the browser and the presence
 * Worker (presence/). Pure TypeScript — no DOM, Node or Workers APIs — so it
 * runs on both sides and is unit tested.
 *
 * Transport: one WebSocket per visitor to a Durable Object ("room").
 * Client → server: { t: "state", s } at most a few times per second, only
 *   while something changed; and the text "ping" as keep-alive (answered by
 *   the platform without waking the object).
 * Server → client: welcome / join / leave / state / full.
 */

export const PRESENCE_ROOM = "main";
export const MAX_PEERS = 16;
/** Minimum time between accepted state updates from one visitor (ms). */
export const MIN_STATE_INTERVAL_MS = 100;
export const TOKEN_TTL_MS = 60_000;
export const PING_MESSAGE = "ping";
export const PONG_MESSAGE = "pong";

export const PEER_ANIMATIONS = ["idle", "walk", "run", "jump", "inspect", "sit"] as const;
export type PeerAnimation = (typeof PEER_ANIMATIONS)[number];

export interface PeerState {
  x: number;
  y: number;
  z: number;
  /** Facing yaw (radians, 0 = +Z). */
  f: number;
  a: PeerAnimation;
  /** Horizontal speed (m/s) and vertical velocity — drive the remote animator. */
  v: number;
  vy: number;
}

export interface PeerInfo {
  id: string;
  name: string;
  /** Joined with the museum keyword (not an owner). */
  guest?: boolean;
  /** One of the couple in a wedding invitation (wears the wedding outfit). */
  couple?: "bride" | "groom";
  /** Index into SWEATER_COLORS. */
  color: number;
}

export type ClientMessage = { t: "state"; s: PeerState };

export type ServerMessage =
  | { t: "welcome"; id: string; peers: (PeerInfo & { s: PeerState | null })[] }
  | { t: "join"; peer: PeerInfo }
  | { t: "leave"; id: string }
  | { t: "state"; id: string; s: PeerState }
  | { t: "full" };

/** Claims inside the short-lived token issued by /api/presence/token. */
export interface PresenceTokenClaims {
  email: string;
  name: string;
  room: string;
  exp: number;
  /** A keyword visitor rather than an owner. */
  guest?: boolean;
  /** The bride or groom of the invitation whose room this is. */
  couple?: "bride" | "groom";
}

/** Friends' sweaters (the local player keeps the signature mustard). */
export const SWEATER_COLORS = ["#5b8fb9", "#7fae6a", "#c96f8a", "#9b7bc4", "#e07b4f", "#4fa59b", "#c9a227", "#8a6f5a"] as const;

/** Stable colour per person (same email → same colour on every visit). */
export function colorIndexFor(email: string): number {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % SWEATER_COLORS.length;
}

/** Display name: the Google name's first word, else the email's local part. */
export function displayName(name: string | null | undefined, email: string): string {
  const first = name?.trim().split(/\s+/)[0];
  const base = first || email.split("@")[0] || "Visitor";
  return base.slice(0, 20);
}

/** Guests and couples typed their own name ("Pak Budi"): keep all of it, not just the first word. */
export function chosenName(name: string | null | undefined, email: string): string {
  const full = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 24);
  return full || displayName(null, email);
}

const finite = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;

/** Validates and clamps a state from an untrusted client. Returns null if malformed. */
export function sanitizeState(raw: unknown): PeerState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const x = finite(r.x, -500, 500);
  const y = finite(r.y, -10, 80);
  const z = finite(r.z, -500, 500);
  const f = finite(r.f, -100, 100);
  const v = finite(r.v, 0, 20);
  const vy = finite(r.vy, -40, 40);
  const a = typeof r.a === "string" && (PEER_ANIMATIONS as readonly string[]).includes(r.a) ? (r.a as PeerAnimation) : null;
  if (x === null || y === null || z === null || f === null || v === null || vy === null || a === null) return null;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round(x), y: round(y), z: round(z), f: round(f), a, v: round(v), vy: round(vy) };
}

/** Parses a raw client frame. Anything unexpected is ignored (null). */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "string" || raw.length > 512) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || (data as { t?: unknown }).t !== "state") return null;
  const s = sanitizeState((data as { s?: unknown }).s);
  return s ? { t: "state", s } : null;
}

export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const data = JSON.parse(raw) as ServerMessage;
    return data && typeof data === "object" && typeof data.t === "string" ? data : null;
  } catch {
    return null;
  }
}

/** True when the new state differs enough from the last sent one to be worth sending. */
export function stateChanged(prev: PeerState | null, next: PeerState): boolean {
  if (!prev) return true;
  return (
    prev.a !== next.a ||
    Math.abs(prev.x - next.x) > 0.03 ||
    Math.abs(prev.y - next.y) > 0.03 ||
    Math.abs(prev.z - next.z) > 0.03 ||
    Math.abs(prev.f - next.f) > 0.05
  );
}

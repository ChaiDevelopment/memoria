import { z } from "zod";
import { isValidKeyword, normalizeKeyword } from "./worldAccess";

/**
 * Worlds people create ("Create your world"): a memory museum or a wedding
 * invitation. Pure logic — unit tested. (Older names say "invitation"; a
 * museum world is the same record with theme "museum".)
 *
 * Every world is one row of the admin's Sheet, tab "Worlds":
 *
 *   A Keyword | B Theme | C Title | D Owner | E Folder | F Published | G Created
 *   H Bride email | I Groom email | J Pair code (hash) | K Details (JSON)
 *
 * Weddings: the creator is one of the couple. The partner joins through a
 * one-time "Link Pasangan" (its hash lives in column J until it is used);
 * after that both seats are locked to those two Google accounts, which is
 * what gives them the wedding outfits in the 3D venue. Museums have no
 * couple: the creator is its host. Guests only ever need the keyword.
 */

export const INVITATIONS_TAB = "Worlds";
export const INVITATIONS_LAST_COL = "K";
export const INVITATIONS_HEADER = ["Keyword", "Theme", "Title", "Owner", "Folder", "Published", "Created", "Bride email", "Groom email", "Pair code", "Details"] as const;
export const WISHES_TAB = "Wishes";
export const WISHES_LAST_COL = "E";
export const WISHES_HEADER = ["Time", "Keyword", "Name", "Message", "Role"] as const;

export const MAX_INVITATIONS_PER_OWNER = 3;
export const MAX_INVITATION_PHOTOS = 300;
/** A museum grows halls for its photos, so it may hold many more. */
export const MAX_MUSEUM_PHOTOS = 1000;

/** Words that can never be an invitation keyword. */
const RESERVED = new Set(["admin", "api", "login", "logout", "photos", "invitations", "invitation", "pair", "privacy", "memora", "museum", "create", "world", "help"]);

export type CoupleRole = "bride" | "groom";

const text = (max: number) => z.string().trim().max(max).default("");
const MAPS_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+|www\.google\.[a-z.]+|google\.[a-z.]+)$/i;

const eventSchema = z.object({
  label: z.string().trim().min(1, "Beri nama acaranya, misalnya Akad Nikah").max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal acara belum diisi"),
  time: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).default(""),
  endTime: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).default(""),
  place: text(80),
  address: text(200),
  mapsUrl: z
    .string()
    .trim()
    .max(300)
    .default("")
    .refine((v) => v === "" || isMapsUrl(v), "Link lokasi harus link Google Maps (https://maps.app.goo.gl/…)"),
});

const bankSchema = z.object({
  bank: z.string().trim().min(1, "Nama bank / e-wallet belum diisi").max(30),
  number: z.string().trim().regex(/^[0-9][0-9 .-]{3,29}$/, "Nomor rekening hanya angka (boleh spasi atau tanda -)"),
  holder: z.string().trim().min(1, "Nama pemilik rekening belum diisi").max(60),
});

export const weddingDetailsSchema = z.object({
  brideName: z.string().trim().min(1, "Nama mempelai wanita belum diisi").max(40),
  groomName: z.string().trim().min(1, "Nama mempelai pria belum diisi").max(40),
  setting: z.enum(["outdoor", "indoor"]).default("outdoor"),
  welcome: text(400),
  events: z.array(eventSchema).max(3).default([]),
  banks: z.array(bankSchema).max(3).default([]),
});
export type WeddingDetails = z.infer<typeof weddingDetailsSchema>;
export type WeddingEvent = WeddingDetails["events"][number];
export type BankAccount = WeddingDetails["banks"][number];

export const museumDetailsSchema = z.object({
  name: z.string().trim().min(1, "Beri nama museummu").max(60),
  welcome: text(400),
});
export type MuseumDetails = z.infer<typeof museumDetailsSchema>;

const agree = z.literal(true, { error: "Centang persetujuan dulu ya" });
export const createInvitationSchema = z.discriminatedUnion("theme", [
  z.object({
    theme: z.literal("wedding"),
    keyword: z.string(),
    role: z.enum(["bride", "groom"]),
    details: weddingDetailsSchema,
    /** The creator read the privacy notice (admin can see worlds). */
    agree,
  }),
  z.object({ theme: z.literal("museum"), keyword: z.string(), details: museumDetailsSchema, agree }),
]);

/** Only Google Maps links: a guest tapping "Buka Maps" must never land on an arbitrary site. */
export function isMapsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || !MAPS_HOSTS.test(u.hostname)) return false;
  const host = u.hostname.toLowerCase();
  if (host === "maps.app.goo.gl" || host.startsWith("maps.google.")) return true;
  // goo.gl and google.* links must point at Maps, not at other Google pages.
  return u.pathname.startsWith("/maps");
}

interface WorldBase {
  /** 1-based Sheet row. */
  row: number;
  keyword: string;
  title: string;
  owner: string;
  folderId: string;
  published: boolean;
  created: string;
  brideEmail: string;
  groomEmail: string;
  pairCodeHash: string;
}
export type WeddingInvitation = WorldBase & { theme: "wedding"; details: WeddingDetails };
export type MuseumWorldRow = WorldBase & { theme: "museum"; details: MuseumDetails };
/** A created world: a wedding invitation or a memory museum. */
export type Invitation = WeddingInvitation | MuseumWorldRow;
export type WorldTheme = Invitation["theme"];

const email = (v: unknown) => String(v ?? "").trim().toLowerCase();
const truthy = (v: unknown) => /^(true|yes|ya|1|x)$/i.test(String(v ?? "").trim());

/** Rows of the Invitations tab → invitations. Rows without a usable keyword or details are skipped. */
export function parseInvitations(values: readonly unknown[][]): Invitation[] {
  const out: Invitation[] = [];
  values.forEach((row, i) => {
    const keyword = normalizeKeyword(String(row[0] ?? ""));
    if (!isValidKeyword(keyword)) return;
    const theme = String(row[1] ?? "").trim().toLowerCase() === "museum" ? "museum" : "wedding";
    let json: unknown;
    try {
      json = JSON.parse(String(row[10] ?? ""));
    } catch {
      return;
    }
    const themed =
      theme === "museum"
        ? (() => {
            const p = museumDetailsSchema.safeParse(json);
            return p.success ? ({ theme: "museum", details: p.data } as const) : null;
          })()
        : (() => {
            const p = weddingDetailsSchema.safeParse(json);
            return p.success ? ({ theme: "wedding", details: p.data } as const) : null;
          })();
    if (!themed) return;
    out.push({
      ...themed,
      row: i + 2,
      keyword,
      title: String(row[2] ?? "").trim() || titleFor(themed),
      owner: email(row[3]),
      folderId: String(row[4] ?? "").trim(),
      published: row[5] === undefined || String(row[5]).trim() === "" ? true : truthy(row[5]),
      created: String(row[6] ?? "").trim(),
      brideEmail: email(row[7]),
      groomEmail: email(row[8]),
      pairCodeHash: String(row[9] ?? "").trim(),
    } as Invitation);
  });
  return out;
}

/** A world before it has a Sheet row. */
export type NewWorld = Omit<WeddingInvitation, "row"> | Omit<MuseumWorldRow, "row">;

export function invitationToValues(inv: NewWorld): string[] {
  return [
    inv.keyword,
    inv.theme,
    inv.title,
    inv.owner,
    inv.folderId,
    inv.published ? "TRUE" : "FALSE",
    inv.created,
    inv.brideEmail,
    inv.groomEmail,
    inv.pairCodeHash,
    JSON.stringify(inv.details),
  ];
}

export function titleFor(w: { theme: "wedding"; details: Pick<WeddingDetails, "brideName" | "groomName"> } | { theme: "museum"; details: Pick<MuseumDetails, "name"> }): string {
  return w.theme === "museum" ? w.details.name : `The Wedding of ${w.details.groomName} & ${w.details.brideName}`;
}

/** Why a keyword can't be used, or null when it is free. */
export function keywordProblem(raw: string, taken: readonly string[]): string | null {
  const k = normalizeKeyword(raw);
  if (!k) return "Isi kata kunci untuk tamu.";
  if (!isValidKeyword(k)) return "Kata kunci hanya huruf, angka dan tanda - (3–64 karakter).";
  if (RESERVED.has(k)) return "Kata kunci itu tidak bisa dipakai. Coba yang lain.";
  if (taken.includes(k)) return "Kata kunci itu sudah dipakai. Coba yang lain, misalnya tambahkan tanggal.";
  return null;
}

/** The couple seat this account holds in the invitation, if any. */
export function coupleRoleOf(inv: Pick<Invitation, "brideEmail" | "groomEmail">, userEmail: string | null | undefined): CoupleRole | null {
  const e = email(userEmail);
  if (!e) return null;
  if (inv.brideEmail === e) return "bride";
  if (inv.groomEmail === e) return "groom";
  return null;
}

/** Owner or either partner may manage the invitation. */
export function canManage(inv: Pick<Invitation, "owner" | "brideEmail" | "groomEmail">, userEmail: string | null | undefined): boolean {
  const e = email(userEmail);
  return !!e && (inv.owner === e || inv.brideEmail === e || inv.groomEmail === e);
}

/** The still-empty seat the partner link fills (null once both are taken). */
export function openSeat(inv: Pick<Invitation, "brideEmail" | "groomEmail">): CoupleRole | null {
  if (!inv.brideEmail) return "bride";
  if (!inv.groomEmail) return "groom";
  return null;
}

/**
 * Claims the open seat for `userEmail`. Returns the updated seats, or an
 * error code: the link was already used, the account is already the other
 * partner, or both seats are taken.
 */
export function claimSeat(
  inv: Pick<Invitation, "brideEmail" | "groomEmail" | "pairCodeHash">,
  userEmail: string,
  codeHash: string,
): { ok: true; role: CoupleRole; brideEmail: string; groomEmail: string } | { ok: false; code: "invalid_link" | "already_partner" | "seats_taken" } {
  const e = email(userEmail);
  const existing = coupleRoleOf(inv, e);
  if (existing) return { ok: false, code: "already_partner" };
  const seat = openSeat(inv);
  if (!seat) return { ok: false, code: "seats_taken" };
  if (!inv.pairCodeHash || inv.pairCodeHash !== codeHash) return { ok: false, code: "invalid_link" };
  return { ok: true, role: seat, brideEmail: seat === "bride" ? e : inv.brideEmail, groomEmail: seat === "groom" ? e : inv.groomEmail };
}

/** First event's start, as a local wall-clock ISO string (for the countdown). */
export function firstEventStart(d: Pick<WeddingDetails, "events">): string | null {
  const ev = [...d.events].sort((a, b) => `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`))[0];
  return ev ? `${ev.date}T${ev.time || "00:00"}:00` : null;
}

export interface WishRow {
  time: string;
  name: string;
  message: string;
  role: "visitor" | "bride" | "groom" | "host";
}

/** Wishes ("Ucapan & Doa") for one invitation, newest first. */
export function parseWishes(values: readonly unknown[][], keyword: string, limit = 100): WishRow[] {
  const out: WishRow[] = [];
  for (const row of values) {
    if (normalizeKeyword(String(row[1] ?? "")) !== keyword) continue;
    const message = String(row[3] ?? "").trim();
    if (!message) continue;
    const role = String(row[4] ?? "").trim();
    out.push({
      time: String(row[0] ?? "").trim(),
      name: String(row[2] ?? "").trim().slice(0, 40) || "Tamu",
      message: message.slice(0, 280),
      role: role === "bride" || role === "groom" || role === "host" ? role : "visitor",
    });
  }
  return out.reverse().slice(0, limit);
}

/**
 * RSVP ("konfirmasi kehadiran"): one row per guest pass in the Sheet's
 * "RSVP" tab — Time | Keyword | Guest id | Name | Attending | Count.
 * A guest who answers again updates their row.
 */
export const RSVP_TAB = "RSVP";
export const RSVP_LAST_COL = "F";
export const RSVP_HEADER = ["Time", "Keyword", "Guest id", "Name", "Attending", "Count"] as const;
export const MAX_RSVP_COUNT = 10;

/** How many people only matters when attending ("Tidak bisa hadir" ignores it). */
export const rsvpSchema = z
  .object({ attending: z.boolean(), count: z.number().int().optional() })
  .superRefine((v, ctx) => {
    if (!v.attending) return;
    const n = v.count ?? 1;
    if (n < 1) ctx.addIssue({ code: "custom", path: ["count"], message: "Minimal 1 orang" });
    if (n > MAX_RSVP_COUNT) ctx.addIssue({ code: "custom", path: ["count"], message: `Maksimal ${MAX_RSVP_COUNT} orang` });
  })
  .transform((v) => ({ attending: v.attending, count: v.attending ? (v.count ?? 1) : 0 }));

export interface RsvpRow {
  /** 1-based Sheet row. */
  row: number;
  time: string;
  guestId: string;
  name: string;
  attending: boolean;
  count: number;
}

/** This invitation's answers (one per guest — the latest row wins). */
export function parseRsvps(values: readonly unknown[][], keyword: string): RsvpRow[] {
  const byGuest = new Map<string, RsvpRow>();
  values.forEach((r, i) => {
    if (normalizeKeyword(String(r[1] ?? "")) !== keyword) return;
    const guestId = String(r[2] ?? "").trim();
    if (!guestId) return;
    const attending = /^(true|yes|ya|hadir|1)$/i.test(String(r[4] ?? "").trim());
    const count = Math.max(0, Math.min(MAX_RSVP_COUNT, parseInt(String(r[5] ?? ""), 10) || 0));
    byGuest.set(guestId, { row: i + 2, time: String(r[0] ?? "").trim(), guestId, name: String(r[3] ?? "").trim().slice(0, 40) || "Tamu", attending, count: attending ? Math.max(1, count) : 0 });
  });
  return [...byGuest.values()].sort((a, b) => b.time.localeCompare(a.time));
}

export function summarizeRsvps(rows: readonly RsvpRow[]) {
  const yes = rows.filter((r) => r.attending);
  return { attendingGuests: yes.length, attendingPeople: yes.reduce((n, r) => n + r.count, 0), notAttending: rows.length - yes.length };
}

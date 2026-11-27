import "server-only";
import { randomToken, sha256Base64Url } from "./crypto";
import { env } from "./env";
import { DriveClient, takenAtFor } from "./google/drive";
import { ApiError } from "./http";
import {
  canManage,
  claimSeat,
  createInvitationSchema,
  INVITATIONS_HEADER,
  INVITATIONS_LAST_COL,
  INVITATIONS_TAB,
  invitationToValues,
  keywordProblem,
  MAX_INVITATION_PHOTOS,
  MAX_MUSEUM_PHOTOS,
  MAX_INVITATIONS_PER_OWNER,
  parseInvitations,
  parseRsvps,
  parseWishes,
  RSVP_HEADER,
  RSVP_LAST_COL,
  RSVP_TAB,
  rsvpSchema,
  titleFor,
  museumDetailsSchema,
  weddingDetailsSchema,
  WISHES_HEADER,
  WISHES_LAST_COL,
  WISHES_TAB,
  type Invitation,
  type NewWorld,
  type RsvpRow,
  type WeddingDetails,
  type WishRow,
} from "./invitations";
import { clients, folderFiles, worldSettings } from "./photos/service";
import { keywordHash, normalizeKeyword } from "./worldAccess";
import type { SessionUser } from "./auth/session";

/** Invitations live in the admin's Sheet; this caches the tab briefly. */
const CACHE_MS = 30_000;
let cache: { at: number; list: Invitation[]; hashes: Map<string, Invitation> } | null = null;

export async function listInvitations(force = false): Promise<Invitation[]> {
  return (await loadInvitations(force)).list;
}

async function loadInvitations(force: boolean) {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache;
  const { sheets } = await clients();
  const list = parseInvitations(await sheets.readTab(INVITATIONS_TAB, INVITATIONS_LAST_COL));
  const hashes = new Map<string, Invitation>();
  for (const inv of list) hashes.set(await keywordHash(inv.keyword), inv);
  cache = { at: Date.now(), list, hashes };
  return cache;
}

export async function invitationByKeyword(keyword: string, force = false): Promise<Invitation | null> {
  const k = normalizeKeyword(keyword);
  return (await listInvitations(force)).find((i) => i.keyword === k) ?? null;
}

/** The invitation a visitor pass was issued for (by keyword hash). */
export async function invitationByHash(kh: string): Promise<Invitation | null> {
  return (await loadInvitations(false)).hashes.get(kh) ?? null;
}

export async function invitationsOf(user: SessionUser): Promise<Invitation[]> {
  return (await listInvitations(true)).filter((i) => canManage(i, user.email));
}

const safe = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);

async function writeInvitation(inv: Invitation) {
  const { sheets } = await clients();
  await sheets.updateTabRow(INVITATIONS_TAB, inv.row, invitationToValues(inv).map((v, i) => (i === 10 ? v : safe(v))), INVITATIONS_LAST_COL);
  cache = null;
}

/** An invitation the signed-in user may manage, freshly read. */
export async function managedInvitation(keyword: string, user: SessionUser): Promise<Invitation> {
  const inv = await invitationByKeyword(keyword, true);
  if (!inv || !canManage(inv, user.email)) throw new ApiError(404, "invitation_not_found", "Undangan tidak ditemukan.");
  return inv;
}

/**
 * "Create your world": checks the keyword and records the world (a wedding
 * invitation or a memory museum) in the Sheet. Its photo folder is made
 * next, in the creator's own My Drive, once they allow it (createUserFolder).
 */
export async function createInvitation(user: SessionUser, input: unknown): Promise<Invitation> {
  const data = createInvitationSchema.parse(input);
  const email = user.email.trim().toLowerCase();
  const existing = await listInvitations(true);
  if (existing.filter((i) => i.owner === email).length >= MAX_INVITATIONS_PER_OWNER) {
    throw new ApiError(409, "too_many_invitations", `Satu akun bisa membuat maksimal ${MAX_INVITATIONS_PER_OWNER} world.`);
  }
  const museum = await worldSettings(true).catch(() => null);
  const taken = [...existing.map((i) => i.keyword), ...(museum ? [museum.keyword] : [])];
  const problem = keywordProblem(data.keyword, taken);
  if (problem) throw new ApiError(400, "keyword_unavailable", problem);
  const keyword = normalizeKeyword(data.keyword);

  const { sheets } = await clients();
  const base = { keyword, owner: email, folderId: "", published: true, created: new Date().toISOString(), pairCodeHash: "" };
  const inv: NewWorld =
    data.theme === "wedding"
      ? {
          ...base,
          theme: "wedding",
          title: titleFor(data),
          brideEmail: data.role === "bride" ? email : "",
          groomEmail: data.role === "groom" ? email : "",
          details: data.details,
        }
      : { ...base, theme: "museum", title: titleFor(data), brideEmail: "", groomEmail: "", details: data.details };
  await sheets.ensureNamedTab(INVITATIONS_TAB, INVITATIONS_HEADER);
  await sheets.appendToTab(INVITATIONS_TAB, [invitationToValues(inv).map((v, i) => (i === 10 ? v : safe(v)))], INVITATIONS_LAST_COL);
  cache = null;
  const saved = await invitationByKeyword(keyword, true);
  if (!saved) throw new ApiError(502, "sheet_error", "World dibuat, tetapi belum terbaca dari Sheet. Muat ulang halaman sebentar lagi.");
  return saved;
}

/**
 * Creates the invitation's photo folder in the creator's own My Drive, using
 * the access token they just granted (drive.file: only files MEMORA creates),
 * then lets MEMORA's robot read it (and share it with the partner later).
 * The token is used here and thrown away.
 */
export async function createUserFolder(keyword: string, user: SessionUser, userAccessToken: string): Promise<Invitation> {
  const inv = await managedInvitation(keyword, user);
  if (inv.folderId) return inv;
  const mine = new DriveClient(userAccessToken);
  const folderId = await mine.createFolder(`MEMORA · ${inv.title}`);
  await mine.shareWith(folderId, env().GOOGLE_SERVICE_ACCOUNT_EMAIL, "writer");
  // A partner who already joined gets the folder too.
  const me = user.email.trim().toLowerCase();
  for (const partner of [inv.brideEmail, inv.groomEmail]) {
    if (partner && partner !== me) await mine.shareWith(folderId, partner, "writer").catch((err) => console.warn("[MEMORA] Could not share the folder with the partner:", err));
  }
  const next = { ...inv, folderId };
  await writeInvitation(next);
  return next;
}

export async function updateInvitation(keyword: string, user: SessionUser, patch: { details?: unknown; published?: unknown }): Promise<Invitation> {
  const inv = await managedInvitation(keyword, user);
  const published = typeof patch.published === "boolean" ? patch.published : inv.published;
  const next: Invitation =
    inv.theme === "wedding"
      ? (() => {
          const details = patch.details === undefined ? inv.details : weddingDetailsSchema.parse(patch.details);
          return { ...inv, details, published, title: titleFor({ theme: "wedding", details }) };
        })()
      : (() => {
          const details = patch.details === undefined ? inv.details : museumDetailsSchema.parse(patch.details);
          return { ...inv, details, published, title: titleFor({ theme: "museum", details }) };
        })();
  await writeInvitation(next);
  return next;
}

/** A fresh one-time "Link Pasangan" code (only its hash is stored). */
export async function newPairCode(keyword: string, user: SessionUser): Promise<string> {
  const inv = await managedInvitation(keyword, user);
  if (inv.theme !== "wedding") throw new ApiError(400, "not_a_wedding", "Link Pasangan hanya untuk undangan pernikahan.");
  if (inv.brideEmail && inv.groomEmail) throw new ApiError(409, "seats_taken", "Kedua kursi pengantin sudah terisi. Atur ulang pasangan dulu jika perlu.");
  const code = randomToken(18);
  await writeInvitation({ ...inv, pairCodeHash: await sha256Base64Url(`pair:${code}`) });
  return code;
}

/** The partner opens the link and signs in: they take the empty seat, and the link stops working. */
export async function claimPair(keyword: string, user: SessionUser, code: string): Promise<{ invitation: Invitation; role: "bride" | "groom" }> {
  const inv = await invitationByKeyword(keyword, true);
  if (!inv) throw new ApiError(404, "invitation_not_found", "Undangan tidak ditemukan.");
  const result = claimSeat(inv, user.email, await sha256Base64Url(`pair:${code}`));
  if (!result.ok) {
    const messages = {
      invalid_link: "Link pasangan ini sudah tidak berlaku. Minta pasanganmu membuat link baru.",
      already_partner: "Akun ini sudah terdaftar sebagai pengantin di undangan ini.",
      seats_taken: "Kedua kursi pengantin di undangan ini sudah terisi.",
    } as const;
    throw new ApiError(result.code === "already_partner" ? 409 : 410, result.code, messages[result.code]);
  }
  const next = { ...inv, brideEmail: result.brideEmail, groomEmail: result.groomEmail, pairCodeHash: "" };
  await writeInvitation(next);
  if (inv.folderId) {
    // MEMORA's robot is an editor of the creator's folder, so it can add the partner.
    const { drive } = await clients();
    await drive.shareWith(inv.folderId, user.email.trim().toLowerCase(), "writer").catch((err) => console.warn("[MEMORA] Could not share the folder with the partner:", err));
  }
  return { invitation: next, role: result.role };
}

/** Frees the partner's seat (the one that isn't the signed-in user's) and voids any partner link. */
export async function resetPartner(keyword: string, user: SessionUser): Promise<Invitation> {
  const inv = await managedInvitation(keyword, user);
  const me = user.email.trim().toLowerCase();
  const next = { ...inv, pairCodeHash: "", brideEmail: inv.brideEmail === me ? me : "", groomEmail: inv.groomEmail === me ? me : "" };
  await writeInvitation(next);
  return next;
}

export interface InvitationPhoto {
  id: string;
  title: string;
  year: number | null;
  story: string;
  width: number | null;
  height: number | null;
  thumbUrl: string;
  url: string;
}

const photoDate = (t: number) => new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** The photos in the world's folder, oldest first (prewedding photos, or a museum's collection). */
export async function invitationPhotos(inv: Invitation): Promise<InvitationPhoto[]> {
  if (!inv.folderId) return [];
  const { drive } = await clients();
  const files = [...(await folderFiles(drive, inv.folderId, true)).values()];
  const dated = files.map((f) => ({ f, t: takenAtFor(f)?.getTime() ?? (Date.parse(f.createdTime ?? "") || 0) }));
  dated.sort((a, b) => a.t - b.t || a.f.name.localeCompare(b.f.name));
  const couple = inv.theme === "wedding" ? `${inv.details.groomName} & ${inv.details.brideName}` : null;
  return dated.slice(0, inv.theme === "museum" ? MAX_MUSEUM_PHOTOS : MAX_INVITATION_PHOTOS).map(({ f, t }) => {
    const rotated = (f.imageMediaMetadata?.rotation ?? 0) % 2 === 1;
    const w = f.imageMediaMetadata?.width ?? null;
    const h = f.imageMediaMetadata?.height ?? null;
    return {
      id: f.id,
      // Museums title each photo by its date ("14 Februari 2024").
      title: couple ?? (t > 0 ? photoDate(t) : "Kenangan"),
      year: t > 0 ? new Date(t).getUTCFullYear() : null,
      story: "",
      width: rotated ? h : w,
      height: rotated ? w : h,
      thumbUrl: `/api/photos/${f.id}/image?size=thumb`,
      url: `/api/photos/${f.id}/image?size=display`,
    };
  });
}

/** Image bytes of a photo that lives in this invitation's folder (and nowhere else). */
export async function invitationImage(inv: Invitation, fileId: string, size: number) {
  if (!inv.folderId) throw new ApiError(404, "photo_not_found", "Photo not found.");
  const { drive } = await clients();
  let file = (await folderFiles(drive, inv.folderId)).get(fileId);
  if (!file) file = (await folderFiles(drive, inv.folderId, true)).get(fileId);
  if (!file) throw new ApiError(404, "photo_not_found", "Photo not found.");
  return drive.imageBytes(file, size);
}

export async function listWishes(inv: Invitation): Promise<WishRow[]> {
  const { sheets } = await clients();
  return parseWishes(await sheets.readTab(WISHES_TAB, WISHES_LAST_COL), inv.keyword);
}

export async function addWish(inv: Invitation, name: string, message: string, role: WishRow["role"]): Promise<void> {
  const { sheets } = await clients();
  await sheets.ensureNamedTab(WISHES_TAB, WISHES_HEADER);
  await sheets.appendToTab(WISHES_TAB, [[new Date().toISOString(), inv.keyword, safe(name), safe(message), role]], WISHES_LAST_COL);
}

export async function listRsvps(inv: Invitation): Promise<RsvpRow[]> {
  const { sheets } = await clients();
  return parseRsvps(await sheets.readTab(RSVP_TAB, RSVP_LAST_COL), inv.keyword);
}

/** Records (or updates) a guest's RSVP. */
export async function setRsvp(inv: Invitation, guest: { id: string; name: string }, input: unknown): Promise<RsvpRow> {
  const { attending, count } = rsvpSchema.parse(input);
  const { sheets } = await clients();
  await sheets.ensureNamedTab(RSVP_TAB, RSVP_HEADER);
  const values = [new Date().toISOString(), inv.keyword, guest.id, safe(guest.name), attending ? "TRUE" : "FALSE", attending ? count : 0];
  const existing = (await listRsvps(inv)).find((r) => r.guestId === guest.id);
  if (existing) await sheets.updateTabRow(RSVP_TAB, existing.row, values, RSVP_LAST_COL);
  else await sheets.appendToTab(RSVP_TAB, [values], RSVP_LAST_COL);
  const saved = (await listRsvps(inv)).find((r) => r.guestId === guest.id);
  if (!saved) throw new ApiError(502, "sheet_error", "Konfirmasi belum tersimpan. Coba lagi.");
  return saved;
}

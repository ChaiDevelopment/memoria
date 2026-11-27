import "server-only";
import { z } from "zod";
import { ALBUM_TAB, parseAlbumRows, type AlbumChapter } from "../album";
import { GUESTBOOK_HEADER, GUESTBOOK_TAB, parseGuestbook, type GuestbookEntry } from "../guestbook";
import { parseSettings, SETTINGS_TAB, type WorldSettings } from "../worldAccess";
import { env } from "../env";
import { DriveClient, takenAtFor, type DriveFile } from "../google/drive";
import { serviceAccountToken } from "../google/serviceAccount";
import { SheetsClient } from "../google/sheets";
import { ApiError } from "../http";
import { mergeLibrary, type LibraryPhoto } from "./library";

export async function clients() {
  const e = env();
  const token = await serviceAccountToken({ email: e.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKeyPem: e.GOOGLE_SERVICE_ACCOUNT_KEY });
  return { drive: new DriveClient(token), sheets: new SheetsClient(token, e.SHEET_ID), folderId: e.DRIVE_FOLDER_ID };
}

/**
 * Short-lived cache of the folder listing (id → file). It is the source of
 * truth for "is this file part of the museum?" — Drive does not return
 * `parents` for files owned by someone else, so membership can't be checked
 * per file. Cached thumbnail links also save one Google call per image.
 */
const FOLDER_CACHE_MS = 5 * 60_000;
const folderCache = new Map<string, { at: number; files: Map<string, DriveFile> }>();

export async function folderFiles(drive: DriveClient, folderId: string, force = false): Promise<Map<string, DriveFile>> {
  const hit = folderCache.get(folderId);
  if (!force && hit && Date.now() - hit.at < FOLDER_CACHE_MS) return hit.files;
  const files = await drive.listFolderImages(folderId);
  if (folderCache.size > 200) folderCache.clear();
  const entry = { at: Date.now(), files: new Map(files.map((f) => [f.id, f])) };
  folderCache.set(folderId, entry);
  return entry.files;
}

/** The museum's public settings (keyword, name, published), cached briefly. */
const SETTINGS_CACHE_MS = 60_000;
let settingsCache: { at: number; settings: WorldSettings | null } | null = null;

export async function worldSettings(force = false): Promise<WorldSettings | null> {
  if (!force && settingsCache && Date.now() - settingsCache.at < SETTINGS_CACHE_MS) return settingsCache.settings;
  const { sheets } = await clients();
  const settings = parseSettings(await sheets.readTab(SETTINGS_TAB));
  settingsCache = { at: Date.now(), settings };
  return settings;
}

export async function listGuestbook(): Promise<GuestbookEntry[]> {
  const { sheets } = await clients();
  return parseGuestbook(await sheets.readTab(GUESTBOOK_TAB));
}

export async function addGuestbookEntry(name: string, message: string, role: "owner" | "visitor"): Promise<void> {
  const { sheets } = await clients();
  await sheets.ensureNamedTab(GUESTBOOK_TAB, GUESTBOOK_HEADER);
  // A leading quote keeps Sheets from ever treating visitor text as a formula.
  const safe = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);
  await sheets.appendToTab(GUESTBOOK_TAB, [[new Date().toISOString(), safe(name), safe(message), role]]);
}

/** The Album Kata chapters from the Sheet's "Album" tab (empty when there is none). */
export async function listAlbum(): Promise<AlbumChapter[]> {
  const { drive, sheets, folderId } = await clients();
  const [fileMap, values] = await Promise.all([folderFiles(drive, folderId), sheets.readTab(ALBUM_TAB)]);
  return parseAlbumRows(values, fileMap);
}

/** Lists the museum's photos, recording any newly added Drive photos in the Sheet. */
export async function listLibrary(): Promise<LibraryPhoto[]> {
  const { drive, sheets, folderId } = await clients();
  await sheets.ensureTab();
  const [fileMap, rows] = await Promise.all([folderFiles(drive, folderId, true), sheets.readRows()]);
  const files = [...fileMap.values()];
  const { photos, newRows } = mergeLibrary(files, rows, takenAtFor);
  await sheets.appendRows(newRows);
  return photos;
}

export const photoUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").max(120, "Title must be at most 120 characters"),
    story: z.string().trim().max(1000, "Story must be at most 1000 characters"),
    year: z
      .number()
      .int("Year must be a whole number")
      .min(1800, "Year looks too early")
      .max(new Date().getFullYear() + 1, "Year cannot be in the future")
      .nullable(),
    hidden: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

async function findRow(fileId: string) {
  const c = await clients();
  await c.sheets.ensureTab();
  const rows = await c.sheets.readRows();
  const row = rows.find((r) => r.fileId === fileId);
  if (!row) throw new ApiError(404, "photo_not_found", "Photo not found. Refresh the page and try again.");
  return { ...c, row };
}

export async function updatePhoto(fileId: string, patch: z.infer<typeof photoUpdateSchema>) {
  const { sheets, row } = await findRow(fileId);
  const updated = { ...row, ...patch };
  await sheets.updateRow(updated);
  return { id: fileId, title: updated.title, year: updated.year, story: updated.story, hidden: updated.hidden };
}

/**
 * Fetches a photo's image for display. The file must live in the museum
 * folder — the service account may have access to other shared files, and
 * this endpoint must never become a way to read them.
 */
export async function photoImage(fileId: string, size: number) {
  const { drive, folderId } = await clients();
  let file = (await folderFiles(drive, folderId)).get(fileId);
  // A photo added since the cache was filled: refresh once before giving up.
  if (!file) file = (await folderFiles(drive, folderId, true)).get(fileId);
  if (!file) throw new ApiError(404, "photo_not_found", "Photo not found.");
  return drive.imageBytes(file, size);
}

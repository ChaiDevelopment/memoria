import "server-only";
import { z } from "zod";
import { env } from "../env";
import { DriveClient, takenAtFor, type DriveFile } from "../google/drive";
import { serviceAccountToken } from "../google/serviceAccount";
import { SheetsClient } from "../google/sheets";
import { ApiError } from "../http";
import { mergeLibrary, type LibraryPhoto } from "./library";

async function clients() {
  const e = env();
  const token = await serviceAccountToken({ email: e.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKeyPem: e.GOOGLE_SERVICE_ACCOUNT_KEY });
  return { drive: new DriveClient(token), sheets: new SheetsClient(token, e.SHEET_ID), folderId: e.DRIVE_FOLDER_ID };
}

/** Lists the museum's photos, recording any newly added Drive photos in the Sheet. */
export async function listLibrary(): Promise<LibraryPhoto[]> {
  const { drive, sheets, folderId } = await clients();
  await sheets.ensureTab();
  const [files, rows] = await Promise.all([drive.listFolderImages(folderId), sheets.readRows()]);
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
  let file: DriveFile;
  try {
    file = await drive.getFile(fileId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) throw new ApiError(404, "photo_not_found", "Photo not found.");
    throw err;
  }
  if (!file.parents?.includes(folderId) || !file.mimeType.startsWith("image/")) {
    throw new ApiError(404, "photo_not_found", "Photo not found.");
  }
  return drive.imageBytes(file, size);
}

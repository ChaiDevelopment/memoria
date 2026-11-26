import type { DriveFile } from "../google/drive";
import type { MemoryRow, NewMemoryRow } from "../google/sheets";

/**
 * The museum's photo library = the Drive folder's images, joined with their
 * rows in the Sheet. Pure functions — unit tested.
 *
 *  - A photo added to the folder gets a new Sheet row automatically
 *    (title from the filename, year from EXIF / camera filename).
 *  - A photo removed from the folder simply disappears (its row is kept,
 *    so the story comes back if the file is restored).
 *  - "Hidden" rows stay in the Sheet but are left out of the museum.
 */

export interface LibraryPhoto {
  id: string;
  title: string;
  year: number | null;
  story: string;
  takenAt: string | null;
  width: number | null;
  height: number | null;
  filename: string;
}

export function titleFromFilename(filename: string | undefined): string {
  if (!filename) return "Untitled memory";
  const base = filename.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").trim();
  // Camera-generated names (IMG_1234, PXL_20240101_…, IMG-2024-WA0001) are not meaningful titles.
  if (!base || /^(img|pxl|dsc|dscn|photo|image|mvimg|screenshot|wa)[\s_-]*[\d\s_.-]*(wa\d*)?$/i.test(base)) return "Untitled memory";
  return base.slice(0, 120);
}

export function mergeLibrary(
  files: DriveFile[],
  rows: MemoryRow[],
  takenAt: (f: DriveFile) => Date | null,
  now: Date = new Date(),
): { photos: LibraryPhoto[]; newRows: NewMemoryRow[] } {
  // If a file somehow has two rows (two people syncing at once), the first wins.
  const byId = new Map<string, MemoryRow>();
  for (const r of rows) if (!byId.has(r.fileId)) byId.set(r.fileId, r);

  const photos: LibraryPhoto[] = [];
  const newRows: NewMemoryRow[] = [];
  for (const f of files) {
    let row: NewMemoryRow | MemoryRow | undefined = byId.get(f.id);
    if (!row) {
      const t = takenAt(f);
      row = {
        fileId: f.id,
        title: titleFromFilename(f.name),
        year: t ? t.getUTCFullYear() : null,
        story: "",
        takenAt: t ? t.toISOString() : "",
        hidden: false,
        addedAt: now.toISOString(),
      };
      newRows.push(row);
    }
    if (row.hidden) continue;
    const rotated = (f.imageMediaMetadata?.rotation ?? 0) % 2 === 1;
    const w = f.imageMediaMetadata?.width ?? null;
    const h = f.imageMediaMetadata?.height ?? null;
    photos.push({
      id: f.id,
      title: row.title || "Untitled memory",
      year: row.year,
      story: row.story,
      takenAt: row.takenAt || null,
      width: rotated ? h : w,
      height: rotated ? w : h,
      filename: f.name,
    });
  }
  // Oldest memories first, undated ones last.
  photos.sort((a, b) => (a.takenAt ?? "9999").localeCompare(b.takenAt ?? "9999"));
  return { photos, newRows };
}

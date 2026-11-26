/**
 * The "Album Kata": chapters of words about the collection, kept in the
 * Sheet's "Album" tab so they can be edited by hand:
 *
 *   A Period | B Title | C Words | D Photos (Drive file names or ids, comma separated)
 *
 * Pure parsing — unit tested. Photos are matched against the museum folder,
 * so a chapter can only ever show photos that are in the museum.
 */

export const ALBUM_TAB = "Album";
export const ALBUM_HEADER = ["Period", "Title", "Words", "Photos (file names or ids, comma separated)"] as const;
export const MAX_CHAPTER_PHOTOS = 6;

export interface AlbumChapter {
  period: string;
  title: string;
  words: string;
  /** Drive file ids, in the order given. */
  photoIds: string[];
}

export function parseAlbumRows(values: readonly unknown[][], files: ReadonlyMap<string, { id: string; name?: string }>): AlbumChapter[] {
  const byName = new Map<string, string>();
  for (const f of files.values()) if (f.name) byName.set(f.name.trim().toLowerCase(), f.id);
  const cell = (row: readonly unknown[], i: number) => (row[i] === undefined || row[i] === null ? "" : String(row[i]).trim());
  const chapters: AlbumChapter[] = [];
  for (const row of values) {
    const title = cell(row, 1);
    const words = cell(row, 2);
    if (!title && !words) continue;
    const photoIds: string[] = [];
    for (const ref of cell(row, 3).split(/[,\n;]+/)) {
      const key = ref.trim();
      if (!key) continue;
      const id = files.has(key) ? key : byName.get(key.toLowerCase());
      if (id && !photoIds.includes(id)) photoIds.push(id);
      if (photoIds.length >= MAX_CHAPTER_PHOTOS) break;
    }
    chapters.push({ period: cell(row, 0), title: title.slice(0, 80), words: words.slice(0, 1200), photoIds });
  }
  return chapters;
}

/**
 * The museum's guest book: short messages left by visitors and owners,
 * stored in the Sheet's "Guestbook" tab (Time | Name | Message | Role).
 * Pure parsing / sanitising — unit tested.
 */

export const GUESTBOOK_TAB = "Guestbook";
export const GUESTBOOK_HEADER = ["Time", "Name", "Message", "Role"] as const;
export const MAX_MESSAGE = 280;
export const GUESTBOOK_LIMIT = 60;

export interface GuestbookEntry {
  time: string;
  name: string;
  message: string;
  guest: boolean;
}

export function sanitizeMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw
    .normalize("NFKC")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return null;
  return [...clean].slice(0, MAX_MESSAGE).join("").trim();
}

/** Newest first. Rows without a message are skipped. */
export function parseGuestbook(values: readonly unknown[][], limit = GUESTBOOK_LIMIT): GuestbookEntry[] {
  const cell = (row: readonly unknown[], i: number) => String(row[i] ?? "").trim();
  const entries: GuestbookEntry[] = [];
  for (const row of values) {
    const message = cell(row, 2);
    if (!message) continue;
    entries.push({ time: cell(row, 0), name: cell(row, 1).slice(0, 40) || "Visitor", message: message.slice(0, MAX_MESSAGE), guest: !/^owner$/i.test(cell(row, 3)) });
  }
  return entries.reverse().slice(0, limit);
}

import { getCurrentUser } from "@/server/auth/session";
import { handler, json } from "@/server/http";
import { listAlbum } from "@/server/photos/service";

/**
 * The Album Kata (words about the collection) from the Sheet's "Album" tab.
 * Signed-out visitors simply get no album.
 */
export const GET = handler(async () => {
  const user = await getCurrentUser();
  if (!user) return json({ chapters: [] }, { headers: { "cache-control": "private, no-store" } });
  const chapters = await listAlbum();
  return json(
    {
      chapters: chapters.map((c) => ({
        period: c.period,
        title: c.title,
        words: c.words,
        photos: c.photoIds.map((id) => ({ id, thumbUrl: `/api/photos/${id}/image?size=thumb`, url: `/api/photos/${id}/image?size=display` })),
      })),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
});

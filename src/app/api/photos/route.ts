import { requireUser } from "@/server/auth/session";
import { handler, json } from "@/server/http";
import { listLibrary } from "@/server/photos/service";

/**
 * The museum's photos: everything in the shared Drive folder, with titles,
 * years and stories from the Sheet. New Drive photos are added automatically.
 */
export const GET = handler(async () => {
  await requireUser();
  const photos = await listLibrary();
  return json(
    {
      photos: photos.map((p) => ({
        ...p,
        thumbUrl: `/api/photos/${p.id}/image?size=thumb`,
        url: `/api/photos/${p.id}/image?size=display`,
      })),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
});

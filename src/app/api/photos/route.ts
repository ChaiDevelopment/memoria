import { requireViewer } from "@/server/auth/viewer";
import { handler, json } from "@/server/http";
import { invitationPhotos } from "@/server/invitationService";
import { listLibrary } from "@/server/photos/service";

/**
 * The world's photos. The museum: everything in its Drive folder, with
 * titles, years and stories from the Sheet (new Drive photos are added
 * automatically). An invitation: the prewedding photos in its own folder.
 */
export const GET = handler(async () => {
  const viewer = await requireViewer();
  if (viewer.world.kind === "invitation") {
    return json({ photos: await invitationPhotos(viewer.world.invitation) }, { headers: { "cache-control": "private, no-store" } });
  }
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

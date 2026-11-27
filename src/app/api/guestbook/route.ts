import { requireViewer, type Viewer } from "@/server/auth/viewer";
import { sanitizeMessage } from "@/server/guestbook";
import { ApiError, assertSameOrigin, handler, json } from "@/server/http";
import { addWish, listWishes } from "@/server/invitationService";
import { addGuestbookEntry, listGuestbook } from "@/server/photos/service";
import { createRateLimiter } from "@/server/worldAccess";

const posts = createRateLimiter(3, 60_000);
const noStore = { "cache-control": "private, no-store" };

/** The museum's guest book, or an invitation's "Ucapan & Doa" — the same shape for the client. */
async function entriesFor(viewer: Viewer) {
  if (viewer.world.kind === "invitation") {
    return (await listWishes(viewer.world.invitation)).map((w) => ({ time: w.time, name: w.name, message: w.message, guest: w.role === "visitor", role: w.role }));
  }
  return (await listGuestbook()).map((e) => ({ ...e, role: e.guest ? "visitor" : "owner" }));
}

/** Anyone inside the world (owner, couple or keyword visitor) can read it. */
export const GET = handler(async () => {
  const viewer = await requireViewer();
  return json({ entries: await entriesFor(viewer) }, { headers: noStore });
});

/** Leave a message, signed with the visitor's (or owner's / couple's) name. */
export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  const viewer = await requireViewer();
  if (!posts(viewer.id)) throw new ApiError(429, "too_many_messages", "You're writing fast! Please wait a moment before leaving another message.");
  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  const message = sanitizeMessage(body?.message);
  if (!message) throw new ApiError(400, "message_required", "Please write a message first.");
  if (viewer.world.kind === "invitation") {
    await addWish(viewer.world.invitation, viewer.name, message, viewer.role === "bride" || viewer.role === "groom" || viewer.role === "host" ? viewer.role : "visitor");
  } else {
    await addGuestbookEntry(viewer.name, message, viewer.role === "owner" ? "owner" : "visitor");
  }
  return json({ entries: await entriesFor(viewer) }, { headers: noStore });
});

import { requireViewer } from "@/server/auth/viewer";
import { sanitizeMessage } from "@/server/guestbook";
import { ApiError, assertSameOrigin, handler, json } from "@/server/http";
import { addGuestbookEntry, listGuestbook } from "@/server/photos/service";
import { createRateLimiter } from "@/server/worldAccess";

const posts = createRateLimiter(3, 60_000);
const noStore = { "cache-control": "private, no-store" };

/** The guest book: anyone inside the museum (owner or visitor) can read it. */
export const GET = handler(async () => {
  await requireViewer();
  return json({ entries: await listGuestbook() }, { headers: noStore });
});

/** Leave a message, signed with the visitor's (or owner's) name. */
export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  const viewer = await requireViewer();
  if (!posts(viewer.id)) throw new ApiError(429, "too_many_messages", "You're writing fast! Please wait a moment before leaving another message.");
  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  const message = sanitizeMessage(body?.message);
  if (!message) throw new ApiError(400, "message_required", "Please write a message first.");
  await addGuestbookEntry(viewer.name, message, viewer.role);
  return json({ entries: await listGuestbook() }, { headers: noStore });
});

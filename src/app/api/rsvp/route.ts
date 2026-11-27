import { requireViewer } from "@/server/auth/viewer";
import { ApiError, assertSameOrigin, handler, json } from "@/server/http";
import { listRsvps, setRsvp } from "@/server/invitationService";
import { createRateLimiter } from "@/server/worldAccess";

const answers = createRateLimiter(10, 60_000);
const noStore = { "cache-control": "private, no-store" };

/** The guest's own RSVP for the invitation they joined (couples don't RSVP). */
export const GET = handler(async () => {
  const viewer = await requireViewer();
  if (viewer.world.kind !== "invitation" || viewer.world.invitation.theme !== "wedding" || viewer.role !== "visitor") return json({ canRsvp: false, rsvp: null }, { headers: noStore });
  const mine = (await listRsvps(viewer.world.invitation)).find((r) => r.guestId === viewer.id);
  return json({ canRsvp: true, rsvp: mine ? { attending: mine.attending, count: mine.count } : null }, { headers: noStore });
});

/** "Hadir" (with how many people) or "Tidak bisa hadir" — the guest can still enter either way. */
export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  const viewer = await requireViewer();
  if (viewer.world.kind !== "invitation" || viewer.world.invitation.theme !== "wedding" || viewer.role !== "visitor") throw new ApiError(403, "rsvp_not_available", "Konfirmasi kehadiran hanya untuk tamu undangan.");
  if (!answers(viewer.id)) throw new ApiError(429, "too_many_attempts", "Tunggu sebentar sebelum mengubah konfirmasi lagi.");
  const body = (await request.json().catch(() => null)) as unknown;
  const saved = await setRsvp(viewer.world.invitation, { id: viewer.id, name: viewer.name }, body);
  return json({ rsvp: { attending: saved.attending, count: saved.count } }, { headers: noStore });
});

import { requireSignedIn } from "@/server/auth/session";
import { assertSameOrigin, handler, json, readJson } from "@/server/http";
import { createInvitation, invitationsOf } from "@/server/invitationService";
import { invitationForOwner } from "@/server/invitationView";
import { createRateLimiter } from "@/server/worldAccess";
import { z } from "zod";

const creates = createRateLimiter(5, 10 * 60_000);
const noStore = { "cache-control": "private, no-store" };

/** The signed-in account's invitations (as creator or partner). */
export const GET = handler(async () => {
  const user = await requireSignedIn();
  const list = await invitationsOf(user);
  return json({ invitations: list.map((i) => invitationForOwner(i, user)) }, { headers: noStore });
});

/** "Create your invitation": folder + Sheet row, then the creator fills in photos and details. */
export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireSignedIn();
  if (!creates(user.email)) {
    return json({ error: { code: "too_many_attempts", message: "Terlalu banyak percobaan. Tunggu beberapa menit." } }, { status: 429 });
  }
  const body = await readJson(request, z.unknown());
  const inv = await createInvitation(user, body);
  return json({ invitation: invitationForOwner(inv, user) }, { status: 201, headers: noStore });
});

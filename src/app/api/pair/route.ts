import { z } from "zod";
import { requireSignedIn } from "@/server/auth/session";
import { assertSameOrigin, handler, json, readJson } from "@/server/http";
import { claimPair } from "@/server/invitationService";
import { createRateLimiter } from "@/server/worldAccess";

const attempts = createRateLimiter(10, 10 * 60_000);
const schema = z.object({ keyword: z.string().max(64), code: z.string().regex(/^[A-Za-z0-9_-]{10,64}$/) });

/** The partner, signed in, accepts the "Link Pasangan": their seat is locked to this account. */
export const POST = handler(async (request: Request) => {
  assertSameOrigin(request);
  const user = await requireSignedIn();
  if (!attempts(user.email)) {
    return json({ error: { code: "too_many_attempts", message: "Terlalu banyak percobaan. Tunggu beberapa menit." } }, { status: 429 });
  }
  const { keyword, code } = await readJson(request, schema);
  const { invitation, role } = await claimPair(keyword, user, code);
  return json({ keyword: invitation.keyword, title: invitation.title, role }, { headers: { "cache-control": "no-store" } });
});

import { requireSignedIn } from "@/server/auth/session";
import { env } from "@/server/env";
import { assertSameOrigin, handler, json } from "@/server/http";
import { newPairCode, resetPartner } from "@/server/invitationService";
import { invitationForOwner } from "@/server/invitationView";

type Ctx = { params: Promise<{ keyword: string }> };
const noStore = { "cache-control": "private, no-store" };

/** Makes a new one-time "Link Pasangan" (the previous one stops working). */
export const POST = handler(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await requireSignedIn();
  const keyword = (await ctx.params).keyword;
  const code = await newPairCode(keyword, user);
  const link = new URL(`/pair/${encodeURIComponent(keyword)}/${encodeURIComponent(code)}`, env().APP_URL).toString();
  return json({ link }, { headers: noStore });
});

/** Frees the partner's seat (wrong account, or starting over). */
export const DELETE = handler(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await requireSignedIn();
  const inv = await resetPartner((await ctx.params).keyword, user);
  return json({ invitation: invitationForOwner(inv, user) }, { headers: noStore });
});

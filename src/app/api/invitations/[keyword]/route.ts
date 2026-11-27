import { z } from "zod";
import { requireSignedIn } from "@/server/auth/session";
import { assertSameOrigin, handler, json, readJson } from "@/server/http";
import { managedInvitation, updateInvitation } from "@/server/invitationService";
import { invitationForOwner } from "@/server/invitationView";

type Ctx = { params: Promise<{ keyword: string }> };
const noStore = { "cache-control": "private, no-store" };
const patchSchema = z.object({ details: z.unknown().optional(), published: z.boolean().optional() });

export const GET = handler(async (_request: Request, ctx: Ctx) => {
  const user = await requireSignedIn();
  const inv = await managedInvitation((await ctx.params).keyword, user);
  return json({ invitation: invitationForOwner(inv, user) }, { headers: noStore });
});

/** Edit the details (names, events, venue, bank accounts) or open / close the invitation. */
export const PATCH = handler(async (request: Request, ctx: Ctx) => {
  assertSameOrigin(request);
  const user = await requireSignedIn();
  const patch = await readJson(request, patchSchema);
  const inv = await updateInvitation((await ctx.params).keyword, user, patch);
  return json({ invitation: invitationForOwner(inv, user) }, { headers: noStore });
});

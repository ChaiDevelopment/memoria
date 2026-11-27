import { requireSignedIn } from "@/server/auth/session";
import { handler, json } from "@/server/http";
import { listRsvps, managedInvitation } from "@/server/invitationService";
import { summarizeRsvps } from "@/server/invitations";

type Ctx = { params: Promise<{ keyword: string }> };

/** For the couple: who is coming, and how many people. */
export const GET = handler(async (_request: Request, ctx: Ctx) => {
  const user = await requireSignedIn();
  const inv = await managedInvitation((await ctx.params).keyword, user);
  const rows = await listRsvps(inv);
  return json(
    { summary: summarizeRsvps(rows), guests: rows.map((r) => ({ name: r.name, attending: r.attending, count: r.count, time: r.time })) },
    { headers: { "cache-control": "private, no-store" } },
  );
});

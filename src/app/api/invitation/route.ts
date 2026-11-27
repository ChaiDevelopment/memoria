import { getViewer } from "@/server/auth/viewer";
import { handler, json } from "@/server/http";
import { invitationForGuest } from "@/server/invitationView";

/**
 * The invitation the visitor is in: names, events, venue setting and the
 * digital envelope's bank accounts. Only for people who joined with its
 * keyword (or the couple); everyone else gets null.
 */
export const GET = handler(async () => {
  const viewer = await getViewer();
  const invitation = viewer?.world.kind === "invitation" ? invitationForGuest(viewer.world.invitation) : null;
  return json({ invitation }, { headers: { "cache-control": "private, no-store" } });
});

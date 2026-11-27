import "server-only";
import type { SessionUser } from "./auth/session";
import { coupleRoleOf, firstEventStart, openSeat, type Invitation } from "./invitations";

/** What the invitation's managers see on their dashboard. */
export function invitationForOwner(inv: Invitation, user: SessionUser) {
  const me = coupleRoleOf(inv, user.email);
  return {
    theme: inv.theme,
    keyword: inv.keyword,
    title: inv.title,
    published: inv.published,
    created: inv.created,
    /** Null until the creator lets MEMORA make the folder in their Drive. */
    folderUrl: inv.folderId ? `https://drive.google.com/drive/folders/${inv.folderId}` : null,
    myRole: me,
    seats: {
      bride: inv.brideEmail ? { taken: true, you: me === "bride" } : { taken: false, you: false },
      groom: inv.groomEmail ? { taken: true, you: me === "groom" } : { taken: false, you: false },
    },
    openSeat: openSeat(inv),
    pairLinkActive: inv.pairCodeHash !== "",
    details: inv.details,
  };
}

/** What wedding guests inside the 3D venue need (no emails, folder ids or pairing data). Null for museums. */
export function invitationForGuest(inv: Invitation) {
  if (inv.theme !== "wedding") return null;
  const d = inv.details;
  return {
    keyword: inv.keyword,
    title: inv.title,
    brideName: d.brideName,
    groomName: d.groomName,
    setting: d.setting,
    welcome: d.welcome,
    events: d.events,
    banks: d.banks,
    startsAt: firstEventStart(d),
  };
}

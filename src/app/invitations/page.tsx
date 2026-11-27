import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountShell, SetupNotice } from "@/components/account/AccountShell";
import { SignOutButton } from "@/components/account/SignOutButton";
import { InvitationsClient } from "@/components/invitations/InvitationsClient";
import { pageUser } from "@/server/pageAuth";

export const metadata: Metadata = { title: "World Saya — MEMORA" };
export const dynamic = "force-dynamic";

/** "Create your world": any Google account can make (and manage) its own museum or wedding invitation. */
export default async function InvitationsPage() {
  const { signedIn, configError } = await pageUser();
  if (configError) {
    return (
      <AccountShell>
        <SetupNotice message={configError} />
      </AccountShell>
    );
  }
  if (!signedIn) redirect("/login?next=/invitations");
  const name = signedIn.name?.trim().split(/\s+/)[0] || signedIn.email.split("@")[0]!;
  return (
    <AccountShell
      right={
        <>
          <span className="hidden max-w-[220px] truncate text-ivory/60 sm:inline">{signedIn.email}</span>
          <SignOutButton />
        </>
      }
    >
      <InvitationsClient userName={name} />
    </AccountShell>
  );
}

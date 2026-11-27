import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountShell, SetupNotice } from "@/components/account/AccountShell";
import { PhotosClient } from "@/components/account/PhotosClient";
import { SignOutButton } from "@/components/account/SignOutButton";
import { rawEnv } from "@/server/env";
import { pageUser } from "@/server/pageAuth";

export const metadata: Metadata = { title: "Our memories — MEMORA" };
// Always render per request: depends on the session cookie and on runtime configuration.
export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const { user, signedIn, configError } = await pageUser();
  if (configError) {
    return (
      <AccountShell>
        <SetupNotice message={configError} />
      </AccountShell>
    );
  }
  // Signed in, but not a museum admin: their place is their invitations.
  if (!user) redirect(signedIn ? "/invitations" : "/login?next=/photos");
  const folderId = rawEnv("DRIVE_FOLDER_ID") ?? "";

  return (
    <AccountShell
      wide
      right={
        <>
          <span className="hidden max-w-[220px] truncate text-ivory/60 sm:inline">{user.name ?? user.email}</span>
          <SignOutButton />
        </>
      }
    >
      <PhotosClient driveFolderUrl={`https://drive.google.com/drive/folders/${folderId}`} />
    </AccountShell>
  );
}

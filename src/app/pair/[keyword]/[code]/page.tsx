import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountShell, SetupNotice } from "@/components/account/AccountShell";
import { PairClient } from "@/components/invitations/PairClient";
import { pageUser } from "@/server/pageAuth";

export const metadata: Metadata = { title: "Link Pasangan — MEMORA", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * "Link Pasangan": the partner opens it, signs in with Google, and confirms —
 * their account is then locked into the couple's second seat.
 */
export default async function PairPage({ params }: { params: Promise<{ keyword: string; code: string }> }) {
  const { keyword, code } = await params;
  const cleanKeyword = decodeURIComponent(keyword).replace(/[^a-z0-9-]/gi, "").slice(0, 64);
  const cleanCode = code.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  const { signedIn, configError } = await pageUser();
  if (configError) {
    return (
      <AccountShell>
        <SetupNotice message={configError} />
      </AccountShell>
    );
  }
  if (!signedIn) redirect(`/login?next=${encodeURIComponent(`/pair/${cleanKeyword}/${cleanCode}`)}`);
  return (
    <AccountShell>
      <PairClient keyword={cleanKeyword} code={cleanCode} email={signedIn.email} />
    </AccountShell>
  );
}

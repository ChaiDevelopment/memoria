import type { Metadata } from "next";
import { ClientGame } from "@/components/ClientGame";
import { sanitizeVisitorName } from "@/server/worldAccess";

export const metadata: Metadata = { title: "Join a world — MEMORA" };

/**
 * Share link: /w/<keyword>[?to=<guest name>] opens MEMORA with the Join form
 * pre-filled (a personal invitation link greets the guest by name). Both are
 * only a convenience here — the server checks the keyword when the visitor
 * joins, exactly like a typed one.
 */
export default async function JoinWorldLink({
  params,
  searchParams,
}: {
  params: Promise<{ keyword: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { keyword } = await params;
  const to = (await searchParams).to;
  const guest = sanitizeVisitorName(Array.isArray(to) ? to[0] : to) ?? undefined;
  let decoded = "";
  try {
    decoded = decodeURIComponent(keyword);
  } catch {
    /* malformed escape: start with an empty field */
  }
  const initial = decoded.replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  return (
    <main>
      <ClientGame initialKeyword={initial} initialName={guest} />
    </main>
  );
}

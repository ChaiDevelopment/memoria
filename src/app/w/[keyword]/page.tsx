import type { Metadata } from "next";
import { ClientGame } from "@/components/ClientGame";

export const metadata: Metadata = { title: "Join a world — MEMORA" };

/**
 * Share link: /w/<keyword> opens MEMORA with the Join form pre-filled.
 * The keyword is only a convenience here — it is checked by the server when
 * the visitor joins, exactly like a typed one.
 */
export default async function JoinWorldLink({ params }: { params: Promise<{ keyword: string }> }) {
  const { keyword } = await params;
  let decoded = "";
  try {
    decoded = decodeURIComponent(keyword);
  } catch {
    /* malformed escape: start with an empty field */
  }
  const initial = decoded.replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  return (
    <main>
      <ClientGame initialKeyword={initial} />
    </main>
  );
}

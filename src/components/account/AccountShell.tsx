import Link from "next/link";
import type { ReactNode } from "react";
import { EmblemIcon } from "@/components/ui/icons";

/** Shared chrome for account pages (login, register, photos). */
export function AccountShell({ children, right, wide = false }: { children: ReactNode; right?: ReactNode; wide?: boolean }) {
  return (
    <div className="account-page min-h-dvh overflow-y-auto text-ivory">
      <header className="sticky top-0 z-10 border-b border-ivory/10 bg-ink/80 backdrop-blur-md">
        <div className={`mx-auto flex items-center justify-between gap-4 px-5 py-3 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-gold">
            <EmblemIcon size={20} className="text-gold" />
            <span className="font-display tracking-[0.38em]">MEMORA</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">{right}</div>
        </div>
      </header>
      <main className={`mx-auto px-5 py-8 sm:py-12 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>
    </div>
  );
}

export function SetupNotice({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-ember/40 bg-ember/10 p-5 text-sm leading-relaxed">
      <p className="font-semibold text-ivory">The server isn’t fully set up yet.</p>
      <p className="mt-1 text-ivory/75">{message}</p>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountShell, SetupNotice } from "@/components/account/AccountShell";
import { pageUser, safeNext } from "@/server/pageAuth";

export const metadata: Metadata = { title: "Sign in — MEMORA" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_invited: "This Google account isn’t on the guest list for this museum. Ask the owner to add your email.",
  cancelled: "Sign-in was cancelled.",
  expired: "The sign-in took too long or was opened in another tab. Please try again.",
  email_unverified: "Your Google account email isn’t verified.",
  not_configured: "The server isn’t fully set up yet.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const { user, configError } = await pageUser();
  if (user) redirect(next);
  const errorCode = typeof params.error === "string" ? params.error : null;

  return (
    <AccountShell>
      {configError ? (
        <SetupNotice message={configError} />
      ) : (
        <div className="mx-auto w-full max-w-sm text-center">
          <h1 className="font-display text-3xl">Welcome to MEMORA</h1>
          <p className="mt-2 text-sm text-ivory/60">Sign in with the Google account that was invited to this museum.</p>
          {errorCode && (
            <p role="alert" className="mt-6 rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-left text-sm">
              {ERRORS[errorCode] ?? "Sign-in failed. Please try again."}
            </p>
          )}
          <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="primary-button mt-8 inline-flex items-center justify-center gap-3">
            <GoogleG />
            Sign in with Google
          </a>
          <p className="mt-6 text-xs leading-relaxed text-ivory/45">
            MEMORA only learns your name and email from Google. It never accesses your own Drive or Photos.
          </p>
        </div>
      )}
    </AccountShell>
  );
}

function GoogleG() {
  // Neutral "G" glyph (not Google's logo) to keep the button self-explanatory.
  return (
    <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/15 font-sans text-sm font-bold">
      G
    </span>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/apiClient";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await api("/api/auth/logout", { body: {} });
        } finally {
          router.replace("/login");
          router.refresh();
        }
      }}
      className="rounded-full border border-ivory/15 px-3 py-1.5 text-ivory/80 transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50"
    >
      Sign out
    </button>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/apiClient";

/** The partner confirms "this is my wedding" — and their seat is locked to this Google account. */
export function PairClient({ keyword, code, email }: { keyword: string; code: string; email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; role: "bride" | "groom" } | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      setDone(await api<{ title: string; role: "bride" | "groom" }>("/api/pair", { body: { keyword, code } }));
    } catch (err) {
      setError(err instanceof ApiClientError && err.status > 0 && err.status < 500 ? err.message : "Belum berhasil. Coba lagi sebentar.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md text-center" data-testid="pair-done">
        <p className="text-4xl">{done.role === "bride" ? "👰" : "🤵"}</p>
        <h1 className="mt-3 font-display text-3xl">Selamat, kamu sudah terdaftar!</h1>
        <p className="mt-2 text-sm text-ivory/65">
          Akunmu sekarang terkunci sebagai {done.role === "bride" ? "pengantin wanita" : "pengantin pria"} di <span className="text-ivory">{done.title}</span>. Di venue 3D, karaktermu otomatis memakai {done.role === "bride" ? "gaun pengantin" : "jas pengantin"}.
        </p>
        <Link href="/invitations" className="primary-button mt-8 inline-flex">
          Buka Undangan Saya
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center">
      <p className="text-4xl">💍</p>
      <h1 className="mt-3 font-display text-3xl">Kamu diundang sebagai pengantin</h1>
      <p className="mt-2 text-sm text-ivory/65">
        Pasanganmu mengajakmu mengelola undangan <span className="font-mono text-ivory">{keyword}</span> bersama. Dengan menerima, akun <span className="text-ivory">{email}</span> akan terkunci sebagai pengantin — hanya kalian berdua yang tampil memakai baju pengantin.
      </p>
      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-left text-sm">
          {error}
        </p>
      )}
      <button type="button" onClick={accept} disabled={busy} className="primary-button mt-8 disabled:opacity-60" data-testid="accept-pair">
        {busy ? "Menyimpan…" : "Ya, ini pernikahanku"}
      </button>
      <p className="mt-4 text-xs text-ivory/45">Bukan akun yang benar? Keluar lalu buka link ini lagi dengan akun Google yang tepat.</p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/apiClient";

type Rsvp = { attending: boolean; count: number };
const MAX = 10;

/**
 * "Konfirmasi kehadiran" for wedding guests: Hadir (and for how many people)
 * or Tidak bisa hadir. Saved as soon as it's chosen; optional — guests can
 * enter the venue either way, and change their answer later.
 */
export function RsvpPicker({ compact = false }: { compact?: boolean }) {
  const [can, setCan] = useState(false);
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let off = false;
    api<{ canRsvp: boolean; rsvp: Rsvp | null }>("/api/rsvp")
      .then((r) => {
        if (off) return;
        setCan(r.canRsvp);
        setRsvp(r.rsvp);
      })
      .catch(() => undefined);
    return () => {
      off = true;
      clearTimeout(timer.current);
    };
  }, []);

  if (!can) return null;

  const save = (next: Rsvp, delay = 0) => {
    setRsvp(next);
    setStatus("saving");
    setError(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api("/api/rsvp", { body: next });
        setStatus("saved");
      } catch (err) {
        setStatus("error");
        setError(err instanceof ApiClientError && err.status > 0 && err.status < 500 ? err.message : "Konfirmasi belum tersimpan. Coba lagi.");
      }
    }, delay);
  };

  const choice = (attending: boolean, label: string, emoji: string) => {
    const active = rsvp?.attending === attending;
    return (
      <button
        type="button"
        onClick={() => save({ attending, count: attending ? Math.max(1, rsvp?.count || 1) : 0 })}
        aria-pressed={active}
        className={`flex-1 rounded-2xl border px-3 py-2.5 text-sm transition-colors ${active ? "border-gold bg-gold/20 text-ivory" : "border-ivory/15 text-ivory/75 hover:border-gold/50"}`}
        data-testid={attending ? "rsvp-yes" : "rsvp-no"}
      >
        {emoji} {label}
      </button>
    );
  };

  return (
    <div className={`w-full text-left ${compact ? "" : "mt-4"}`} data-testid="rsvp">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ivory/60">Konfirmasi kehadiran</p>
      <div className="mt-2 flex gap-2">
        {choice(true, "Hadir", "🤍")}
        {choice(false, "Tidak bisa hadir", "🙏")}
      </div>
      {rsvp?.attending && (
        <div className="mt-3 flex items-center gap-3 text-sm text-ivory/80">
          <span>Jumlah orang</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" aria-label="Kurangi" onClick={() => save({ attending: true, count: Math.max(1, rsvp.count - 1) }, 500)} className="h-8 w-8 rounded-full border border-ivory/20 hover:border-gold/60">
              −
            </button>
            <span className="w-6 text-center font-display text-lg text-ivory" data-testid="rsvp-count">
              {rsvp.count}
            </span>
            <button type="button" aria-label="Tambah" onClick={() => save({ attending: true, count: Math.min(MAX, rsvp.count + 1) }, 500)} className="h-8 w-8 rounded-full border border-ivory/20 hover:border-gold/60">
              +
            </button>
          </div>
        </div>
      )}
      <p className="mt-2 min-h-4 text-xs text-ivory/55" aria-live="polite">
        {status === "saving"
          ? "Menyimpan…"
          : status === "saved"
            ? rsvp?.attending
              ? "Terima kasih! Kehadiranmu sudah tercatat ✓"
              : "Terima kasih atas kabarnya. Kamu tetap bisa melihat undangan ✓"
            : status === "error"
              ? error
              : rsvp
                ? "Kamu bisa mengubahnya kapan saja."
                : "Opsional — kamu tetap bisa masuk tanpa mengisinya."}
      </p>
    </div>
  );
}

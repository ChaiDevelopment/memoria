"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/lib/apiClient";
import { useGameStore, type GuestbookEntryView } from "@/stores/gameStore";
import { exitPointerLock } from "@/systems/input/pointerLock";
import { CloseIcon } from "./icons";

const MAX = 280;

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The guest book: read what visitors wrote, and leave a message of your own. */
export function GuestbookPanel() {
  const open = useGameStore((s) => s.guestbookOpen);
  if (!open) return null;
  return <Guestbook />;
}

function Guestbook() {
  const entries = useGameStore((s) => s.guestbook);
  const viewer = useGameStore((s) => s.viewer);
  const wedding = useGameStore((s) => s.world.kind === "wedding");
  const setGuestbook = useGameStore((s) => s.setGuestbook);
  const close = useGameStore((s) => s.closeGuestbook);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    exitPointerLock();
    api<{ entries: GuestbookEntryView[] }>("/api/guestbook")
      .then((r) => setGuestbook(r.entries))
      .catch(() => undefined);
  }, [setGuestbook]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return setError("Please write a message first.");
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ entries: GuestbookEntryView[] }>("/api/guestbook", { method: "POST", body: { message } });
      setGuestbook(r.entries);
      setMessage("");
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiClientError && err.status > 0 && err.status < 500 ? err.message : "Your message couldn't be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inspect-backdrop absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={wedding ? "Ucapan & Doa" : "Guest Book"}>
      <div className="inspect-card relative flex max-h-full w-full max-w-[720px] flex-col gap-4 rounded-3xl p-5 sm:p-6">
        <button type="button" onClick={close} className="absolute right-3 top-3 rounded-full p-2 text-ivory/60 hover:bg-ivory/10 hover:text-ivory" aria-label="Close">
          <CloseIcon />
        </button>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">{wedding ? "Ucapan & Doa" : "Guest Book"}</p>
          <h2 className="mt-1 font-display text-3xl text-ivory">{wedding ? "Kirim ucapan untuk kedua mempelai" : "Leave a few words"}</h2>
        </div>

        {viewer ? (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <textarea
              value={message}
              onChange={(e) => (setMessage(e.target.value.slice(0, MAX)), setSent(false))}
              onKeyDown={(e) => e.stopPropagation()}
              maxLength={MAX}
              rows={3}
              placeholder={wedding ? `Tulis ucapan dan doamu, ${viewer.name}…` : `Write something for this museum, ${viewer.name}…`}
              className="join-input resize-none"
            />
            <div className="flex items-center gap-3">
              <span className="text-xs text-ivory/40">
                {message.length}/{MAX}
              </span>
              {sent && <span className="text-xs text-gold">{wedding ? "Terima kasih — ucapanmu sudah terpasang di papan." : "Thank you — your message is on the board."}</span>}
              <button type="submit" disabled={busy} className="primary-button ml-auto min-w-[140px] disabled:opacity-60">
                {busy ? (wedding ? "Mengirim…" : "Saving…") : wedding ? "Kirim ucapan" : "Sign the book"}
              </button>
            </div>
            {error && (
              <p role="alert" className="rounded-xl border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-ivory">
                {error}
              </p>
            )}
          </form>
        ) : (
          <p className="text-sm text-ivory/60">Join this world with its keyword to read and sign the guest book.</p>
        )}

        <ul className="-mx-1 flex min-h-0 flex-col gap-2 overflow-y-auto px-1">
          {entries.length === 0 && <li className="text-sm italic text-ivory/50">{wedding ? "Belum ada ucapan — jadilah yang pertama." : "No messages yet — be the first to sign."}</li>}
          {entries.map((e, i) => (
            <li key={`${e.time}-${i}`} className="rounded-2xl border border-ivory/10 bg-ivory/5 px-4 py-3">
              <p className="whitespace-pre-line font-display text-base text-ivory/90">{e.message}</p>
              <p className="mt-1 text-xs text-ivory/50">
                — {e.name}
                {e.role === "bride" || e.role === "groom" ? " · Mempelai" : e.role === "host" ? " · Pemilik" : e.guest ? "" : " · Owner"}
                {when(e.time) && ` · ${when(e.time)}`}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

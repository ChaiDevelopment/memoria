"use client";

import { useEffect, useState } from "react";
import { useGameStore, type InvitationView } from "@/stores/gameStore";
import { exitPointerLock } from "@/systems/input/pointerLock";
import { CloseIcon } from "./icons";
import { RsvpPicker } from "./RsvpPicker";

/** Overlays of the wedding venue: the digital envelope and the event details. */
export function WeddingPanels() {
  const panel = useGameStore((s) => s.panel);
  const world = useGameStore((s) => s.world);
  const close = useGameStore((s) => s.closePanel);
  useEffect(() => {
    if (panel) exitPointerLock();
  }, [panel]);
  if (!panel || world.kind !== "wedding") return null;
  return (
    <div className="inspect-backdrop absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={panel === "envelope" ? "Amplop Digital" : "Info Acara"}>
      <div className="inspect-card relative flex max-h-full w-full max-w-[560px] flex-col gap-4 overflow-y-auto rounded-3xl p-5 sm:p-7">
        <button type="button" onClick={close} className="absolute right-3 top-3 rounded-full p-2 text-ivory/60 hover:bg-ivory/10 hover:text-ivory" aria-label="Close">
          <CloseIcon />
        </button>
        {panel === "envelope" ? <Envelope invitation={world.invitation} /> : <EventInfo invitation={world.invitation} />}
      </div>
    </div>
  );
}

function Envelope({ invitation }: { invitation: InvitationView }) {
  const [copied, setCopied] = useState<number | null>(null);
  const copy = async (i: number, number: string) => {
    await navigator.clipboard?.writeText(number.replace(/[^0-9]/g, "")).catch(() => undefined);
    setCopied(i);
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 1800);
  };
  return (
    <>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">Amplop Digital</p>
        <h2 className="mt-1 font-display text-3xl text-ivory">Tanda kasih</h2>
        <p className="mt-2 text-sm leading-relaxed text-ivory/65">Doa restu Anda adalah hadiah terindah bagi kami. Namun jika Anda ingin memberikan tanda kasih, dapat melalui:</p>
      </div>
      {invitation.banks.length === 0 ? (
        <p className="rounded-2xl border border-ivory/10 bg-ivory/5 px-4 py-4 text-sm italic text-ivory/60">Kedua mempelai belum menambahkan rekening. Doa dan ucapan Anda sudah lebih dari cukup 🤍</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {invitation.banks.map((b, i) => (
            <li key={i} className="rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/10 to-transparent px-4 py-4" data-testid="bank-account">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{b.bank}</p>
              <p className="mt-1 font-mono text-xl tracking-wider text-ivory">{b.number}</p>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-sm text-ivory/70">a.n. {b.holder}</p>
                <button type="button" onClick={() => copy(i, b.number)} className="ml-auto rounded-full border border-ivory/15 px-3 py-1 text-xs text-ivory/80 hover:border-gold/60 hover:text-gold">
                  {copied === i ? "Tersalin ✓" : "Salin nomor"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ivory/45">Pastikan nama penerima sesuai sebelum mengirim. MEMORA tidak memproses pembayaran apa pun.</p>
    </>
  );
}

function useCountdown(startsAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startsAt) return null;
  const target = new Date(startsAt).getTime();
  if (Number.isNaN(target)) return null;
  const left = Math.max(0, target - now);
  return { done: left === 0, days: Math.floor(left / 86_400_000), hours: Math.floor(left / 3_600_000) % 24, minutes: Math.floor(left / 60_000) % 60, seconds: Math.floor(left / 1000) % 60 };
}

function EventInfo({ invitation }: { invitation: InvitationView }) {
  const c = useCountdown(invitation.startsAt);
  return (
    <>
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">The Wedding of</p>
        <h2 className="mt-1 font-display text-3xl italic text-ivory">
          {invitation.groomName} &amp; {invitation.brideName}
        </h2>
      </div>
      {c && (
        <div className="grid grid-cols-4 gap-2 text-center" data-testid="countdown">
          {c.done ? (
            <p className="col-span-4 font-display text-lg text-gold">Hari bahagia telah tiba 🤍</p>
          ) : (
            (
              [
                [c.days, "Hari"],
                [c.hours, "Jam"],
                [c.minutes, "Menit"],
                [c.seconds, "Detik"],
              ] as const
            ).map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-ivory/10 bg-ivory/5 py-3">
                <p className="font-display text-2xl text-ivory">{v}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-ivory/50">{l}</p>
              </div>
            ))
          )}
        </div>
      )}
      {invitation.events.length === 0 && <p className="text-center text-sm italic text-ivory/55">Detail acara akan segera diumumkan.</p>}
      <ul className="flex flex-col gap-3">
        {invitation.events.map((ev, i) => (
          <li key={i} className="rounded-2xl border border-ivory/10 bg-ivory/5 px-4 py-4">
            <p className="font-display text-xl text-gold">{ev.label}</p>
            {ev.date && (
              <p className="mt-1 text-sm text-ivory/85">
                {new Date(`${ev.date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
            {ev.time && (
              <p className="text-sm text-ivory/70">
                Pukul {ev.time}
                {ev.endTime ? ` – ${ev.endTime}` : " – selesai"}
              </p>
            )}
            {ev.place && <p className="mt-2 text-sm text-ivory">{ev.place}</p>}
            {ev.address && <p className="text-xs leading-relaxed text-ivory/60">{ev.address}</p>}
            {ev.mapsUrl && (
              <a href={ev.mapsUrl} target="_blank" rel="noopener noreferrer" className="primary-button mt-3 inline-flex text-sm">
                📍 Buka Google Maps
              </a>
            )}
          </li>
        ))}
      </ul>
      <div className="rounded-2xl border border-gold/25 bg-gold/5 px-4 py-3">
        <RsvpPicker compact />
      </div>
    </>
  );
}

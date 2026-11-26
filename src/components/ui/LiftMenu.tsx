"use client";

import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { exitPointerLock } from "@/systems/input/pointerLock";
import { getWorld } from "@/systems/world/buildWorld";
import { CloseIcon } from "./icons";

/** Storey of a frame slot: Memory Hall slots are "h<floor>-…", the original museum is the ground floor. */
function floorOfSlot(slotId: string): number {
  const m = /^[hb](\d+)-/.exec(slotId);
  return m ? Number(m[1]) : 0;
}

/**
 * The brass lift's floor selector. Floors are chronological (photos fill
 * the halls oldest first), so each button shows the years on that floor.
 */
export function LiftMenu() {
  const open = useGameStore((s) => s.liftMenuOpen);
  const rides = useGameStore((s) => s.rides);
  return (
    <>
      {rides > 0 && <div key={rides} className="lift-arrive pointer-events-none absolute inset-0 z-30 bg-[#1b140e]" />}
      {open && <LiftPanel />}
    </>
  );
}

function LiftPanel() {
  const wingFrames = useGameStore((s) => s.wingFrames);
  const exhibits = useGameStore((s) => s.exhibits);
  const current = useGameStore((s) => s.currentFloor);
  const close = useGameStore((s) => s.closeLiftMenu);
  const requestTeleport = useGameStore((s) => s.requestTeleport);
  const isTouch = useGameStore((s) => s.isTouch);
  const [riding, setRiding] = useState<number | null>(null);
  const albumChapters = useGameStore((s) => s.album.length);
  const world = getWorld(wingFrames, albumChapters);

  const floors = useMemo(() => {
    const info = world.grand.liftStops.map((stop) => ({ stop, photos: 0, from: Infinity, to: -Infinity, halls: 0 }));
    for (const h of world.grand.halls) if (info[h.floor]) info[h.floor]!.halls++;
    for (const [slot, photo] of Object.entries(exhibits)) {
      const f = info[floorOfSlot(slot)];
      if (!f) continue;
      f.photos++;
      if (photo.year !== null) {
        f.from = Math.min(f.from, photo.year);
        f.to = Math.max(f.to, photo.year);
      }
    }
    return info;
  }, [world, exhibits]);

  const ride = (floor: number) => {
    const stop = world.grand.liftStops[floor];
    if (!stop || riding !== null) return;
    if (floor === current) {
      close();
      return;
    }
    setRiding(floor);
    // A short fade, then step out on the chosen floor.
    window.setTimeout(() => requestTeleport({ x: stop.x, y: stop.y, z: stop.z, facing: stop.facing }), 450);
  };

  useEffect(() => {
    exitPointerLock();
    const onKey = (e: KeyboardEvent) => {
      const n = Number.parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 0 && n < floors.length) ride(n);
      if (e.key.toLowerCase() === "g") ride(0);
      if (e.key.toLowerCase() === "r") ride(floors.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="inspect-backdrop absolute inset-0 z-30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Lift">
      {riding !== null && <div className="lift-fade pointer-events-none absolute inset-0 bg-[#1b140e]" />}
      <div className="inspect-card relative w-full max-w-[420px] rounded-3xl p-5 sm:p-6">
        <button type="button" onClick={close} className="absolute right-4 top-4 rounded-full p-2 text-ivory/60 hover:bg-ivory/10 hover:text-ivory" aria-label="Close">
          <CloseIcon />
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">The Brass Lift</p>
        <h2 className="mt-1 font-display text-2xl text-ivory">Choose a floor</h2>
        <p className="mt-1 text-sm text-ivory/60">Floors go up through the years — the oldest memories on the ground.</p>
        <ul className="mt-4 flex flex-col-reverse gap-2">
          {floors.map((f, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => ride(i)}
                disabled={riding !== null}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${i === current ? "border-gold/70 bg-gold/15" : "border-ivory/10 bg-ivory/5 hover:border-gold/60 hover:bg-gold/10"}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold font-display text-sm text-ink">{f.stop.rooftop ? "R" : i === 0 ? "G" : i}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ivory">
                    {f.stop.label}
                    {i === current && <span className="ml-2 text-xs font-normal text-gold">You are here</span>}
                  </span>
                  <span className="block truncate text-xs text-ivory/60">
                    {f.stop.rooftop ? "Coffee & the view" : f.from <= f.to ? (f.from === f.to ? `${f.from}` : `${f.from} – ${f.to}`) : i === 0 ? "Lobby · Gallery · Timeline" : "Balcony"}
                    {f.photos > 0 && ` · ${f.photos} photo${f.photos === 1 ? "" : "s"}`}
                    {f.halls > 0 && ` · ${f.halls} hall${f.halls === 1 ? "" : "s"}`}
                  </span>
                </span>
                {!isTouch && <kbd className="rounded-md border border-ivory/20 px-1.5 text-[11px] text-ivory/50">{f.stop.rooftop ? "R" : i === 0 ? "G" : i}</kbd>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

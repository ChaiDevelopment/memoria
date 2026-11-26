"use client";

import Link from "next/link";
import { useGameStore } from "@/stores/gameStore";
import { requestPointerLock } from "@/systems/input/pointerLock";
import { EmblemIcon } from "./icons";

/** Opening screen shown over the live (slowly orbiting) museum view. */
export function TitleScreen({ ready }: { ready: boolean }) {
  const phase = useGameStore((s) => s.phase);
  const enterMuseum = useGameStore((s) => s.enterMuseum);
  const isTouch = useGameStore((s) => s.isTouch);
  const museumName = useGameStore((s) => s.museumName);
  if (phase !== "title") return null;

  const enter = () => {
    enterMuseum();
    if (!isTouch) requestPointerLock();
  };

  return (
    <div className="title-backdrop absolute inset-0 z-50 flex flex-col items-center justify-end px-6 pb-[max(48px,env(safe-area-inset-bottom))] sm:justify-center sm:pb-0">
      <div className="title-rise flex flex-col items-center text-center">
        <EmblemIcon size={40} className="mb-4 text-gold" />
        <h1 className="font-display text-5xl tracking-[0.42em] text-ivory drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)] sm:text-7xl">MEMORA</h1>
        <div className="my-4 h-px w-40 bg-gradient-to-r from-transparent via-gold to-transparent" />
        <p className="font-display text-lg italic text-ivory/90 sm:text-xl">A Shared World of Memories</p>
        <p className="mt-2 text-sm text-ivory/60">{museumName}</p>

        <button type="button" onClick={enter} disabled={!ready} className="primary-button mt-10 min-w-[220px] text-base disabled:cursor-wait disabled:opacity-60" data-testid="enter-museum">
          {ready ? "Enter the Museum" : "Preparing the galleries…"}
        </button>
        <p className="mt-4 text-xs text-ivory/50">
          {isTouch ? "Left stick to move · drag on the right to look around" : "WASD to move · mouse to look · Shift to run · Space to jump · E to interact"}
        </p>
        <Link href="/photos" className="mt-5 text-sm text-gold/90 underline-offset-4 hover:text-gold hover:underline">
          Bring in your own photos →
        </Link>
      </div>
    </div>
  );
}

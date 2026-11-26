"use client";

import dynamic from "next/dynamic";

/**
 * The game depends on browser-only APIs (WebGL, pointer lock, localStorage),
 * so the whole shell is rendered on the client. The server sends a light
 * boot screen that is replaced once the game chunk arrives.
 */
const GameRoot = dynamic(() => import("./GameRoot"), {
  ssr: false,
  loading: () => <BootScreen />,
});

export function ClientGame() {
  return <GameRoot />;
}

export function BootScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-ink text-ivory">
      <div className="font-display text-4xl tracking-[0.42em] sm:text-6xl">MEMORA</div>
      <div className="mt-3 font-display italic text-ivory/70">A Shared World of Memories</div>
      <div className="boot-bar mt-8 h-px w-48 overflow-hidden bg-ivory/15">
        <span />
      </div>
    </div>
  );
}

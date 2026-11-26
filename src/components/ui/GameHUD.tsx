"use client";

import { useEffect, useRef, useState } from "react";
import { AREAS } from "@/config/museumLayout";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useGameStore } from "@/stores/gameStore";
import { CollapseIcon, EmblemIcon, ExpandIcon, SettingsIcon, VisitorsIcon } from "./icons";

/**
 * In-game overlay. Deliberately sparse: brand + location top-left, a few
 * round utility buttons top-right, contextual prompts at the bottom.
 */
export function GameHUD() {
  const phase = useGameStore((s) => s.phase);
  if (phase !== "playing") return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none" style={{ padding: "max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))" }}>
      <BrandBlock />
      <TopRightControls />
      <AreaBanner />
      <BottomPrompts />
    </div>
  );
}

function BrandBlock() {
  const museumName = useGameStore((s) => s.museumName);
  const currentArea = useGameStore((s) => s.currentArea);
  const area = AREAS.find((a) => a.id === currentArea);
  return (
    <div className="absolute left-[max(14px,env(safe-area-inset-left))] top-[max(14px,env(safe-area-inset-top))] flex flex-col gap-1.5">
      <div className="hud-panel flex items-center gap-3 rounded-2xl px-4 py-2.5">
        <EmblemIcon size={22} className="text-gold" />
        <div className="leading-tight">
          <div className="font-display text-[15px] tracking-[0.42em] text-ivory sm:text-base">MEMORA</div>
          <div className="max-w-[46vw] truncate font-display text-[12px] italic text-ivory/70 sm:text-[13px]">{museumName}</div>
        </div>
      </div>
      {area && (
        <div className="hud-panel w-fit rounded-full px-3 py-1 text-[11px] tracking-wide text-ivory/80">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-gold align-middle" />
          {area.name}
        </div>
      )}
    </div>
  );
}

function TopRightControls() {
  const visitorCount = useGameStore((s) => s.visitorCount);
  const openMenu = useGameStore((s) => s.openMenu);
  const showFps = useGameStore((s) => s.settings.showFps);
  const { isFullscreen, supported, toggle } = useFullscreen();
  return (
    <div className="absolute right-[max(14px,env(safe-area-inset-right))] top-[max(14px,env(safe-area-inset-top))] flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <div className="hud-panel flex h-10 items-center gap-2 rounded-full px-3.5 text-ivory/85" title="Live visitors arrive with multiplayer in a later phase">
          <VisitorsIcon size={18} className="text-gold" />
          <span className="text-sm tabular-nums">{visitorCount}</span>
          <span className="hidden text-xs text-ivory/60 sm:inline">visiting</span>
        </div>
        {supported && (
          <button type="button" onClick={toggle} className="hud-button pointer-events-auto" aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {isFullscreen ? <CollapseIcon size={18} /> : <ExpandIcon size={18} />}
          </button>
        )}
        <button type="button" onClick={openMenu} className="hud-button pointer-events-auto" aria-label="Open settings menu">
          <SettingsIcon size={18} />
        </button>
      </div>
      {showFps && <FpsMeter />}
    </div>
  );
}

/** Updates the DOM directly twice per second — no React re-renders. */
function FpsMeter() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      frames++;
      if (now - last >= 500) {
        if (ref.current) ref.current.textContent = `${Math.round((frames * 1000) / (now - last))} FPS`;
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <span ref={ref} className="hud-panel rounded-full px-2.5 py-1 font-mono text-[11px] text-ivory/80">— FPS</span>;
}

/** Large adventure-game style title when entering a new area. */
function AreaBanner() {
  const currentArea = useGameStore((s) => s.currentArea);
  const [shown, setShown] = useState<string | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (!currentArea) return;
    // The lobby is announced by the title screen already; skip the very first area.
    if (first.current) {
      first.current = false;
      return;
    }
    setShown(currentArea);
    const t = window.setTimeout(() => setShown(null), 3200);
    return () => window.clearTimeout(t);
  }, [currentArea]);
  const area = AREAS.find((a) => a.id === shown);
  if (!area) return null;
  return (
    <div key={area.id} className="area-banner absolute left-1/2 top-[18%] w-max max-w-[92vw] text-center">
      <div className="mx-auto mb-2 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
      <div className="font-display text-3xl tracking-[0.12em] text-ivory drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-5xl">{area.name}</div>
      <div className="mt-2 font-display text-sm italic text-ivory/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] sm:text-base">{area.subtitle}</div>
      <div className="mx-auto mt-3 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
    </div>
  );
}

function Key({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <kbd className={`inline-flex h-6 items-center justify-center rounded-md border border-ivory/25 bg-ivory/10 px-1.5 font-sans text-[11px] font-medium text-ivory shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)] ${wide ? "min-w-[44px]" : "min-w-6"}`}>
      {children}
    </kbd>
  );
}

function BottomPrompts() {
  const nearby = useGameStore((s) => s.nearby);
  const inspecting = useGameStore((s) => s.inspectingId);
  const menuOpen = useGameStore((s) => s.menuOpen);
  const isTouch = useGameStore((s) => s.isTouch);
  const showHints = useGameStore((s) => s.settings.showHints);
  const pointerLocked = useGameStore((s) => s.pointerLocked);
  if (menuOpen || inspecting) return null;

  return (
    <div className="absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
      {nearby && (
        <div className={`prompt-pop hud-panel flex items-center gap-3 rounded-full py-2 pl-2 pr-5 ${isTouch ? "mb-28" : ""}`}>
          {isTouch ? (
            <span className="rounded-full bg-gold px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink">Tap ✋</span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold font-sans text-sm font-bold text-ink">E</span>
          )}
          <span className="text-sm text-ivory">
            Inspect <span className="font-display italic text-gold">“{nearby.label}”</span>
          </span>
        </div>
      )}
      {!isTouch && !pointerLocked && !nearby && (
        <div className="hud-panel rounded-full px-4 py-1.5 text-xs text-ivory/85">Click the view to look around with the mouse</div>
      )}
      {!isTouch && showHints && (
        <div className="hud-panel hidden items-center gap-4 rounded-2xl px-4 py-2 text-[11px] text-ivory/75 md:flex">
          <span className="flex items-center gap-1.5">
            <Key>W</Key>
            <Key>A</Key>
            <Key>S</Key>
            <Key>D</Key> Move
          </span>
          <span className="flex items-center gap-1.5">
            <Key wide>Shift</Key> Run
          </span>
          <span className="flex items-center gap-1.5">
            <Key wide>Space</Key> Jump
          </span>
          <span className="flex items-center gap-1.5">
            <Key>E</Key> Interact
          </span>
          <span className="flex items-center gap-1.5">
            <Key wide>Esc</Key> Menu
          </span>
          <span className="flex items-center gap-1.5 text-ivory/55">Wheel · Zoom</span>
        </div>
      )}
    </div>
  );
}

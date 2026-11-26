"use client";

import { useEffect, useId } from "react";
import { CAMERA } from "@/config/gameConfig";
import { useGameStore } from "@/stores/gameStore";
import { exitPointerLock, requestPointerLock } from "@/systems/input/pointerLock";
import type { QualityLevel } from "@/types/game";
import { CloseIcon, EmblemIcon } from "./icons";

/** Pause menu: resume, settings (persisted), and a controls reference. */
export function SettingsMenu() {
  const menuOpen = useGameStore((s) => s.menuOpen);
  if (!menuOpen) return null;
  return <MenuPanel />;
}

function MenuPanel() {
  const settings = useGameStore((s) => s.settings);
  const update = useGameStore((s) => s.updateSettings);
  const reset = useGameStore((s) => s.resetSettings);
  const closeMenu = useGameStore((s) => s.closeMenu);
  const isTouch = useGameStore((s) => s.isTouch);
  const debugColliders = useGameStore((s) => s.debugColliders);
  const setDebugColliders = useGameStore((s) => s.setDebugColliders);

  // Menus need a free cursor. Browsers normally release pointer lock on Esc,
  // but the menu can also open while locked (settings shortcut, synthetic
  // key events), in which case every click would go to the locked canvas.
  useEffect(() => {
    exitPointerLock();
  }, []);

  const resume = () => {
    closeMenu();
    if (!isTouch) requestPointerLock();
  };

  return (
    <div className="menu-backdrop absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Pause menu">
      <div className="menu-panel relative flex max-h-full w-full max-w-[760px] flex-col overflow-hidden rounded-3xl">
        <header className="flex shrink-0 items-center justify-between border-b border-ivory/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <EmblemIcon size={22} className="text-gold" />
            <div>
              <h2 className="font-display text-xl tracking-[0.3em] text-ivory">PAUSED</h2>
              <p className="text-xs text-ivory/55">Your progress in the museum is kept while you are here.</p>
            </div>
          </div>
          <button type="button" onClick={resume} className="hud-button" aria-label="Close menu">
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 sm:grid-cols-[1fr_1fr]">
          <section className="flex flex-col gap-4">
            <SectionTitle>Controls</SectionTitle>
            <Slider label="Mouse sensitivity" min={0.2} max={3} step={0.05} value={settings.mouseSensitivity} onChange={(v) => update({ mouseSensitivity: v })} format={(v) => `${v.toFixed(2)}×`} />
            <Slider label="Touch look sensitivity" min={0.3} max={3} step={0.05} value={settings.touchSensitivity} onChange={(v) => update({ touchSensitivity: v })} format={(v) => `${v.toFixed(2)}×`} />
            <Slider label="Camera distance" min={CAMERA.minDistance} max={CAMERA.maxDistance} step={0.1} value={settings.cameraDistance} onChange={(v) => update({ cameraDistance: v })} format={(v) => `${v.toFixed(1)} m`} />
            <Toggle label="Invert vertical look" checked={settings.invertY} onChange={(v) => update({ invertY: v })} />

            <SectionTitle>Graphics</SectionTitle>
            <Segmented<QualityLevel>
              label="Quality"
              value={settings.quality}
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ]}
              onChange={(v) => update({ quality: v })}
            />
            <p className="-mt-2 text-[11px] leading-relaxed text-ivory/45">Low disables real-time shadows and lowers resolution — best for phones and older laptops.</p>
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle>Interface</SectionTitle>
            <Toggle label="Show control hints" checked={settings.showHints} onChange={(v) => update({ showHints: v })} />
            <Toggle label="Show FPS counter" checked={settings.showFps} onChange={(v) => update({ showFps: v })} />

            <SectionTitle>Controls reference</SectionTitle>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              {(isTouch
                ? [
                    ["Left stick", "Move"],
                    ["Drag right side", "Look around"],
                    ["Run button", "Toggle running"],
                    ["Jump button", "Jump"],
                    ["Hand button", "Inspect"],
                  ]
                : [
                    ["W A S D", "Move"],
                    ["Mouse", "Look around"],
                    ["Shift", "Run"],
                    ["Space", "Jump"],
                    ["E", "Interact / close"],
                    ["Mouse wheel", "Zoom"],
                    ["Esc", "Menu"],
                  ]
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium text-gold">{k}</dt>
                  <dd className="text-ivory/75">{v}</dd>
                </div>
              ))}
            </dl>

            <SectionTitle>Developer</SectionTitle>
            <Toggle label="Show collision volumes" checked={debugColliders} onChange={setDebugColliders} />
          </section>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-ivory/10 px-6 py-4">
          <button type="button" onClick={reset} className="text-xs text-ivory/55 underline-offset-4 hover:text-ivory hover:underline">
            Reset to defaults
          </button>
          <button type="button" onClick={resume} className="primary-button">
            Resume exploring
          </button>
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/90">{children}</h3>;
}

function Slider(props: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[13px]">
        <label htmlFor={id} className="text-ivory/85">
          {props.label}
        </label>
        <span className="tabular-nums text-ivory/55">{props.format(props.value)}</span>
      </div>
      <input id={id} type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} className="memora-range" />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center justify-between gap-4 text-left text-[13px] text-ivory/85">
      {label}
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-gold" : "bg-ivory/15"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-ivory shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-ivory/85">{label}</span>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-ivory/8 p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg py-1.5 text-[13px] transition-colors ${value === o.value ? "bg-gold font-medium text-ink" : "text-ivory/70 hover:bg-ivory/10"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

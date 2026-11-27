"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useGameStore } from "@/stores/gameStore";
import { addLook, input } from "@/systems/input/inputState";
import { HandIcon, JumpIcon, RunIcon } from "./icons";

const JOYSTICK_RADIUS = 52;
const DEAD_ZONE = 0.12;

/**
 * Touch controls designed for thumbs: a floating-origin joystick on the
 * left, a drag-to-look zone on the right and large action buttons within
 * reach of the right thumb. Each control tracks its own pointer id, so
 * moving, looking and jumping all work simultaneously (multi-touch).
 */
export function MobileControls() {
  const isTouch = useGameStore((s) => s.isTouch);
  const phase = useGameStore((s) => s.phase);
  const menuOpen = useGameStore((s) => s.menuOpen);
  const inspecting = useGameStore((s) => s.inspectingId);
  const active = isTouch && phase === "playing" && !menuOpen && !inspecting;

  // Release everything if the controls disappear mid-gesture.
  useEffect(() => {
    if (!active) {
      input.joystick.x = 0;
      input.joystick.y = 0;
    }
  }, [active]);

  if (!active) return null;
  return (
    <div className="absolute inset-0 z-10 select-none" style={{ touchAction: "none" }}>
      <LookZone />
      <Joystick />
      <ActionButtons />
    </div>
  );
}

function LookZone() {
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    addLook(e.clientX - p.x, e.clientY - p.y, "touch");
    p.x = e.clientX;
    p.y = e.clientY;
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current?.id === e.pointerId) pointer.current = null;
  };
  return (
    <div
      className="absolute inset-y-0 right-0 left-[38%]"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-label="Drag to look around"
    />
  );
}

function Joystick() {
  const zone = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const state = useRef<{ id: number; cx: number; cy: number } | null>(null);

  const setKnob = (dx: number, dy: number) => {
    if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };

  const release = () => {
    state.current = null;
    input.joystick.x = 0;
    input.joystick.y = 0;
    setKnob(0, 0);
    base.current?.classList.remove("joystick-active");
  };

  const update = (clientX: number, clientY: number) => {
    const s = state.current;
    if (!s) return;
    let dx = clientX - s.cx;
    let dy = clientY - s.cy;
    const len = Math.hypot(dx, dy);
    if (len > JOYSTICK_RADIUS) {
      dx = (dx / len) * JOYSTICK_RADIUS;
      dy = (dy / len) * JOYSTICK_RADIUS;
    }
    setKnob(dx, dy);
    let x = dx / JOYSTICK_RADIUS;
    let y = -dy / JOYSTICK_RADIUS;
    const mag = Math.hypot(x, y);
    if (mag < DEAD_ZONE) {
      x = 0;
      y = 0;
    } else {
      // Rescale so movement ramps smoothly from the edge of the dead zone.
      const scaled = (mag - DEAD_ZONE) / (1 - DEAD_ZONE);
      x = (x / mag) * scaled;
      y = (y / mag) * scaled;
    }
    input.joystick.x = x;
    input.joystick.y = y;
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (state.current || !base.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = base.current.getBoundingClientRect();
    state.current = { id: e.pointerId, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    base.current.classList.add("joystick-active");
    update(e.clientX, e.clientY);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (state.current?.id === e.pointerId) update(e.clientX, e.clientY);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (state.current?.id === e.pointerId) release();
  };

  useEffect(() => release, []);

  return (
    <div
      ref={zone}
      data-testid="joystick-zone"
      className="absolute bottom-0 left-0 h-[min(46vh,260px)] w-[min(44vw,260px)]"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div
        ref={base}
        data-testid="joystick-base"
        className="joystick-base absolute h-[128px] w-[128px] rounded-full"
        style={{ left: "max(28px, env(safe-area-inset-left))", bottom: "max(28px, env(safe-area-inset-bottom))" }}
      >
        <div ref={knob} className="joystick-knob absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full" />
      </div>
    </div>
  );
}

function ActionButtons() {
  // Highlighted when something is in reach, or to stand up from a seat.
  const nearby = useGameStore((s) => s.nearby !== null || s.seatedId !== null);
  const interact = useGameStore((s) => s.interact);
  const [running, setRunning] = useState(input.runToggle);

  const press = (e: ReactPointerEvent<HTMLButtonElement>, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <div
      className="absolute grid grid-cols-2 grid-rows-2 items-center justify-items-center gap-3"
      style={{ right: "max(22px, env(safe-area-inset-right))", bottom: "max(22px, env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        aria-label="Interact"
        aria-disabled={!nearby}
        data-testid="btn-interact"
        className={`touch-button col-start-1 row-start-1 h-16 w-16 ${nearby ? "touch-button-highlight" : "opacity-45"}`}
        onPointerDown={(e) => press(e, interact)}
      >
        <HandIcon size={26} />
      </button>
      <button
        type="button"
        aria-label={running ? "Walk" : "Run"}
        aria-pressed={running}
        data-testid="btn-run"
        className={`touch-button col-start-1 row-start-2 h-14 w-14 ${running ? "touch-button-on" : ""}`}
        onPointerDown={(e) =>
          press(e, () => {
            input.runToggle = !input.runToggle;
            setRunning(input.runToggle);
          })
        }
      >
        <RunIcon size={22} />
      </button>
      <button
        type="button"
        aria-label="Jump"
        data-testid="btn-jump"
        className="touch-button col-start-2 row-span-2 h-20 w-20"
        onPointerDown={(e) => press(e, () => (input.jumpQueued = true))}
      >
        <JumpIcon size={30} />
      </button>
    </div>
  );
}

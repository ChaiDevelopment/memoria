/**
 * Per-frame input state. Intentionally a plain mutable object (not React
 * state): it changes many times per second and is read inside the render
 * loop, so routing it through React/Zustand would cause needless re-renders.
 *
 * Producers: keyboard/mouse hooks (desktop) and MobileControls (touch).
 * Consumer: PlayerController, once per frame.
 */

export interface InputState {
  /** Currently held keys, by KeyboardEvent.code. */
  keys: Set<string>;
  /** Virtual joystick vector (x = right, y = forward), magnitude 0..1. */
  joystick: { x: number; y: number };
  /** Accumulated look delta in pixels since the last frame. */
  look: { x: number; y: number; source: "mouse" | "touch" };
  /** Accumulated zoom delta (wheel). */
  zoom: number;
  /** Edge-triggered actions, cleared by the consumer. */
  jumpQueued: boolean;
  /** Mobile run toggle. */
  runToggle: boolean;
}

export const input: InputState = {
  keys: new Set(),
  joystick: { x: 0, y: 0 },
  look: { x: 0, y: 0, source: "mouse" },
  zoom: 0,
  jumpQueued: false,
  runToggle: false,
};

export function addLook(dx: number, dy: number, source: "mouse" | "touch") {
  input.look.x += dx;
  input.look.y += dy;
  input.look.source = source;
}

/** Desired movement in camera-relative axes: x = strafe right, y = forward. */
export function readMoveAxes(): { x: number; y: number; run: boolean } {
  const k = input.keys;
  let x = 0;
  let y = 0;
  if (k.has("KeyW") || k.has("ArrowUp")) y += 1;
  if (k.has("KeyS") || k.has("ArrowDown")) y -= 1;
  if (k.has("KeyD") || k.has("ArrowRight")) x += 1;
  if (k.has("KeyA") || k.has("ArrowLeft")) x -= 1;
  const len = Math.hypot(x, y);
  if (len > 0) {
    x /= len;
    y /= len;
  } else {
    x = input.joystick.x;
    y = input.joystick.y;
  }
  const run = k.has("ShiftLeft") || k.has("ShiftRight") || input.runToggle;
  return { x, y, run };
}

export function resetInput() {
  input.keys.clear();
  input.joystick.x = 0;
  input.joystick.y = 0;
  input.look.x = 0;
  input.look.y = 0;
  input.zoom = 0;
  input.jumpQueued = false;
}

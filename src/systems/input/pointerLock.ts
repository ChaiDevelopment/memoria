/**
 * Pointer-lock helpers. Browsers only grant pointer lock in response to a user
 * gesture and may reject requests made shortly after the user pressed Esc, so
 * every request is wrapped to fail softly (the player can click again).
 */

let lockTarget: HTMLElement | null = null;

export function setPointerLockTarget(el: HTMLElement | null) {
  lockTarget = el;
}

export function isPointerLocked(): boolean {
  return typeof document !== "undefined" && lockTarget !== null && document.pointerLockElement === lockTarget;
}

export function requestPointerLock() {
  if (!lockTarget || isPointerLocked() || typeof lockTarget.requestPointerLock !== "function") return;
  try {
    const result = lockTarget.requestPointerLock() as unknown;
    if (result instanceof Promise) result.catch(() => undefined);
  } catch {
    // Not allowed right now (e.g. cooldown after Esc); a later click retries.
  }
}

export function exitPointerLock() {
  if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
}

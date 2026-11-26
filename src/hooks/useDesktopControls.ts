"use client";

import { useEffect, type RefObject } from "react";
import { gameStore } from "@/stores/gameStore";
import { addLook, input, resetInput } from "@/systems/input/inputState";
import { isPointerLocked, requestPointerLock, setPointerLockTarget } from "@/systems/input/pointerLock";

const MOVEMENT_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
]);

/** Ignore Esc key events this soon after the browser released pointer lock (it was the same press). */
const UNLOCK_ESC_GRACE_MS = 400;
/** Chrome occasionally reports a huge first movement after locking. */
const MAX_MOUSE_DELTA = 300;

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * Keyboard + mouse controls. Movement keys use KeyboardEvent.code so WASD
 * works on any keyboard layout. Esc follows the browser's pointer-lock
 * behaviour: releasing the lock opens the pause menu.
 */
export function useDesktopControls(surface: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    setPointerLockTarget(el);
    let lastUnlockAt = 0;
    let dragging = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) && e.code !== "Escape") return;
      const st = gameStore.getState();
      if (MOVEMENT_CODES.has(e.code)) {
        input.keys.add(e.code);
        if (e.code.startsWith("Arrow")) e.preventDefault();
        return;
      }
      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (!e.repeat) input.jumpQueued = true;
          break;
        case "KeyE":
          if (e.repeat || st.phase !== "playing" || st.menuOpen) break;
          if (st.inspectingId) st.closeInspect();
          else if (st.liftMenuOpen) st.closeLiftMenu();
          else if (st.albumIndex !== null) st.closeAlbum();
          else st.interact();
          break;
        case "Escape":
          if (performance.now() - lastUnlockAt < UNLOCK_ESC_GRACE_MS) break;
          if (st.inspectingId) st.closeInspect();
          else if (st.liftMenuOpen) st.closeLiftMenu();
          else if (st.albumIndex !== null) st.closeAlbum();
          else if (st.menuOpen) st.closeMenu();
          else if (st.phase === "playing") st.openMenu();
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      input.keys.delete(e.code);
    };

    const onBlur = () => resetInput();
    const onVisibility = () => {
      if (document.hidden) resetInput();
    };

    const onMouseDown = (e: MouseEvent) => {
      const st = gameStore.getState();
      // Only clicks on the 3D view itself (not HUD buttons layered on top) capture the mouse.
      if (!(e.target instanceof HTMLCanvasElement)) return;
      if (st.isTouch || st.phase !== "playing" || st.menuOpen || e.button !== 0) return;
      dragging = true;
      requestPointerLock();
    };
    const onMouseUp = () => {
      dragging = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerLocked() && !dragging) return;
      if (Math.abs(e.movementX) > MAX_MOUSE_DELTA || Math.abs(e.movementY) > MAX_MOUSE_DELTA) return;
      addLook(e.movementX, e.movementY, "mouse");
    };
    const onWheel = (e: WheelEvent) => {
      input.zoom += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    };

    const onLockChange = () => {
      const locked = isPointerLocked();
      const st = gameStore.getState();
      st.setPointerLocked(locked);
      if (locked) return;
      lastUnlockAt = performance.now();
      resetInput();
      if (st.inspectingId) st.closeInspect();
      // The lift menu releases the mouse on purpose (to click a floor).
      else if (st.phase === "playing" && !st.menuOpen && !st.liftMenuOpen && st.albumIndex === null && !st.isTouch) st.openMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousemove", onMouseMove);
    el.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("wheel", onWheel);
      document.removeEventListener("pointerlockchange", onLockChange);
      setPointerLockTarget(null);
    };
  }, [surface]);
}

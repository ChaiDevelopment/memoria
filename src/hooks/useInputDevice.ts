"use client";

import { useEffect } from "react";
import { gameStore } from "@/stores/gameStore";

/**
 * Decides between touch and mouse/keyboard controls. Starts from the
 * primary pointer type and then follows whatever the player actually uses,
 * so hybrid devices (touch laptops, tablets with keyboards) just work.
 */
export function useInputDevice() {
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    gameStore.getState().setIsTouch(coarse.matches);

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") gameStore.getState().setIsTouch(true);
      else if (e.pointerType === "mouse") gameStore.getState().setIsTouch(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) gameStore.getState().setIsTouch(false);
    };
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}

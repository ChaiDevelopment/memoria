import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CAMERA } from "@/config/gameConfig";
import type { ExhibitPhoto } from "@/content/exhibits";
import type { GameSettings, QualityLevel } from "@/types/game";
import type { AreaId } from "@/types/world";

/**
 * UI-level game state. Only values that change rarely live here (menus,
 * current area, nearby interactable…). Per-frame data such as positions and
 * input lives in mutable refs inside the game loop to avoid React re-renders.
 */

export type GamePhase = "title" | "playing";

export interface GameState {
  phase: GamePhase;
  menuOpen: boolean;
  /** Memory id currently being inspected, or null. */
  inspectingId: string | null;
  /** Interactable the player can currently use. */
  nearby: { id: string; memoryId: string; label: string } | null;
  currentArea: AreaId | null;
  isTouch: boolean;
  pointerLocked: boolean;
  /** Placeholder until multiplayer arrives in a later phase. */
  visitorCount: number;
  museumName: string;
  settings: GameSettings;
  /** Developer aid: render collision volumes (not persisted). */
  debugColliders: boolean;
  /** The signed-in user's photos hung in the museum: frame slot id → photo. */
  exhibits: Record<string, ExhibitPhoto>;
  exhibitsStatus: "loading" | "signed-out" | "ready" | "error";

  enterMuseum: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  openInspect: (memoryId: string) => void;
  closeInspect: () => void;
  setNearby: (nearby: GameState["nearby"]) => void;
  setCurrentArea: (area: AreaId | null) => void;
  setIsTouch: (isTouch: boolean) => void;
  setPointerLocked: (locked: boolean) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  resetSettings: () => void;
  setDebugColliders: (on: boolean) => void;
  setExhibits: (status: GameState["exhibitsStatus"], exhibits?: Record<string, ExhibitPhoto>) => void;
}

function defaultQuality(): QualityLevel {
  if (typeof window === "undefined") return "medium";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse ? "low" : "high";
}

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1,
  touchSensitivity: 1,
  invertY: false,
  quality: "high",
  showFps: false,
  showHints: true,
  cameraDistance: CAMERA.defaultDistance,
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: "title",
      menuOpen: false,
      inspectingId: null,
      nearby: null,
      currentArea: null,
      isTouch: false,
      pointerLocked: false,
      visitorCount: 1,
      museumName: "The Museum of Small Moments",
      settings: { ...DEFAULT_SETTINGS, quality: defaultQuality() },
      debugColliders: false,
      exhibits: {},
      exhibitsStatus: "loading",

      enterMuseum: () => set({ phase: "playing", menuOpen: false }),
      openMenu: () => {
        if (get().phase !== "playing") return;
        set({ menuOpen: true, inspectingId: null });
      },
      closeMenu: () => set({ menuOpen: false }),
      openInspect: (memoryId) => {
        if (get().menuOpen) return;
        set({ inspectingId: memoryId });
      },
      closeInspect: () => set({ inspectingId: null }),
      setNearby: (nearby) => {
        if (get().nearby?.id === nearby?.id) return;
        set({ nearby });
      },
      setCurrentArea: (currentArea) => {
        if (get().currentArea !== currentArea) set({ currentArea });
      },
      setIsTouch: (isTouch) => {
        if (get().isTouch !== isTouch) set({ isTouch });
      },
      setPointerLocked: (pointerLocked) => set({ pointerLocked }),
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS, quality: defaultQuality() } }),
      setDebugColliders: (debugColliders) => set({ debugColliders }),
      setExhibits: (exhibitsStatus, exhibits) => set(exhibits ? { exhibitsStatus, exhibits } : { exhibitsStatus }),
    }),
    {
      name: "memora-settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      merge: (persisted, current) => {
        const saved = (persisted as { settings?: Partial<GameSettings> } | undefined)?.settings;
        return { ...current, settings: { ...current.settings, ...(saved ?? {}) } };
      },
    },
  ),
);

/** Convenience for non-React code (game loop, event handlers). */
export const gameStore = useGameStore;

export function isGameplayBlocked(s: Pick<GameState, "phase" | "menuOpen" | "inspectingId">): boolean {
  return s.phase !== "playing" || s.menuOpen || s.inspectingId !== null;
}

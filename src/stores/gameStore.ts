import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CAMERA } from "@/config/gameConfig";
import type { ExhibitPhoto } from "@/content/exhibits";

/** A guest book message as served by /api/guestbook. */
export interface GuestbookEntryView {
  time: string;
  name: string;
  message: string;
  guest: boolean;
}

/** An Album Kata chapter as served by /api/album. */
export interface AlbumChapterView {
  period: string;
  title: string;
  words: string;
  photos: { id: string; thumbUrl: string; url: string }[];
}
import type { PeerInfo } from "@/shared/presence";
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
  nearby: { id: string; kind: "photo" | "lift" | "album" | "guestbook"; memoryId: string; label: string } | null;
  /** Who is visiting: an owner (Google sign-in) or a keyword visitor; null = nobody yet. */
  viewer: { role: "owner" | "visitor"; name: string } | null;
  viewerStatus: "loading" | "ready";
  /** Bumped when the visitor joins / leaves, so photos and presence reload. */
  accessVersion: number;
  guestbook: GuestbookEntryView[];
  guestbookOpen: boolean;
  /** Album Kata chapters (from the Sheet's "Album" tab). */
  album: AlbumChapterView[];
  /** Chapter being read, or null. */
  albumIndex: number | null;
  /** The lift's floor menu is open. */
  liftMenuOpen: boolean;
  /** A requested move (lift ride) for the player controller to apply on its next frame. */
  pendingTeleport: { x: number; y: number; z: number; facing: number } | null;
  /** Storey the player is on (0 = ground). */
  currentFloor: number;
  /** Increments on every lift ride (drives the arrival fade). */
  rides: number;
  currentArea: AreaId | null;
  isTouch: boolean;
  pointerLocked: boolean;
  /** Multiplayer connection state and the other visitors currently in the museum. */
  presence: "off" | "connecting" | "online";
  peers: PeerInfo[];
  museumName: string;
  settings: GameSettings;
  /** Developer aid: render collision volumes (not persisted). */
  debugColliders: boolean;
  /** The signed-in user's photos hung in the museum: frame slot id → photo. */
  exhibits: Record<string, ExhibitPhoto>;
  exhibitsStatus: "loading" | "signed-out" | "ready" | "error";
  /** Photos beyond the museum's own frames — they open Memory Halls. */
  wingFrames: number;

  enterMuseum: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  openInspect: (memoryId: string) => void;
  closeInspect: () => void;
  setNearby: (nearby: GameState["nearby"]) => void;
  /** Use whatever is nearby: inspect a photo or call the lift. */
  interact: () => void;
  closeLiftMenu: () => void;
  setViewer: (viewer: GameState["viewer"], museumName?: string) => void;
  refreshAccess: () => void;
  setGuestbook: (entries: GuestbookEntryView[]) => void;
  openGuestbook: () => void;
  closeGuestbook: () => void;
  setAlbum: (album: AlbumChapterView[]) => void;
  openAlbum: (index: number) => void;
  closeAlbum: () => void;
  requestTeleport: (to: NonNullable<GameState["pendingTeleport"]>) => void;
  consumeTeleport: () => GameState["pendingTeleport"];
  setCurrentFloor: (floor: number) => void;
  setCurrentArea: (area: AreaId | null) => void;
  setIsTouch: (isTouch: boolean) => void;
  setPointerLocked: (locked: boolean) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  resetSettings: () => void;
  setDebugColliders: (on: boolean) => void;
  setExhibits: (status: GameState["exhibitsStatus"], exhibits?: Record<string, ExhibitPhoto>, wingFrames?: number) => void;
  setPresence: (presence: GameState["presence"], peers?: PeerInfo[]) => void;
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
      liftMenuOpen: false,
      viewer: null,
      viewerStatus: "loading",
      accessVersion: 0,
      guestbook: [],
      guestbookOpen: false,
      album: [],
      albumIndex: null,
      pendingTeleport: null,
      currentFloor: 0,
      rides: 0,
      currentArea: null,
      isTouch: false,
      pointerLocked: false,
      presence: "off",
      peers: [],
      museumName: "The Museum of Small Moments",
      settings: { ...DEFAULT_SETTINGS, quality: defaultQuality() },
      debugColliders: false,
      exhibits: {},
      exhibitsStatus: "loading",
      wingFrames: 0,

      enterMuseum: () => set({ phase: "playing", menuOpen: false }),
      openMenu: () => {
        if (get().phase !== "playing") return;
        set({ menuOpen: true, inspectingId: null, liftMenuOpen: false, albumIndex: null, guestbookOpen: false });
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
      interact: () => {
        const { nearby, menuOpen, phase } = get();
        if (!nearby || menuOpen || phase !== "playing") return;
        if (nearby.kind === "lift") set({ liftMenuOpen: true });
        else if (nearby.kind === "guestbook") set({ guestbookOpen: true });
        else if (nearby.kind === "album") {
          const index = Number(nearby.memoryId.replace("album-", ""));
          if (get().album[index]) set({ albumIndex: index });
        }
        else set({ inspectingId: nearby.memoryId });
      },
      closeLiftMenu: () => set({ liftMenuOpen: false }),
      setViewer: (viewer, museumName) => set({ viewer, viewerStatus: "ready", ...(museumName ? { museumName } : {}) }),
      refreshAccess: () => set({ accessVersion: get().accessVersion + 1, viewerStatus: "loading" }),
      setGuestbook: (guestbook) => set({ guestbook }),
      openGuestbook: () => set({ guestbookOpen: true }),
      closeGuestbook: () => set({ guestbookOpen: false }),
      setAlbum: (album) => set({ album }),
      openAlbum: (index) => set({ albumIndex: Math.max(0, Math.min(get().album.length - 1, index)) }),
      closeAlbum: () => set({ albumIndex: null }),
      requestTeleport: (pendingTeleport) => set({ pendingTeleport, liftMenuOpen: false, rides: get().rides + 1 }),
      consumeTeleport: () => {
        const t = get().pendingTeleport;
        if (t) set({ pendingTeleport: null });
        return t;
      },
      setCurrentFloor: (currentFloor) => {
        if (get().currentFloor !== currentFloor) set({ currentFloor });
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
      setPresence: (presence, peers) => set(peers ? { presence, peers } : { presence }),
      setExhibits: (exhibitsStatus, exhibits, wingFrames) =>
        set({ exhibitsStatus, ...(exhibits ? { exhibits } : {}), ...(wingFrames !== undefined ? { wingFrames } : {}) }),
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

export function isGameplayBlocked(s: Pick<GameState, "phase" | "menuOpen" | "inspectingId" | "liftMenuOpen" | "albumIndex" | "guestbookOpen">): boolean {
  return s.phase !== "playing" || s.menuOpen || s.inspectingId !== null || s.liftMenuOpen || s.albumIndex !== null || s.guestbookOpen;
}

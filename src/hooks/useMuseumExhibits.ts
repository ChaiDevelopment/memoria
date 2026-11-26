"use client";

import { useEffect } from "react";
import { MEMORY_BY_ID, PHOTO_PLACEMENTS } from "@/config/memories";
import { buildGrandLayout, MAX_HALL_FRAMES } from "@/config/grandMuseum";
import { assignExhibits, type ExhibitPhoto, type FrameSlot } from "@/content/exhibits";
import { api } from "@/lib/apiClient";
import { gameStore, type AlbumChapterView } from "@/stores/gameStore";
import type { PhotoPlacement } from "@/types/memory";

function slotFor(p: PhotoPlacement, section: FrameSlot["section"]): FrameSlot {
  return { slotId: p.memoryId, aspect: p.aspect ?? MEMORY_BY_ID.get(p.memoryId)?.aspect ?? 1.5, section };
}

/** The museum's own frames, in placement order. */
export const FRAME_SLOTS: FrameSlot[] = PHOTO_PLACEMENTS.map((p) =>
  slotFor(p, p.memoryId.startsWith("t") ? "timeline" : p.mount === "easel" ? "garden" : "gallery"),
);

/**
 * All frames for a collection of `photoCount` photos: the museum's own, then
 * the Memory Halls in fill order — so, as photos arrive oldest first, each
 * floor holds a later stretch of years than the one below.
 */
export function frameSlotsFor(photoCount: number): { slots: FrameSlot[]; wingFrames: number } {
  const wingFrames = Math.min(MAX_HALL_FRAMES, Math.max(0, photoCount - FRAME_SLOTS.length));
  const wing = buildGrandLayout(wingFrames).placements.map((p) => slotFor(p, "room"));
  return { slots: [...FRAME_SLOTS, ...wing], wingFrames };
}

/**
 * Loads the signed-in visitor's photos and hangs them in the museum,
 * opening Memory Halls for photos beyond the museum's own frames.
 * Visitors who aren't signed in (or have no photos yet) see the
 * placeholder paintings.
 */
export function useMuseumExhibits() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api<{ user: { email: string } | null }>("/api/auth/me");
        if (!me.user) {
          if (!cancelled) gameStore.getState().setExhibits("signed-out", {}, 0);
          return;
        }
        const { photos } = await api<{ photos: ExhibitPhoto[] }>("/api/photos");
        const { slots, wingFrames } = frameSlotsFor(photos.length);
        if (!cancelled) gameStore.getState().setExhibits("ready", assignExhibits(slots, photos), wingFrames);
        // The Album Kata is optional: without an "Album" tab the balconies just have no books.
        try {
          const { chapters } = await api<{ chapters: AlbumChapterView[] }>("/api/album");
          if (!cancelled) gameStore.getState().setAlbum(chapters);
        } catch (err) {
          console.warn("[MEMORA] Could not load the Album Kata.", err);
        }
      } catch (err) {
        // Not configured, offline, etc.: the museum still works with placeholders.
        console.warn("[MEMORA] Could not load your photos; showing placeholders.", err);
        if (!cancelled) gameStore.getState().setExhibits("error", {}, 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

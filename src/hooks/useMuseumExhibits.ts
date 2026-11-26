"use client";

import { useEffect } from "react";
import { MEMORY_BY_ID, PHOTO_PLACEMENTS } from "@/config/memories";
import { assignExhibits, type ExhibitPhoto, type FrameSlot } from "@/content/exhibits";
import { api } from "@/lib/apiClient";
import { gameStore } from "@/stores/gameStore";

/** Every frame in the museum, in placement order. */
export const FRAME_SLOTS: FrameSlot[] = PHOTO_PLACEMENTS.map((p) => ({
  slotId: p.memoryId,
  aspect: MEMORY_BY_ID.get(p.memoryId)?.aspect ?? 1.5,
  section: p.memoryId.startsWith("t") ? "timeline" : p.mount === "easel" ? "garden" : "gallery",
}));

/**
 * Loads the signed-in visitor's photos and hangs them in the museum.
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
          if (!cancelled) gameStore.getState().setExhibits("signed-out", {});
          return;
        }
        const { photos } = await api<{ photos: ExhibitPhoto[] }>("/api/photos");
        if (!cancelled) gameStore.getState().setExhibits("ready", assignExhibits(FRAME_SLOTS, photos));
      } catch (err) {
        // Not configured, offline, etc.: the museum still works with placeholders.
        console.warn("[MEMORA] Could not load your photos; showing placeholders.", err);
        if (!cancelled) gameStore.getState().setExhibits("error", {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

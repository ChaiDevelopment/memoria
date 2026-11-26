"use client";

import { useEffect } from "react";
import { MEMORY_BY_ID, PHOTO_PLACEMENTS } from "@/config/memories";
import { buildGrandLayout, MAX_HALL_FRAMES } from "@/config/grandMuseum";
import { assignExhibits, type ExhibitPhoto, type FrameSlot } from "@/content/exhibits";
import { api } from "@/lib/apiClient";
import { gameStore, useGameStore, type AlbumChapterView, type GuestbookEntryView } from "@/stores/gameStore";
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
 * Loads the museum's photos for its owners and keyword visitors and hangs
 * them, opening Memory Halls for photos beyond the museum's own frames.
 * Anyone else (the demo tour) sees the placeholder paintings.
 */
export function useMuseumExhibits() {
  const accessVersion = useGameStore((st) => st.accessVersion);
  useEffect(() => {
    let cancelled = false;
    const store = gameStore.getState();
    (async () => {
      try {
        const me = await api<{ user: { name: string | null; email: string } | null; visitor: { name: string } | null; world: { name: string } | null }>("/api/auth/me");
        if (cancelled) return;
        const viewer = me.user
          ? { role: "owner" as const, name: me.user.name?.trim().split(/\s+/)[0] || me.user.email.split("@")[0]! }
          : me.visitor
            ? { role: "visitor" as const, name: me.visitor.name }
            : null;
        store.setViewer(viewer, me.world?.name);
        if (!viewer) {
          store.setExhibits("signed-out", {}, 0);
          store.setAlbum([]);
          store.setGuestbook([]);
          return;
        }
        const { photos } = await api<{ photos: ExhibitPhoto[] }>("/api/photos");
        const { slots, wingFrames } = frameSlotsFor(photos.length);
        if (!cancelled) store.setExhibits("ready", assignExhibits(slots, photos), wingFrames);
        // The Album Kata and guest book are optional extras.
        const [album, guestbook] = await Promise.allSettled([
          api<{ chapters: AlbumChapterView[] }>("/api/album"),
          api<{ entries: GuestbookEntryView[] }>("/api/guestbook"),
        ]);
        if (cancelled) return;
        if (album.status === "fulfilled") store.setAlbum(album.value.chapters);
        else console.warn("[MEMORA] Could not load the Album Kata.", album.reason);
        if (guestbook.status === "fulfilled") store.setGuestbook(guestbook.value.entries);
      } catch (err) {
        // Not configured, offline, etc.: the museum still works with placeholders.
        console.warn("[MEMORA] Could not load your photos; showing placeholders.", err);
        if (!cancelled) {
          if (gameStore.getState().viewerStatus === "loading") store.setViewer(null);
          store.setExhibits("error", {}, 0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessVersion]);
}

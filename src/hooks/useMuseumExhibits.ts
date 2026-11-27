"use client";

import { useEffect } from "react";
import { MEMORY_BY_ID, PHOTO_PLACEMENTS } from "@/config/memories";
import { buildGrandLayout, MAX_HALL_FRAMES } from "@/config/grandMuseum";
import { assignExhibits, type ExhibitPhoto, type FrameSlot } from "@/content/exhibits";
import { api } from "@/lib/apiClient";
import { gameStore, useGameStore, type AlbumChapterView, type GuestbookEntryView, type InvitationView, type ViewerRole } from "@/stores/gameStore";
import { weddingFrameSlots } from "@/systems/world/buildWedding";
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

interface Me {
  user: { name: string | null; email: string; admin: boolean } | null;
  viewer: { role: ViewerRole; name: string } | null;
  world: { kind: "museum"; name: string } | { kind: "invitation"; theme: "wedding" | "museum"; name: string; keyword: string } | null;
}

/**
 * Loads the world the visitor is in and hangs its photos: the museum (for
 * its owners and keyword visitors, opening Memory Halls as needed) or a
 * wedding invitation's venue. Anyone else (the demo tour) sees the
 * placeholder paintings.
 */
export function useMuseumExhibits() {
  const accessVersion = useGameStore((st) => st.accessVersion);
  useEffect(() => {
    let cancelled = false;
    const store = gameStore.getState();
    (async () => {
      try {
        const me = await api<Me>("/api/auth/me");
        if (cancelled) return;
        const viewer = me.viewer;
        if (!viewer) {
          store.setViewer(null);
          store.setWorld({ kind: "museum" });
          store.setExhibits("signed-out", {}, 0);
          store.setAlbum([]);
          store.setGuestbook([]);
          return;
        }

        if (me.world?.kind === "invitation" && me.world.theme === "wedding") {
          // A wedding invitation: its details, prewedding photos and wishes.
          const [{ invitation }, { photos }] = await Promise.all([
            api<{ invitation: InvitationView | null }>("/api/invitation"),
            api<{ photos: ExhibitPhoto[] }>("/api/photos"),
          ]);
          if (cancelled) return;
          if (!invitation) throw new Error("Invitation not available");
          store.setAlbum([]);
          store.setWorld({ kind: "wedding", invitation });
          store.setViewer(viewer, invitation.title);
          store.setExhibits("ready", assignExhibits(weddingFrameSlots(invitation.setting, photos.length), photos), 0);
          const wishes = await api<{ entries: GuestbookEntryView[] }>("/api/guestbook").catch(() => null);
          if (!cancelled && wishes) store.setGuestbook(wishes.entries);
          return;
        }

        // A museum: the admins' own, or a museum world someone created (its
        // photos, an empty Album Kata and its own guest book come from the same APIs).
        store.setWorld({ kind: "museum" });
        store.setViewer(viewer, me.world?.name);
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

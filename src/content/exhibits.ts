/**
 * Decides which of the user's photos hangs in which museum frame.
 *
 * Frames keep their designed size and position (so architecture, labels
 * and collision never change); a photo is cropped to fill its frame, and
 * the full image is shown when the visitor inspects it. Pure — unit tested.
 */

export interface ExhibitPhoto {
  id: string;
  title: string;
  year: number | null;
  story: string;
  width: number | null;
  height: number | null;
  thumbUrl: string;
  url: string;
}

export interface FrameSlot {
  /** Placement key (the placeholder memory id, e.g. "g01", "t03"). */
  slotId: string;
  /** Frame width / height. */
  aspect: number;
  section: "gallery" | "timeline" | "garden";
}

type Orientation = "landscape" | "portrait" | "square";

function orientationOf(aspect: number): Orientation {
  if (aspect > 1.1) return "landscape";
  if (aspect < 0.9) return "portrait";
  return "square";
}

function photoOrientation(p: ExhibitPhoto): Orientation {
  return p.width && p.height ? orientationOf(p.width / p.height) : "landscape";
}

/**
 * @param photos the user's photos, oldest first (as returned by /api/photos)
 * @returns slotId → photo. Slots left out keep their placeholder.
 */
export function assignExhibits(slots: readonly FrameSlot[], photos: readonly ExhibitPhoto[]): Record<string, ExhibitPhoto> {
  const result: Record<string, ExhibitPhoto> = {};
  const pool = [...photos];
  const timeline = slots.filter((s) => s.section === "timeline");
  const others = slots.filter((s) => s.section !== "timeline");

  // Timeline Hall: a chronological walk through the whole collection —
  // photos sampled evenly from the oldest to the newest. Only when there are
  // enough photos to fill the rest of the museum too; otherwise the gallery
  // (the main room) is filled first.
  if (pool.length >= slots.length && timeline.length > 0) {
    // Sample from photos that suit the timeline frames' orientation, so
    // portraits stay available for portrait frames elsewhere.
    const want = orientationOf(timeline[0]!.aspect);
    const matching = pool.filter((p) => photoOrientation(p) === want);
    const candidates = matching.length >= timeline.length ? matching : pool;
    const picks =
      timeline.length === 1
        ? [0]
        : Array.from({ length: timeline.length }, (_, i) => Math.round((i * (candidates.length - 1)) / (timeline.length - 1)));
    const chosen = [...new Set(picks)].map((i) => candidates[i]!);
    timeline.forEach((slot, i) => {
      const photo = chosen[i];
      if (photo) result[slot.slotId] = photo;
    });
    const used = new Set(chosen.map((p) => p.id));
    for (let i = pool.length - 1; i >= 0; i--) if (used.has(pool[i]!.id)) pool.splice(i, 1);
  }

  const order = pool.length >= slots.length || Object.keys(result).length > 0 ? others : [...others.filter((s) => s.section === "gallery"), ...timeline, ...others.filter((s) => s.section === "garden")];
  for (const slot of order) {
    if (result[slot.slotId] || pool.length === 0) continue;
    // Prefer a photo with the frame's orientation, so less of it is cropped away.
    const want = orientationOf(slot.aspect);
    let index = pool.findIndex((p) => photoOrientation(p) === want);
    if (index < 0) index = 0;
    result[slot.slotId] = pool.splice(index, 1)[0]!;
  }
  return result;
}

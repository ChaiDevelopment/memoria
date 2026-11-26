import { ATRIUM, FLOOR_HEIGHT, type GrandLayout } from "@/config/grandMuseum";
import type { SignDef } from "@/config/museumLayout";

/**
 * Signs that tell visitors where each floor's memories are: a plaque above
 * every atrium door into a Memory Hall (with its years) and a large era
 * title on each balcony. Pure — unit tested.
 */

/** Storey + hall of a frame slot: "h<floor>-<hall>-n" (halls), "b<floor>-n" (balconies), others = ground floor museum. */
function slotInfo(slotId: string): { floor: number; hall: number | null } {
  const h = /^h(\d+)-(\d+)-/.exec(slotId);
  if (h) return { floor: Number(h[1]), hall: Number(h[2]) };
  const b = /^b(\d+)-/.exec(slotId);
  return { floor: b ? Number(b[1]) : 0, hall: null };
}

export function yearSpan(years: readonly number[]): string | null {
  if (years.length === 0) return null;
  const from = Math.min(...years);
  const to = Math.max(...years);
  return from === to ? `${from}` : `${from} – ${to}`;
}

export function grandSigns(grand: Pick<GrandLayout, "halls" | "topFloor" | "lecterns">, exhibits: Readonly<Record<string, { year: number | null }>>, albumTitles = 0): SignDef[] {
  const floorYears = new Map<number, number[]>();
  const hallYears = new Map<string, number[]>();
  for (const [slot, photo] of Object.entries(exhibits)) {
    if (photo.year === null) continue;
    const { floor, hall } = slotInfo(slot);
    floorYears.set(floor, [...(floorYears.get(floor) ?? []), photo.year]);
    if (hall !== null) hallYears.set(`${floor}-${hall}`, [...(hallYears.get(`${floor}-${hall}`) ?? []), photo.year]);
  }

  const signs: SignDef[] = [];
  const doorX = ATRIUM.maxX - 0.2 - 0.03;
  for (const h of grand.halls) {
    if (h.col !== 0) continue; // only the halls opening onto the atrium
    const label = `Memory Hall ${h.floor === 0 ? "G" : h.floor}${String.fromCharCode(65 + h.index)}`;
    const years = yearSpan(hallYears.get(`${h.floor}-${h.index + 1}`) ?? []);
    signs.push({
      id: `door-${h.floor}-${h.index}`,
      title: label,
      subtitle: years ? `${years}  →` : "More memories  →",
      x: doorX,
      y: h.floor * FLOOR_HEIGHT + 4.2,
      z: h.row === 0 ? 21 : 35,
      facing: "-x",
      width: 3.2,
      height: 0.8,
      style: "plaque",
    });
  }

  for (let f = 1; f <= grand.topFloor; f++) {
    const years = yearSpan(floorYears.get(f) ?? []);
    const chapters = grand.lecterns.filter((l) => l.floor === f && l.index < albumTitles);
    const parts = [chapters.length ? "Album Kata" : null, years].filter(Boolean);
    signs.push({
      id: `era-${f}`,
      title: `Floor ${f}`,
      subtitle: parts.length ? parts.join("  ·  ") : "Grand Atrium",
      x: ATRIUM.minX + 0.2 + 0.03,
      y: f * FLOOR_HEIGHT + 4.95,
      z: 26,
      facing: "+x",
      width: 6,
      height: 1.0,
      style: "hero",
    });
  }
  return signs;
}

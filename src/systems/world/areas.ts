import { AREAS } from "@/config/museumLayout";
import type { AreaDef } from "@/types/world";

/**
 * Returns the area containing (x, z) on the floor the player is on (feet
 * height `y`), or null when between areas (e.g. inside a doorway).
 */
export function areaAt(x: number, z: number, areas: readonly AreaDef[] = AREAS, y = 0): AreaDef | null {
  for (const area of areas) {
    if (Math.abs(y - (area.elevation ?? 0)) > 3) continue;
    const b = area.bounds;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return area;
  }
  return null;
}

/** Display name + subtitle for an area id (including Memory Rooms). */
export function areaInfo(id: string | null): { name: string; subtitle: string } | null {
  if (!id) return null;
  const fixed = AREAS.find((a) => a.id === id);
  if (fixed) return { name: fixed.name, subtitle: fixed.subtitle };
  if (id === "atrium") return { name: "Grand Atrium", subtitle: "Every memory deserves a place" };
  if (id === "rooftop") return { name: "Rooftop Café", subtitle: "Coffee above the clouds" };
  if (id === "entrance") return { name: "Entrance Court", subtitle: "Welcome to MEMORA" };
  const hall = /^hall-(\d+)-(\d+)$/.exec(id);
  if (hall) {
    const floor = Number(hall[1]);
    return { name: `Memory Hall ${floor === 0 ? "G" : floor}${String.fromCharCode(64 + Number(hall[2]))}`, subtitle: floor === 0 ? "Ground floor" : `Floor ${floor}` };
  }
  const balcony = /^balcony-(\d+)$/.exec(id);
  if (balcony) return { name: `Floor ${balcony[1]} Balcony`, subtitle: "Grand Atrium" };
  const room = /^room-(\d+)$/.exec(id);
  if (room) return { name: `Memory Room ${room[1]}`, subtitle: room[1] === "1" ? "The collection keeps growing" : "More moments" };
  return null;
}

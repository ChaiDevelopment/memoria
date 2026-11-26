import { AREAS } from "@/config/museumLayout";
import type { AreaDef } from "@/types/world";

/** Returns the area containing (x, z), or null when between areas (e.g. inside a doorway). */
export function areaAt(x: number, z: number, areas: readonly AreaDef[] = AREAS): AreaDef | null {
  for (const area of areas) {
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
  const room = /^room-(\d+)$/.exec(id);
  if (room) return { name: `Memory Room ${room[1]}`, subtitle: room[1] === "1" ? "The collection keeps growing" : "More moments" };
  return null;
}

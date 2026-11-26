import { AREAS } from "@/config/museumLayout";
import type { AreaDef } from "@/types/world";

/** Returns the area containing (x, z), or null when between areas (e.g. inside a doorway). */
export function areaAt(x: number, z: number): AreaDef | null {
  for (const area of AREAS) {
    const b = area.bounds;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return area;
  }
  return null;
}

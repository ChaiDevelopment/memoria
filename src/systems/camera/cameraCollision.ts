import type { Collider } from "@/types/world";

/**
 * Ray cast against static colliders (slab test for boxes, cylinders treated
 * as their bounding boxes). Returns the distance to the nearest hit in
 * [0, maxDist], or maxDist when nothing is hit. Colliders that contain the
 * ray origin are ignored so the camera never "sticks" to the player's own
 * surroundings.
 */
export function raycastDistance(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  colliders: readonly Collider[],
): number {
  let nearest = maxDist;
  const invX = 1 / dx;
  const invY = 1 / dy;
  const invZ = 1 / dz;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i]!;
    let minX: number, maxX: number, minZ: number, maxZ: number;
    if (c.kind === "box") {
      minX = c.minX;
      maxX = c.maxX;
      minZ = c.minZ;
      maxZ = c.maxZ;
    } else {
      minX = c.x - c.radius;
      maxX = c.x + c.radius;
      minZ = c.z - c.radius;
      maxZ = c.z + c.radius;
    }
    const minY = c.minY;
    const maxY = c.maxY;
    if (ox > minX && ox < maxX && oy > minY && oy < maxY && oz > minZ && oz < maxZ) continue;

    let t1 = (minX - ox) * invX;
    let t2 = (maxX - ox) * invX;
    let tmin = Math.min(t1, t2);
    let tmax = Math.max(t1, t2);
    t1 = (minY - oy) * invY;
    t2 = (maxY - oy) * invY;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (minZ - oz) * invZ;
    t2 = (maxZ - oz) * invZ;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));

    // NaN guards cover rays parallel to a slab (0 * Infinity).
    if (tmax >= Math.max(tmin, 0) && tmin < nearest && !Number.isNaN(tmin)) {
      nearest = Math.max(0, tmin);
    }
  }
  return nearest;
}

/** Offset direction from pivot to camera for the given yaw/pitch (unit vector). */
export function orbitDirection(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const cp = Math.cos(pitch);
  return { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp };
}

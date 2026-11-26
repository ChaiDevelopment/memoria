import type { Collider } from "@/types/world";

/**
 * Kinematic collision for an upright cylinder (the player) against static
 * boxes and vertical cylinders. All functions are pure/allocation-free so they
 * can run every frame and be unit tested in Node.
 */

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface CharacterShape {
  radius: number;
  height: number;
  stepHeight: number;
}

/** Does a circle at (x, z) with radius r overlap the collider's XZ footprint? */
export function circleOverlapsXZ(x: number, z: number, r: number, c: Collider): boolean {
  if (c.kind === "box") {
    const cx = x < c.minX ? c.minX : x > c.maxX ? c.maxX : x;
    const cz = z < c.minZ ? c.minZ : z > c.maxZ ? c.maxZ : z;
    const dx = x - cx;
    const dz = z - cz;
    return dx * dx + dz * dz < r * r;
  }
  const dx = x - c.x;
  const dz = z - c.z;
  const rr = r + c.radius;
  return dx * dx + dz * dz < rr * rr;
}

/**
 * Pushes the character out of every collider that overlaps its body
 * vertically (ignoring ledges low enough to step onto). Mutates `pos`.
 * Returns true if any push happened.
 */
export function resolveHorizontal(pos: Position, shape: CharacterShape, colliders: readonly Collider[]): boolean {
  const r = shape.radius;
  const bottom = pos.y + shape.stepHeight;
  const top = pos.y + shape.height;
  let hit = false;
  // A few iterations resolve corners where two colliders meet.
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i]!;
      if (c.maxY <= bottom || c.minY >= top) continue;
      if (c.kind === "box") {
        const cx = pos.x < c.minX ? c.minX : pos.x > c.maxX ? c.maxX : pos.x;
        const cz = pos.z < c.minZ ? c.minZ : pos.z > c.maxZ ? c.maxZ : pos.z;
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-12) {
          const d = Math.sqrt(d2);
          const push = (r - d) / d;
          pos.x += dx * push;
          pos.z += dz * push;
        } else {
          // Center is inside the box: exit through the nearest face.
          const left = pos.x - c.minX;
          const right = c.maxX - pos.x;
          const back = pos.z - c.minZ;
          const front = c.maxZ - pos.z;
          const m = Math.min(left, right, back, front);
          if (m === left) pos.x = c.minX - r;
          else if (m === right) pos.x = c.maxX + r;
          else if (m === back) pos.z = c.minZ - r;
          else pos.z = c.maxZ + r;
        }
        moved = true;
      } else {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const rr = r + c.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        if (d2 > 1e-12) {
          const d = Math.sqrt(d2);
          const push = (rr - d) / d;
          pos.x += dx * push;
          pos.z += dz * push;
        } else {
          pos.x = c.x + rr;
        }
        moved = true;
      }
    }
    if (!moved) break;
    hit = true;
  }
  return hit;
}

/**
 * Highest walkable surface under the character whose top is no more than
 * `maxRise` above the feet. The world floor is y = 0. A slightly reduced
 * support radius avoids "standing on air" at ledge edges.
 */
export function groundHeight(pos: Position, shape: CharacterShape, colliders: readonly Collider[], maxRise: number): number {
  const supportRadius = shape.radius * 0.75;
  const limit = pos.y + maxRise;
  let ground = 0;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i]!;
    if (c.maxY > limit || c.maxY <= ground) continue;
    if (circleOverlapsXZ(pos.x, pos.z, supportRadius, c)) ground = c.maxY;
  }
  return ground;
}

/**
 * Lowest collider underside above the character's waist that overlaps its
 * footprint — used to stop jumps at ceilings and lintels.
 */
export function ceilingHeight(pos: Position, shape: CharacterShape, colliders: readonly Collider[]): number {
  const waist = pos.y + shape.height * 0.5;
  const r = shape.radius * 0.9;
  let ceiling = Infinity;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i]!;
    if (c.minY < waist || c.minY >= ceiling) continue;
    if (circleOverlapsXZ(pos.x, pos.z, r, c)) ceiling = c.minY;
  }
  return ceiling;
}

/** True if the character volume at `pos` intersects any collider (used by tests/spawn validation). */
export function isBlocked(pos: Position, shape: CharacterShape, colliders: readonly Collider[]): boolean {
  const bottom = pos.y + shape.stepHeight;
  const top = pos.y + shape.height;
  for (const c of colliders) {
    if (c.maxY <= bottom || c.minY >= top) continue;
    if (circleOverlapsXZ(pos.x, pos.z, shape.radius, c)) return true;
  }
  return false;
}

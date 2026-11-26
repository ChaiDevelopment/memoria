import { INTERACTION } from "@/config/gameConfig";

/**
 * Interaction system: finds the object the player can currently interact with.
 * Phase 1 supports framed photographs; new kinds only need a new `kind` value
 * and a handler in the UI layer.
 */

export interface Interactable {
  id: string;
  kind: "photo";
  memoryId: string;
  label: string;
  /** Focus point of the object (photo center). */
  x: number;
  y: number;
  z: number;
  /** Direction the object faces; the player must stand on this side. */
  normalX: number;
  normalZ: number;
}

/**
 * Returns the best interactable for a player at (px, pz) facing `facing`
 * (radians, 0 = +Z), or null. Pure function — unit tested.
 */
export function findInteractable(
  px: number,
  pz: number,
  facing: number,
  list: readonly Interactable[],
  range: number = INTERACTION.range,
): Interactable | null {
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  let best: Interactable | null = null;
  let bestScore = Infinity;
  for (const it of list) {
    const dx = px - it.x;
    const dz = pz - it.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range || dist < 1e-4) continue;
    // Must stand in front of the object.
    if (dx * it.normalX + dz * it.normalZ < 0.15) continue;
    // Must roughly face it.
    const look = (-dx * fx - dz * fz) / dist;
    if (look < INTERACTION.facingThreshold) continue;
    const score = dist * (1.6 - look);
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

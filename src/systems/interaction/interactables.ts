import { INTERACTION } from "@/config/gameConfig";

/**
 * Interaction system: finds the object the player can currently interact with.
 * Phase 1 supports framed photographs; new kinds only need a new `kind` value
 * and a handler in the UI layer.
 */

/** Max vertical distance between the player's eyes and a photo's centre. */
const MAX_EYE_DELTA = 2.5;

export interface Interactable {
  id: string;
  /** "photo": inspect a memory. "lift": open the lift's floor menu. "album": read an Album Kata chapter. */
  kind: "photo" | "lift" | "album" | "guestbook";
  /** Photo slot id (for lifts: "lift-<floor>"). */
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
  /** Player feet height — photos on another floor are ignored. */
  py = 0,
): Interactable | null {
  const fx = Math.sin(facing);
  const fz = Math.cos(facing);
  let best: Interactable | null = null;
  let bestScore = Infinity;
  for (const it of list) {
    // Eye height ~1.5 m; frames hang 1.5–2.5 m up. Anything far above or
    // below the player's eyes is on another floor.
    if (Math.abs(py + 1.5 - it.y) > MAX_EYE_DELTA) continue;
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

import type { Interactable } from "@/systems/interaction/interactables";
import type { PhotoPlacement } from "@/types/memory";
import type { AreaDef, Collider } from "@/types/world";

/**
 * What the player controller, camera and interaction system need from any
 * world — the museum or a wedding venue. Each world adds its own rendering data.
 */
export interface PlayWorld {
  colliders: Collider[];
  /** Subset of colliders the third-person camera must stay in front of. */
  cameraColliders: Collider[];
  interactables: Interactable[];
  areas: AreaDef[];
  /** Every frame that can hold a photo. */
  placements: PhotoPlacement[];
  /** Everything the player can legitimately reach. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Where visitors start (and return to if they fall out of the world). */
  spawn: { x: number; y: number; z: number; facing: number };
}

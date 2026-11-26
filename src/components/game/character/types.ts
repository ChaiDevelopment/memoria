import type { Pose } from "@/systems/animation/characterAnimator";

/**
 * Contract between the player logic and whatever visual model represents the
 * player. Swapping the procedural character for a rigged GLB only requires a
 * component that implements this handle (e.g. by mapping joints to bones, or
 * by driving an AnimationMixer from the animator's state weights).
 */
export interface CharacterModelHandle {
  applyPose(pose: Pose): void;
}

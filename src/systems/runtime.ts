import { CAMERA } from "@/config/gameConfig";
import { SPAWN } from "@/config/museumLayout";
import type { AnimationStateName } from "@/types/game";
import { createMotorState, type MotorState } from "./movement/characterMotor";

/**
 * Mutable per-frame state shared between the controller, camera, character
 * model and lighting. Lives outside React so the 60 Hz loop never triggers
 * re-renders. One instance per local player.
 */
export interface PlayerRuntime {
  motor: MotorState;
  camera: {
    yaw: number;
    pitch: number;
    /** Distance requested by the user (wheel / settings). */
    targetDistance: number;
    /** Current distance after collision and smoothing. */
    distance: number;
    pivot: { x: number; y: number; z: number };
  };
  anim: {
    state: AnimationStateName;
    landed: boolean;
  };
  wantsRun: boolean;
  /** Height of the floor the player last stood on (for the camera's floor clamp). */
  groundY: number;
}

export function createPlayerRuntime(): PlayerRuntime {
  return {
    motor: createMotorState(SPAWN.x, SPAWN.y, SPAWN.z, SPAWN.facing),
    camera: {
      // Camera starts behind the player (player faces -Z, camera sits at +Z).
      yaw: SPAWN.facing + Math.PI,
      pitch: CAMERA.defaultPitch,
      targetDistance: CAMERA.defaultDistance,
      distance: CAMERA.defaultDistance,
      pivot: { x: SPAWN.x, y: SPAWN.y + CAMERA.pivotHeight, z: SPAWN.z },
    },
    anim: { state: "idle", landed: false },
    wantsRun: false,
    groundY: SPAWN.y,
  };
}

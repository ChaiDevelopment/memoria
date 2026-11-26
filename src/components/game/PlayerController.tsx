"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { SPAWN } from "@/config/museumLayout";
import { facingToNormal } from "@/lib/math";
import { gameStore, isGameplayBlocked } from "@/stores/gameStore";
import { selectAnimationState } from "@/systems/animation/characterAnimator";
import { input, readMoveAxes } from "@/systems/input/inputState";
import { findInteractable } from "@/systems/interaction/interactables";
import { stepMotor } from "@/systems/movement/characterMotor";
import type { PlayerRuntime } from "@/systems/runtime";
import { areaAt } from "@/systems/world/areas";
import type { WorldData } from "@/systems/world/buildWorld";

/** Largest simulated step; longer frames (tab switches, hitches) are clamped. */
const MAX_DT = 1 / 20;


/**
 * Translates input into motion every frame: camera-relative movement,
 * jumping, collision, animation state, area tracking and interaction lookup.
 */
export function PlayerController({ runtime, world }: { runtime: PlayerRuntime; world: WorldData }) {
  const areaTimer = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_DT);
    const st = gameStore.getState();
    const blocked = isGameplayBlocked(st);
    const axes = blocked ? { x: 0, y: 0, run: false } : readMoveAxes();

    // Camera-relative movement: forward is where the camera looks.
    const yaw = runtime.camera.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const moveX = fx * axes.y + rx * axes.x;
    const moveZ = fz * axes.y + rz * axes.x;

    const jump = !blocked && input.jumpQueued;
    input.jumpQueued = false;

    // While inspecting, turn to face the photograph.
    let faceTowards: number | null = null;
    if (st.inspectingId) {
      const placement = world.placements.find((p) => p.memoryId === st.inspectingId);
      if (placement) {
        const n = facingToNormal(placement.facing);
        faceTowards = Math.atan2(-n.x, -n.z);
      }
    }

    const motor = runtime.motor;
    const events = stepMotor(motor, { moveX, moveZ, run: axes.run, jump, faceTowards }, dt, world.colliders);

    // Safety net: anything outside the playable envelope returns to the lobby.
    const p = motor.position;
    const b = world.bounds;
    if (p.x < b.minX || p.x > b.maxX || p.z < b.minZ || p.z > b.maxZ) {
      p.x = SPAWN.x;
      p.y = SPAWN.y;
      p.z = SPAWN.z;
      motor.velocity.x = motor.velocity.y = motor.velocity.z = 0;
    }

    runtime.wantsRun = axes.run;
    runtime.anim.landed = events.landed;
    runtime.anim.state = selectAnimationState({
      grounded: motor.grounded,
      horizontalSpeed: motor.horizontalSpeed,
      inspecting: st.inspectingId !== null,
      wantsRun: axes.run,
    });

    // Rare UI updates are throttled and de-duplicated inside the store.
    areaTimer.current -= dt;
    if (areaTimer.current <= 0) {
      areaTimer.current = 0.2;
      const area = areaAt(p.x, p.z, world.areas);
      if (area) st.setCurrentArea(area.id);
    }
    if (!st.inspectingId) {
      const it = blocked ? null : findInteractable(p.x, p.z, motor.facing, world.interactables);
      st.setNearby(it ? { id: it.id, memoryId: it.memoryId, label: it.label } : null);
    }
  }, -3);

  return null;
}

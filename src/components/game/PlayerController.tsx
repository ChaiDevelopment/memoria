"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { floorAtHeight } from "@/config/grandMuseum";
import { facingToNormal } from "@/lib/math";
import { gameStore, isGameplayBlocked, useGameStore } from "@/stores/gameStore";
import { selectAnimationState } from "@/systems/animation/characterAnimator";
import { input, readMoveAxes } from "@/systems/input/inputState";
import { findInteractable } from "@/systems/interaction/interactables";
import { stepMotor } from "@/systems/movement/characterMotor";
import type { PlayerRuntime } from "@/systems/runtime";
import { areaAt } from "@/systems/world/areas";
import type { Seat } from "@/systems/world/buildWedding";
import type { PlayWorld } from "@/systems/world/playWorld";

/** Largest simulated step; longer frames (tab switches, hitches) are clamped. */
const MAX_DT = 1 / 20;


/**
 * Translates input into motion every frame: camera-relative movement,
 * jumping, collision, animation state, area tracking and interaction lookup.
 */
export function PlayerController({ runtime, world }: { runtime: PlayerRuntime; world: PlayWorld }) {
  const areaTimer = useRef(0);
  const sittingOn = useRef<Seat | null>(null);
  // Seats (wedding venues). The pelaminan's thrones are only for the couple.
  const seats = useMemo(() => new Map(("seats" in world ? (world.seats as Seat[]) : []).map((s) => [s.id, s])), [world]);
  const couple = useGameStore((s) => s.viewer?.role === "bride" || s.viewer?.role === "groom");
  const interactables = useMemo(
    () => world.interactables.filter((it) => it.kind !== "seat" || couple || !seats.get(it.memoryId)?.coupleOnly),
    [world, seats, couple],
  );

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

    // Sitting: hold the seat until the visitor moves, jumps or presses E again.
    const seat = st.seatedId ? (seats.get(st.seatedId) ?? null) : null;
    if (seat && (Math.abs(axes.x) > 0.2 || Math.abs(axes.y) > 0.2 || input.jumpQueued)) {
      input.jumpQueued = false;
      st.standUp();
    } else if (seat) {
      input.jumpQueued = false;
      sittingOn.current = seat;
      motor.position.x = seat.x;
      motor.position.y = seat.y;
      motor.position.z = seat.z;
      motor.velocity.x = motor.velocity.y = motor.velocity.z = 0;
      motor.horizontalSpeed = 0;
      motor.grounded = true;
      motor.facing = seat.facing;
      runtime.groundY = seat.y;
      runtime.anim.state = "sit";
      runtime.anim.landed = false;
      return;
    }
    if (sittingOn.current) {
      // Stood up: step out to where the seat was approached from.
      const s = sittingOn.current;
      sittingOn.current = null;
      motor.position.x = s.exit.x;
      motor.position.y = s.y;
      motor.position.z = s.exit.z;
      motor.velocity.x = motor.velocity.y = motor.velocity.z = 0;
    }

    // Lift ride: move the visitor to the chosen floor.
    const tp = st.pendingTeleport ? st.consumeTeleport() : null;
    if (tp) {
      motor.position.x = tp.x;
      motor.position.y = tp.y;
      motor.position.z = tp.z;
      motor.velocity.x = motor.velocity.y = motor.velocity.z = 0;
      motor.facing = tp.facing;
      runtime.groundY = tp.y;
      runtime.camera.yaw = tp.facing + Math.PI;
      runtime.camera.pivot.x = tp.x;
      runtime.camera.pivot.y = tp.y + 1.5;
      runtime.camera.pivot.z = tp.z;
    }
    const events = stepMotor(motor, { moveX, moveZ, run: axes.run, jump, faceTowards }, dt, world.colliders);

    // Safety net: anything outside the playable envelope returns to the lobby.
    const p = motor.position;
    const b = world.bounds;
    if (p.x < b.minX || p.x > b.maxX || p.z < b.minZ || p.z > b.maxZ || p.y < -5) {
      p.x = world.spawn.x;
      p.y = world.spawn.y;
      p.z = world.spawn.z;
      motor.velocity.x = motor.velocity.y = motor.velocity.z = 0;
    }

    runtime.wantsRun = axes.run;
    if (motor.grounded) runtime.groundY = p.y;
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
      const area = areaAt(p.x, p.z, world.areas, p.y);
      if (area) st.setCurrentArea(area.id);
      st.setCurrentFloor(floorAtHeight(runtime.groundY));
    }
    if (!st.inspectingId) {
      const it = blocked ? null : findInteractable(p.x, p.z, motor.facing, interactables, undefined, p.y);
      st.setNearby(it ? { id: it.id, kind: it.kind, memoryId: it.memoryId, label: it.label } : null);
    }
  }, -3);

  return null;
}

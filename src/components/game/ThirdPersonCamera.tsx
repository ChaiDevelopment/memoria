"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CAMERA } from "@/config/gameConfig";
import { clamp, damp } from "@/lib/math";
import { gameStore } from "@/stores/gameStore";
import { orbitDirection, raycastDistance } from "@/systems/camera/cameraCollision";
import { input } from "@/systems/input/inputState";
import type { PlayerRuntime } from "@/systems/runtime";
import { getWorld } from "@/systems/world/buildWorld";

/**
 * Adventure-game orbit camera: mouse/touch rotates yaw & pitch around a
 * smoothed pivot above the player; a ray cast against architecture pulls the
 * camera in front of walls and ceilings (fast in, slow out).
 */
export function ThirdPersonCamera({ runtime }: { runtime: PlayerRuntime }) {
  const world = useMemo(() => getWorld(), []);
  const lastSettingsDistance = useRef<number | null>(null);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const st = gameStore.getState();
    const { settings } = st;
    const cam = runtime.camera;

    // Look input (ignored while a menu is open so dragging sliders doesn't spin the view).
    if (!st.menuOpen) {
      const k =
        input.look.source === "touch"
          ? CAMERA.touchRadiansPerPixel * settings.touchSensitivity
          : CAMERA.mouseRadiansPerPixel * settings.mouseSensitivity;
      cam.yaw -= input.look.x * k;
      cam.pitch += input.look.y * k * (settings.invertY ? -1 : 1);
      cam.pitch = clamp(cam.pitch, CAMERA.minPitch, CAMERA.maxPitch);
    }
    input.look.x = 0;
    input.look.y = 0;
    // Slow cinematic orbit behind the title screen.
    if (st.phase === "title") cam.yaw += dt * 0.12;

    // Zoom: the settings slider sets the base distance, the wheel adjusts it live.
    if (lastSettingsDistance.current !== settings.cameraDistance) {
      lastSettingsDistance.current = settings.cameraDistance;
      cam.targetDistance = settings.cameraDistance;
    }
    if (input.zoom !== 0) {
      if (!st.menuOpen) {
        cam.targetDistance = clamp(cam.targetDistance + input.zoom * 0.004, CAMERA.minDistance, CAMERA.maxDistance);
      }
      input.zoom = 0;
    }

    // Smoothed pivot above the player.
    const p = runtime.motor.position;
    const pivot = cam.pivot;
    const kh = damp(CAMERA.followRate, dt);
    const kv = damp(CAMERA.followRateVertical, dt);
    pivot.x += (p.x - pivot.x) * kh;
    pivot.z += (p.z - pivot.z) * kh;
    pivot.y += (p.y + CAMERA.pivotHeight - pivot.y) * kv;

    // Collision against architecture and the floor.
    const d = orbitDirection(cam.yaw, cam.pitch);
    const hit = raycastDistance(
      pivot.x,
      pivot.y,
      pivot.z,
      d.x,
      d.y,
      d.z,
      cam.targetDistance + CAMERA.collisionPadding,
      world.cameraColliders,
    );
    let allowed = Math.max(CAMERA.collisionMinDistance, hit - CAMERA.collisionPadding);
    if (d.y < -1e-3) {
      allowed = Math.min(allowed, Math.max(CAMERA.collisionMinDistance, (pivot.y - 0.25) / -d.y));
    }
    const wanted = Math.min(cam.targetDistance, allowed);

    const rate = wanted < cam.distance ? CAMERA.zoomInRate : CAMERA.zoomOutRate;
    cam.distance += (wanted - cam.distance) * damp(rate, dt);
    // Never sit inside geometry, even for a single frame.
    cam.distance = Math.min(cam.distance, allowed);

    camera.position.set(pivot.x + d.x * cam.distance, pivot.y + d.y * cam.distance, pivot.z + d.z * cam.distance);
    camera.lookAt(pivot.x, pivot.y, pivot.z);
  }, -1);

  return null;
}

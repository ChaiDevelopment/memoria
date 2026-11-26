"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CAMERA } from "@/config/gameConfig";
import { damp } from "@/lib/math";
import { CharacterAnimator } from "@/systems/animation/characterAnimator";
import type { PlayerRuntime } from "@/systems/runtime";
import { ProceduralCharacter } from "./character/ProceduralCharacter";
import type { CharacterModelHandle } from "./character/types";

/**
 * Visual representation of the local player: positions the model from the
 * motor state and feeds it the blended animation pose each frame.
 */
export function Player({ runtime, blobShadow }: { runtime: PlayerRuntime; blobShadow: boolean }) {
  const root = useRef<THREE.Group>(null);
  const blob = useRef<THREE.Mesh>(null);
  const model = useRef<CharacterModelHandle>(null);
  const animator = useMemo(() => new CharacterAnimator(), []);
  const groundY = useRef(0);
  /** Rendered feet height: eases over stair steps instead of popping (physics stays exact). */
  const visualY = useRef<number | null>(null);

  // Soft contact shadow, used when real-time shadows are disabled (low quality).
  const blobMaterial = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(40,25,15,0.45)");
      g.addColorStop(1, "rgba(40,25,15,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  }, []);
  useEffect(
    () => () => {
      blobMaterial.map?.dispose();
      blobMaterial.dispose();
    },
    [blobMaterial],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const motor = runtime.motor;
    const pose = animator.update(dt, {
      state: runtime.anim.state,
      horizontalSpeed: motor.horizontalSpeed,
      verticalVelocity: motor.velocity.y,
      landed: runtime.anim.landed,
    });
    model.current?.applyPose(pose);

    const g = root.current;
    if (g) {
      const target = motor.position.y;
      const v = visualY.current;
      // Smooth only small grounded height changes (stairs, ledges); jumps, falls
      // and teleports stay exact.
      visualY.current = v !== null && motor.grounded && Math.abs(target - v) < 0.5 ? v + (target - v) * damp(22, dt) : target;
      g.position.set(motor.position.x, visualY.current, motor.position.z);
      g.rotation.y = motor.facing;
      // Hide the model when the camera is pushed right up against it.
      g.visible = runtime.camera.distance > CAMERA.hidePlayerDistance;
    }
    if (motor.grounded) groundY.current = motor.position.y;
    const b = blob.current;
    if (b) {
      const height = Math.max(0, motor.position.y - groundY.current);
      b.position.set(motor.position.x, groundY.current + 0.035, motor.position.z);
      const s = 1 / (1 + height * 0.6);
      b.scale.set(s, s, s);
    }
  }, -2);

  return (
    <>
      <group ref={root} name="player">
        <ProceduralCharacter ref={model} />
      </group>
      {blobShadow && (
        <mesh ref={blob} material={blobMaterial} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <circleGeometry args={[0.45, 20]} />
        </mesh>
      )}
    </>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { InstanceTransform } from "@/lib/geometry";
import { useGameStore } from "@/stores/gameStore";
import type { WorldData } from "@/systems/world/buildWorld";
import { Instanced } from "./environment/Instanced";

/**
 * Collision volumes are pure data (see systems/world/buildWorld.ts) consumed
 * by the movement and camera systems. This component only visualises them
 * when "Show colliders" is enabled in Settings → Developer.
 */
export function CollisionWorld({ world }: { world: WorldData }) {
  const visible = useGameStore((s) => s.debugColliders);
  if (!visible) return null;
  return <ColliderDebugView world={world} />;
}

function ColliderDebugView({ world }: { world: WorldData }) {
  const resources = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
      camera: new THREE.MeshBasicMaterial({ color: "#ff5a36", wireframe: true, transparent: true, opacity: 0.6, depthTest: false }),
      solid: new THREE.MeshBasicMaterial({ color: "#36c2ff", wireframe: true, transparent: true, opacity: 0.7, depthTest: false }),
    }),
    [],
  );
  useEffect(() => () => Object.values(resources).forEach((r) => r.dispose()), [resources]);

  const { cameraBoxes, boxes, cylinders } = useMemo(() => {
    const cameraBoxes: InstanceTransform[] = [];
    const boxes: InstanceTransform[] = [];
    const cylinders: InstanceTransform[] = [];
    for (const c of world.colliders) {
      if (c.kind === "box") {
        const t: InstanceTransform = {
          x: (c.minX + c.maxX) / 2,
          y: (c.minY + c.maxY) / 2,
          z: (c.minZ + c.maxZ) / 2,
          sx: c.maxX - c.minX,
          sy: c.maxY - c.minY,
          sz: c.maxZ - c.minZ,
        };
        (c.blocksCamera ? cameraBoxes : boxes).push(t);
      } else {
        cylinders.push({ x: c.x, y: (c.minY + c.maxY) / 2, z: c.z, sx: c.radius, sy: c.maxY - c.minY, sz: c.radius });
      }
    }
    return { cameraBoxes, boxes, cylinders };
  }, [world]);

  return (
    <group name="collider-debug" renderOrder={10}>
      <Instanced geometry={resources.box} material={resources.camera} items={cameraBoxes} castShadow={false} receiveShadow={false} />
      <Instanced geometry={resources.box} material={resources.solid} items={boxes} castShadow={false} receiveShadow={false} />
      <Instanced geometry={resources.cylinder} material={resources.solid} items={cylinders} castShadow={false} receiveShadow={false} />
    </group>
  );
}

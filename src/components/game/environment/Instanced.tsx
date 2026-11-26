"use client";

import { useLayoutEffect, useRef } from "react";
import type * as THREE from "three";
import { applyInstances, type InstanceTransform } from "@/lib/geometry";

interface InstancedProps {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: readonly InstanceTransform[];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Renders many copies of one geometry in a single draw call. Transforms are
 * written once (static decor), so there is no per-frame cost.
 */
export function Instanced({ geometry, material, items, castShadow = true, receiveShadow = true }: InstancedProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (ref.current) applyInstances(ref.current, items);
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh
      // Re-create the mesh if the instance count changes.
      key={items.length}
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

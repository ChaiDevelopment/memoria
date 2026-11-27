"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { InstanceTransform } from "@/lib/geometry";
import { Instanced } from "../environment/Instanced";

/** Where the 3D asset pack lives (public/assets/…). */
export const ASSET = {
  character: "/assets/characters/character-base.glb",
  garden: (name: string) => `/assets/themes/wedding/garden-sunset/${name}.glb`,
  ballroom: (name: string) => `/assets/themes/wedding/grand-ballroom/${name}.glb`,
  shared: (name: string) => `/assets/themes/wedding/shared/${name}.glb`,
};

/** Lamps, candles and bulbs in the pack are emissive: brighten them so they glow (bloom). */
function glowing(material: THREE.Material): THREE.Material {
  const m = material as THREE.MeshStandardMaterial;
  if (!m.emissive || m.emissive.getHex() === 0 || m.userData.memoraGlow) return material;
  const lit = m.clone();
  lit.emissiveIntensity = Math.max(2.6, m.emissiveIntensity ?? 1);
  lit.toneMapped = true;
  lit.userData.memoraGlow = true;
  return lit;
}

export interface GlbPart {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/**
 * The meshes of a static GLB, each with its node transform baked into the
 * geometry — ready to be drawn many times as instances (one draw call per part).
 */
export function useGlbParts(url: string): GlbPart[] {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const parts: GlbPart[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      const material = glowing(Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material);
      parts.push({ name: mesh.name, geometry, material });
    });
    return parts;
  }, [scene]);
}

/** Draws a GLB at many places (position, Y rotation, scale) — one instanced mesh per part. */
export function GlbInstances({ url, items, castShadow = true, receiveShadow = true }: { url: string; items: readonly InstanceTransform[]; castShadow?: boolean; receiveShadow?: boolean }) {
  const parts = useGlbParts(url);
  if (items.length === 0) return null;
  return (
    <>
      {parts.map((p, i) => (
        <Instanced key={`${p.name}-${i}`} geometry={p.geometry} material={p.material} items={items} castShadow={castShadow} receiveShadow={receiveShadow} />
      ))}
    </>
  );
}

/** One placed copy of a GLB (its own scene graph — use for unique pieces). */
export function GlbModel({ url, position = [0, 0, 0], rotationY = 0, scale = 1, castShadow = true, onReady }: { url: string; position?: [number, number, number]; rotationY?: number; scale?: number | [number, number, number]; castShadow?: boolean; onReady?: (root: THREE.Object3D) => void }) {
  const { scene } = useGLTF(url);
  const root = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = castShadow;
        m.receiveShadow = true;
        if (!Array.isArray(m.material)) m.material = glowing(m.material);
      }
    });
    onReady?.(clone);
    return clone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);
  return <primitive object={root} position={position} rotation={[0, rotationY, 0]} scale={scale} />;
}

export function preloadWeddingAssets() {
  useGLTF.preload(ASSET.character);
}

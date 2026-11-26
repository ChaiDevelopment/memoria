import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Box3Data, RectXZ } from "@/types/world";
import type { UvRect } from "./textures/proceduralTextures";

/**
 * Static geometry builders. Static architecture is merged into one geometry
 * per material so each room costs only a handful of draw calls.
 */

export function boxGeometryFrom(b: Box3Data): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ);
  g.translate((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
  return g;
}

/** Merges boxes into one geometry; returns null when the list is empty. */
export function mergeBoxes(boxes: readonly Box3Data[]): THREE.BufferGeometry | null {
  if (boxes.length === 0) return null;
  const parts = boxes.map(boxGeometryFrom);
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error("Failed to merge box geometries");
  merged.computeBoundingSphere();
  return merged;
}

/** Horizontal floor quads at height y with world-space UVs (tiles every `tile` meters). */
export function floorGeometry(rects: readonly RectXZ[], y: number, tile: number): THREE.BufferGeometry | null {
  if (rects.length === 0) return null;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  rects.forEach((r, i) => {
    const corners: [number, number][] = [
      [r.minX, r.maxZ],
      [r.maxX, r.maxZ],
      [r.maxX, r.minZ],
      [r.minX, r.minZ],
    ];
    for (const [x, z] of corners) {
      positions.push(x, y, z);
      normals.push(0, 1, 0);
      uvs.push(x / tile, -z / tile);
    }
    const o = i * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

export interface TexturedQuad {
  /** Center of the quad. */
  x: number;
  y: number;
  z: number;
  /** Rotation about +Y; a quad with rotation 0 faces +Z. */
  rotationY: number;
  width: number;
  height: number;
  uv: UvRect;
}

/** Vertical quads sampling sub-rectangles of one atlas texture — one draw call for all. */
export function texturedQuadsGeometry(quads: readonly TexturedQuad[]): THREE.BufferGeometry | null {
  if (quads.length === 0) return null;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  quads.forEach((q, i) => {
    const c = Math.cos(q.rotationY);
    const s = Math.sin(q.rotationY);
    // Local right axis (+X rotated) and normal (+Z rotated).
    const rx = c;
    const rz = -s;
    const nx = s;
    const nz = c;
    const hw = q.width / 2;
    const hh = q.height / 2;
    const corners: [number, number, number, number][] = [
      [-hw, -hh, q.uv.u0, q.uv.v0],
      [hw, -hh, q.uv.u1, q.uv.v0],
      [hw, hh, q.uv.u1, q.uv.v1],
      [-hw, hh, q.uv.u0, q.uv.v1],
    ];
    for (const [lx, ly, u, v] of corners) {
      positions.push(q.x + rx * lx, q.y + ly, q.z + rz * lx);
      normals.push(nx, 0, nz);
      uvs.push(u, v);
    }
    const o = i * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

export interface InstanceTransform {
  x: number;
  y: number;
  z: number;
  rotationY?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  color?: string;
}

const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();

/** Writes transforms (and optional colors) into an InstancedMesh. */
export function applyInstances(mesh: THREE.InstancedMesh, items: readonly InstanceTransform[]) {
  const anyColor = items.some((it) => it.color !== undefined);
  items.forEach((it, i) => {
    tmpObject.position.set(it.x, it.y, it.z);
    tmpObject.rotation.set(0, it.rotationY ?? 0, 0);
    tmpObject.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    tmpObject.updateMatrix();
    mesh.setMatrixAt(i, tmpObject.matrix);
    if (anyColor) mesh.setColorAt(i, tmpColor.set(it.color ?? "#ffffff"));
  });
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

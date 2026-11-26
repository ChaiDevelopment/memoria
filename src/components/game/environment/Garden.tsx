"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  FOUNTAIN,
  FOUNTAIN_PLAZA_RADIUS,
  GARDEN_LAMPS,
  GARDEN_PATHS,
  GARDEN_ROCKS,
  GARDEN_TREES,
  HEDGES,
  PERGOLA,
  outdoorTreeScatter,
  scatterFlowers,
  type TreeDef,
} from "@/config/decorLayout";
import type { InstanceTransform } from "@/lib/geometry";
import { getMaterials } from "@/lib/materials";
import { mulberry32 } from "@/lib/random";
import { Instanced } from "./Instanced";

const FLOWER_COLORS = ["#f2c14e", "#e8655a", "#f4f1ea", "#c98bd1", "#f29fb8"];
const CANOPY_COLORS = ["#6a9a4f", "#58884a", "#7aa85a", "#4f7d47", "#8fae5a"];

export function Garden() {
  const mats = getMaterials();
  const geo = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      blob: new THREE.IcosahedronGeometry(1, 0),
      post: new THREE.CylinderGeometry(1, 1, 1, 6),
      stone: new THREE.CylinderGeometry(1, 1, 1, 6),
      rock: new THREE.DodecahedronGeometry(1, 0),
      flower: new THREE.IcosahedronGeometry(0.07, 0),
      lantern: new THREE.BoxGeometry(0.22, 0.3, 0.22),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  const items = useMemo(() => {
    // Hedges: box body + bumpy tops so they read as foliage, not walls.
    const hedgeBodies: InstanceTransform[] = [];
    const hedgeBumps: InstanceTransform[] = [];
    const rand = mulberry32(21);
    for (const h of HEDGES) {
      const w = h.maxX - h.minX;
      const d = h.maxZ - h.minZ;
      hedgeBodies.push({ x: (h.minX + h.maxX) / 2, y: (h.height - 0.2) / 2, z: (h.minZ + h.maxZ) / 2, sx: w, sy: h.height - 0.2, sz: d });
      const alongX = w > d;
      const len = alongX ? w : d;
      const count = Math.max(1, Math.round(len / 1.1));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const x = alongX ? h.minX + w * t : (h.minX + h.maxX) / 2;
        const z = alongX ? (h.minZ + h.maxZ) / 2 : h.minZ + d * t;
        const s = 0.62 + rand() * 0.18;
        hedgeBumps.push({ x, y: h.height - 0.25, z, sx: s, sy: s * 0.65, sz: s, rotationY: rand() * 3, color: rand() > 0.5 ? "#4d7a44" : "#57864a" });
      }
    }

    // Stepping stones along each path polyline.
    const stones: InstanceTransform[] = [];
    for (const path of GARDEN_PATHS) {
      for (let i = 0; i < path.length - 1; i++) {
        const [x0, z0] = path[i]!;
        const [x1, z1] = path[i + 1]!;
        const len = Math.hypot(x1 - x0, z1 - z0);
        const steps = Math.floor(len / 0.62);
        const px = -(z1 - z0) / len;
        const pz = (x1 - x0) / len;
        for (let s = 0; s < steps; s++) {
          const t = (s + 0.5) / steps;
          for (const side of [-1, 1]) {
            const off = side * 0.34 + (rand() - 0.5) * 0.1;
            stones.push({
              x: x0 + (x1 - x0) * t + px * off,
              y: 0.025,
              z: z0 + (z1 - z0) * t + pz * off,
              sx: 0.3 + rand() * 0.06,
              sy: 0.03,
              sz: 0.26 + rand() * 0.06,
              rotationY: rand() * Math.PI,
              color: rand() > 0.5 ? "#d4cbbb" : "#c3b9a6",
            });
          }
        }
      }
    }

    const flowers = scatterFlowers();
    const flowerHeads: InstanceTransform[] = flowers.map((f) => ({
      x: f.x,
      y: 0.22 * f.scale,
      z: f.z,
      sx: f.scale,
      sy: f.scale,
      sz: f.scale,
      rotationY: f.rotation,
      color: FLOWER_COLORS[f.colorIndex % FLOWER_COLORS.length],
    }));
    const flowerLeaves: InstanceTransform[] = flowers.map((f) => ({
      x: f.x,
      y: 0.07,
      z: f.z,
      sx: 0.12 * f.scale,
      sy: 0.12 * f.scale,
      sz: 0.12 * f.scale,
      rotationY: f.rotation,
      color: f.colorIndex % 2 ? "#4f7d47" : "#5e8c4f",
    }));

    const lampPosts: InstanceTransform[] = [];
    const lampCaps: InstanceTransform[] = [];
    const lampGlows: InstanceTransform[] = [];
    for (const l of GARDEN_LAMPS) {
      lampPosts.push({ x: l.x, y: 1.4, z: l.z, sx: 0.06, sy: 2.8, sz: 0.06 });
      lampCaps.push({ x: l.x, y: 0.1, z: l.z, sx: 0.16, sy: 0.2, sz: 0.16 });
      lampCaps.push({ x: l.x, y: 3.0, z: l.z, sx: 0.2, sy: 0.08, sz: 0.2 });
      lampGlows.push({ x: l.x, y: 2.8, z: l.z });
    }

    const rocks: InstanceTransform[] = GARDEN_ROCKS.map((r, i) => ({
      x: r.x,
      y: r.scale * 0.35,
      z: r.z,
      sx: r.scale,
      sy: r.scale * 0.7,
      sz: r.scale * 0.9,
      rotationY: i * 1.7,
    }));

    // Pergola.
    const P = PERGOLA;
    const pergola: InstanceTransform[] = [];
    for (const x of [P.minX, P.maxX]) for (const z of [P.minZ, P.maxZ]) pergola.push({ x, y: P.height / 2, z, sx: 0.18, sy: P.height, sz: 0.18 });
    for (const z of [P.minZ, P.maxZ]) pergola.push({ x: (P.minX + P.maxX) / 2, y: P.height + 0.08, z, sx: P.maxX - P.minX + 0.8, sy: 0.16, sz: 0.14 });
    for (let i = 0; i < 6; i++) {
      const x = P.minX - 0.2 + ((P.maxX - P.minX + 0.4) * i) / 5;
      pergola.push({ x, y: P.height + 0.22, z: (P.minZ + P.maxZ) / 2, sx: 0.1, sy: 0.1, sz: P.maxZ - P.minZ + 0.8 });
    }
    const vines: InstanceTransform[] = [];
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      for (const z of [P.minZ, P.maxZ]) {
        vines.push({ x: P.minX + (P.maxX - P.minX) * t, y: P.height + 0.2 + rand() * 0.1, z: z + (rand() - 0.5) * 0.3, sx: 0.28, sy: 0.2, sz: 0.28, rotationY: rand() * 3, color: rand() > 0.6 ? "#e889a7" : "#5b8c4c" });
      }
    }
    for (const x of [P.minX, P.maxX])
      for (const z of [P.minZ, P.maxZ])
        for (let k = 0; k < 4; k++) vines.push({ x: x + (rand() - 0.5) * 0.2, y: 0.5 + k * 0.6, z: z + (rand() - 0.5) * 0.2, sx: 0.2, sy: 0.22, sz: 0.2, rotationY: rand() * 3, color: k % 2 ? "#4f7d47" : "#e889a7" });

    return { hedgeBodies, hedgeBumps, stones, flowerHeads, flowerLeaves, lampPosts, lampCaps, lampGlows, rocks, pergola, vines };
  }, []);

  return (
    <group name="garden">
      <Instanced geometry={geo.box} material={mats.hedge} items={items.hedgeBodies} />
      <Instanced geometry={geo.blob} material={mats.whiteInstanced} items={items.hedgeBumps} />
      <Instanced geometry={geo.stone} material={mats.whiteInstanced} items={items.stones} castShadow={false} />
      <Instanced geometry={geo.flower} material={mats.whiteInstanced} items={items.flowerHeads} castShadow={false} />
      <Instanced geometry={geo.blob} material={mats.whiteInstanced} items={items.flowerLeaves} castShadow={false} />
      <Instanced geometry={geo.post} material={mats.blackMetal} items={items.lampPosts} />
      <Instanced geometry={geo.box} material={mats.blackMetal} items={items.lampCaps} />
      <Instanced geometry={geo.lantern} material={mats.lampGlow} items={items.lampGlows} castShadow={false} />
      <Instanced geometry={geo.rock} material={mats.stoneDark} items={items.rocks} />
      <Instanced geometry={geo.box} material={mats.oak} items={items.pergola} />
      <Instanced geometry={geo.blob} material={mats.whiteInstanced} items={items.vines} />
      <mesh material={mats.stone} position={[FOUNTAIN.x, 0.015, FOUNTAIN.z]} receiveShadow>
        <cylinderGeometry args={[FOUNTAIN_PLAZA_RADIUS, FOUNTAIN_PLAZA_RADIUS, 0.03, 28]} />
      </mesh>
      <Fountain />
    </group>
  );
}

/** Trees inside the garden and around the museum, in three low-poly styles. */
export function Trees({ includeOutdoor }: { includeOutdoor: boolean }) {
  const mats = getMaterials();
  const geo = useMemo(
    () => ({
      trunk: new THREE.CylinderGeometry(0.7, 1, 1, 6),
      blob: new THREE.IcosahedronGeometry(1, 0),
      cone: new THREE.ConeGeometry(1, 1, 7),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  const items = useMemo(() => {
    const trees: TreeDef[] = includeOutdoor ? [...GARDEN_TREES, ...outdoorTreeScatter()] : [...GARDEN_TREES];
    const trunks: InstanceTransform[] = [];
    const blobs: InstanceTransform[] = [];
    const cones: InstanceTransform[] = [];
    trees.forEach((t, i) => {
      const s = t.scale;
      const rot = i * 2.399;
      const color = CANOPY_COLORS[i % CANOPY_COLORS.length];
      if (t.variant === 1) {
        trunks.push({ x: t.x, y: 0.9 * s, z: t.z, sx: 0.22 * s, sy: 1.8 * s, sz: 0.22 * s, rotationY: rot });
        cones.push({ x: t.x, y: 2.6 * s, z: t.z, sx: 1.5 * s, sy: 2.6 * s, sz: 1.5 * s, rotationY: rot, color: "#45704a" });
        cones.push({ x: t.x, y: 3.9 * s, z: t.z, sx: 1.05 * s, sy: 2.0 * s, sz: 1.05 * s, rotationY: rot + 1, color: "#4f7d4c" });
      } else if (t.variant === 2) {
        trunks.push({ x: t.x, y: 1.1 * s, z: t.z, sx: 0.2 * s, sy: 2.2 * s, sz: 0.2 * s, rotationY: rot });
        blobs.push({ x: t.x, y: 3.3 * s, z: t.z, sx: 1.15 * s, sy: 1.85 * s, sz: 1.15 * s, rotationY: rot, color });
      } else {
        trunks.push({ x: t.x, y: 1.0 * s, z: t.z, sx: 0.26 * s, sy: 2.0 * s, sz: 0.26 * s, rotationY: rot });
        blobs.push({ x: t.x, y: 3.0 * s, z: t.z, sx: 1.7 * s, sy: 1.35 * s, sz: 1.7 * s, rotationY: rot, color });
        blobs.push({ x: t.x + 0.9 * s, y: 2.5 * s, z: t.z + 0.3 * s, sx: 1.0 * s, sy: 0.85 * s, sz: 1.0 * s, rotationY: rot + 1, color: "#7aa85a" });
        blobs.push({ x: t.x - 0.7 * s, y: 3.6 * s, z: t.z - 0.4 * s, sx: 1.05 * s, sy: 0.9 * s, sz: 1.05 * s, rotationY: rot + 2, color: "#58884a" });
      }
    });
    return { trunks, blobs, cones };
  }, [includeOutdoor]);

  return (
    <group name="trees">
      <Instanced geometry={geo.trunk} material={mats.bark} items={items.trunks} />
      <Instanced geometry={geo.blob} material={mats.whiteInstanced} items={items.blobs} />
      <Instanced geometry={geo.cone} material={mats.whiteInstanced} items={items.cones} />
    </group>
  );
}

const DROPLETS = 140;

function Fountain() {
  const mats = getMaterials();
  const F = FOUNTAIN;
  const points = useRef<THREE.Points>(null);
  const sim = useMemo(() => {
    const rand = mulberry32(5);
    const positions = new Float32Array(DROPLETS * 3);
    const velocities = new Float32Array(DROPLETS * 3);
    const reset = (i: number, initial: boolean) => {
      const a = rand() * Math.PI * 2;
      const sp = 0.6 + rand() * 0.5;
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 2.05;
      positions[i * 3 + 2] = 0;
      velocities[i * 3] = Math.cos(a) * sp;
      velocities[i * 3 + 1] = 2.2 + rand() * 1.2;
      velocities[i * 3 + 2] = Math.sin(a) * sp;
      if (initial) {
        // Pre-warm so droplets don't all start in sync.
        const t = rand() * 1.2;
        positions[i * 3] = velocities[i * 3]! * t;
        positions[i * 3 + 1] = 2.05 + velocities[i * 3 + 1]! * t - 4.9 * t * t;
        positions[i * 3 + 2] = velocities[i * 3 + 2]! * t;
        velocities[i * 3 + 1] = velocities[i * 3 + 1]! - 9.8 * t;
      }
    };
    for (let i = 0; i < DROPLETS; i++) reset(i, true);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 3);
    const material = new THREE.PointsMaterial({ color: "#e8f6ff", size: 0.07, transparent: true, opacity: 0.85, depthWrite: false });
    return { positions, velocities, reset, geometry, material };
  }, []);
  useEffect(() => () => (sim.geometry.dispose(), sim.material.dispose()), [sim]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { positions: p, velocities: v } = sim;
    for (let i = 0; i < DROPLETS; i++) {
      v[i * 3 + 1] = v[i * 3 + 1]! - 9.8 * dt;
      p[i * 3] = p[i * 3]! + v[i * 3]! * dt;
      p[i * 3 + 1] = p[i * 3 + 1]! + v[i * 3 + 1]! * dt;
      p[i * 3 + 2] = p[i * 3 + 2]! + v[i * 3 + 2]! * dt;
      const r2 = p[i * 3]! ** 2 + p[i * 3 + 2]! ** 2;
      const floor = r2 < 1 ? 1.62 : 0.5;
      if (p[i * 3 + 1]! < floor && v[i * 3 + 1]! < 0) sim.reset(i, false);
    }
    sim.geometry.attributes.position!.needsUpdate = true;
  });

  return (
    <group position={[F.x, 0, F.z]}>
      <mesh material={mats.stone} position={[0, F.rimHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[F.radius, F.radius + 0.1, F.rimHeight, 20]} />
      </mesh>
      <mesh material={mats.water} position={[0, F.rimHeight - 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[F.radius - 0.25, 24]} />
      </mesh>
      <mesh material={mats.stone} position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 1.4, 8]} />
      </mesh>
      <mesh material={mats.stone} position={[0, 1.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 0.35, 0.3, 14]} />
      </mesh>
      <mesh material={mats.water} position={[0, 1.71, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 16]} />
      </mesh>
      <mesh material={mats.stone} position={[0, 1.9, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.14, 0.4, 6]} />
      </mesh>
      <points ref={points} geometry={sim.geometry} material={sim.material} />
    </group>
  );
}

"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BENCHES,
  BENCH_DEPTH,
  BENCH_SEAT_HEIGHT,
  CENTER_PLINTH,
  COLUMNS,
  COLUMN_HEIGHT,
  GALLERY_PEDESTAL,
  INFO_DESK,
  PENDANT_LAMPS,
  POTTED_PLANTS,
  RUGS,
} from "@/config/decorLayout";
import { PHOTO_PLACEMENTS } from "@/config/memories";
import type { InstanceTransform } from "@/lib/geometry";
import { getMaterials } from "@/lib/materials";
import { Instanced } from "./Instanced";

/** Shared low-poly primitives (created once). */
function usePrimitives() {
  const prims = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      column: new THREE.CylinderGeometry(0.34, 0.38, 1, 8),
      cylinder8: new THREE.CylinderGeometry(1, 1, 1, 8),
      cylinder12: new THREE.CylinderGeometry(1, 1, 1, 14),
      pot: new THREE.CylinderGeometry(0.3, 0.22, 0.55, 7),
      blob: new THREE.IcosahedronGeometry(1, 0),
      shade: new THREE.CylinderGeometry(0.12, 0.38, 0.32, 10, 1, true),
      bulb: new THREE.SphereGeometry(0.11, 10, 6),
    }),
    [],
  );
  useEffect(() => () => Object.values(prims).forEach((g) => g.dispose()), [prims]);
  return prims;
}

export function Furniture() {
  const mats = getMaterials();
  const prims = usePrimitives();

  const items = useMemo(() => {
    const benchWood: InstanceTransform[] = [];
    const benchLegs: InstanceTransform[] = [];
    for (const b of BENCHES) {
      const rot = b.along === "x" ? 0 : Math.PI / 2;
      benchWood.push({ x: b.x, y: BENCH_SEAT_HEIGHT - 0.04, z: b.z, rotationY: rot, sx: b.length, sy: 0.08, sz: BENCH_DEPTH });
      for (const side of [-1, 1]) {
        const off = (b.length / 2 - 0.16) * side;
        const [ox, oz] = b.along === "x" ? [off, 0] : [0, off];
        benchLegs.push({ x: b.x + ox, y: (BENCH_SEAT_HEIGHT - 0.08) / 2, z: b.z + oz, rotationY: rot, sx: 0.09, sy: BENCH_SEAT_HEIGHT - 0.08, sz: BENCH_DEPTH - 0.06 });
      }
    }

    const columnShafts: InstanceTransform[] = [];
    const columnCaps: InstanceTransform[] = [];
    for (const c of COLUMNS) {
      columnShafts.push({ x: c.x, y: COLUMN_HEIGHT / 2, z: c.z, sx: 1.1, sy: COLUMN_HEIGHT - 0.6, sz: 1.1 });
      columnCaps.push({ x: c.x, y: 0.16, z: c.z, sx: 1.0, sy: 0.32, sz: 1.0 });
      columnCaps.push({ x: c.x, y: COLUMN_HEIGHT - 0.2, z: c.z, sx: 0.98, sy: 0.4, sz: 0.98 });
    }

    const pots: InstanceTransform[] = [];
    const trunks: InstanceTransform[] = [];
    const leaves: InstanceTransform[] = [];
    POTTED_PLANTS.forEach((p, i) => {
      const s = p.scale;
      pots.push({ x: p.x, y: 0.275 * s, z: p.z, sx: s, sy: s, sz: s, color: i % 3 === 0 ? "#e8e1d4" : "#c0714f" });
      if (i % 2 === 0) {
        // Small indoor tree.
        trunks.push({ x: p.x, y: 0.9 * s, z: p.z, sx: 0.04 * s, sy: 0.9 * s, sz: 0.04 * s });
        leaves.push({ x: p.x, y: 1.55 * s, z: p.z, sx: 0.42 * s, sy: 0.5 * s, sz: 0.42 * s, rotationY: i, color: "#5f8f4e" });
        leaves.push({ x: p.x + 0.18 * s, y: 1.25 * s, z: p.z + 0.08 * s, sx: 0.3 * s, sy: 0.32 * s, sz: 0.3 * s, rotationY: i * 2, color: "#4f8048" });
        leaves.push({ x: p.x - 0.16 * s, y: 1.85 * s, z: p.z - 0.06 * s, sx: 0.28 * s, sy: 0.3 * s, sz: 0.28 * s, rotationY: i * 3, color: "#6b9c55" });
      } else {
        // Bushy fern.
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + i;
          leaves.push({ x: p.x + Math.cos(a) * 0.2 * s, y: (0.72 + (k % 2) * 0.12) * s, z: p.z + Math.sin(a) * 0.2 * s, sx: 0.3 * s, sy: 0.22 * s, sz: 0.3 * s, rotationY: a, color: k % 2 ? "#3f6e45" : "#5b8c4c" });
        }
        leaves.push({ x: p.x, y: 0.95 * s, z: p.z, sx: 0.26 * s, sy: 0.3 * s, sz: 0.26 * s, color: "#6b9c55" });
      }
    });

    const rods: InstanceTransform[] = [];
    const shades: InstanceTransform[] = [];
    const bulbs: InstanceTransform[] = [];
    for (const l of PENDANT_LAMPS) {
      const bottom = l.ceiling - l.drop;
      rods.push({ x: l.x, y: bottom + l.drop / 2, z: l.z, sx: 0.015, sy: l.drop, sz: 0.015 });
      shades.push({ x: l.x, y: bottom, z: l.z });
      bulbs.push({ x: l.x, y: bottom - 0.08, z: l.z });
    }

    // Timeline floor inlay: a brass line with a medallion for every year.
    const inlay: InstanceTransform[] = [{ x: 25.1, y: 0.025, z: 7, sx: 31.2, sy: 0.01, sz: 0.06 }];
    const medallions: InstanceTransform[] = PHOTO_PLACEMENTS.filter((p) => p.memoryId.startsWith("t")).map((p) => ({
      x: p.x,
      y: 0.026,
      z: 7,
      sx: 0.2,
      sy: 0.012,
      sz: 0.2,
    }));

    return { benchWood, benchLegs, columnShafts, columnCaps, pots, trunks, leaves, rods, shades, bulbs, inlay, medallions };
  }, []);

  return (
    <group name="furniture">
      <Instanced geometry={prims.box} material={mats.oak} items={items.benchWood} />
      <Instanced geometry={prims.box} material={mats.blackMetal} items={items.benchLegs} />
      <Instanced geometry={prims.column} material={mats.marble} items={items.columnShafts} />
      <Instanced geometry={prims.box} material={mats.marble} items={items.columnCaps} />
      <Instanced geometry={prims.pot} material={mats.whiteInstanced} items={items.pots} />
      <Instanced geometry={prims.cylinder8} material={mats.bark} items={items.trunks} />
      <Instanced geometry={prims.blob} material={mats.whiteInstanced} items={items.leaves} />
      <Instanced geometry={prims.cylinder8} material={mats.blackMetal} items={items.rods} castShadow={false} />
      <Instanced geometry={prims.shade} material={mats.brass} items={items.shades} castShadow={false} />
      <Instanced geometry={prims.bulb} material={mats.lampGlow} items={items.bulbs} castShadow={false} />
      <Instanced geometry={prims.box} material={mats.brass} items={items.inlay} castShadow={false} />
      <Instanced geometry={prims.cylinder12} material={mats.brass} items={items.medallions} castShadow={false} />
      <Rugs />
      <LobbyCenterpiece />
      <GalleryPedestal />
      <InfoDesk />
    </group>
  );
}

function Rugs() {
  const rugMaterials = useMemo(
    () =>
      RUGS.map((r) => ({
        body: new THREE.MeshStandardMaterial({ color: r.color, roughness: 1 }),
        border: new THREE.MeshStandardMaterial({ color: r.border, roughness: 1 }),
      })),
    [],
  );
  useEffect(() => () => rugMaterials.forEach((m) => (m.body.dispose(), m.border.dispose())), [rugMaterials]);
  return (
    <group>
      {RUGS.map((r, i) => {
        const m = rugMaterials[i]!;
        if (r.kind === "round") {
          return (
            <group key={i} position={[r.x, 0.03, r.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <mesh material={m.border} receiveShadow>
                <circleGeometry args={[r.radius, 40]} />
              </mesh>
              <mesh material={m.body} position={[0, 0, 0.002]} receiveShadow>
                <circleGeometry args={[r.radius - 0.18, 40]} />
              </mesh>
              <mesh material={m.border} position={[0, 0, 0.004]} receiveShadow>
                <ringGeometry args={[r.radius * 0.55, r.radius * 0.55 + 0.06, 40]} />
              </mesh>
            </group>
          );
        }
        return (
          <group key={i} position={[r.x, 0.03, r.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh material={m.border} receiveShadow>
              <planeGeometry args={[r.width, r.depth]} />
            </mesh>
            <mesh material={m.body} position={[0, 0, 0.002]} receiveShadow>
              <planeGeometry args={[r.width - 0.3, r.depth - 0.3]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Marble plinth with a slowly turning "memory crystal" — the museum's emblem. */
function LobbyCenterpiece() {
  const mats = getMaterials();
  const crystal = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (crystal.current) {
      crystal.current.rotation.y += dt * 0.35;
      crystal.current.position.y = CENTER_PLINTH.height + 1.35 + Math.sin(t * 1.1) * 0.08;
    }
    if (orbit.current) orbit.current.rotation.y -= dt * 0.6;
  });
  const p = CENTER_PLINTH;
  return (
    <group position={[p.x, 0, p.z]}>
      <mesh material={mats.marble} position={[0, p.height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[p.radius, p.radius + 0.08, p.height, 12]} />
      </mesh>
      <mesh material={mats.brass} position={[0, p.height + 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[p.radius - 0.05, p.radius - 0.05, 0.03, 12]} />
      </mesh>
      <group ref={crystal} position={[0, p.height + 1.35, 0]}>
        <mesh material={mats.crystal} scale={[0.42, 0.68, 0.42]} castShadow>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
        <group ref={orbit}>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              material={mats.brass}
              position={[Math.cos((i * Math.PI * 2) / 3) * 0.85, Math.sin(i * 2.1) * 0.2, Math.sin((i * Math.PI * 2) / 3) * 0.85]}
              scale={0.1}
              castShadow
            >
              <icosahedronGeometry args={[1, 0]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

function GalleryPedestal() {
  const mats = getMaterials();
  const p = GALLERY_PEDESTAL;
  return (
    <group position={[p.x, 0, p.z]}>
      <mesh material={mats.marble} position={[0, p.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[p.size, p.height, p.size]} />
      </mesh>
      <mesh material={mats.trim} position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[p.size + 0.06, 0.1, p.size + 0.06]} />
      </mesh>
      <mesh material={mats.sculpture} position={[0, p.height + 0.42, 0]} rotation={[0.3, 0.6, 0]} castShadow>
        <torusKnotGeometry args={[0.24, 0.075, 64, 6, 2, 3]} />
      </mesh>
    </group>
  );
}

/** Reception desk with an open guest book (interactive in a later phase). */
function InfoDesk() {
  const mats = getMaterials();
  const d = INFO_DESK;
  const cx = (d.minX + d.maxX) / 2;
  const cz = (d.minZ + d.maxZ) / 2;
  const w = d.maxX - d.minX;
  const depth = d.maxZ - d.minZ;
  return (
    <group position={[cx, 0, cz]}>
      <mesh material={mats.walnut} position={[0, (d.height - 0.06) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, d.height - 0.06, depth]} />
      </mesh>
      <mesh material={mats.marble} position={[0, d.height - 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.12, 0.06, depth + 0.12]} />
      </mesh>
      <mesh material={mats.brass} position={[0, 0.5, depth / 2 + 0.005]}>
        <boxGeometry args={[w - 0.2, 0.05, 0.01]} />
      </mesh>
      {/* Guest book */}
      <group position={[-0.5, d.height + 0.02, 0.05]} rotation={[0, 0.25, 0]}>
        <mesh material={mats.fabric} castShadow>
          <boxGeometry args={[0.62, 0.025, 0.42]} />
        </mesh>
        <mesh material={mats.paper} position={[-0.15, 0.02, 0]} rotation={[0, 0, 0.06]}>
          <boxGeometry args={[0.29, 0.015, 0.39]} />
        </mesh>
        <mesh material={mats.paper} position={[0.15, 0.02, 0]} rotation={[0, 0, -0.06]}>
          <boxGeometry args={[0.29, 0.015, 0.39]} />
        </mesh>
      </group>
      {/* Desk lamp */}
      <group position={[1.0, d.height, -0.1]}>
        <mesh material={mats.brass} position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.4, 6]} />
        </mesh>
        <mesh material={mats.brass} position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.04, 10]} />
        </mesh>
        <mesh material={mats.lampGlow} position={[0, 0.42, 0]}>
          <sphereGeometry args={[0.07, 10, 6]} />
        </mesh>
        <mesh material={mats.brass} position={[0, 0.47, 0]}>
          <coneGeometry args={[0.16, 0.14, 10, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

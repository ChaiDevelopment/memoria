"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LIFT_SHAFT, RING_HOLE } from "@/config/grandMuseum";
import { mergeBoxes, type InstanceTransform } from "@/lib/geometry";
import { getMaterials } from "@/lib/materials";
import { useGameStore } from "@/stores/gameStore";
import type { WorldData } from "@/systems/world/buildWorld";
import type { Box3Data } from "@/types/world";
import { Instanced } from "./Instanced";

const CAP = 0.06;

/** Glass balustrade with a brass handrail, inside a railing collider box. */
function balustrade(r: Box3Data, glass: Box3Data[], brass: Box3Data[]) {
  const alongX = r.maxX - r.minX >= r.maxZ - r.minZ;
  const pad = 0.015;
  glass.push(alongX ? { ...r, minZ: r.minZ + pad, maxZ: r.maxZ - pad, minY: r.minY + 0.08, maxY: r.maxY - CAP } : { ...r, minX: r.minX + pad, maxX: r.maxX - pad, minY: r.minY + 0.08, maxY: r.maxY - CAP });
  const grow = 0.025;
  brass.push(alongX ? { ...r, minZ: r.minZ - grow, maxZ: r.maxZ + grow, minY: r.maxY - CAP, maxY: r.maxY } : { ...r, minX: r.minX - grow, maxX: r.maxX + grow, minY: r.maxY - CAP, maxY: r.maxY });
  brass.push({ ...r, minY: r.minY, maxY: r.minY + 0.08 });
}

/**
 * The Grand Atrium's furniture: the imperial staircase, its landing and the
 * balcony balustrades, the brass lift, the glass dome and the floating
 * memory crystal. Geometry comes from the world data (same boxes as the
 * colliders), merged per material.
 */
export function GrandAtrium({ world }: { world: WorldData }) {
  const mats = getMaterials();
  const { grand, atrium } = world;

  const geo = useMemo(() => {
    const glass: Box3Data[] = [];
    const brass: Box3Data[] = [];
    for (const r of atrium.railings) balustrade(r, glass, brass);

    // Stair nosings: a thin walnut lip on every tread.
    const nosing: Box3Data[] = atrium.treads.map((t) => ({ ...t, minY: t.maxY - 0.04, maxY: t.maxY + 0.005 }));
    // Landing / connector fascia.
    const fascia: Box3Data[] = atrium.platforms.map((p) => ({ minX: p.minX - 0.04, maxX: p.maxX + 0.04, minZ: p.minZ - 0.04, maxZ: p.maxZ + 0.04, minY: p.minY - 0.05, maxY: p.minY + 0.06 }));

    // Lift: brass corner posts, a band at every floor, glass sides, doors.
    const s = grand.liftShaft;
    const post = 0.14;
    const liftBrass: Box3Data[] = [];
    for (const x of [s.minX, s.maxX - post]) for (const z of [s.minZ, s.maxZ - post]) liftBrass.push({ minX: x, maxX: x + post, minZ: z, maxZ: z + post, minY: 0, maxY: s.maxY });
    const liftGlass: Box3Data[] = [
      { ...s, minX: s.minX + 0.02, maxX: s.minX + 0.06 },
      { ...s, minX: s.maxX - 0.06, maxX: s.maxX - 0.02 },
      { ...s, minZ: s.maxZ - 0.06, maxZ: s.maxZ - 0.02 },
    ];
    // Lift kiosk roof on the rooftop.
    liftBrass.push({ minX: s.minX - 0.3, maxX: s.maxX + 0.3, minZ: s.minZ - 0.3, maxZ: s.maxZ + 0.3, minY: s.maxY, maxY: s.maxY + 0.18 });
    const doors: Box3Data[] = [];
    for (const stop of grand.liftStops) {
      const y = stop.y;
      liftBrass.push({ ...s, minX: s.minX - 0.02, maxX: s.maxX + 0.02, minZ: s.minZ - 0.02, maxZ: s.maxZ + 0.02, minY: y + 2.6, maxY: y + 2.8 });
      liftBrass.push({ ...s, minX: s.minX - 0.02, maxX: s.maxX + 0.02, minZ: s.minZ - 0.02, maxZ: s.maxZ + 0.02, minY: y, maxY: y + 0.08 });
      // Door leaves (closed), on the shaft's north face.
      doors.push({ minX: s.minX + 0.2, maxX: (s.minX + s.maxX) / 2 - 0.01, minZ: s.minZ - 0.03, maxZ: s.minZ + 0.04, minY: y + 0.08, maxY: y + 2.6 });
      doors.push({ minX: (s.minX + s.maxX) / 2 + 0.01, maxX: s.maxX - 0.2, minZ: s.minZ - 0.03, maxZ: s.minZ + 0.04, minY: y + 0.08, maxY: y + 2.6 });
    }
    return {
      glass: mergeBoxes([...glass, ...liftGlass]),
      brass: mergeBoxes([...brass, ...liftBrass]),
      treads: mergeBoxes([...atrium.treads, ...atrium.platforms]),
      nosing: mergeBoxes([...nosing, ...fascia]),
      doors: mergeBoxes(doors),
      runners: mergeBoxes(grand.runners),
    };
  }, [grand, atrium]);
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo]);

  const panels = useMemo<InstanceTransform[]>(
    () => grand.liftStops.map((stop) => ({ x: stop.panel.x + 1.05, y: stop.panel.y, z: LIFT_SHAFT.minZ - 0.05, sx: 0.16, sy: 0.26, sz: 0.04 })),
    [grand],
  );
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => box.dispose(), [box]);

  return (
    <group name="grand-atrium">
      {geo.treads && <mesh geometry={geo.treads} material={mats.marble} castShadow receiveShadow />}
      {geo.nosing && <mesh geometry={geo.nosing} material={mats.walnut} castShadow receiveShadow />}
      {geo.brass && <mesh geometry={geo.brass} material={mats.brass} castShadow />}
      {geo.doors && <mesh geometry={geo.doors} material={mats.walnut} receiveShadow />}
      {geo.runners && <mesh geometry={geo.runners} material={mats.fabric} receiveShadow />}
      {geo.glass && <mesh geometry={geo.glass} material={mats.glass} renderOrder={2} />}
      <Instanced geometry={box} material={mats.lampGlow} items={panels} castShadow={false} />
      <Dome height={grand.atriumHeight} />
      <MemoryCrystal height={grand.atriumHeight} />
      <HallShells world={world} />
    </group>
  );
}

/** Glass dome with brass ribs over the atrium's central oculus. */
function Dome({ height }: { height: number }) {
  const mats = getMaterials();
  const cx = (RING_HOLE.minX + RING_HOLE.maxX) / 2;
  const geo = useMemo(
    () => ({
      shell: new THREE.SphereGeometry(6, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      ring: new THREE.TorusGeometry(6, 0.12, 6, 40),
      rib: new THREE.TorusGeometry(6, 0.05, 4, 24, Math.PI),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const y = height + 0.4;
  return (
    <group position={[cx, y, 26]}>
      <mesh geometry={geo.shell} material={mats.glass} renderOrder={2} />
      <mesh geometry={geo.ring} material={mats.brass} rotation={[Math.PI / 2, 0, 0]} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={geo.rib} material={mats.brass} rotation={[0, (i * Math.PI) / 4, 0]} />
      ))}
    </group>
  );
}

/** The giant floating memory crystal in the atrium void, circled by brass rings. */
function MemoryCrystal({ height }: { height: number }) {
  const mats = getMaterials();
  const crystal = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const geo = useMemo(
    () => ({
      gem: new THREE.OctahedronGeometry(1.3, 0),
      ring: new THREE.TorusGeometry(2.3, 0.05, 6, 48),
      ring2: new THREE.TorusGeometry(2.8, 0.035, 6, 48),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  // Float between the landing and the dome, clear of the staircase.
  const y = Math.max(10, height - 4.5);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (crystal.current) {
      crystal.current.rotation.y = t * 0.25;
      crystal.current.position.y = y + Math.sin(t * 0.8) * 0.25;
    }
    if (ringA.current) ringA.current.rotation.set(Math.PI / 2 + Math.sin(t * 0.3) * 0.35, t * 0.2, 0);
    if (ringB.current) ringB.current.rotation.set(Math.PI / 2 - 0.4, -t * 0.15, Math.cos(t * 0.25) * 0.3);
  });
  return (
    <group position={[0, 0, 26]}>
      <mesh ref={crystal} geometry={geo.gem} material={mats.crystal} scale={[1, 1.7, 1]} castShadow />
      <mesh ref={ringA} geometry={geo.ring} material={mats.brass} position={[0, y, 0]} />
      <mesh ref={ringB} geometry={geo.ring2} material={mats.brass} position={[0, y, 0]} />
      <pointLight position={[0, y, 0]} color="#ffd9a0" intensity={8} distance={14} decay={1.6} />
    </group>
  );
}

/**
 * Memory Halls on floors other than the visitor's are not rendered in full;
 * a plain massing box per hall keeps the building's silhouette from outside.
 */
function HallShells({ world }: { world: WorldData }) {
  const mats = getMaterials();
  const floor = useGameStore((s) => s.currentFloor);
  const geometry = useMemo(() => {
    const pad = 0.2;
    const boxes = world.grand.hallShells
      .filter((s) => s.floor !== floor)
      .map((s) => ({ minX: s.box.minX - pad, maxX: s.box.maxX + pad, minZ: s.box.minZ - pad, maxZ: s.box.maxZ + pad, minY: s.box.minY, maxY: s.box.maxY - (isTop(world, s) ? 0.65 : 0) }));
    return mergeBoxes(boxes);
  }, [world, floor]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry ? <mesh geometry={geometry} material={mats.wall} castShadow receiveShadow /> : null;
}

function isTop(world: WorldData, s: WorldData["grand"]["hallShells"][number]) {
  return !world.grand.hallShells.some((o) => o.floor === s.floor + 1 && o.box.minX === s.box.minX && o.box.minZ === s.box.minZ);
}


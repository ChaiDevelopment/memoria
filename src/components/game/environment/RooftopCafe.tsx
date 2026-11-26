"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { RooftopCafe as CafeDef } from "@/config/grandMuseum";
import { ATRIUM } from "@/config/grandMuseum";
import type { InstanceTransform } from "@/lib/geometry";
import { getMaterials } from "@/lib/materials";
import { Instanced } from "./Instanced";

const UMBRELLA_COLORS = ["#c9774a", "#e9dcc4", "#6f8f6a"];

/**
 * The rooftop café on the Grand Atrium: an open deck with a coffee bar,
 * bistro tables under parasols, planters, loungers facing the hills and
 * strings of warm lights — a place to sit and look at the view.
 */
export function RooftopCafe({ cafe }: { cafe: CafeDef }) {
  const mats = getMaterials();
  const geo = useMemo(
    () => ({
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
      cone: new THREE.ConeGeometry(1, 1, 8),
      bulb: new THREE.SphereGeometry(1, 8, 6),
      bush: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  const items = useMemo(() => {
    const y = cafe.y;
    const tableTops: InstanceTransform[] = [];
    const metal: InstanceTransform[] = [];
    const chairs: InstanceTransform[] = [];
    const parasols: InstanceTransform[] = [];
    const cups: InstanceTransform[] = [];
    const pots: InstanceTransform[] = [];
    const bushes: InstanceTransform[] = [];
    const bulbs: InstanceTransform[] = [];
    const wood: InstanceTransform[] = [];
    const marble: InstanceTransform[] = [];
    const cushions: InstanceTransform[] = [];

    cafe.tables.forEach((t, i) => {
      tableTops.push({ x: t.x, y: y + 0.74, z: t.z, sx: 0.48, sy: 0.04, sz: 0.48 });
      metal.push({ x: t.x, y: y + 0.37, z: t.z, sx: 0.04, sy: 0.74, sz: 0.04 });
      metal.push({ x: t.x, y: y + 0.02, z: t.z, sx: 0.24, sy: 0.04, sz: 0.24 });
      cups.push({ x: t.x + 0.12, y: y + 0.8, z: t.z - 0.05, sx: 0.045, sy: 0.08, sz: 0.045 });
      cups.push({ x: t.x - 0.14, y: y + 0.8, z: t.z + 0.08, sx: 0.045, sy: 0.08, sz: 0.045 });
      // Two chairs facing each other across the table.
      for (const side of [-1, 1]) {
        const cx = t.x + side * 0.72;
        const rotationY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        chairs.push({ x: cx, y: y + 0.45, z: t.z, sx: 0.44, sy: 0.05, sz: 0.44, rotationY });
        chairs.push({ x: cx + side * 0.2, y: y + 0.72, z: t.z, sx: 0.44, sy: 0.5, sz: 0.05, rotationY });
        for (const dx of [-0.18, 0.18]) for (const dz of [-0.18, 0.18]) metal.push({ x: cx + dx, y: y + 0.22, z: t.z + dz, sx: 0.03, sy: 0.44, sz: 0.03 });
      }
      if (t.umbrella) {
        metal.push({ x: t.x, y: y + 1.25, z: t.z, sx: 0.035, sy: 2.5, sz: 0.035 });
        parasols.push({ x: t.x, y: y + 2.45, z: t.z, sx: 1.35, sy: 0.55, sz: 1.35, color: UMBRELLA_COLORS[i % UMBRELLA_COLORS.length] });
      }
    });

    // Coffee bar.
    const c = cafe.counter;
    const cx = (c.minX + c.maxX) / 2;
    const cz = (c.minZ + c.maxZ) / 2;
    wood.push({ x: cx, y: (c.minY + c.maxY) / 2 - 0.03, z: cz, sx: c.maxX - c.minX, sy: c.maxY - c.minY - 0.06, sz: c.maxZ - c.minZ });
    marble.push({ x: cx, y: c.maxY - 0.03, z: cz, sx: c.maxX - c.minX + 0.12, sy: 0.06, sz: c.maxZ - c.minZ + 0.12 });
    metal.push({ x: cx - 1.6, y: c.maxY + 0.22, z: cz - 0.1, sx: 0.55, sy: 0.4, sz: 0.4 }); // espresso machine
    metal.push({ x: cx + 1.4, y: c.maxY + 0.15, z: cz - 0.1, sx: 0.22, sy: 0.3, sz: 0.22 }); // grinder
    for (let i = 0; i < 5; i++) cups.push({ x: cx - 0.4 + i * 0.18, y: c.maxY + 0.04, z: cz + 0.15, sx: 0.045, sy: 0.08, sz: 0.045 });
    // Bar stools on the café side.
    for (const dx of [-2, -0.7, 0.6, 1.9]) {
      wood.push({ x: cx + dx, y: c.minY + 0.72, z: c.maxZ + 0.45, sx: 0.36, sy: 0.06, sz: 0.36 });
      metal.push({ x: cx + dx, y: c.minY + 0.36, z: c.maxZ + 0.45, sx: 0.04, sy: 0.72, sz: 0.04 });
    }
    // Menu board above the bar.
    wood.push({ x: cx, y: c.minY + 2.2, z: c.minZ - 0.25, sx: 2.6, sy: 0.9, sz: 0.06 });

    for (const p of cafe.planters) {
      pots.push({ x: p.x, y: cafe.y + 0.3, z: p.z, sx: 0.8, sy: 0.6, sz: 0.8 });
      bushes.push({ x: p.x, y: cafe.y + 0.95, z: p.z, sx: 0.55, sy: 0.6, sz: 0.55 });
    }
    for (const l of cafe.loungers) {
      wood.push({ x: l.x, y: y + 0.28, z: l.z, sx: 0.75, sy: 0.08, sz: 1.8 });
      wood.push({ x: l.x, y: y + 0.55, z: l.z - 0.78, sx: 0.75, sy: 0.55, sz: 0.08, rotationY: 0 });
      cushions.push({ x: l.x, y: y + 0.36, z: l.z + 0.05, sx: 0.68, sy: 0.08, sz: 1.6 });
      for (const dx of [-0.32, 0.32]) for (const dz of [-0.8, 0.8]) metal.push({ x: l.x + dx, y: y + 0.12, z: l.z + dz, sx: 0.04, sy: 0.24, sz: 0.04 });
    }

    // Festoon lights: posts at the corners and midpoints, bulbs strung between them.
    const posts: [number, number][] = [
      [ATRIUM.minX + 0.35, ATRIUM.minZ + 0.35],
      [ATRIUM.minX + 0.35, 26],
      [ATRIUM.minX + 0.35, ATRIUM.maxZ - 0.35],
      [0, ATRIUM.maxZ - 0.35],
      [ATRIUM.maxX - 0.35, ATRIUM.maxZ - 0.35],
      [ATRIUM.maxX - 0.35, 26],
      [ATRIUM.maxX - 0.35, ATRIUM.minZ + 3.6],
    ];
    for (const [px, pz] of posts) metal.push({ x: px, y: y + 1.5, z: pz, sx: 0.06, sy: 3, sz: 0.06 });
    for (let i = 0; i < posts.length - 1; i++) {
      const [ax, az] = posts[i]!;
      const [bx, bz] = posts[i + 1]!;
      const n = Math.round(Math.hypot(bx - ax, bz - az) / 0.9);
      for (let j = 1; j < n; j++) {
        const t = j / n;
        const sag = Math.sin(t * Math.PI) * 0.45;
        bulbs.push({ x: ax + (bx - ax) * t, y: y + 2.85 - sag, z: az + (bz - az) * t, sx: 0.06, sy: 0.08, sz: 0.06 });
      }
    }
    return { tableTops, metal, chairs, parasols, cups, pots, bushes, bulbs, wood, marble, cushions };
  }, [cafe]);

  return (
    <group name="rooftop-cafe">
      <Instanced geometry={geo.cyl} material={mats.walnut} items={items.tableTops} />
      <Instanced geometry={geo.box} material={mats.blackMetal} items={items.metal} />
      <Instanced geometry={geo.box} material={mats.oak} items={items.chairs} />
      <Instanced geometry={geo.cone} material={mats.whiteInstanced} items={items.parasols} />
      <Instanced geometry={geo.cyl} material={mats.ceramic} items={items.cups} castShadow={false} />
      <Instanced geometry={geo.box} material={mats.terracotta} items={items.pots} />
      <Instanced geometry={geo.bush} material={mats.leaf} items={items.bushes} />
      <Instanced geometry={geo.bulb} material={mats.lampGlow} items={items.bulbs} castShadow={false} />
      <Instanced geometry={geo.box} material={mats.darkWood} items={items.wood} />
      <Instanced geometry={geo.box} material={mats.marble} items={items.marble} />
      <Instanced geometry={geo.box} material={mats.cushion} items={items.cushions} castShadow={false} />
    </group>
  );
}

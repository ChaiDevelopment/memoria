"use client";

import { Sky } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { WORLD } from "@/config/gameConfig";
import type { InstanceTransform } from "@/lib/geometry";
import { getMaterials } from "@/lib/materials";
import { mulberry32 } from "@/lib/random";
import { createGrassTexture } from "@/lib/textures/proceduralTextures";
import { Instanced } from "./Instanced";

const GROUND_SIZE = 420;

export function Outdoors() {
  const mats = getMaterials();
  const grass = useMemo(() => {
    const tex = createGrassTexture();
    tex.repeat.set(GROUND_SIZE / 6, GROUND_SIZE / 6);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: "#ffffff" });
  }, []);
  useEffect(() => () => (grass.map?.dispose(), grass.dispose()), [grass]);

  const geo = useMemo(() => ({ hill: new THREE.ConeGeometry(1, 1, 7), box: new THREE.BoxGeometry(1, 1, 1) }), []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

  const hills = useMemo<InstanceTransform[]>(() => {
    const rand = mulberry32(77);
    const out: InstanceTransform[] = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand() * 0.2;
      const r = 150 + rand() * 50;
      const s = 30 + rand() * 35;
      out.push({ x: Math.cos(a) * r, y: s * 0.2, z: Math.sin(a) * r, sx: s, sy: s * (0.4 + rand() * 0.35), sz: s, rotationY: rand() * 3, color: rand() > 0.5 ? "#7d9a6a" : "#6c8c62" });
    }
    return out;
  }, []);

  // Entrance plaza, steps and a low stone wall framing the front lawn.
  const plaza = useMemo<InstanceTransform[]>(
    () => [
      { x: 0, y: 0.012, z: 20.2, sx: 28, sy: 0.024, sz: 12 },
      { x: 25, y: 0.012, z: 12.6, sx: 33, sy: 0.024, sz: 3 },
      { x: 0, y: 0.06, z: 14.9, sx: 6, sy: 0.12, sz: 1.0 },
    ],
    [],
  );

  const sun = WORLD.sunDirection;
  return (
    <group name="outdoors">
      <Sky distance={4500} sunPosition={[sun[0] * 100, sun[1] * 100, sun[2] * 100]} turbidity={6} rayleigh={1.4} mieCoefficient={0.006} mieDirectionalG={0.86} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={grass} receiveShadow>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      </mesh>
      <Instanced geometry={geo.box} material={mats.stone} items={plaza} castShadow={false} />
      <Instanced geometry={geo.hill} material={mats.whiteInstanced} items={hills} castShadow={false} receiveShadow={false} />
    </group>
  );
}

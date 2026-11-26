"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { WORLD } from "@/config/gameConfig";
import type { PlayerRuntime } from "@/systems/runtime";
import type { QualityLevel } from "@/types/game";

const SHADOW_MAP: Record<QualityLevel, number> = { low: 0, medium: 1024, high: 2048 };

/**
 * Warm late-afternoon sun + sky fill. The sun's shadow frustum follows the
 * player (snapped to shadow-map texels to avoid shimmering), so a modest
 * shadow map stays crisp across the whole museum.
 */
export function Lighting({ runtime, quality }: { runtime: PlayerRuntime; quality: QualityLevel }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const atriumLight = useRef<THREE.PointLight>(null);
  const hallLight = useRef<THREE.PointLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const { gl, scene } = useThree();
  const mapSize = SHADOW_MAP[quality];
  const shadows = mapSize > 0;
  const extent = WORLD.shadowExtent;
  const dir = useMemo(() => new THREE.Vector3(...WORLD.sunDirection).normalize(), []);

  // Soft image-based fill from a procedural studio environment (no network fetch).
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.32;
    return () => {
      scene.environment = null;
      env.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const p = runtime.motor.position;
    const texel = shadows ? (extent * 2) / mapSize : 1;
    const x = Math.round(p.x / texel) * texel;
    const z = Math.round(p.z / texel) * texel;
    target.position.set(x, 0, z);
    target.updateMatrixWorld();
    l.position.set(x + dir.x * 70, dir.y * 70, z + dir.z * 70);
    // Two warm lights that travel with the visitor: one over the atrium at
    // their storey, one over the Memory Hall they're in (constant light count,
    // so no shader recompiles).
    const g = runtime.groundY;
    atriumLight.current?.position.set(0, g + 4.6, 28);
    const h = hallLight.current;
    if (h) {
      const inHalls = p.x > 12;
      h.intensity = inHalls ? 16 : 0;
      const hx = 22 + Math.round((p.x - 22) / 20) * 20;
      const hz = p.z < 28 ? 21 : 35;
      h.position.set(hx, g + 4.2, hz);
    }
  });

  return (
    <>
      <primitive object={target} />
      <directionalLight
        // Re-create when the shadow map size changes so the map is reallocated.
        key={mapSize}
        ref={light}
        target={target}
        color="#ffe3bd"
        intensity={2.6}
        castShadow={shadows}
        shadow-mapSize={[Math.max(mapSize, 512), Math.max(mapSize, 512)]}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={10}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
      />
      <hemisphereLight args={["#dbe8f7", "#a88a63", 0.85]} />
      <ambientLight color="#ffe8c8" intensity={0.18} />
      {quality !== "low" && (
        <>
          <pointLight position={[0, 5.2, 7]} color="#ffd9a0" intensity={22} distance={18} decay={1.6} />
          <pointLight position={[0, 4.6, -12]} color="#ffe2b5" intensity={20} distance={18} decay={1.6} />
          <pointLight position={[25, 3.6, 7]} color="#ffd59a" intensity={16} distance={20} decay={1.6} />
          <pointLight ref={atriumLight} position={[0, 4.6, 28]} color="#ffdcaa" intensity={22} distance={22} decay={1.5} />
          <pointLight ref={hallLight} position={[22, 4.2, 21]} color="#ffd9a0" intensity={0} distance={18} decay={1.6} />
        </>
      )}
      <fog attach="fog" args={["#e6dccb", 55, 210]} />
    </>
  );
}

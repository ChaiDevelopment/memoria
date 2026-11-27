"use client";

import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { InvitationView } from "@/stores/gameStore";
import { BALLROOM, VENUE } from "@/systems/world/buildWedding";
import type { QualityLevel } from "@/types/game";
import { ASSET, GlbInstances, GlbModel } from "../assets/glb";
import type { VenueKit } from "./venueKit";

const FLOOR_TEX = "/assets/textures/marble-floor.png";
const FLOOR_ROUGH = "/assets/textures/marble-floor_roughness.png";

/**
 * The Grand Ballroom, built from the asset pack: the architectural shell
 * (arched windows, pilasters, coffered ceiling, wall sconces), velvet
 * curtains at every window, a polished marble floor, crystal chandeliers
 * under the ceiling medallions, round banquet tables, the two-level stage
 * and the couple's sofa.
 */
export function GrandBallroom({ quality }: { kit: VenueKit; quality: QualityLevel; invitation: InvitationView }) {
  const low = quality === "low";
  const marble = useTexture(FLOOR_TEX);
  const rough = useTexture(FLOOR_ROUGH);
  const floorMat = useMemo(() => {
    for (const t of [marble, rough]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(16, 24); // one repeat per 2 m
      t.anisotropy = 8;
    }
    marble.colorSpace = THREE.SRGBColorSpace;
    // Polished but not mirror-like: sharp highlights would bloom into glare.
    // The roughness map's glossy veins caught the lamps as hot spots, so the floor
    // uses a uniform satin finish instead (soft sheen, no glare).
    void rough;
    return new THREE.MeshStandardMaterial({ map: marble, roughness: 0.72, metalness: 0, envMapIntensity: 0.9 });
  }, [marble, rough]);
  useEffect(() => () => floorMat.dispose(), [floorMat]);

  const items = useMemo(() => {
    const wallX = VENUE.maxX - 0.24;
    return {
      curtains: BALLROOM.windows.flatMap((z) => [
        { x: -wallX, y: 0, z, rotationY: Math.PI / 2 },
        { x: wallX, y: 0, z, rotationY: -Math.PI / 2 },
      ]),
      tables: BALLROOM.tables.map((t) => ({ x: t.x, y: 0, z: t.z })),
      centerpieces: BALLROOM.tables.map((t) => ({ x: t.x, y: 0.78, z: t.z })),
      grand: BALLROOM.chandeliers.filter((c) => c.big).map((c) => ({ x: c.x, y: VENUE.ceiling, z: c.z })),
      small: BALLROOM.chandeliers.filter((c) => !c.big).map((c) => ({ x: c.x, y: VENUE.ceiling, z: c.z })),
    };
  }, []);

  const W = VENUE.maxX - VENUE.minX;
  const D = VENUE.maxZ - VENUE.minZ;
  return (
    <group name="grand-ballroom">
      <mesh material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (VENUE.minZ + VENUE.maxZ) / 2]} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      {/* The shell is lit, not a shadow caster (it is the room itself) — a large saving. */}
      <GlbModel url={ASSET.ballroom("ballroom-shell")} position={[BALLROOM.shellAt.x, 0, BALLROOM.shellAt.z]} castShadow={false} />
      <GlbInstances url={ASSET.ballroom("curtain-velvet")} items={items.curtains} castShadow={false} />

      {/* Stage, backdrop and the couple's sofa. */}
      <GlbModel url={ASSET.ballroom("stage-ballroom")} position={[BALLROOM.stageAt.x, 0, BALLROOM.stageAt.z]} castShadow={false} />
      <GlbModel url={ASSET.ballroom("sofa-wedding")} position={[BALLROOM.sofa.x, BALLROOM.stage[1].top, BALLROOM.sofa.z]} />

      {/* Banquet tables with their chairs and centrepieces. */}
      <GlbInstances url={ASSET.ballroom("table-round-set")} items={items.tables} castShadow={false} />
      <GlbInstances url={ASSET.ballroom("centerpiece-flowers")} items={items.centerpieces} castShadow={false} />

      {/* Crystal chandeliers hang from the ceiling medallions. */}
      <GlbInstances url={ASSET.ballroom("chandelier-grand")} items={items.grand} castShadow={false} />
      <GlbInstances url={ASSET.ballroom("chandelier-small")} items={items.small} castShadow={false} />

      <BallroomLights low={low} />
    </group>
  );
}

function BallroomLights({ low }: { low: boolean }) {
  const spot = useMemo(() => {
    // A soft spotlight on the sofa (strong enough to lift it, not to wash out the white stage).
    const s = new THREE.SpotLight("#ffe1b0", low ? 18 : 26, 24, 0.4, 0.6, 1.4);
    s.position.set(0, 6.6, -8.5);
    s.target.position.set(0, 0.8, -17.6);
    return s;
  }, [low]);
  useEffect(() => () => spot.dispose(), [spot]);
  return (
    <>
      <primitive object={spot} />
      <primitive object={spot.target} />
      <pointLight position={[0, 5.2, 1]} color="#ffd9a0" intensity={low ? 26 : 34} distance={24} decay={1.5} />
      {!low && (
        <>
          <pointLight position={[0, 5, 14]} color="#ffd9a0" intensity={24} distance={18} decay={1.6} />
          <pointLight position={[0, 4.8, -10]} color="#ffdcae" intensity={14} distance={14} decay={1.6} />
        </>
      )}
    </>
  );
}

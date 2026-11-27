"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { InstanceTransform } from "@/lib/geometry";
import type { InvitationView } from "@/stores/gameStore";
import { BALLROOM, STAGE, THRONES, VENUE } from "@/systems/world/buildWedding";
import type { QualityLevel } from "@/types/game";
import { Instanced } from "../environment/Instanced";
import { rng, useDisposable, type VenueKit } from "./venueKit";
import { marbleTexture, ornateBackdropTexture } from "./weddingTextures";

const FLORALS = ["#ffffff", "#f7e3d6", "#e9a8b2", "#c9536a", "#f3d0d6"];
/** Window bays sit above every other photo frame on the side walls. */
const WINDOW_Z = [-14.4, -9.2, -4, 1.2, 6.4, 11.6, 16.8, 22];

/**
 * The Grand Ballroom: marble floor, classical pillars, tall arched windows
 * with burgundy velvet, a coffered ceiling with crystal chandeliers, round
 * banquet tables and a two-level stage with an ornate gold backdrop.
 */
export function GrandBallroom({ kit, quality, invitation }: { kit: VenueKit; quality: QualityLevel; invitation: InvitationView }) {
  const { m, g } = kit;
  const low = quality === "low";
  const marble = useDisposable(() => {
    const t = marbleTexture(low ? 256 : 512);
    t.repeat.set(16, 24);
    return t;
  }, [low]);
  const floorMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: marble, roughness: 0.18, metalness: 0.08 }), [marble]);
  const backdropTex = useDisposable(() => ornateBackdropTexture(invitation.groomName, invitation.brideName), [invitation.groomName, invitation.brideName]);
  const backdropMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: backdropTex, roughness: 0.55, metalness: 0.1 }), [backdropTex]);

  const W = VENUE.maxX - VENUE.minX;
  const D = VENUE.maxZ - VENUE.minZ;
  const cz = (VENUE.minZ + VENUE.maxZ) / 2;
  const H = VENUE.ceiling;

  const d = useMemo(() => {
    const r = rng(311);
    // Pillars: plinth, fluted shaft and capital.
    const plinths: InstanceTransform[] = [];
    const shafts: InstanceTransform[] = [];
    const capitals: InstanceTransform[] = [];
    for (const p of [...BALLROOM.wallPillars, ...BALLROOM.stagePillars]) {
      plinths.push({ x: p.x, y: 0.2, z: p.z, sx: p.r * 2.3, sy: 0.4, sz: p.r * 2.3 });
      shafts.push({ x: p.x, y: H / 2, z: p.z, sx: p.r, sy: H - 0.8, sz: p.r });
      capitals.push({ x: p.x, y: H - 0.3, z: p.z, sx: p.r * 2.4, sy: 0.32, sz: p.r * 2.4 });
    }
    // Round banquet tables: cloth, centrepiece, candles; chairs facing the table with burgundy ribbons.
    const centre: InstanceTransform[] = [];
    const candles: InstanceTransform[] = [];
    const chairSeats: InstanceTransform[] = [];
    const chairBacks: InstanceTransform[] = [];
    const ribbons: InstanceTransform[] = [];
    const ring = BALLROOM.chairRing;
    for (const t of BALLROOM.tables) {
      for (let i = 0; i < 9; i++) centre.push({ x: t.x + (r() - 0.5) * 0.36, y: 1.0 + r() * 0.18, z: t.z + (r() - 0.5) * 0.36, sx: 0.9, sy: 0.9, sz: 0.9, color: FLORALS[Math.floor(r() * FLORALS.length)] });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        candles.push({ x: t.x + Math.cos(a) * 0.5, y: 0.86, z: t.z + Math.sin(a) * 0.5, sx: 0.03, sy: 0.12, sz: 0.03 });
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const ox = Math.cos(a);
        const oz = Math.sin(a);
        // The chair faces the table: its back is on the outer side.
        const rotationY = Math.atan2(ox, oz);
        chairSeats.push({ x: t.x + ox * ring, y: 0.46, z: t.z + oz * ring, sx: 0.44, sy: 0.07, sz: 0.44, rotationY });
        chairBacks.push({ x: t.x + ox * (ring + 0.2), y: 0.76, z: t.z + oz * (ring + 0.2), sx: 0.42, sy: 0.6, sz: 0.05, rotationY });
        ribbons.push({ x: t.x + ox * (ring + 0.235), y: 0.7, z: t.z + oz * (ring + 0.235), sx: 0.44, sy: 0.09, sz: 0.02, rotationY });
      }
    }
    // Stage florals: banks of roses at both ends and along the front edge.
    const stageFlowers: InstanceTransform[] = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 34; i++) {
        const sc = 1 + r() * 0.8;
        stageFlowers.push({ x: s * (5.4 + r() * 0.9), y: 0.3 + r() * 1.5, z: -19.0 + r() * 1.8, sx: sc, sy: sc, sz: sc, color: FLORALS[Math.floor(r() * FLORALS.length)] });
      }
      for (let i = 0; i < 14; i++) {
        const sc = 0.8 + r() * 0.6;
        stageFlowers.push({ x: s * (1.5 + r() * 4.6), y: 0.3, z: -13.5 + (r() - 0.5) * 0.15, sx: sc, sy: sc * 0.7, sz: sc, color: FLORALS[Math.floor(r() * FLORALS.length)] });
      }
    }
    // Crystal drops for the chandeliers.
    const crystals: InstanceTransform[] = [];
    for (const c of BALLROOM.chandeliers) {
      const tiers: [number, number, number][] = c.big ? [[1.6, 22, 2.0], [1.1, 16, 2.6], [0.6, 10, 3.1]] : [[0.75, 12, 1.4], [0.42, 8, 1.8]];
      for (const [rad, n, drop] of tiers) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          crystals.push({ x: c.x + Math.cos(a) * rad, y: H - drop - (i % 2) * 0.12, z: c.z + Math.sin(a) * rad, sx: 1.2, sy: 2.2, sz: 1.2 });
        }
      }
    }
    // Pleated velvet: curtains at every window and long drapes framing the stage.
    const velvet: InstanceTransform[] = [];
    for (const s of [-1, 1]) {
      for (const z of WINDOW_Z) {
        for (const side of [-1, 1]) {
          for (let k = 0; k < 5; k++) velvet.push({ x: s * (VENUE.maxX - 0.14 - (k % 2) * 0.04), y: 4.55, z: z + side * (0.78 + k * 0.08), sx: 0.055, sy: 2.75, sz: 0.055 });
        }
      }
      for (let k = 0; k < 9; k++) velvet.push({ x: s * (6.25 + k * 0.1), y: 2.6, z: STAGE.minZ + 0.12 + (k % 2) * 0.06, sx: 0.07, sy: 5.2, sz: 0.07 });
    }
    return { plinths, shafts, capitals, centre, candles, chairSeats, chairBacks, ribbons, stageFlowers, crystals, velvet };
  }, [H]);

  const [lv1, lv2] = BALLROOM.stage;
  const top = lv2.top;
  return (
    <group name="grand-ballroom">
      {/* Marble floor. */}
      <mesh geometry={g.plane} material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]} scale={[W, D, 1]} receiveShadow />

      {/* Walls: ivory with gold-framed panels below, arched windows with velvet curtains above. */}
      <Walls kit={kit} W={W} D={D} cz={cz} H={H} />

      {/* Coffered ceiling: a raised tray with a glowing cove and gold moulding. */}
      <mesh geometry={g.plane} material={m.ceiling} rotation={[Math.PI / 2, 0, 0]} position={[0, H, cz]} scale={[W, D, 1]} />
      <mesh geometry={g.box} material={m.ceilingTray} position={[0, H - 0.25, cz]} scale={[W - 2, 0.1, D - 2]} />
      <mesh geometry={g.box} material={m.cove} position={[0, H - 0.31, cz]} scale={[W - 7, 0.04, D - 7]} />
      <mesh geometry={g.box} material={m.ceiling} position={[0, H - 0.33, cz]} scale={[W - 7.6, 0.06, D - 7.6]} />
      {[-1, 1].map((s) => (
        <mesh key={`mx${s}`} geometry={g.box} material={m.gold} position={[s * ((W - 2) / 2), H - 0.32, cz]} scale={[0.1, 0.08, D - 2]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`mz${s}`} geometry={g.box} material={m.gold} position={[0, H - 0.32, cz + s * ((D - 2) / 2)]} scale={[W - 2, 0.08, 0.1]} />
      ))}

      {/* Classical pillars. */}
      <Instanced geometry={g.box} material={m.marbleColumn} items={d.plinths} />
      <Instanced geometry={g.cylinder} material={m.marbleColumn} items={d.shafts} />
      <Instanced geometry={g.box} material={m.gold} items={d.capitals} />

      {/* Two-level stage with an ornate gold backdrop. */}
      <mesh geometry={g.box} material={m.champagne} position={[0, lv1.top / 2, (lv1.minZ + lv1.maxZ) / 2]} scale={[lv1.maxX - lv1.minX, lv1.top, lv1.maxZ - lv1.minZ]} castShadow receiveShadow />
      <mesh geometry={g.box} material={m.champagne} position={[0, lv2.top / 2, (lv2.minZ + lv2.maxZ) / 2]} scale={[lv2.maxX - lv2.minX, lv2.top, lv2.maxZ - lv2.minZ]} castShadow receiveShadow />
      <mesh geometry={g.box} material={m.gold} position={[0, lv1.top - 0.02, lv1.maxZ + 0.01]} scale={[lv1.maxX - lv1.minX, 0.04, 0.03]} />
      <mesh geometry={g.box} material={m.gold} position={[0, lv2.top - 0.02, lv2.maxZ + 0.01]} scale={[lv2.maxX - lv2.minX, 0.04, 0.03]} />
      <mesh geometry={g.plane} material={m.burgundy} rotation={[-Math.PI / 2, 0, 0]} position={[0, lv2.top + 0.006, -17.4]} scale={[3.6, 3.4, 1]} receiveShadow />
      <mesh geometry={g.plane} material={m.burgundy} rotation={[-Math.PI / 2, 0, 0]} position={[0, lv1.top + 0.006, -14.6]} scale={[2.2, 2.4, 1]} receiveShadow />
      <mesh geometry={g.box} material={m.goldDark} position={[0, 2.6, STAGE.minZ - 0.32]} scale={[13, 5.2, 0.5]} receiveShadow />
      <mesh geometry={g.plane} material={backdropMat} position={[0, 2.75, STAGE.minZ - 0.06]} scale={[12.2, 4.9, 1]} />
      <mesh geometry={g.halfRing} material={m.gold} position={[0, 4.3, STAGE.minZ - 0.03]} scale={[3.2, 1.1, 1]} />
      {/* Pleated velvet drapes (stage and windows) with gold tie-backs. */}
      <Instanced geometry={g.cylinderLow} material={m.velvet} items={d.velvet} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.box} material={m.gold} position={[s * 6.65, 1.5, STAGE.minZ + 0.26]} scale={[1.0, 0.07, 0.07]} />
      ))}
      <Instanced geometry={g.flower} material={m.white} items={d.stageFlowers} />
      {/* Gold thrones with burgundy cushions. */}
      {THRONES.map((t) => (
        <group key={t.x} position={[t.x, top, t.z]}>
          <mesh geometry={g.box} material={m.gold} position={[0, 0.26, 0]} scale={[0.82, 0.5, 0.74]} castShadow />
          <mesh geometry={g.box} material={m.burgundy} position={[0, 0.55, 0.02]} scale={[0.66, 0.12, 0.6]} />
          <mesh geometry={g.box} material={m.gold} position={[0, 1.1, -0.33]} scale={[0.82, 1.2, 0.12]} castShadow />
          <mesh geometry={g.halfDisc} material={m.gold} position={[0, 1.7, -0.33]} scale={[0.41, 0.36, 1]} />
          <mesh geometry={g.box} material={m.burgundy} position={[0, 1.08, -0.26]} scale={[0.6, 0.95, 0.04]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={g.box} material={m.gold} position={[s * 0.38, 0.72, 0]} scale={[0.07, 0.18, 0.66]} />
          ))}
        </group>
      ))}

      {/* Banquet tables. */}
      {BALLROOM.tables.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh geometry={g.tableTop} material={m.tablecloth} position={[0, 0.76, 0]} scale={[BALLROOM.tableRadius, 0.04, BALLROOM.tableRadius]} castShadow receiveShadow />
          <mesh geometry={g.cloth} material={m.tablecloth} position={[0, 0.38, 0]} scale={[BALLROOM.tableRadius, 0.76, BALLROOM.tableRadius]} />
          <mesh geometry={g.cylinder} material={m.gold} position={[0, 0.86, 0]} scale={[0.1, 0.18, 0.1]} />
        </group>
      ))}
      <Instanced geometry={g.flower} material={m.white} items={d.centre} castShadow={false} />
      <Instanced geometry={g.cylinderLow} material={m.flame} items={d.candles} castShadow={false} />
      <Instanced geometry={g.box} material={m.satin} items={d.chairSeats} />
      <Instanced geometry={g.box} material={m.satin} items={d.chairBacks} />
      <Instanced geometry={g.box} material={m.burgundy} items={d.ribbons} castShadow={false} />

      {/* Crystal chandeliers: one grand centrepiece and smaller companions. */}
      {BALLROOM.chandeliers.map((c, i) => (
        <group key={i} position={[c.x, H, c.z]}>
          <mesh geometry={g.cylinder} material={m.gold} position={[0, -0.5, 0]} scale={[0.025, 1, 0.025]} />
          <mesh geometry={g.ring} material={m.gold} position={[0, c.big ? -1.9 : -1.3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={c.big ? 1.6 : 0.75} />
          {c.big && <mesh geometry={g.ring} material={m.gold} position={[0, -2.5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={1.1} />}
          <mesh geometry={g.cone} material={m.crystal} position={[0, c.big ? -2.9 : -1.75, 0]} rotation={[Math.PI, 0, 0]} scale={c.big ? [0.7, 1.4, 0.7] : [0.35, 0.7, 0.35]} />
          <mesh geometry={g.orb} material={m.crystal} position={[0, c.big ? -1.6 : -1.1, 0]} scale={c.big ? 0.35 : 0.18} />
        </group>
      ))}
      <Instanced geometry={g.flower} material={m.crystal} items={d.crystals} castShadow={false} receiveShadow={false} />

      <BallroomLights low={low} />
    </group>
  );
}

function Walls({ kit, W, D, cz, H }: { kit: VenueKit; W: number; D: number; cz: number; H: number }) {
  const { m, g } = kit;
  const sides: { x: number; z: number; w: number; d: number }[] = [
    { x: VENUE.minX - 0.2, z: cz, w: 0.4, d: D + 0.8 },
    { x: VENUE.maxX + 0.2, z: cz, w: 0.4, d: D + 0.8 },
    { x: 0, z: VENUE.minZ - 0.2, w: W + 0.8, d: 0.4 },
    { x: 0, z: VENUE.maxZ + 0.2, w: W + 0.8, d: 0.4 },
  ];
  return (
    <>
      {sides.map((s, i) => (
        <group key={i}>
          <mesh geometry={g.box} material={m.ivoryWall} position={[s.x, H / 2, s.z]} scale={[s.w, H, s.d]} receiveShadow />
          <mesh geometry={g.box} material={m.panel} position={[s.x, 0.6, s.z]} scale={[s.w + 0.08, 1.2, s.d + 0.08]} />
          <mesh geometry={g.box} material={m.gold} position={[s.x, 1.22, s.z]} scale={[s.w + 0.12, 0.06, s.d + 0.12]} />
          <mesh geometry={g.box} material={m.gold} position={[s.x, 3.15, s.z]} scale={[s.w + 0.1, 0.05, s.d + 0.1]} />
          <mesh geometry={g.box} material={m.gold} position={[s.x, H - 0.12, s.z]} scale={[s.w + 0.16, 0.18, s.d + 0.16]} />
        </group>
      ))}
      {/* Tall arched windows (night sky) with burgundy curtains, on both long walls. */}
      {[-1, 1].flatMap((s) =>
        WINDOW_Z.map((z) => (
          <group key={`${s}${z}`} position={[s * (VENUE.maxX - 0.02), 0, z]} rotation={[0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
            <mesh geometry={g.plane} material={m.nightGlass} position={[0, 4.45, 0]} scale={[1.3, 1.9, 1]} />
            <mesh geometry={g.halfDisc} material={m.nightGlass} position={[0, 5.4, 0]} scale={[0.65, 0.6, 1]} />
            <mesh geometry={g.halfRing} material={m.gold} position={[0, 5.4, 0.02]} scale={[0.7, 0.66, 1]} />
            {[-0.7, 0.7].map((x) => (
              <mesh key={x} geometry={g.box} material={m.gold} position={[x, 4.45, 0.02]} scale={[0.06, 1.9, 0.04]} />
            ))}
            <mesh geometry={g.box} material={m.gold} position={[0, 3.5, 0.03]} scale={[1.5, 0.06, 0.06]} />
          </group>
        )),
      )}
    </>
  );
}

function BallroomLights({ low }: { low: boolean }) {
  const spot = useMemo(() => {
    const s = new THREE.SpotLight("#ffe4b8", low ? 40 : 60, 22, 0.42, 0.55, 1.4);
    s.position.set(0, 6.6, -9);
    s.target.position.set(0, 0.5, -17.4);
    return s;
  }, [low]);
  useEffect(() => () => spot.dispose(), [spot]);
  return (
    <>
      <primitive object={spot} />
      <primitive object={spot.target} />
      <pointLight position={[0, 4.6, -2]} color="#ffd9a0" intensity={low ? 30 : 40} distance={22} decay={1.5} />
      {!low && (
        <>
          <pointLight position={[0, 4.8, 12]} color="#ffd9a0" intensity={26} distance={18} decay={1.6} />
          <pointLight position={[0, 4.5, -12]} color="#ffdcae" intensity={22} distance={16} decay={1.6} />
        </>
      )}
    </>
  );
}

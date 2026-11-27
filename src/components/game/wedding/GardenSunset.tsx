"use client";

import { Sky } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { InstanceTransform } from "@/lib/geometry";
import { createGrassTexture, createWoodTexture } from "@/lib/textures/proceduralTextures";
import type { InvitationView } from "@/stores/gameStore";
import { CHAIR_ROWS, GARDEN, LIGHT_POLES, rowChairXs, STAGE, THRONES, VENUE } from "@/systems/world/buildWedding";
import type { QualityLevel } from "@/types/game";
import { Instanced } from "../environment/Instanced";
import { ASSET, GlbInstances, GlbModel } from "../assets/glb";
import { rng, useDisposable, type VenueKit } from "./venueKit";
import { welcomeSignTexture } from "./weddingTextures";

const HEDGE_GREENS = ["#4f7d43", "#5b8a4c", "#47733d", "#66945a"];
const BLOOMS = ["#f3b6c0", "#ffffff", "#f7d9c4", "#e78a9a", "#fbe7a1"];

/**
 * Garden Sunset: a luxury garden wedding at golden hour — rolling flowering
 * hedges, trees, distant hills, a wooden pergola over the deck with flowing
 * fabric, natural wooden chairs, a fountain, benches and lanterns.
 */
export function GardenSunset({ kit, quality, invitation }: { kit: VenueKit; quality: QualityLevel; invitation: InvitationView }) {
  const { m, g } = kit;
  const low = quality === "low";
  const grass = useDisposable(() => {
    const t = createGrassTexture(low ? 256 : 512);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(40, 40);
    return t;
  }, [low]);
  const grassMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: grass, color: "#bcd39a", roughness: 1 }), [grass]);
  const deckTex = useDisposable(() => {
    const t = createWoodTexture(low ? 256 : 512);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    return t;
  }, [low]);
  const deckMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: deckTex, color: "#d7b48a", roughness: 0.75 }), [deckTex]);

  const d = useMemo(() => {
    const r = rng(1402);
    // Rolling hedges: overlapping bushes, flattened on the gallery sides so the frames stay in front.
    const bushes: InstanceTransform[] = [];
    const hedgeFlowers: InstanceTransform[] = [];
    const sideBush = (x: number, z: number) => {
      const h = 2.3 + r() * 0.8;
      bushes.push({ x, y: h * 0.45, z, sx: 0.6, sy: h * 0.62, sz: 1.0 + r() * 0.35, rotationY: r() * 0.4, color: HEDGE_GREENS[Math.floor(r() * 4)] });
    };
    for (let z = VENUE.minZ; z <= VENUE.maxZ; z += 1.15) for (const s of [-1, 1]) sideBush(s * (VENUE.maxX + 0.55), z);
    for (let x = VENUE.minX; x <= VENUE.maxX; x += 1.2) {
      for (const z of [VENUE.minZ - 0.6, VENUE.maxZ + 0.6]) {
        const h = 2.0 + r() * 1.1;
        bushes.push({ x, y: h * 0.42, z, sx: 1.0 + r() * 0.4, sy: h * 0.6, sz: 0.75, rotationY: r() * 3, color: HEDGE_GREENS[Math.floor(r() * 4)] });
      }
    }
    // Flower clusters dotted over the hedges, and beds along their foot.
    for (let i = 0; i < (low ? 120 : 320); i++) {
      const side = Math.floor(r() * 4);
      const t = r();
      const y = 0.4 + r() * 2.0;
      const [x, z] =
        side === 0 ? [-(VENUE.maxX + 0.12), VENUE.minZ + t * (VENUE.maxZ - VENUE.minZ)] : side === 1 ? [VENUE.maxX + 0.12, VENUE.minZ + t * (VENUE.maxZ - VENUE.minZ)] : side === 2 ? [VENUE.minX + t * 32, VENUE.minZ - 0.05] : [VENUE.minX + t * 32, VENUE.maxZ + 0.05];
      // Keep the frames on the sides clear of flowers.
      if ((side < 2 && y > 1.0 && y < 2.5) || y > 2.4) continue;
      const s = 0.5 + r() * 0.5;
      hedgeFlowers.push({ x, y, z, sx: s, sy: s, sz: s, color: BLOOMS[Math.floor(r() * BLOOMS.length)] });
    }
    for (let z = VENUE.minZ + 1; z < VENUE.maxZ - 1; z += 0.55) {
      for (const s of [-1, 1]) {
        const sc = 0.6 + r() * 0.5;
        hedgeFlowers.push({ x: s * (VENUE.maxX - 0.35 - r() * 0.3), y: 0.16, z: z + r() * 0.3, sx: sc, sy: sc, sz: sc, color: BLOOMS[Math.floor(r() * BLOOMS.length)] });
      }
    }

    // Trees inside the venue (with colliders) and a forest ring beyond the hedges.
    const trunks: InstanceTransform[] = [];
    const crowns: InstanceTransform[] = [];
    const tree = (x: number, z: number, s: number) => {
      trunks.push({ x, y: 1.6 * s, z, sx: 0.26 * s, sy: 3.2 * s, sz: 0.26 * s });
      const parts = [
        [0, 4.0, 0, 1.9],
        [0.9, 3.4, 0.4, 1.3],
        [-0.8, 3.5, -0.5, 1.4],
        [0.2, 5.0, -0.2, 1.3],
      ] as const;
      for (const [dx, dy, dz, cs] of parts) crowns.push({ x: x + dx * s, y: dy * s, z: z + dz * s, sx: cs * s, sy: cs * s * 0.85, sz: cs * s, rotationY: r() * 6, color: HEDGE_GREENS[Math.floor(r() * 4)] });
    };
    for (const t of GARDEN.trees) tree(t.x, t.z, t.s);
    for (let i = 0; i < (low ? 18 : 40); i++) {
      const a = r() * Math.PI * 2;
      const dist = 26 + r() * 22;
      tree(Math.cos(a) * dist, 3 + Math.sin(a) * dist * 1.15, 1.2 + r() * 1.1);
    }
    // Distant hills (fog softens them into the sunset haze).
    const hills: InstanceTransform[] = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + r() * 0.2;
      const dist = 85 + r() * 45;
      const s = 16 + r() * 22;
      hills.push({ x: Math.cos(a) * dist, y: -s * 0.25, z: Math.sin(a) * dist, sx: s * 1.6, sy: s * 0.7, sz: s, rotationY: r() * 6, color: r() > 0.5 ? "#6f8f62" : "#8a9e78" });
    }

    // Natural wooden chairs in rows (seat, legs, back posts, slats, top rail).
    const seats: InstanceTransform[] = [];
    const legs: InstanceTransform[] = [];
    const backs: InstanceTransform[] = [];
    const rails: InstanceTransform[] = [];
    for (const z of CHAIR_ROWS) {
      for (const s of [-1, 1]) {
        for (const x of rowChairXs()) {
          const cx = s * x;
          seats.push({ x: cx, y: 0.45, z, sx: 0.44, sy: 0.05, sz: 0.42 });
          for (const [lx, lz] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]] as const) legs.push({ x: cx + lx, y: 0.22, z: z + lz, sx: 0.025, sy: 0.44, sz: 0.025 });
          for (const bx of [-0.19, 0.19]) backs.push({ x: cx + bx, y: 0.72, z: z + 0.19, sx: 0.035, sy: 0.55, sz: 0.035 });
          for (const bx of [-0.08, 0, 0.08]) backs.push({ x: cx + bx, y: 0.7, z: z + 0.19, sx: 0.025, sy: 0.4, sz: 0.02 });
          rails.push({ x: cx, y: 0.97, z: z + 0.19, sx: 0.44, sy: 0.06, sz: 0.04 });
        }
      }
    }

    // Pergola rafters, drapes and hanging flowers.
    const rafters: InstanceTransform[] = [];
    const top = GARDEN.pergolaHeight;
    for (let x = -4.6; x <= 4.61; x += 0.55) rafters.push({ x, y: top + 0.16, z: -17.1, sx: 0.07, sy: 0.1, sz: 5.0 });
    const pergolaFlowers: InstanceTransform[] = [];
    for (const p of GARDEN.pergolaPosts) {
      for (let i = 0; i < 16; i++) {
        const sc = 0.8 + r() * 0.7;
        pergolaFlowers.push({ x: p.x + (r() - 0.5) * 0.7, y: top - 0.1 - r() * 1.3 * (i / 16), z: p.z + (r() - 0.5) * 0.6, sx: sc, sy: sc, sz: sc, color: BLOOMS[Math.floor(r() * 3)] });
      }
    }
    for (let i = 0; i < 40; i++) {
      const sc = 0.9 + r() * 0.8;
      pergolaFlowers.push({ x: -4.3 + r() * 8.6, y: top + 0.05 + r() * 0.2, z: -15.1 + (r() - 0.5) * 0.35, sx: sc, sy: sc, sz: sc, color: BLOOMS[Math.floor(r() * 3)] });
    }
    // A round floral arch on the deck, behind the thrones (the altar's focal point).
    const ringY = STAGE.height + 2.05;
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      const heavy = Math.sin(a) < -0.2 || Math.cos(a) > 0.75;
      if (!heavy && i % 3 !== 0) continue;
      const sc = (heavy ? 1.1 : 0.8) + r() * 0.6;
      pergolaFlowers.push({ x: Math.cos(a) * 1.75, y: ringY + Math.sin(a) * 1.75, z: -18.85 + (r() - 0.5) * 0.2, sx: sc, sy: sc, sz: sc, color: BLOOMS[Math.floor(r() * BLOOMS.length)] });
    }
    // Pleated white drapes tied at the front posts.
    const pleats: InstanceTransform[] = [];
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) pleats.push({ x: s * (4.3 - 0.22 - k * 0.09), y: (top + STAGE.height) / 2, z: -14.92 + (k % 2) * 0.05, sx: 0.06, sy: top - STAGE.height - 0.2, sz: 0.06 });

    // String lights between the poles, and along the pergola beams.
    const bulbs: InstanceTransform[] = [];
    const zs = [...new Set(LIGHT_POLES.map((p) => p.z))];
    for (const z of zs) for (let i = 0; i <= 24; i++) bulbs.push({ x: -8.5 + (17 * i) / 24, y: 3.45 - Math.sin((i / 24) * Math.PI) * 0.7, z });
    for (let i = 0; i < zs.length - 1; i++) for (const x of [-8.5, 8.5]) for (let k = 1; k < 10; k++) bulbs.push({ x, y: 3.45 - Math.sin((k / 10) * Math.PI) * 0.4, z: zs[i]! + ((zs[i + 1]! - zs[i]!) * k) / 10 });
    for (let i = 0; i <= 20; i++) bulbs.push({ x: -4.3 + (8.6 * i) / 20, y: top - 0.12 - Math.sin((i / 20) * Math.PI) * 0.35, z: -14.95 });

    // Stone pavers on the entrance plaza and around the fountain.
    const pavers: InstanceTransform[] = [];
    for (let z = 18.6; z <= 26.4; z += 0.9) for (let x = -3.4; x <= 3.4; x += 0.9) if (Math.abs(x) > 1.25 || z > 18.6) pavers.push({ x: x + (r() - 0.5) * 0.12, y: 0.02, z: z + (r() - 0.5) * 0.12, sx: 0.4, sy: 0.04, sz: 0.4, rotationY: r() * 1.2, color: r() > 0.5 ? "#d8cfbf" : "#c8bda9" });
    const f = GARDEN.fountain;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      pavers.push({ x: f.x + Math.cos(a) * (f.radius + 0.45), y: 0.02, z: f.z + Math.sin(a) * (f.radius + 0.45), sx: 0.36, sy: 0.04, sz: 0.36, rotationY: a, color: "#d2c8b6" });
    }
    return { bushes, hedgeFlowers, trunks, crowns, hills, seats, legs, backs, rails, rafters, pergolaFlowers, pleats, bulbs, pavers };
  }, [low]);

  const f = GARDEN.fountain;
  const glb = useMemo(() => {
    const r = rng(9);
    // Guest chairs face the pelaminan (-z).
    const chairs: InstanceTransform[] = [];
    for (const z of CHAIR_ROWS) for (const sgn of [-1, 1]) for (const x of rowChairXs()) chairs.push({ x: sgn * x, y: 0, z, rotationY: Math.PI });
    // Flowering hedge modules (2,2 m) around the venue; the sides face inwards.
    const hedges: InstanceTransform[] = [];
    for (let z = VENUE.minZ + 1.1; z < VENUE.maxZ; z += 2.15) {
      hedges.push({ x: VENUE.minX - 0.55, y: 0, z, rotationY: Math.PI / 2 });
      hedges.push({ x: VENUE.maxX + 0.55, y: 0, z, rotationY: -Math.PI / 2 });
    }
    for (let x = VENUE.minX + 1.1; x < VENUE.maxX; x += 2.15) {
      hedges.push({ x, y: 0, z: VENUE.minZ - 0.55, rotationY: 0 });
      if (Math.abs(x) > 2.5) hedges.push({ x, y: 0, z: VENUE.maxZ + 0.55, rotationY: Math.PI });
    }
    // Trees: the four inside the hedges plus a ring of woodland beyond them.
    const trees: InstanceTransform[][] = [[], [], []];
    GARDEN.trees.forEach((t, i) => trees[i % 3]!.push({ x: t.x, y: 0, z: t.z, rotationY: i * 1.7, sx: t.s * 0.9, sy: t.s * 0.9, sz: t.s * 0.9 }));
    for (let i = 0; i < (low ? 14 : 30); i++) {
      const a = r() * Math.PI * 2;
      const dist = 26 + r() * 24;
      const sc = 1 + r() * 0.6;
      trees[i % 3]!.push({ x: Math.cos(a) * dist, y: 0, z: 3 + Math.sin(a) * dist * 1.15, rotationY: r() * 6, sx: sc, sy: sc, sz: sc });
    }
    // Stone path from the entrance to the flower arch (2 m tiles).
    const path: InstanceTransform[] = [];
    for (let z = 18.5; z <= 26.5; z += 2) for (const x of [-1, 1]) path.push({ x, y: 0.005, z });
    // String lights: rows across the aisle, and runs between the rows along both sides.
    const rows = [...new Set(LIGHT_POLES.map((p) => p.z))];
    const lightsAcross = rows.map((z) => ({ x: 0, y: 3.45, z }));
    const lightsAlong: InstanceTransform[] = [];
    for (let i = 0; i < rows.length - 1; i++) for (const x of [-8.5, 8.5]) lightsAlong.push({ x, y: 3.45, z: (rows[i]! + rows[i + 1]!) / 2, rotationY: Math.PI / 2, sx: (rows[i + 1]! - rows[i]!) / 17, sy: 1, sz: 1 });
    return {
      chairs,
      hedges,
      trees,
      path,
      lightsAcross,
      lightsAlong,
      lamps: LIGHT_POLES.map((p) => ({ x: p.x, y: 0, z: p.z })),
      lanterns: GARDEN.lanterns.map((l) => ({ x: l.x, y: 0, z: l.z })),
      thrones: THRONES.map((t) => ({ x: t.x, y: STAGE.height, z: t.z })),
      benches: GARDEN.benches.map((b, i) => ({ x: b.x, y: 0, z: b.z, rotationY: i === 0 ? 0 : Math.PI })),
    };
  }, [low]);

  return (
    <group name="garden-sunset">
      {/* A low sun over the hills: orange and pink, like golden hour. */}
      <Sky distance={4500} sunPosition={[-40, 2.2, -100]} turbidity={10} rayleigh={3.6} mieCoefficient={0.012} mieDirectionalG={0.92} />
      <mesh geometry={g.plane} material={grassMat} rotation={[-Math.PI / 2, 0, 0]} scale={[260, 260, 1]} receiveShadow />
      <Instanced geometry={g.crown} material={m.white} items={d.hills} castShadow={false} receiveShadow={false} />
      <GlbModel url={ASSET.garden("mountains-backdrop")} position={[0, -2, -210]} />

      {/* Flowering hedges, flower beds at their foot, and trees. */}
      <GlbInstances url={ASSET.garden("hedge-flower")} items={glb.hedges} castShadow={false} />
      <Instanced geometry={g.flower} material={m.white} items={d.hedgeFlowers} castShadow={false} />
      <GlbInstances url={ASSET.garden("tree-large")} items={glb.trees[0]!} />
      <GlbInstances url={ASSET.garden("tree-large-2")} items={glb.trees[1]!} />
      <GlbInstances url={ASSET.garden("tree-large-3")} items={glb.trees[2]!} />

      {/* The pelaminan: wooden deck under the pergola, with the couple's chairs. */}
      <GlbModel url={ASSET.garden("wedding-deck")} position={[0, 0, (STAGE.minZ + STAGE.maxZ) / 2]} />
      <GlbModel url={ASSET.garden("pergola")} position={[0, STAGE.height, -17.1]} />
      <GlbInstances url={ASSET.garden("throne-wood")} items={glb.thrones} />

      {/* Guests' chairs, string lights on garden lamp posts, lanterns along the aisle. */}
      <GlbInstances url={ASSET.garden("chair-wood")} items={glb.chairs} castShadow={!low} />
      <GlbInstances url={ASSET.garden("lamp-post")} items={glb.lamps} />
      <GlbInstances url={ASSET.garden("string-lights")} items={glb.lightsAcross} castShadow={false} />
      <GlbInstances url={ASSET.garden("string-lights")} items={glb.lightsAlong} castShadow={false} />
      <GlbInstances url={ASSET.garden("lantern-ground")} items={glb.lanterns} castShadow={false} />

      <WelcomeSign groom={invitation.groomName} bride={invitation.brideName} />

      {/* Entrance: stone path, fountain, benches. */}
      <GlbInstances url={ASSET.garden("stone-path")} items={glb.path} castShadow={false} />
      <GlbModel url={ASSET.garden("fountain")} position={[f.x, 0, f.z]} />
      <GlbInstances url={ASSET.garden("bench-garden")} items={glb.benches} />

      {!low && <Fireflies kit={kit} />}
      <GardenLights low={low} />
    </group>
  );
}

/** The "Welcome to our Wedding" easel, its blank board painted with the couple's names. */
function WelcomeSign({ groom, bride }: { groom: string; bride: string }) {
  const tex = useDisposable(() => welcomeSignTexture(groom, bride), [groom, bride]);
  const mat = useDisposable(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), [tex]);
  const w = GARDEN.welcomeSign;
  return (
    <GlbModel
      url={ASSET.garden("welcome-sign")}
      position={[w.x, 0, w.z]}
      rotationY={0.35}
      onReady={(root) =>
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh && (mesh.name === "content_area" || mesh.parent?.name === "content_area")) mesh.material = mat;
        })
      }
    />
  );
}

/** Fireflies and drifting petals: one instanced mesh each, updated every frame. */
function Fireflies({ kit }: { kit: VenueKit }) {
  const flies = useRef<THREE.InstancedMesh>(null);
  const petals = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 48 }, () => ({ x: (r() - 0.5) * 28, z: -18 + r() * 42, y: 0.6 + r() * 2.4, p: r() * 10, s: 0.4 + r() * 0.6 }));
  }, []);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const fm = flies.current;
    const pm = petals.current;
    seeds.forEach((sd, i) => {
      if (fm && i < 32) {
        o.position.set(sd.x + Math.sin(t * 0.4 + sd.p) * 0.8, sd.y + Math.sin(t * 0.9 + sd.p * 2) * 0.3, sd.z + Math.cos(t * 0.35 + sd.p) * 0.8);
        const glow = 0.5 + 0.5 * Math.sin(t * 2.2 + sd.p * 3);
        o.scale.setScalar(0.03 + glow * 0.03);
        o.rotation.set(0, 0, 0);
        o.updateMatrix();
        fm.setMatrixAt(i, o.matrix);
      }
      if (pm) {
        const fall = (t * 0.25 * sd.s + sd.p) % 4;
        o.position.set(sd.x * 0.6 + Math.sin(t * 0.6 + sd.p) * 0.6, 4.2 - fall, sd.z * 0.6 + Math.cos(t * 0.5 + sd.p) * 0.4);
        o.rotation.set(t + sd.p, t * 0.7, 0);
        o.scale.setScalar(1.4);
        o.updateMatrix();
        pm.setMatrixAt(i, o.matrix);
      }
    });
    if (fm) fm.instanceMatrix.needsUpdate = true;
    if (pm) pm.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={flies} args={[kit.g.orb, kit.m.firefly, 32]} frustumCulled={false} />
      <instancedMesh ref={petals} args={[kit.g.petal, kit.m.blush, seeds.length]} frustumCulled={false} />
    </>
  );
}

function GardenLights({ low }: { low: boolean }) {
  if (low) return <pointLight position={[0, 3.4, -17]} color="#ffd6a0" intensity={22} distance={14} decay={1.6} />;
  return (
    <>
      <pointLight position={[0, 3.3, -16.8]} color="#ffd6a0" intensity={26} distance={13} decay={1.5} />
      <pointLight position={[0, 3.2, -4]} color="#ffd59a" intensity={12} distance={16} decay={1.6} />
      <pointLight position={[0, 3.2, 10]} color="#ffd59a" intensity={12} distance={16} decay={1.6} />
      <pointLight position={[-10.2, 2.2, 23.6]} color="#ffe2b0" intensity={8} distance={9} decay={1.6} />
    </>
  );
}

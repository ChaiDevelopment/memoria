"use client";

import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { InstanceTransform } from "@/lib/geometry";
import { useGameStore, type InvitationView } from "@/stores/gameStore";
import { AISLE_FLOWERS, ARCH, ENVELOPE_BOX, INFO_BOARD, WISHES_WALL, type WeddingWorld } from "@/systems/world/buildWedding";
import type { QualityLevel } from "@/types/game";
import { CollisionWorld } from "../CollisionWorld";
import { Instanced } from "../environment/Instanced";
import { Photographs } from "../environment/Photographs";
import { ASSET, GlbInstances, GlbModel } from "../assets/glb";
import { GardenSunset } from "./GardenSunset";
import { GrandBallroom } from "./GrandBallroom";
import { rng, useDisposable, useVenueKit, type VenueKit } from "./venueKit";
import { coupleSignTexture, envelopeLabelTexture, infoBoardTexture, wishesWallTexture } from "./weddingTextures";

/**
 * The wedding venue. Two genuinely different places share only the
 * gameplay pieces (aisle, flower arch, photo gallery, info board, envelope
 * and wishes wall): Garden Sunset outdoors, the Grand Ballroom indoors.
 */
export function WeddingVenue({ world, invitation, quality }: { world: WeddingWorld; invitation: InvitationView; quality: QualityLevel }) {
  const kit = useVenueKit();
  const outdoor = world.setting === "outdoor";
  return (
    <group name="wedding-venue">
      {outdoor ? <GardenSunset kit={kit} quality={quality} invitation={invitation} /> : <GrandBallroom kit={kit} quality={quality} invitation={invitation} />}
      <SharedPieces kit={kit} invitation={invitation} outdoor={outdoor} quality={quality} />
      <Photographs placements={world.placements} atlasCell={quality === "low" ? 256 : 384} />
      <CollisionWorld world={world} />
    </group>
  );
}

const FLOWER_COLORS = ["#fbf4e6", "#efb8b8", "#d9707e", "#f7d9c4", "#ffffff"];

/** Aisle runner, flower arch with the couple's sign, aisle flowers, info board, envelope and wishes wall. */
function SharedPieces({ kit, invitation, outdoor, quality }: { kit: VenueKit; invitation: InvitationView; outdoor: boolean; quality: QualityLevel }) {
  const { m, g } = kit;
  const wishes = useGameStore((s) => s.guestbook);
  const signTex = useDisposable(() => coupleSignTexture(invitation.groomName, invitation.brideName), [invitation.groomName, invitation.brideName]);
  const boardTex = useDisposable(() => infoBoardTexture(invitation.groomName, invitation.brideName, invitation.events), [invitation]);
  const wishesTex = useDisposable(() => wishesWallTexture(wishes), [wishes]);
  const envelopeTex = useDisposable(() => envelopeLabelTexture(), []);
  const signMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 }), [signTex]);
  const boardMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.85 }), [boardTex]);
  const wishesMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: wishesTex, roughness: 0.9 }), [wishesTex]);
  const envelopeMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: envelopeTex, roughness: 0.8 }), [envelopeTex]);

  const decor = useMemo(() => {
    const r = rng(outdoor ? 2026 : 1127);
    const flowers: InstanceTransform[] = [];
    const leaves: InstanceTransform[] = [];
    const bloom = (x: number, y: number, z: number, s = 1) => flowers.push({ x, y, z, sx: s, sy: s, sz: s, rotationY: r() * 6, color: FLOWER_COLORS[Math.floor(r() * FLOWER_COLORS.length)] });
    // The arch: a dense band of roses with greenery, heavier at the base.
    for (let i = 0; i <= 34; i++) {
      const a = (i / 34) * Math.PI;
      const x = Math.cos(a) * ARCH.halfWidth;
      const y = ARCH.height - 1.2 + Math.sin(a) * 1.2;
      bloom(x + (r() - 0.5) * 0.12, y + (r() - 0.5) * 0.12, ARCH.z + (r() - 0.5) * 0.22, 0.8 + r() * 0.7);
      if (i % 2 === 0) leaves.push({ x: x * 1.05, y: y + 0.1, z: ARCH.z - 0.14, sx: 0.28, sy: 0.14, sz: 0.24, rotationY: r() * 6 });
    }
    for (const s of [-1, 1]) for (let i = 0; i < 16; i++) bloom(s * ARCH.halfWidth + (r() - 0.5) * 0.3, 0.25 + i * 0.15, ARCH.z + (r() - 0.5) * 0.35, 0.7 + r() * 0.5);
    // Aisle stands: a round bouquet on each.
    for (const f of AISLE_FLOWERS) {
      for (let i = 0; i < 9; i++) bloom(f.x + (r() - 0.5) * 0.34, 1.12 + r() * 0.3, f.z + (r() - 0.5) * 0.34, 0.7 + r() * 0.5);
      leaves.push({ x: f.x, y: 1.05, z: f.z, sx: 0.32, sy: 0.12, sz: 0.32 });
    }
    // Rose petals on the runner.
    const petals: InstanceTransform[] = [];
    for (let i = 0; i < (quality === "low" ? 90 : 240); i++) petals.push({ x: (r() - 0.5) * 2.1, y: 0.03, z: -13.5 + r() * 31, rotationY: r() * Math.PI, color: r() > 0.55 ? "#f3c2c6" : outdoor ? "#fbf1ea" : "#e9a0a8" });
    return { flowers, leaves, petals };
  }, [outdoor, quality]);

  // The ballroom's runner uses the pack's red carpet with gold borders.
  const carpetTex = useTexture("/assets/textures/red-carpet.png");
  const carpetMat = useDisposable(() => {
    const t = carpetTex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 15);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  }, [carpetTex]);
  const runner = outdoor ? m.cream : carpetMat;
  return (
    <group name="wedding-shared">
      {/* Aisle runner: cream linen in the garden, burgundy velvet in the ballroom. */}
      <mesh geometry={g.plane} material={runner} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 2]} scale={[2.2, 33, 1]} receiveShadow />
      {outdoor && [-1.12, 1.12].map((x) => (
        <mesh key={x} geometry={g.plane} material={m.gold} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.016, 2]} scale={[0.06, 33, 1]} />
      ))}
      <Instanced geometry={g.petal} material={m.petal} items={decor.petals} castShadow={false} />

      {/* Flower arch with the couple's sign (the garden uses the modelled arch). */}
      {outdoor && <GlbModel url={ASSET.shared("flower-arch")} position={[0, 0, ARCH.z]} />}
      <GlbInstances url={outdoor ? ASSET.shared("flower-stand") : ASSET.ballroom("flower-pedestal")} items={AISLE_FLOWERS.map((f) => ({ x: f.x, y: 0, z: f.z }))} />
      {false && [-1, 1].map((s) => (
        <mesh key={s} geometry={g.cylinder} material={outdoor ? m.woodLight : m.gold} position={[s * ARCH.halfWidth, (ARCH.height - 1.2) / 2, ARCH.z]} scale={[0.1, ARCH.height - 1.2, 0.1]} castShadow />
      ))}
      {outdoor && (
        <>
          <mesh geometry={g.plane} material={signMat} position={[0, ARCH.height - 1.55, ARCH.z + 0.02]} scale={[2.6, 0.65, 1]} />
          <mesh geometry={g.plane} material={signMat} position={[0, ARCH.height - 1.55, ARCH.z - 0.02]} rotation={[0, Math.PI, 0]} scale={[2.6, 0.65, 1]} />
          {[-1, 1].map((s) => (
            <mesh key={`r${s}`} geometry={g.box} material={m.gold} position={[s * 1.1, ARCH.height - 1.05, ARCH.z]} scale={[0.015, 0.5, 0.015]} />
          ))}
        </>
      )}

      {false && AISLE_FLOWERS.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <mesh geometry={g.cylinder} material={m.gold} position={[0, 0.5, 0]} scale={[0.045, 1.0, 0.045]} castShadow />
          <mesh geometry={g.cylinder} material={m.gold} position={[0, 0.03, 0]} scale={[0.2, 0.06, 0.2]} />
          <mesh geometry={g.cone} material={m.gold} position={[0, 1.02, 0]} rotation={[Math.PI, 0, 0]} scale={[0.2, 0.16, 0.2]} />
        </group>
      ))}
      {/* (The arch and aisle flowers are modelled assets now in both venues.) */}

      {/* Info board (entrance, left). */}
      <group position={[INFO_BOARD.x, 0, INFO_BOARD.z]} rotation={[0, Math.PI / 2, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={g.box} material={outdoor ? m.wood : m.gold} position={[s * 0.6, 0.95, -0.06]} scale={[0.06, 1.9, 0.06]} castShadow />
        ))}
        <mesh geometry={g.box} material={outdoor ? m.woodLight : m.gold} position={[0, 1.4, -0.06]} scale={[INFO_BOARD.width - 0.1, 2.0, 0.06]} castShadow />
        <mesh geometry={g.plane} material={boardMat} position={[0, 1.4, -0.025]} scale={[INFO_BOARD.width - 0.3, 1.82, 1]} />
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} geometry={g.flower} material={i % 2 ? m.blush : m.satin} position={[-0.55 + i * 0.18, 2.42 + (i % 2) * 0.05, -0.02]} scale={0.9} />
        ))}
      </group>

      {/* Digital envelope box (entrance, right). */}
      <group position={[ENVELOPE_BOX.x, 0, ENVELOPE_BOX.z]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh geometry={g.tableTop} material={outdoor ? m.wood : m.tablecloth} position={[0, 0.4, 0]} scale={[0.5, 0.8, 0.5]} castShadow />
        <mesh geometry={g.box} material={m.satin} position={[0, 0.98, 0]} scale={[0.6, 0.36, 0.5]} castShadow />
        <mesh geometry={g.box} material={m.gold} position={[0, 0.98, 0]} scale={[0.62, 0.06, 0.52]} />
        <mesh geometry={g.box} material={m.gold} position={[0, 0.98, 0]} scale={[0.06, 0.38, 0.52]} />
        <mesh geometry={g.box} material={m.wire} position={[0, 1.165, 0]} scale={[0.34, 0.01, 0.05]} />
        <mesh geometry={g.plane} material={envelopeMat} position={[0, 1.55, 0.02]} scale={[0.9, 0.35, 1]} />
        <mesh geometry={g.box} material={m.gold} position={[0, 1.3, 0]} scale={[0.02, 0.3, 0.02]} />
      </group>

      {/* Wishes wall ("Ucapan & Doa"). */}
      <group position={[WISHES_WALL.x, 0, WISHES_WALL.z]}>
        <mesh geometry={g.box} material={outdoor ? m.woodLight : m.gold} position={[0, WISHES_WALL.height / 2 + 0.35, -0.12]} scale={[WISHES_WALL.width + 0.14, WISHES_WALL.height + 0.14, 0.12]} castShadow />
        <mesh geometry={g.plane} material={wishesMat} position={[0, WISHES_WALL.height / 2 + 0.35, -0.055]} scale={[WISHES_WALL.width, WISHES_WALL.height, 1]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={g.box} material={outdoor ? m.wood : m.gold} position={[s * (WISHES_WALL.width / 2 - 0.1), 0.2, -0.12]} scale={[0.08, 0.4, 0.08]} />
        ))}
      </group>
    </group>
  );
}

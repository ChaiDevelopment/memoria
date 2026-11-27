"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import * as THREE from "three";
import { JOINTS, readHipsOffset, readJoint, type JointName, type Pose } from "@/systems/animation/characterAnimator";
import type { CharacterModelHandle } from "./types";

/**
 * Stylised low-poly explorer built from primitives on a real joint
 * hierarchy (hips → spine → chest → head/arms, hips → thighs → shins → feet).
 * It is a temporary character: any model implementing CharacterModelHandle
 * (e.g. a rigged GLB) can replace it without touching movement code.
 */

const HIPS_HEIGHT = 0.92;

const PALETTE = {
  skin: "#eab995",
  hair: "#4a3226",
  sweater: "#d9a441",
  sweaterDark: "#c08d33",
  pants: "#3b4a6b",
  shoes: "#5a3a28",
  scarf: "#b5523b",
  bag: "#8a5a3a",
  eye: "#2a1d17",
  blush: "#e89a86",
};

/** "explorer": the everyday outfit. "suit" / "gown": the groom's and bride's wedding outfits. */
export type Outfit = "explorer" | "suit" | "gown";

function useCharacterAssets(sweater: string) {
  const assets = useMemo(() => {
    const mat = (color: string, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
    const materials = {
      jacket: mat("#22242f", 0.55),
      shirt: mat("#f7f4ee", 0.7),
      bow: mat("#151515", 0.5),
      flower: mat("#f3e7d3", 0.6),
      leaf: mat("#5f8a4e", 0.8),
      dress: mat("#fbf7f1", 0.55),
      dressShade: mat("#efe6d8", 0.6),
      gold: new THREE.MeshStandardMaterial({ color: "#d9b77e", roughness: 0.35, metalness: 0.7, flatShading: true }),
      veil: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
      rose: mat("#d9707e", 0.7),
      blackShoe: mat("#141414", 0.35),
      skin: mat(PALETTE.skin, 0.7),
      hair: mat(PALETTE.hair, 0.9),
      sweater: mat(sweater),
      // Shoulders/cuffs: a slightly darker shade of the sweater.
      sweaterDark: mat(sweater === PALETTE.sweater ? PALETTE.sweaterDark : `#${new THREE.Color(sweater).multiplyScalar(0.86).getHexString()}`),
      pants: mat(PALETTE.pants),
      shoes: mat(PALETTE.shoes, 0.6),
      scarf: mat(PALETTE.scarf),
      bag: mat(PALETTE.bag, 0.6),
      eye: mat(PALETTE.eye, 0.3),
      blush: mat(PALETTE.blush, 0.9),
    };
    const geometries = {
      pelvis: new THREE.CylinderGeometry(0.155, 0.165, 0.2, 7),
      waist: new THREE.CylinderGeometry(0.17, 0.155, 0.26, 7),
      chest: new THREE.CylinderGeometry(0.2, 0.17, 0.3, 7),
      shoulder: new THREE.IcosahedronGeometry(0.075, 0),
      neck: new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6),
      head: new THREE.IcosahedronGeometry(0.145, 1),
      hairCap: new THREE.SphereGeometry(0.158, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairBack: new THREE.BoxGeometry(0.26, 0.16, 0.1),
      eye: new THREE.SphereGeometry(0.019, 6, 4),
      nose: new THREE.ConeGeometry(0.02, 0.05, 4),
      blush: new THREE.CircleGeometry(0.022, 6),
      upperArm: new THREE.CapsuleGeometry(0.056, 0.18, 2, 6),
      forearm: new THREE.CapsuleGeometry(0.048, 0.16, 2, 6),
      cuff: new THREE.CylinderGeometry(0.054, 0.054, 0.04, 6),
      hand: new THREE.IcosahedronGeometry(0.052, 0),
      thigh: new THREE.CapsuleGeometry(0.078, 0.27, 2, 6),
      shin: new THREE.CapsuleGeometry(0.062, 0.29, 2, 6),
      shoe: new THREE.BoxGeometry(0.12, 0.085, 0.25),
      scarf: new THREE.TorusGeometry(0.105, 0.045, 5, 9),
      scarfTail: new THREE.BoxGeometry(0.07, 0.2, 0.03),
      strap: new THREE.BoxGeometry(0.035, 0.62, 0.02),
      bag: new THREE.BoxGeometry(0.2, 0.16, 0.08),
      // Wedding outfits.
      shirtFront: new THREE.BoxGeometry(0.12, 0.26, 0.02),
      lapel: new THREE.BoxGeometry(0.045, 0.24, 0.02),
      bowWing: new THREE.ConeGeometry(0.035, 0.06, 4),
      boutonniere: new THREE.IcosahedronGeometry(0.026, 0),
      jacketTail: new THREE.CylinderGeometry(0.175, 0.19, 0.16, 7),
      skirt: new THREE.CylinderGeometry(0.17, 0.6, 0.92, 12, 1, true),
      skirtHem: new THREE.TorusGeometry(0.6, 0.025, 4, 16),
      bodiceTrim: new THREE.TorusGeometry(0.17, 0.018, 4, 12),
      tiara: new THREE.TorusGeometry(0.11, 0.012, 4, 12, Math.PI),
      veil: new THREE.ConeGeometry(0.24, 0.95, 10, 1, true),
      longHair: new THREE.BoxGeometry(0.25, 0.34, 0.09),
      bouquet: new THREE.IcosahedronGeometry(0.075, 0),
      stem: new THREE.CylinderGeometry(0.018, 0.012, 0.12, 5),
    };
    return { materials, geometries };
  }, [sweater]);
  useEffect(
    () => () => {
      Object.values(assets.materials).forEach((m) => m.dispose());
      Object.values(assets.geometries).forEach((g) => g.dispose());
    },
    [assets],
  );
  return assets;
}

export function ProceduralCharacter({ ref, sweater = PALETTE.sweater, outfit = "explorer" }: { ref?: Ref<CharacterModelHandle>; sweater?: string; outfit?: Outfit }) {
  const { materials: m, geometries: g } = useCharacterAssets(sweater);
  const joints = useRef<Partial<Record<JointName, THREE.Group>>>({});
  const suit = outfit === "suit";
  const gown = outfit === "gown";
  const explorer = outfit === "explorer";
  // Torso / sleeves / legs per outfit.
  const top = suit ? m.jacket : gown ? m.dress : m.sweater;
  const topDark = suit ? m.jacket : gown ? m.dressShade : m.sweaterDark;
  const sleeve = suit ? m.jacket : gown ? m.skin : m.sweater;
  const legs = suit ? m.jacket : gown ? m.dress : m.pants;
  const shoes = suit ? m.blackShoe : gown ? m.dress : m.shoes;
  const bind = (name: JointName) => (el: THREE.Group | null) => {
    if (el) joints.current[name] = el;
  };

  useImperativeHandle(
    ref,
    () => ({
      applyPose(pose: Pose) {
        for (const name of JOINTS) {
          const j = joints.current[name];
          if (!j) continue;
          const [x, y, z] = readJoint(pose, name);
          j.rotation.set(x, y, z);
        }
        const hips = joints.current.hips;
        if (hips) hips.position.y = HIPS_HEIGHT + readHipsOffset(pose);
      },
    }),
    [],
  );

  return (
    <group name="procedural-character">
      <group ref={bind("hips")} position={[0, HIPS_HEIGHT, 0]}>
        <mesh geometry={g.pelvis} material={legs} position={[0, 0.02, 0]} castShadow />
        {/* Satchel hanging at the left hip */}
        {explorer && <mesh geometry={g.bag} material={m.bag} position={[0.2, -0.06, 0.02]} rotation={[0, Math.PI / 2, 0]} castShadow />}
        {suit && <mesh geometry={g.jacketTail} material={m.jacket} position={[0, -0.02, 0]} castShadow />}
        {gown && (
          <>
            {/* A full skirt from the waist to the floor (the legs walk inside it). */}
            <mesh geometry={g.skirt} material={m.dress} position={[0, -0.4, 0]} castShadow />
            <mesh geometry={g.skirtHem} material={m.dressShade} position={[0, -0.85, 0]} rotation={[Math.PI / 2, 0, 0]} />
          </>
        )}

        <group ref={bind("spine")} position={[0, 0.08, 0]}>
          <mesh geometry={g.waist} material={top} position={[0, 0.12, 0]} castShadow />
          {gown && <mesh geometry={g.bodiceTrim} material={m.gold} position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} />}
          <group ref={bind("chest")} position={[0, 0.22, 0]}>
            <mesh geometry={g.chest} material={top} position={[0, 0.13, 0]} castShadow />
            {explorer && (
              <>
                <mesh geometry={g.strap} material={m.bag} position={[0.02, 0.06, 0.168]} rotation={[0.12, 0, -0.62]} />
                <mesh geometry={g.strap} material={m.bag} position={[0.02, 0.06, -0.168]} rotation={[-0.12, 0, -0.62]} />
                <mesh geometry={g.scarf} material={m.scarf} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
                <mesh geometry={g.scarfTail} material={m.scarf} position={[-0.07, 0.2, 0.15]} rotation={[0.15, 0, 0.12]} />
              </>
            )}
            {suit && (
              <>
                {/* White shirt front, satin lapels, a bow tie and a boutonniere. */}
                <mesh geometry={g.shirtFront} material={m.shirt} position={[0, 0.16, 0.19]} rotation={[-0.12, 0, 0]} />
                <mesh geometry={g.lapel} material={m.bow} position={[0.065, 0.16, 0.192]} rotation={[-0.12, 0, -0.28]} />
                <mesh geometry={g.lapel} material={m.bow} position={[-0.065, 0.16, 0.192]} rotation={[-0.12, 0, 0.28]} />
                <mesh geometry={g.bowWing} material={m.bow} position={[0.03, 0.285, 0.18]} rotation={[0, 0, Math.PI / 2]} />
                <mesh geometry={g.bowWing} material={m.bow} position={[-0.03, 0.285, 0.18]} rotation={[0, 0, -Math.PI / 2]} />
                <mesh geometry={g.boutonniere} material={m.flower} position={[0.12, 0.2, 0.17]} />
                <mesh geometry={g.boutonniere} material={m.leaf} position={[0.135, 0.17, 0.165]} scale={0.6} />
              </>
            )}
            <mesh geometry={g.shoulder} material={topDark} position={[0.19, 0.24, 0]} />
            <mesh geometry={g.shoulder} material={topDark} position={[-0.19, 0.24, 0]} />

            <group ref={bind("head")} position={[0, 0.32, 0]}>
              <mesh geometry={g.neck} material={m.skin} position={[0, 0.03, 0]} />
              <mesh geometry={g.head} material={m.skin} position={[0, 0.17, 0.01]} scale={[1, 1.06, 0.98]} castShadow />
              <mesh geometry={g.hairCap} material={m.hair} position={[0, 0.19, -0.01]} rotation={[-0.28, 0, 0]} castShadow />
              <mesh geometry={g.hairBack} material={m.hair} position={[0, 0.14, -0.09]} />
              {gown && (
                <>
                  {/* Long hair, a small tiara and a veil falling behind. */}
                  <mesh geometry={g.longHair} material={m.hair} position={[0, 0.02, -0.1]} />
                  <mesh geometry={g.tiara} material={m.gold} position={[0, 0.3, 0.02]} rotation={[-0.35, 0, 0]} />
                  <mesh geometry={g.veil} material={m.veil} position={[0, -0.12, -0.12]} rotation={[0.22, 0, 0]} />
                </>
              )}
              <mesh geometry={g.eye} material={m.eye} position={[0.052, 0.17, 0.135]} />
              <mesh geometry={g.eye} material={m.eye} position={[-0.052, 0.17, 0.135]} />
              <mesh geometry={g.nose} material={m.skin} position={[0, 0.135, 0.152]} rotation={[Math.PI / 2, 0, 0]} />
              <mesh geometry={g.blush} material={m.blush} position={[0.085, 0.12, 0.122]} rotation={[0, 0.55, 0]} />
              <mesh geometry={g.blush} material={m.blush} position={[-0.085, 0.12, 0.122]} rotation={[0, -0.55, 0]} />
            </group>

            {/* Left arm (+X) */}
            <group ref={bind("lUpperArm")} position={[0.215, 0.22, 0]}>
              <mesh geometry={g.upperArm} material={sleeve} position={[0, -0.13, 0]} castShadow />
              <group ref={bind("lForearm")} position={[0, -0.27, 0]}>
                <mesh geometry={g.forearm} material={sleeve} position={[0, -0.1, 0]} castShadow />
                <mesh geometry={g.cuff} material={suit ? m.shirt : topDark} position={[0, -0.2, 0]} />
                <mesh geometry={g.hand} material={m.skin} position={[0, -0.26, 0.01]} castShadow />
                {gown && (
                  <>
                    {/* The bouquet. */}
                    <mesh geometry={g.stem} material={m.leaf} position={[0, -0.3, 0.06]} rotation={[0.9, 0, 0]} />
                    <mesh geometry={g.bouquet} material={m.rose} position={[0, -0.27, 0.13]} />
                    <mesh geometry={g.boutonniere} material={m.flower} position={[0.05, -0.24, 0.12]} />
                    <mesh geometry={g.boutonniere} material={m.flower} position={[-0.05, -0.25, 0.14]} />
                  </>
                )}
              </group>
            </group>
            {/* Right arm (-X) */}
            <group ref={bind("rUpperArm")} position={[-0.215, 0.22, 0]}>
              <mesh geometry={g.upperArm} material={sleeve} position={[0, -0.13, 0]} castShadow />
              <group ref={bind("rForearm")} position={[0, -0.27, 0]}>
                <mesh geometry={g.forearm} material={sleeve} position={[0, -0.1, 0]} castShadow />
                <mesh geometry={g.cuff} material={suit ? m.shirt : topDark} position={[0, -0.2, 0]} />
                <mesh geometry={g.hand} material={m.skin} position={[0, -0.26, 0.01]} castShadow />
              </group>
            </group>
          </group>
        </group>

        {/* Legs */}
        {(["l", "r"] as const).map((side) => {
          const sx = side === "l" ? 0.095 : -0.095;
          return (
            <group key={side} ref={bind(`${side}Thigh`)} position={[sx, -0.04, 0]}>
              <mesh geometry={g.thigh} material={legs} position={[0, -0.2, 0]} castShadow />
              <group ref={bind(`${side}Shin`)} position={[0, -0.42, 0]}>
                <mesh geometry={g.shin} material={legs} position={[0, -0.2, 0]} castShadow />
                <group ref={bind(`${side}Foot`)} position={[0, -0.42, 0]}>
                  <mesh geometry={g.shoe} material={shoes} position={[0, -0.0, 0.05]} castShadow />
                </group>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}

"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { PLAYER } from "@/config/gameConfig";
import type { AnimationStateName } from "@/types/game";
import { ASSET } from "../assets/glb";

export type OutfitName = "casual" | "suit" | "gown" | "hijab" | "kebaya";
export type HairName = "short" | "long" | "bun";
export interface Look {
  outfit: OutfitName;
  /** No hair with a hijab. */
  hair: HairName | null;
}

/** Guests get a stable, varied look from their colour index. */
export const GUEST_LOOKS: Look[] = [
  { outfit: "casual", hair: "short" },
  { outfit: "hijab", hair: null },
  { outfit: "kebaya", hair: "bun" },
  { outfit: "casual", hair: "long" },
  { outfit: "suit", hair: "short" },
  { outfit: "casual", hair: "bun" },
  { outfit: "hijab", hair: null },
  { outfit: "kebaya", hair: "long" },
];

export function lookFor(role: "bride" | "groom" | null, index: number): Look {
  if (role === "bride") return { outfit: "gown", hair: "long" };
  if (role === "groom") return { outfit: "suit", hair: "short" };
  return GUEST_LOOKS[index % GUEST_LOOKS.length]!;
}

/** Which mesh nodes make up a look. */
function visibleParts(look: Look): Set<string> {
  const parts = new Set(["body", "face", `outfit-${look.outfit}`]);
  if (look.outfit === "gown") parts.add("outfit-gown-bouquet");
  if (look.hair && look.outfit !== "hijab") parts.add(`hair-${look.hair}`);
  return parts;
}

export interface AnimSample {
  state: AnimationStateName;
  /** Horizontal speed (m/s) — paces the walk / run cycles. */
  speed: number;
}

/**
 * The rigged character (character-base.glb): one skinned clone per player,
 * showing one outfit and hairstyle, cross-fading between its animation clips
 * (idle, walk, run, jump, sit, inspect…) as the player moves.
 */
export function GlbCharacter({ look, sample }: { look: Look; sample: () => AnimSample }) {
  const { scene, animations } = useGLTF(ASSET.character);
  const model = useMemo(() => {
    const m = cloneSkinned(scene);
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false; // skinned meshes move outside their bind-pose bounds
      }
    });
    return m;
  }, [scene]);

  useEffect(() => {
    const show = visibleParts(look);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.visible = show.has(mesh.name) || show.has(mesh.parent?.name ?? "");
    });
  }, [model, look]);

  const { mixer, actions } = useMemo(() => {
    const mx = new THREE.AnimationMixer(model);
    const map = new Map<string, THREE.AnimationAction>();
    for (const clip of animations) {
      const a = mx.clipAction(clip);
      if (clip.name === "jump") {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      map.set(clip.name, a);
    }
    return { mixer: mx, actions: map };
  }, [model, animations]);
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  const current = useRef<string | null>(null);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { state, speed } = sample();
    const name = actions.has(state) ? state : "idle";
    if (name !== current.current) {
      const next = actions.get(name);
      const prev = current.current ? actions.get(current.current) : undefined;
      if (next) {
        next.reset().setEffectiveWeight(1).play();
        if (prev) next.crossFadeFrom(prev, name === "jump" ? 0.12 : 0.22, false);
      }
      current.current = name;
    }
    // Keep feet in step with the ground speed.
    const a = actions.get(name);
    if (a && (name === "walk" || name === "run")) a.timeScale = THREE.MathUtils.clamp(speed / (name === "run" ? PLAYER.runSpeed : PLAYER.walkSpeed), 0.6, 1.4);
    mixer.update(dt);
  });

  return <primitive object={model} />;
}

useGLTF.preload(ASSET.character);

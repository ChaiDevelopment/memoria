"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SIGNS } from "@/config/museumLayout";
import { texturedQuadsGeometry, type TexturedQuad } from "@/lib/geometry";
import { facingToNormal, facingToRotationY } from "@/lib/math";
import { createSignAtlas } from "@/lib/textures/proceduralTextures";

/** Wayfinding signs above doorways and the MEMORA hero lettering. One draw call per style. */
export function Signage() {
  const atlas = useMemo(() => createSignAtlas(SIGNS), []);
  const { hero, plaques } = useMemo(() => {
    const heroQuads: TexturedQuad[] = [];
    const plaqueQuads: TexturedQuad[] = [];
    for (const s of SIGNS) {
      const uv = atlas.rects.get(s.id);
      if (!uv) throw new Error(`Missing sign ${s.id}`);
      const n = facingToNormal(s.facing);
      const quad: TexturedQuad = {
        x: s.x + n.x * 0.005,
        y: s.y,
        z: s.z + n.z * 0.005,
        rotationY: facingToRotationY(s.facing),
        width: s.width,
        height: s.height,
        uv,
      };
      (s.style === "hero" ? heroQuads : plaqueQuads).push(quad);
    }
    return { hero: texturedQuadsGeometry(heroQuads), plaques: texturedQuadsGeometry(plaqueQuads) };
  }, [atlas]);

  const materials = useMemo(
    () => ({
      hero: new THREE.MeshStandardMaterial({ map: atlas.texture, transparent: true, alphaTest: 0.1, roughness: 0.6, metalness: 0.2 }),
      plaque: new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.5 }),
    }),
    [atlas],
  );

  useEffect(
    () => () => {
      atlas.texture.dispose();
      hero?.dispose();
      plaques?.dispose();
      materials.hero.dispose();
      materials.plaque.dispose();
    },
    [atlas, hero, plaques, materials],
  );

  return (
    <group name="signage">
      {hero && <mesh geometry={hero} material={materials.hero} />}
      {plaques && <mesh geometry={plaques} material={materials.plaque} />}
    </group>
  );
}

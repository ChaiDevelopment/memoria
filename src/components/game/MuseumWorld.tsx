"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { createWoodTexture } from "@/lib/textures/proceduralTextures";
import type { QualityLevel } from "@/types/game";
import { CollisionWorld } from "./CollisionWorld";
import { Furniture } from "./environment/Furniture";
import { Garden, Trees } from "./environment/Garden";
import { Outdoors } from "./environment/Outdoors";
import { Photographs } from "./environment/Photographs";
import { Signage } from "./environment/Signage";
import { MuseumRoom } from "./MuseumRoom";

/** The complete static world: four connected areas plus surroundings. */
export function MuseumWorld({ quality }: { quality: QualityLevel }) {
  const floorMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: createWoodTexture(quality === "low" ? 512 : 1024), roughness: 0.62 }),
    [quality],
  );
  useEffect(
    () => () => {
      floorMaterial.map?.dispose();
      floorMaterial.dispose();
    },
    [floorMaterial],
  );

  return (
    <group name="museum-world">
      <MuseumRoom area="lobby" floorMaterial={floorMaterial} />
      <MuseumRoom area="gallery" floorMaterial={floorMaterial} />
      <MuseumRoom area="timeline" floorMaterial={floorMaterial} />
      <Furniture />
      <Photographs atlasCell={quality === "low" ? 256 : 384} />
      <Signage />
      <Garden />
      <Trees includeOutdoor={quality !== "low"} />
      <Outdoors />
      <CollisionWorld />
    </group>
  );
}

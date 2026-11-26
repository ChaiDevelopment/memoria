"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { createWoodTexture } from "@/lib/textures/proceduralTextures";
import type { WorldData } from "@/systems/world/buildWorld";
import type { QualityLevel } from "@/types/game";
import { CollisionWorld } from "./CollisionWorld";
import { Furniture } from "./environment/Furniture";
import { Garden, Trees } from "./environment/Garden";
import { Outdoors } from "./environment/Outdoors";
import { Photographs } from "./environment/Photographs";
import { Signage } from "./environment/Signage";
import { MuseumRoom } from "./MuseumRoom";

/** The complete static world: four connected areas plus surroundings. */
export function MuseumWorld({ world, quality }: { world: WorldData; quality: QualityLevel }) {
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
      {world.areas
        .filter((a) => a.indoor)
        .map((a) => (
          <MuseumRoom key={a.id} world={world} area={a.id} floorMaterial={floorMaterial} />
        ))}
      <Furniture wingBenches={world.wingBenches} />
      <Photographs placements={world.placements} atlasCell={quality === "low" || world.placements.length > 49 ? 256 : 384} />
      <Signage />
      <Garden />
      <Trees includeOutdoor={quality !== "low"} />
      <Outdoors />
      <CollisionWorld world={world} />
    </group>
  );
}

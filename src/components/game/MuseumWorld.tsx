"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { FLOOR_HEIGHT } from "@/config/grandMuseum";
import { createWoodTexture } from "@/lib/textures/proceduralTextures";
import { useGameStore } from "@/stores/gameStore";
import type { WorldData } from "@/systems/world/buildWorld";
import type { QualityLevel } from "@/types/game";
import { CollisionWorld } from "./CollisionWorld";
import { Furniture } from "./environment/Furniture";
import { Garden, Trees } from "./environment/Garden";
import { Outdoors } from "./environment/Outdoors";
import { grandSigns } from "@/content/wayfinding";
import { AlbumLecterns } from "./environment/AlbumLecterns";
import { GrandAtrium } from "./environment/GrandAtrium";
import { PhotoZones } from "./environment/PhotoZones";
import { RooftopCafe } from "./environment/RooftopCafe";
import { Signage } from "./environment/Signage";
import { MuseumRoom } from "./MuseumRoom";

/** The complete static world: the museum, the Grand Atrium and its Memory Halls, plus surroundings. */
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

  // Memory Halls are drawn in full only on the visitor's floor (see HallShells).
  const floor = useGameStore((s) => s.currentFloor);
  const exhibits = useGameStore((s) => s.exhibits);
  const albumChapters = useGameStore((s) => s.album.length);
  const signs = useMemo(() => grandSigns(world.grand, exhibits, albumChapters), [world, exhibits, albumChapters]);

  return (
    <group name="museum-world">
      {world.areas
        .filter((a) => a.indoor || a.id === "rooftop")
        .map((a) => (
          <MuseumRoom
            key={a.id}
            world={world}
            area={a.id}
            floorMaterial={floorMaterial}
            visible={!a.id.startsWith("hall-") || Math.round((a.elevation ?? 0) / FLOOR_HEIGHT) === floor}
          />
        ))}
      <Furniture wingBenches={world.wingBenches} />
      <GrandAtrium world={world} />
      <RooftopCafe cafe={world.grand.rooftop} />
      <PhotoZones world={world} atlasCell={quality === "low" ? 256 : 384} />
      <Signage extra={signs} />
      <AlbumLecterns lecterns={world.grand.lecterns} />
      <Garden />
      <Trees includeOutdoor={quality !== "low"} />
      <Outdoors />
      <CollisionWorld world={world} />
    </group>
  );
}

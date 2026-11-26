"use client";

import { useEffect, useMemo } from "react";
import type * as THREE from "three";
import { floorGeometry, mergeBoxes } from "@/lib/geometry";
import { getMaterials } from "@/lib/materials";
import type { WorldData } from "@/systems/world/buildWorld";
import type { AreaId } from "@/types/world";

interface MuseumRoomProps {
  world: WorldData;
  area: AreaId;
  floorMaterial: THREE.Material;
  visible?: boolean;
}

/**
 * Architecture for one room: walls, trim, ceiling, glazing and floor. All
 * pieces are generated from the layout data and merged per material, so a
 * room costs ~5 draw calls and is frustum-culled as a unit.
 */
export function MuseumRoom({ world, area, floorMaterial, visible = true }: MuseumRoomProps) {
  const mats = getMaterials();
  const geometry = useMemo(() => {
    const geo = world.areaGeometry[area];
    return {
      walls: mergeBoxes(geo?.wallSolids ?? []),
      trim: mergeBoxes([...(geo?.wallTrim ?? []), ...(geo?.ceilingTrim ?? [])]),
      ceiling: mergeBoxes(geo?.ceilingSlabs ?? []),
      glass: mergeBoxes(geo?.glass ?? []),
      floor: floorGeometry(
        world.floors.filter((f) => f.area === area).map((f) => ({ ...f.rect, y: f.y })),
        0.02,
        4,
      ),
    };
  }, [world, area]);

  useEffect(
    () => () => {
      for (const g of Object.values(geometry)) g?.dispose();
    },
    [geometry],
  );

  return (
    <group name={`room-${area}`} visible={visible}>
      {geometry.walls && <mesh geometry={geometry.walls} material={mats.wall} castShadow receiveShadow />}
      {geometry.trim && <mesh geometry={geometry.trim} material={mats.trim} castShadow receiveShadow />}
      {geometry.ceiling && <mesh geometry={geometry.ceiling} material={mats.ceiling} castShadow receiveShadow />}
      {geometry.floor && <mesh geometry={geometry.floor} material={floorMaterial} receiveShadow />}
      {geometry.glass && <mesh geometry={geometry.glass} material={mats.glass} renderOrder={2} />}
    </group>
  );
}

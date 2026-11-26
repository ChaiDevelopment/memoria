"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { ATRIUM, floorAtHeight, HALL, hallAreaId } from "@/config/grandMuseum";
import { getLocalRuntime } from "@/systems/presence/remotePeers";
import type { WorldData } from "@/systems/world/buildWorld";
import type { PhotoPlacement } from "@/types/memory";
import type { RectXZ } from "@/types/world";
import { Photographs } from "./Photographs";

/** Hall photos load within this distance on the visitor's floor… */
const LOAD_DISTANCE = 34;
/** …and are released (textures freed) beyond this one. */
const UNLOAD_DISTANCE = 50;

interface Zone {
  key: string;
  placements: PhotoPlacement[];
  rect: RectXZ | null;
  floor: number;
}

function distanceToRect(x: number, z: number, r: RectXZ): number {
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
  return Math.hypot(dx, dz);
}

/**
 * Splits the photographs into zones — the original museum, plus one per
 * Memory Hall — each with its own small texture atlas. Hall zones exist only
 * while the visitor is on that floor and nearby, so a 900-photo collection
 * never needs more than a few hundred thumbnails in memory at once.
 */
export function PhotoZones({ world, atlasCell }: { world: WorldData; atlasCell: number }) {
  const zones = useMemo<Zone[]>(() => {
    const byHall = new Map<string, PhotoPlacement[]>();
    const core: PhotoPlacement[] = [];
    for (const p of world.placements) {
      const m = /^h(\d+)-(\d+)-/.exec(p.memoryId);
      const b = /^b(\d+)-/.exec(p.memoryId);
      if (!m && !b) {
        core.push(p);
        continue;
      }
      const key = m ? `hall-${m[1]}-${m[2]}` : `balcony-${b![1]}`;
      let list = byHall.get(key);
      if (!list) byHall.set(key, (list = []));
      list.push(p);
    }
    const out: Zone[] = [{ key: "core", placements: core, rect: null, floor: 0 }];
    for (const [key, placements] of byHall) {
      const b = /^balcony-(\d+)$/.exec(key);
      if (b) out.push({ key, placements, rect: ATRIUM, floor: Number(b[1]) });
    }
    for (const h of world.grand.halls) {
      const key = hallAreaId(h);
      const placements = byHall.get(key);
      if (!placements) continue;
      const x0 = HALL.x0 + h.col * HALL.width;
      const z0 = HALL.rowZ[h.row]!;
      out.push({ key, placements, rect: { minX: x0, maxX: x0 + HALL.width, minZ: z0, maxZ: z0 + HALL.depth }, floor: h.floor });
    }
    return out;
  }, [world]);

  const [active, setActive] = useState<ReadonlySet<string>>(() => new Set(["core"]));
  const timer = useRef(0);
  useFrame((_, dt) => {
    timer.current -= dt;
    if (timer.current > 0) return;
    timer.current = 0.4;
    const r = getLocalRuntime();
    if (!r) return;
    const { x, z } = r.motor.position;
    const floor = floorAtHeight(r.groundY);
    const next = new Set<string>(["core"]);
    for (const zone of zones) {
      if (!zone.rect || zone.floor !== floor) continue;
      const d = distanceToRect(x, z, zone.rect);
      if (d < LOAD_DISTANCE || (active.has(zone.key) && d < UNLOAD_DISTANCE)) next.add(zone.key);
    }
    if (next.size !== active.size || [...next].some((k) => !active.has(k))) setActive(next);
  });

  return (
    <>
      {zones
        .filter((z) => active.has(z.key))
        .map((z) => (
          <Photographs key={z.key} placements={z.placements} atlasCell={z.key === "core" ? atlasCell : Math.min(atlasCell, 256)} />
        ))}
    </>
  );
}

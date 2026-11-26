import {
  BENCHES,
  BENCH_DEPTH,
  BENCH_SEAT_HEIGHT,
  CENTER_PLINTH,
  COLUMNS,
  COLUMN_HEIGHT,
  COLUMN_RADIUS,
  FOUNTAIN,
  GALLERY_PEDESTAL,
  GARDEN_LAMPS,
  GARDEN_TREES,
  HEDGES,
  HEDGE_COLLIDER_HEIGHT,
  INFO_DESK,
  PERGOLA,
  PLANT_COLLIDER_HEIGHT,
  PLANT_COLLIDER_RADIUS,
  POTTED_PLANTS,
  TREE_TRUNK_RADIUS,
} from "@/config/decorLayout";
import { MEMORY_BY_ID, PHOTO_PLACEMENTS } from "@/config/memories";
import { AREAS, CEILINGS, WALLS } from "@/config/museumLayout";
import { facingToNormal } from "@/lib/math";
import type { Interactable } from "@/systems/interaction/interactables";
import type { AreaId, Box3Data, BoxCollider, Collider, CylinderCollider } from "@/types/world";
import { buildCeiling, buildWall } from "./wallBuilder";

export interface AreaGeometry {
  wallSolids: Box3Data[];
  wallTrim: Box3Data[];
  glass: Box3Data[];
  ceilingSlabs: Box3Data[];
  ceilingTrim: Box3Data[];
}

export interface WorldData {
  colliders: Collider[];
  /** Subset of colliders the third-person camera must stay in front of. */
  cameraColliders: Collider[];
  areaGeometry: Record<AreaId, AreaGeometry>;
  interactables: Interactable[];
}

const box = (b: Box3Data, blocksCamera: boolean): BoxCollider => ({ kind: "box", blocksCamera, ...b });

const cylinder = (x: number, z: number, radius: number, minY: number, maxY: number): CylinderCollider => ({
  kind: "cylinder",
  x,
  z,
  radius,
  minY,
  maxY,
  blocksCamera: false,
});

function emptyAreaGeometry(): AreaGeometry {
  return { wallSolids: [], wallTrim: [], glass: [], ceilingSlabs: [], ceilingTrim: [] };
}

export function buildWorld(): WorldData {
  const colliders: Collider[] = [];
  const areaGeometry = Object.fromEntries(AREAS.map((a) => [a.id, emptyAreaGeometry()])) as Record<AreaId, AreaGeometry>;

  for (const wall of WALLS) {
    const pieces = buildWall(wall);
    const geo = areaGeometry[wall.area];
    geo.wallSolids.push(...pieces.solids);
    geo.wallTrim.push(...pieces.trim);
    geo.glass.push(...pieces.glass);
    for (const c of pieces.colliders) colliders.push(box(c, true));
  }

  for (const ceiling of CEILINGS) {
    const pieces = buildCeiling(ceiling);
    const geo = areaGeometry[ceiling.area];
    geo.ceilingSlabs.push(...pieces.slabs);
    geo.ceilingTrim.push(...pieces.trim);
    geo.glass.push(...pieces.glass);
    colliders.push(box(pieces.collider, true));
  }

  // Furniture & decor.
  for (const b of BENCHES) {
    const halfL = b.length / 2;
    const halfD = BENCH_DEPTH / 2;
    const [hx, hz] = b.along === "x" ? [halfL, halfD] : [halfD, halfL];
    colliders.push(
      box({ minX: b.x - hx, maxX: b.x + hx, minZ: b.z - hz, maxZ: b.z + hz, minY: 0, maxY: BENCH_SEAT_HEIGHT }, false),
    );
  }
  for (const c of COLUMNS) colliders.push(cylinder(c.x, c.z, COLUMN_RADIUS + 0.06, 0, COLUMN_HEIGHT));
  colliders.push(cylinder(CENTER_PLINTH.x, CENTER_PLINTH.z, CENTER_PLINTH.radius, 0, CENTER_PLINTH.height));
  // The floating sculpture above the plinth.
  colliders.push(cylinder(CENTER_PLINTH.x, CENTER_PLINTH.z, 0.55, CENTER_PLINTH.height + 0.25, CENTER_PLINTH.height + 2.4));
  {
    const p = GALLERY_PEDESTAL;
    const s = p.size / 2;
    colliders.push(box({ minX: p.x - s, maxX: p.x + s, minZ: p.z - s, maxZ: p.z + s, minY: 0, maxY: p.height + 0.9 }, false));
  }
  colliders.push(box({ ...INFO_DESK, minY: 0, maxY: INFO_DESK.height }, false));
  for (const p of POTTED_PLANTS) {
    colliders.push(cylinder(p.x, p.z, PLANT_COLLIDER_RADIUS * p.scale, 0, PLANT_COLLIDER_HEIGHT * p.scale));
  }

  // Garden.
  for (const h of HEDGES) colliders.push(box({ ...h, minY: 0, maxY: HEDGE_COLLIDER_HEIGHT }, false));
  for (const t of GARDEN_TREES) colliders.push(cylinder(t.x, t.z, TREE_TRUNK_RADIUS * t.scale + 0.05, 0, 3.2 * t.scale));
  colliders.push(cylinder(FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.radius, 0, 2.4));
  for (const l of GARDEN_LAMPS) colliders.push(cylinder(l.x, l.z, 0.14, 0, 3.1));
  for (const x of [PERGOLA.minX, PERGOLA.maxX]) {
    for (const z of [PERGOLA.minZ, PERGOLA.maxZ]) colliders.push(cylinder(x, z, 0.14, 0, PERGOLA.height));
  }
  colliders.push(
    box({ minX: PERGOLA.minX - 0.3, maxX: PERGOLA.maxX + 0.3, minZ: PERGOLA.minZ - 0.3, maxZ: PERGOLA.maxZ + 0.3, minY: PERGOLA.height, maxY: PERGOLA.height + 0.3 }, false),
  );

  // Photographs → interactables (+ easel colliders).
  const interactables: Interactable[] = [];
  for (const p of PHOTO_PLACEMENTS) {
    const memory = MEMORY_BY_ID.get(p.memoryId);
    if (!memory) throw new Error(`Photo placement references unknown memory "${p.memoryId}"`);
    const n = facingToNormal(p.facing);
    interactables.push({
      id: `photo:${p.memoryId}`,
      kind: "photo",
      memoryId: p.memoryId,
      label: memory.title,
      x: p.x,
      y: p.y,
      z: p.z,
      normalX: n.x,
      normalZ: n.z,
    });
    if (p.mount === "easel") {
      const halfW = (p.height * memory.aspect) / 2 + 0.1;
      const halfD = 0.32;
      const [hx, hz] = n.x !== 0 ? [halfD, halfW] : [halfW, halfD];
      colliders.push(box({ minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz, minY: 0, maxY: 2.0 }, false));
    }
  }

  return {
    colliders,
    cameraColliders: colliders.filter((c) => c.blocksCamera),
    areaGeometry,
    interactables,
  };
}

let cached: WorldData | null = null;

/** World data is static, so it is built once and shared. */
export function getWorld(): WorldData {
  if (!cached) cached = buildWorld();
  return cached;
}

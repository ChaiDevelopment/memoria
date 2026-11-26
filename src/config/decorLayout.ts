import { mulberry32 } from "@/lib/random";

/**
 * Furniture, plants and garden placements. Each entry is used both for
 * rendering (instanced meshes) and, where solid, for collision.
 */

export interface BenchDef {
  x: number;
  z: number;
  /** "x": the bench's long side runs along X. */
  along: "x" | "z";
  length: number;
}

export const BENCHES: BenchDef[] = [
  { x: -7.3, z: 11.8, along: "z", length: 2.2 },
  { x: 7.3, z: 11.8, along: "z", length: 2.2 },
  { x: 0, z: -8.6, along: "z", length: 2.6 },
  { x: 0, z: -17.6, along: "z", length: 2.6 },
  { x: 20.5, z: 7, along: "x", length: 2.2 },
  { x: 32, z: 7, along: "x", length: 2.2 },
  { x: -26, z: 0.7, along: "x", length: 2.2 },
  { x: -26, z: -8.7, along: "x", length: 2.2 },
  { x: -30.7, z: -4, along: "z", length: 2.2 },
  { x: -21.3, z: -4, along: "z", length: 2.2 },
];

export const BENCH_SEAT_HEIGHT = 0.46;
export const BENCH_DEPTH = 0.52;

export const COLUMNS = [
  { x: -6, z: 3 },
  { x: 6, z: 3 },
  { x: -6, z: 11 },
  { x: 6, z: 11 },
] as const;
export const COLUMN_RADIUS = 0.42;
export const COLUMN_HEIGHT = 7;

/** Lobby centerpiece plinth (walkable top — try jumping on it). */
export const CENTER_PLINTH = { x: 0, z: 7, radius: 1.05, height: 0.85 } as const;
export const GALLERY_PEDESTAL = { x: 0, z: -13.1, size: 0.8, height: 1.0 } as const;

export const INFO_DESK = { minX: 4.8, maxX: 7.8, minZ: 0.7, maxZ: 1.6, height: 1.05 } as const;

export const POTTED_PLANTS: { x: number; z: number; scale: number }[] = [
  { x: -8.25, z: 13.25, scale: 1.15 },
  { x: 8.25, z: 13.25, scale: 1.15 },
  { x: -8.25, z: 0.8, scale: 1.0 },
  { x: -3.4, z: 0.75, scale: 0.95 },
  { x: 3.4, z: 0.75, scale: 0.95 },
  { x: -11.2, z: -23.2, scale: 1.1 },
  { x: 11.2, z: -23.2, scale: 1.1 },
  { x: 11.2, z: -0.95, scale: 1.0 },
  { x: -11.2, z: -0.95, scale: 1.0 },
  { x: 40.2, z: 3.85, scale: 1.0 },
  { x: 40.2, z: 10.15, scale: 1.0 },
  { x: 10.2, z: 10.15, scale: 0.9 },
];
export const PLANT_COLLIDER_RADIUS = 0.36;
export const PLANT_COLLIDER_HEIGHT = 1.5;

export const PENDANT_LAMPS: { x: number; z: number; ceiling: number; drop: number }[] = [
  { x: -6, z: 7, ceiling: 7, drop: 2.4 },
  { x: 6, z: 7, ceiling: 7, drop: 2.4 },
  ...[11, 17, 23, 29, 35].map((x) => ({ x, z: 7, ceiling: 5, drop: 1.3 })),
];

export const RUGS = [
  { kind: "round" as const, x: 0, z: 7, radius: 3.3, color: "#8c4a3a", border: "#d9b77e" },
  { kind: "rect" as const, x: 0, z: -13, width: 3.2, depth: 15, color: "#41566b", border: "#d9c9a3" },
];

// ── Garden ────────────────────────────────────────────────────────────────

export const FOUNTAIN = { x: -26, z: -4, radius: 2.9, rimHeight: 0.55 } as const;
export const FOUNTAIN_PLAZA_RADIUS = 6.2;

export interface HedgeDef {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

/** Hedges enclosing the garden. Colliders are taller than the visible hedge. */
export const HEDGES: HedgeDef[] = [
  { minX: -42.6, maxX: -41.4, minZ: -28.6, maxZ: 18.6, height: 1.6 },
  { minX: -42.6, maxX: -12.2, minZ: -28.6, maxZ: -27.4, height: 1.6 },
  { minX: -42.6, maxX: -12.2, minZ: 17.4, maxZ: 18.6, height: 1.6 },
  // Entrance Court (south of the Grand Atrium's portico).
  { minX: -12.6, maxX: -11.6, minZ: 38.2, maxZ: 50.6, height: 1.6 },
  { minX: -12.6, maxX: 12.6, minZ: 49.4, maxZ: 50.6, height: 1.6 },
  { minX: 11.6, maxX: 12.6, minZ: 42.2, maxZ: 50.6, height: 1.6 },
  { minX: -12.6, maxX: -11.6, minZ: -28.6, maxZ: -24.2, height: 1.6 },
];
export const HEDGE_COLLIDER_HEIGHT = 2.6;

export interface TreeDef {
  x: number;
  z: number;
  scale: number;
  variant: 0 | 1 | 2;
}

export const GARDEN_TREES: TreeDef[] = [
  { x: -15, z: 14.2, scale: 1.0, variant: 0 },
  { x: -22.5, z: 14.6, scale: 1.2, variant: 1 },
  { x: -31, z: 14.8, scale: 1.05, variant: 2 },
  { x: -38.4, z: 12.5, scale: 1.25, variant: 0 },
  { x: -38.2, z: 3.5, scale: 1.1, variant: 1 },
  { x: -38.8, z: -8.5, scale: 1.3, variant: 2 },
  { x: -37.5, z: -20.5, scale: 1.15, variant: 0 },
  { x: -30.5, z: -24.6, scale: 1.0, variant: 1 },
  { x: -21.5, z: -24.8, scale: 1.2, variant: 2 },
  { x: -16.2, z: -20.8, scale: 0.95, variant: 0 },
  { x: -15.8, z: -3.2, scale: 1.0, variant: 1 },
  { x: -33.6, z: 7.5, scale: 0.9, variant: 2 },
  { x: -32.2, z: -15.5, scale: 1.05, variant: 0 },
  { x: -18.6, z: 1.6, scale: 0.8, variant: 2 },
  { x: -35.4, z: -1.6, scale: 0.85, variant: 1 },
];
export const TREE_TRUNK_RADIUS = 0.3;

/** Stepping-stone paths (polylines in XZ). */
export const GARDEN_PATHS: [number, number][][] = [
  [
    [-9.4, 7],
    [-19, 7],
    [-23.2, 1.2],
  ],
  [
    [-12.4, -12],
    [-19.5, -12],
    [-23.1, -7.8],
  ],
  [
    [-31.8, -4],
    [-36.5, -4],
    [-36.5, 9],
    [-28, 10.5],
    [-19, 7],
  ],
];

export const GARDEN_LAMPS: { x: number; z: number }[] = [
  { x: -16.2, z: 8.5 },
  { x: -16.2, z: 5.5 },
  { x: -20.5, z: 9.4 },
  { x: -18.5, z: -10.4 },
  { x: -31.2, z: 1.4 },
  { x: -31.2, z: -9.4 },
  { x: -37.9, z: 9.6 },
];

/** Wooden pergola over the path leaving the lobby. */
export const PERGOLA = { minX: -14.2, maxX: -10.6, minZ: 5.3, maxZ: 8.7, height: 2.9 } as const;

export interface FlowerBed {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  count: number;
}

export const FLOWER_BEDS: FlowerBed[] = [
  { minX: -40.6, maxX: -10.5, minZ: 15.8, maxZ: 17.1, count: 170 },
  { minX: -40.9, maxX: -39.6, minZ: -26.5, maxZ: 16, count: 190 },
  { minX: -40.5, maxX: -13, minZ: -26.9, maxZ: -25.7, count: 150 },
  { minX: -14.2, maxX: -12.6, minZ: -9.2, maxZ: -3.6, count: 45 },
  { minX: -12.2, maxX: -10.5, minZ: 9.8, maxZ: 13.4, count: 40 },
];

export interface ScatterItem {
  x: number;
  z: number;
  scale: number;
  rotation: number;
  colorIndex: number;
}

/** Deterministic flower scatter so the garden looks identical on every load. */
export function scatterFlowers(): ScatterItem[] {
  const rand = mulberry32(1337);
  const items: ScatterItem[] = [];
  for (const bed of FLOWER_BEDS) {
    for (let i = 0; i < bed.count; i++) {
      items.push({
        x: bed.minX + rand() * (bed.maxX - bed.minX),
        z: bed.minZ + rand() * (bed.maxZ - bed.minZ),
        scale: 0.7 + rand() * 0.6,
        rotation: rand() * Math.PI * 2,
        colorIndex: Math.floor(rand() * 5),
      });
    }
  }
  return items;
}

export const GARDEN_ROCKS: { x: number; z: number; scale: number }[] = [
  { x: -17.2, z: 13.6, scale: 0.55 },
  { x: -36.8, z: 13.8, scale: 0.7 },
  { x: -39.2, z: -14, scale: 0.6 },
  { x: -27.5, z: -23.6, scale: 0.65 },
  { x: -14.2, z: -18.2, scale: 0.45 },
  { x: -34.2, z: -11.6, scale: 0.4 },
  { x: -24.2, z: 12.6, scale: 0.5 },
];

/** Trees outside the playable area that frame the views through windows. */
export function outdoorTreeScatter(): TreeDef[] {
  const rand = mulberry32(4242);
  const trees: TreeDef[] = [];
  const keepOut = [
    { minX: -45, maxX: -7, minZ: -31, maxZ: 21 }, // garden
    { minX: -15, maxX: 15, minZ: -28, maxZ: 16 }, // lobby + gallery
    { minX: 7, maxX: 45, minZ: -1, maxZ: 15 }, // timeline hall
    { minX: -17, maxX: 96, minZ: 10, maxZ: 55 }, // Grand Atrium, Memory Halls, Entrance Court
  ];
  const blocked = (x: number, z: number) =>
    keepOut.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);
  let guard = 0;
  while (trees.length < 46 && guard++ < 2000) {
    const angle = rand() * Math.PI * 2;
    const radius = 30 + rand() * 46;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (blocked(x, z)) continue;
    trees.push({ x, z, scale: 0.9 + rand() * 0.7, variant: Math.floor(rand() * 3) as 0 | 1 | 2 });
  }
  return trees;
}

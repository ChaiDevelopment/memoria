import type { StairFlightDef } from "@/systems/world/stairBuilder";
import type { PhotoPlacement } from "@/types/memory";
import type { AreaDef, Box3Data, CeilingDef, FloorDef, RectXZ, WallDef, WallOpening } from "@/types/world";

/**
 * The Grand Museum: a multi-storey Grand Atrium south of the lobby, with an
 * entrance court, an imperial staircase to Floor 1, a brass lift serving
 * every floor, and blocks of Memory Halls east of the atrium — 8 halls per
 * floor (4 × 2 grid), 26 frames each, up to 5 floors (1,040 frames).
 *
 * Everything is derived from the number of photos beyond the original
 * museum's 34 frames, so the building grows with the collection: halls fill
 * in order, a new floor appears only when the floor below is full, and
 * small collections never get empty floors. All of it is plain data — the
 * same wall/stair/collider generators as the rest of the building.
 *
 *            z=14 ┌──────── Lobby ────────┐┌─ Hall A ─┬─ Hall C ─┬─ … (x → 92)
 *                 │     Grand Atrium      ││  (row 0) │          │
 *            z=28 │  stairs · lift · dome ├┼─ Hall B ─┼─ Hall D ─┼─ …
 *            z=38 └──────── portico ──────┘│  (row 1) │          │
 *            z=42                          └──────────┴──────────┴─
 *                    Entrance Court (z 38–50)
 */

const T = 0.4;
const H = T / 2;

export const FLOOR_HEIGHT = 6;
/** Storey for a standing height: the stair landing (3 m) still counts as the floor below. */
export const floorAtHeight = (y: number) => Math.max(0, Math.floor((y + 1) / FLOOR_HEIGHT));
export const ATRIUM: RectXZ = { minX: -12, maxX: 12, minZ: 14, maxZ: 38 };
/** The open void inside the balcony rings. */
export const RING_HOLE: RectXZ = { minX: -9, maxX: 9, minZ: 17, maxZ: 35 };
export const ENTRANCE: RectXZ = { minX: -12, maxX: 12, minZ: 38, maxZ: 50 };
/** The oculus under the glass dome. */
export const SKYLIGHT: RectXZ = { minX: -6, maxX: 6, minZ: 20, maxZ: 32 };
export const LIFT_SHAFT: RectXZ = { minX: 6.6, maxX: 9.0, minZ: 17.0, maxZ: 19.4 };

export const HALL = { width: 20, depth: 14, x0: 12, rowZ: [14, 28] as const, cols: 4, ceiling: 5, frames: 26 } as const;
export const HALLS_PER_FLOOR = HALL.cols * HALL.rowZ.length;
export const MAX_HALL_FLOORS = 5;
/** Frames around each upper balcony (Floors 1+), filled before that floor's halls. */
export const BALCONY_FRAMES = 17;
/** Every frame the Grand Museum can add beyond the original museum: halls + balconies. */
export const MAX_HALL_FRAMES = MAX_HALL_FLOORS * HALLS_PER_FLOOR * HALL.frames + (MAX_HALL_FLOORS - 1) * BALCONY_FRAMES;

export interface HallRef {
  floor: number;
  /** 0–7 within the floor (fill order). */
  index: number;
  row: number;
  col: number;
  frames: number;
}

export interface GrandPlan {
  halls: HallRef[];
  /** Frames used on each upper balcony. */
  balconies: { floor: number; frames: number }[];
}

/**
 * What `extraFrames` photos need, in fill order: floor by floor — the
 * balcony first (Floors 1+), then that floor's halls (row pairs, west → east).
 * So each storey holds one continuous stretch of years.
 */
export function planGrand(extraFrames: number): GrandPlan {
  let n = Math.max(0, Math.min(MAX_HALL_FRAMES, Math.floor(extraFrames)));
  const halls: HallRef[] = [];
  const balconies: GrandPlan["balconies"] = [];
  for (let floor = 0; floor < MAX_HALL_FLOORS && n > 0; floor++) {
    if (floor > 0) {
      const frames = Math.min(BALCONY_FRAMES, n);
      balconies.push({ floor, frames });
      n -= frames;
    }
    for (let index = 0; index < HALLS_PER_FLOOR && n > 0; index++) {
      const frames = Math.min(HALL.frames, n);
      halls.push({ floor, index, row: index % 2, col: Math.floor(index / 2), frames });
      n -= frames;
    }
  }
  return { halls, balconies };
}

export const planHalls = (extraFrames: number): HallRef[] => planGrand(extraFrames).halls;

export const hallAreaId = (h: Pick<HallRef, "floor" | "index">) => `hall-${h.floor}-${h.index + 1}` as const;
export const floorLabel = (floor: number) => (floor === 0 ? "Ground" : `Floor ${floor}`);
export const hallName = (h: Pick<HallRef, "floor" | "index">) => `Memory Hall ${h.floor === 0 ? "G" : h.floor}${String.fromCharCode(65 + h.index)}`;

/** The 26 frame slots of a hall, in fill order. Positions avoid every potential door. */
export function hallFrames(h: HallRef): PhotoPlacement[] {
  const e = h.floor * FLOOR_HEIGHT;
  const x0 = HALL.x0 + h.col * HALL.width;
  const z0 = HALL.rowZ[h.row]!;
  const id = (i: number) => `h${h.floor}-${h.index + 1}-${i + 1}`;
  const L = { aspect: 3 / 2, height: 1.2, y: e + 2.15 };
  const P = { aspect: 2 / 3, height: 1.4, y: e + 2.2 };
  const off = 0.23;
  const out: Omit<PhotoPlacement, "memoryId">[] = [];
  const along = [1.7, 4.2, 6.7, 13.3, 15.8, 18.3];
  for (const dx of along) out.push({ x: x0 + dx, y: L.y, z: z0 + off, facing: "+z", height: L.height, aspect: L.aspect, frame: "oak", mount: "wall" });
  for (const dx of along) out.push({ x: x0 + dx, y: L.y, z: z0 + HALL.depth - off, facing: "-z", height: L.height, aspect: L.aspect, frame: "black", mount: "wall" });
  const side = [1.6, 3.6, 10.4, 12.4];
  for (const dz of side) out.push({ x: x0 + off, y: P.y, z: z0 + dz, facing: "+x", height: P.height, aspect: P.aspect, frame: "gold", mount: "wall" });
  for (const dz of side) out.push({ x: x0 + HALL.width - off, y: P.y, z: z0 + dz, facing: "-x", height: P.height, aspect: P.aspect, frame: "gold", mount: "wall" });
  for (const dx of [6.5, 10, 13.5]) out.push({ x: x0 + dx, y: e + 1.9, z: z0 + 7 - 0.18, facing: "-z", height: 1.2, aspect: 3 / 2, frame: "white", mount: "wall" });
  for (const dx of [6.5, 10, 13.5]) out.push({ x: x0 + dx, y: e + 1.9, z: z0 + 7 + 0.18, facing: "+z", height: 1.2, aspect: 3 / 2, frame: "white", mount: "wall" });
  return out.slice(0, h.frames).map((p, i) => ({ ...p, memoryId: id(i) }));
}

/** The frames around balcony `floor` (the atrium's walls at that storey), in fill order. They avoid doors, windows and the lift. */
export function balconyFrames(floor: number, count: number): PhotoPlacement[] {
  const y = floor * FLOOR_HEIGHT;
  const off = 0.23;
  const L = { aspect: 3 / 2, height: 1.2, y: y + 2.15 };
  const P = { aspect: 2 / 3, height: 1.4, y: y + 2.2 };
  const out: Omit<PhotoPlacement, "memoryId">[] = [];
  for (const x of [-10, -6.5, -3, 0.5, 4]) out.push({ x, y: L.y, z: ATRIUM.minZ + off, facing: "+z", height: L.height, aspect: L.aspect, frame: "oak", mount: "wall" });
  for (const x of [-10.4, -2, 2, 10.4]) out.push({ x, y: L.y, z: ATRIUM.maxZ - off, facing: "-z", height: L.height, aspect: L.aspect, frame: "black", mount: "wall" });
  for (const z of [15.8, 18, 27, 36.2]) out.push({ x: ATRIUM.minX + off, y: P.y, z, facing: "+x", height: P.height, aspect: P.aspect, frame: "gold", mount: "wall" });
  for (const z of [16, 25.5, 28, 30.5]) out.push({ x: ATRIUM.maxX - off, y: P.y, z, facing: "-x", height: P.height, aspect: P.aspect, frame: "gold", mount: "wall" });
  return out.slice(0, count).map((p, i) => ({ ...p, memoryId: `b${floor}-${i + 1}` }));
}

/** Album Kata lecterns per balcony: one open book per chapter, along the walk from the lift. */
export const LECTERNS_PER_FLOOR = 10;
const LECTERN_SPOTS: { x: number; z: number; facing: "+x" | "-x" | "+z" | "-z" }[] = [
  // North band, walking west from the lift…
  { x: -1, z: 16.45, facing: "-z" },
  { x: -4, z: 16.45, facing: "-z" },
  { x: -7, z: 16.45, facing: "-z" },
  // …down the west band…
  { x: -9.55, z: 19, facing: "-x" },
  { x: -9.55, z: 21.8, facing: "-x" },
  { x: -9.55, z: 24.6, facing: "-x" },
  { x: -9.55, z: 27.4, facing: "-x" },
  // …and along the south band, between the two staircases.
  { x: -5, z: 35.55, facing: "+z" },
  { x: -2, z: 35.55, facing: "+z" },
  { x: 1, z: 35.55, facing: "+z" },
];

export interface Lectern {
  /** Chapter index (0-based). */
  index: number;
  floor: number;
  x: number;
  y: number;
  z: number;
  /** Side the reader stands on. */
  facing: "+x" | "-x" | "+z" | "-z";
}

export function planLecterns(chapters: number): Lectern[] {
  const n = Math.max(0, Math.min(MAX_HALL_FLOORS * LECTERNS_PER_FLOOR, Math.floor(chapters)));
  return Array.from({ length: n }, (_, index) => {
    const floor = 1 + Math.floor(index / LECTERNS_PER_FLOOR);
    const spot = LECTERN_SPOTS[index % LECTERNS_PER_FLOOR]!;
    return { index, floor, x: spot.x, y: floor * FLOOR_HEIGHT, z: spot.z, facing: spot.facing };
  });
}

/** Rooftop café furniture (positions on the atrium roof). */
export interface RooftopCafe {
  y: number;
  tables: { x: number; z: number; umbrella: boolean }[];
  counter: Box3Data;
  planters: { x: number; z: number }[];
  loungers: { x: number; z: number }[];
  /** The glass dome rising through the roof (cylinder collider). */
  dome: { x: number; z: number; radius: number };
}

export interface LiftStop {
  floor: number;
  label: string;
  rooftop: boolean;
  /** Where the visitor arrives (north balcony band, west of the shaft). */
  x: number;
  y: number;
  z: number;
  facing: number;
  /** Call-panel position (interactable). */
  panel: { x: number; y: number; z: number };
}

export interface GrandLayout {
  halls: HallRef[];
  /** Highest floor reachable (balcony ring / halls). Always ≥ 1: the staircase leads to Floor 1. */
  topFloor: number;
  atriumHeight: number;
  walls: WallDef[];
  ceilings: CeilingDef[];
  floors: FloorDef[];
  areas: AreaDef[];
  placements: PhotoPlacement[];
  stairs: StairFlightDef[];
  /** Walkable platforms (landing, stair connectors): rendered + camera-blocking colliders. */
  platforms: Box3Data[];
  /** Balustrades: rendered + colliders. */
  railings: Box3Data[];
  liftShaft: Box3Data;
  liftStops: LiftStop[];
  /** Exterior massing per hall, drawn for floors the visitor isn't on. */
  hallShells: { floor: number; box: Box3Data }[];
  rooftop: RooftopCafe;
  lecterns: Lectern[];
  /** Carpet runners guiding visitors from the lift and stairs to the Memory Halls. */
  runners: Box3Data[];
  maxX: number;
}

const RAIL_H = 1.0;
const RAIL_T = 0.08;

/** Balustrade along an x-run (at z) or z-run (at x), standing on floor height y. */
function rail(axis: "x" | "z", at: number, from: number, to: number, y: number): Box3Data {
  return axis === "x"
    ? { minX: from, maxX: to, minZ: at - RAIL_T / 2, maxZ: at + RAIL_T / 2, minY: y, maxY: y + RAIL_H }
    : { minX: at - RAIL_T / 2, maxX: at + RAIL_T / 2, minZ: from, maxZ: to, minY: y, maxY: y + RAIL_H };
}

function wall(id: string, area: AreaDef["id"], axis: "x" | "z", at: number, from: number, to: number, baseY: number, height: number, openings: WallOpening[], exterior = false): WallDef {
  return { id, area, axis, at, from, to, height, thickness: T, openings, exterior, baseY };
}

export function buildGrandLayout(extraFrames: number, albumChapters = 0): GrandLayout {
  const plan = planGrand(extraFrames);
  const halls = plan.halls;
  const open = new Set(halls.map((h) => `${h.floor}:${h.row}:${h.col}`));
  const isOpen = (f: number, r: number, c: number) => open.has(`${f}:${r}:${c}`);
  const lecterns = planLecterns(albumChapters);
  const topFloor = Math.max(1, ...halls.map((h) => h.floor), ...plan.balconies.map((b) => b.floor), ...lecterns.map((l) => l.floor));
  const atriumHeight = (topFloor + 1) * FLOOR_HEIGHT + 2;

  const walls: WallDef[] = [];
  const ceilings: CeilingDef[] = [];
  const floors: FloorDef[] = [];
  const areas: AreaDef[] = [];
  const placements: PhotoPlacement[] = [];
  const railings: Box3Data[] = [];
  const platforms: Box3Data[] = [];
  const liftStops: LiftStop[] = [];
  const hallShells: GrandLayout["hallShells"] = [];

  // ── Atrium shell: one wall band per storey (so each floor gets its own doors and windows) ──
  for (let k = 0; k <= topFloor + 1; k++) {
    const base = k * FLOOR_HEIGHT;
    const top = k === topFloor + 1;
    const h = top ? atriumHeight - base : FLOOR_HEIGHT;
    const upper = (o: Omit<WallOpening, "bottom" | "top">, b: number, t: number): WallOpening => ({ ...o, bottom: b, top: t });
    // North (shared with the lobby on the ground floor).
    walls.push(
      wall(`atrium-north-${k}`, "atrium", "x", ATRIUM.minZ, ATRIUM.minX - H, ATRIUM.maxX + H, base, h, k === 0
        ? [
            { kind: "window", start: -7.6, end: -3.8, bottom: 0.7, top: 5.6 },
            { kind: "door", start: -2.5, end: 2.5, bottom: 0, top: 4.4 },
            { kind: "window", start: 3.8, end: 7.6, bottom: 0.7, top: 5.6 },
          ]
        : []),
    );
    // South: the portico, then windows on every storey.
    walls.push(
      wall(`atrium-south-${k}`, "atrium", "x", ATRIUM.maxZ, ATRIUM.minX - H, ATRIUM.maxX + H, base, h, k === 0
        ? [
            { kind: "window", start: -9, end: -5, bottom: 1.0, top: 4.6 },
            { kind: "door", start: -3, end: 3, bottom: 0, top: 5.2 },
            { kind: "window", start: 5, end: 9, bottom: 1.0, top: 4.6 },
          ]
        : top
          ? []
          : [upper({ kind: "window", start: -8, end: -4 }, 1.2, 4.4), upper({ kind: "window", start: 4, end: 8 }, 1.2, 4.4)], true),
    );
    // West: garden door on the ground floor, tall windows above.
    walls.push(
      wall(`atrium-west-${k}`, "atrium", "z", ATRIUM.minX, ATRIUM.minZ - H, ATRIUM.maxZ + H, base, h, k === 0
        ? [
            { kind: "door", start: 14.6, end: 17.2, bottom: 0, top: 3.4 },
            { kind: "window", start: 22, end: 26, bottom: 1.0, top: 5.0 },
            { kind: "window", start: 30, end: 34, bottom: 1.0, top: 5.0 },
          ]
        : top
          ? []
          : [upper({ kind: "window", start: 20, end: 25 }, 1.2, 4.4), upper({ kind: "window", start: 29, end: 34 }, 1.2, 4.4)], true),
    );
    // East: doors into the Memory Halls of each floor (extends to z=42 to close hall row 1).
    const eastDoors: WallOpening[] = [];
    if (!top && isOpen(k, 0, 0)) eastDoors.push({ kind: "door", start: 19, end: 23, bottom: 0, top: 3.6 });
    if (!top && isOpen(k, 1, 0)) eastDoors.push({ kind: "door", start: 33, end: 37, bottom: 0, top: 3.6 });
    walls.push(wall(`atrium-east-${k}`, "atrium", "z", ATRIUM.maxX, ATRIUM.minZ - H, 42 + H, base, h, eastDoors, true));
  }

  ceilings.push({
    area: "atrium",
    rect: { minX: ATRIUM.minX - H, maxX: ATRIUM.maxX + H, minZ: ATRIUM.minZ - H, maxZ: ATRIUM.maxZ + H },
    height: atriumHeight,
    thickness: 0.4,
    skylights: [SKYLIGHT],
    glazingBars: false,
  });
  floors.push({ area: "atrium", rect: { minX: ATRIUM.minX, maxX: ATRIUM.maxX, minZ: ATRIUM.minZ + H, maxZ: ATRIUM.maxZ }, material: "wood" });
  areas.push({ id: "atrium", name: "Grand Atrium", subtitle: "Every memory deserves a place", bounds: { ...ATRIUM }, indoor: true });
  areas.push({ id: "entrance", name: "Entrance Court", subtitle: "Welcome to MEMORA", bounds: { ...ENTRANCE }, indoor: false });

  // ── Balcony rings (Floors 1…top) ──
  const ringPieces = (y: number): RectXZ[] => [
    { minX: ATRIUM.minX, maxX: ATRIUM.maxX, minZ: ATRIUM.minZ, maxZ: RING_HOLE.minZ },
    { minX: ATRIUM.minX, maxX: ATRIUM.maxX, minZ: RING_HOLE.maxZ, maxZ: ATRIUM.maxZ },
    { minX: ATRIUM.minX, maxX: RING_HOLE.minX, minZ: RING_HOLE.minZ, maxZ: RING_HOLE.maxZ },
    { minX: RING_HOLE.maxX, maxX: ATRIUM.maxX, minZ: RING_HOLE.minZ, maxZ: RING_HOLE.maxZ },
  ].map((r) => ({ ...r, y }) as RectXZ & { y: number });
  for (let k = 1; k <= topFloor; k++) {
    const y = k * FLOOR_HEIGHT;
    const id = `balcony-${k}` as const;
    ceilings.push({ area: id, rect: { ...ATRIUM }, height: y - 0.4, thickness: 0.4, skylights: [RING_HOLE], openHoles: true, glazingBars: false });
    for (const r of ringPieces(y)) floors.push({ area: id, rect: r, material: "wood", y });
    areas.push({ id, name: `${floorLabel(k)} Balcony`, subtitle: "Grand Atrium", bounds: { ...ATRIUM }, indoor: true, elevation: y });
    // Inner balustrades (gaps for the lift and, on Floor 1, the arriving staircase).
    railings.push(rail("x", RING_HOLE.minZ, RING_HOLE.minX, LIFT_SHAFT.minX, y));
    if (k === 1) {
      railings.push(rail("x", RING_HOLE.maxZ, -7, 7, y));
      railings.push(rail("z", RING_HOLE.maxX, RING_HOLE.minZ, 26.2, y));
      railings.push(rail("z", RING_HOLE.minX, RING_HOLE.minZ, 26.2, y));
    } else {
      railings.push(rail("x", RING_HOLE.maxZ, RING_HOLE.minX, RING_HOLE.maxX, y));
      railings.push(rail("z", RING_HOLE.maxX, LIFT_SHAFT.maxZ, RING_HOLE.maxZ, y));
      railings.push(rail("z", RING_HOLE.minX, RING_HOLE.minZ, RING_HOLE.maxZ, y));
    }
  }

  // ── Imperial staircase: Ground → landing (3 m) → Floor 1 (6 m) ──
  const flight = (id: string, x: number, z: number, baseY: number, direction: StairFlightDef["direction"], width: number): StairFlightDef => ({
    id,
    area: "atrium",
    x,
    z,
    baseY,
    direction,
    width,
    steps: 15,
    rise: 0.2,
    run: 0.32,
    railings: { left: true, right: true },
  });
  const stairs = [flight("stair-centre", 0, 31.0, 0, "-z", 4), flight("stair-east", 8, 26.2, 3.0, "+z", 2), flight("stair-west", -8, 26.2, 3.0, "+z", 2)];
  platforms.push({ minX: -9, maxX: 9, minZ: 23.2, maxZ: 26.2, minY: 2.7, maxY: 3.0 }); // landing
  platforms.push({ minX: 7.0, maxX: 9.0, minZ: 31.0, maxZ: 35.0, minY: 5.6, maxY: 6.0 }); // east connector
  platforms.push({ minX: -9.0, maxX: -7.0, minZ: 31.0, maxZ: 35.0, minY: 5.6, maxY: 6.0 }); // west connector
  railings.push(rail("x", 23.2, -9, 9, 3.0));
  railings.push(rail("z", 9, 23.2, 26.2, 3.0));
  railings.push(rail("z", -9, 23.2, 26.2, 3.0));
  railings.push(rail("x", 26.2, 2, 7, 3.0));
  railings.push(rail("x", 26.2, -7, -2, 3.0));
  railings.push(rail("z", 7.0, 31.0, 35.0, 6.0));
  railings.push(rail("z", -7.0, 31.0, 35.0, 6.0));

  // ── Rooftop café on the atrium roof ──
  const roofY = atriumHeight + 0.4;
  const deckPieces: RectXZ[] = [
    { minX: ATRIUM.minX, maxX: ATRIUM.maxX, minZ: ATRIUM.minZ, maxZ: SKYLIGHT.minZ },
    { minX: ATRIUM.minX, maxX: ATRIUM.maxX, minZ: SKYLIGHT.maxZ, maxZ: ATRIUM.maxZ },
    { minX: ATRIUM.minX, maxX: SKYLIGHT.minX, minZ: SKYLIGHT.minZ, maxZ: SKYLIGHT.maxZ },
    { minX: SKYLIGHT.maxX, maxX: ATRIUM.maxX, minZ: SKYLIGHT.minZ, maxZ: SKYLIGHT.maxZ },
  ];
  for (const r of deckPieces) floors.push({ area: "rooftop", rect: r, material: "wood", y: roofY });
  areas.push({ id: "rooftop", name: "Rooftop Café", subtitle: "Coffee above the clouds", bounds: { ...ATRIUM }, indoor: false, elevation: roofY });
  // Glass parapet all round.
  railings.push(rail("x", ATRIUM.minZ + 0.1, ATRIUM.minX, ATRIUM.maxX, roofY));
  railings.push(rail("x", ATRIUM.maxZ - 0.1, ATRIUM.minX, ATRIUM.maxX, roofY));
  railings.push(rail("z", ATRIUM.minX + 0.1, ATRIUM.minZ, ATRIUM.maxZ, roofY));
  railings.push(rail("z", ATRIUM.maxX - 0.1, ATRIUM.minZ, ATRIUM.maxZ, roofY));
  const rooftop: RooftopCafe = {
    y: roofY,
    tables: [
      { x: -9.2, z: 21, umbrella: true },
      { x: -9.2, z: 27, umbrella: false },
      { x: -9.2, z: 33, umbrella: true },
      { x: 9.4, z: 23.5, umbrella: true },
      { x: 9.4, z: 29.5, umbrella: false },
      { x: -4, z: 35.6, umbrella: true },
      { x: 4, z: 35.6, umbrella: true },
    ],
    counter: { minX: -10.8, maxX: -4.6, minZ: 14.6, maxZ: 15.5, minY: roofY, maxY: roofY + 1.05 },
    planters: [
      { x: -11.2, z: 37.2 },
      { x: 11.2, z: 37.2 },
      { x: -11.2, z: 17.4 },
      { x: 0, z: 14.8 },
      { x: 11.2, z: 33.6 },
    ],
    loungers: [
      { x: -8.2, z: 37 },
      { x: 8.2, z: 37 },
    ],
    dome: { x: 0, z: 26, radius: 6.3 },
  };

  // ── Lift (every floor, up to the rooftop) ──
  const liftShaft: Box3Data = { ...LIFT_SHAFT, minY: 0, maxY: roofY + 3 };
  for (let k = 0; k <= topFloor; k++) {
    const y = k * FLOOR_HEIGHT;
    liftStops.push({ floor: k, label: floorLabel(k), rooftop: false, x: 7.8, y, z: 15.6, facing: -Math.PI / 2, panel: { x: 7.8, y: y + 1.4, z: LIFT_SHAFT.minZ - 0.05 } });
  }
  liftStops.push({ floor: topFloor + 1, label: "Rooftop Café", rooftop: true, x: 7.8, y: roofY, z: 15.6, facing: Math.PI, panel: { x: 7.8, y: roofY + 1.4, z: LIFT_SHAFT.minZ - 0.05 } });

  // ── Memory Halls ──
  for (const h of halls) {
    const e = h.floor * FLOOR_HEIGHT;
    const x0 = HALL.x0 + h.col * HALL.width;
    const z0 = HALL.rowZ[h.row]!;
    const id = hallAreaId(h);
    areas.push({
      id,
      name: hallName(h),
      subtitle: floorLabel(h.floor),
      bounds: { minX: x0, maxX: x0 + HALL.width, minZ: z0, maxZ: z0 + HALL.depth },
      indoor: true,
      elevation: e,
    });
    floors.push({ area: id, rect: { minX: x0 + (h.col === 0 ? H : 0), maxX: x0 + HALL.width, minZ: z0, maxZ: z0 + HALL.depth }, material: "wood", y: e });
    if (h.floor > 0) ceilings.push({ area: id, rect: { minX: x0, maxX: x0 + HALL.width, minZ: z0, maxZ: z0 + HALL.depth }, height: e - 0.4, thickness: 0.4, skylights: [] });
    const roofTop = !isOpen(h.floor + 1, h.row, h.col);
    ceilings.push({
      area: id,
      rect: { minX: x0, maxX: x0 + HALL.width, minZ: z0, maxZ: z0 + HALL.depth },
      height: e + HALL.ceiling,
      thickness: 0.35,
      skylights: roofTop ? [{ minX: x0 + 6, maxX: x0 + 14, minZ: z0 + 4, maxZ: z0 + 10 }] : [],
    });
    walls.push(wall(`${id}-partition`, id, "x", z0 + 7, x0 + 4, x0 + 16, e, 3.2, []));
    walls[walls.length - 1]!.thickness = 0.3;
    hallShells.push({ floor: h.floor, box: { minX: x0, maxX: x0 + HALL.width, minZ: z0, maxZ: z0 + HALL.depth, minY: e, maxY: e + FLOOR_HEIGHT } });
  }

  // Grid walls between/around open halls, per floor.
  const floorsWithHalls = [...new Set(halls.map((h) => h.floor))];
  for (const f of floorsWithHalls) {
    const e = f * FLOOR_HEIGHT;
    const clerestory = (start: number, end: number): WallOpening => ({ kind: "window", start, end, bottom: 1.2, top: 4.2 });
    for (let c = 0; c < HALL.cols; c++) {
      const x0 = HALL.x0 + c * HALL.width;
      const ownerOf = (r: number) => `hall-${f}-${c * 2 + r + 1}` as const;
      const north = isOpen(f, 0, c);
      const south = isOpen(f, 1, c);
      if (north) walls.push(wall(`hw-${f}-${c}-z14`, ownerOf(0), "x", 14, x0 + H, x0 + HALL.width - H, e, FLOOR_HEIGHT, [clerestory(x0 + 8, x0 + 12)], true));
      if (north || south) {
        const openings = north && south ? [{ kind: "door" as const, start: x0 + 8, end: x0 + 12, bottom: 0, top: 3.6 }] : [clerestory(x0 + 8, x0 + 12)];
        walls.push(wall(`hw-${f}-${c}-z28`, ownerOf(north ? 0 : 1), "x", 28, x0 + H, x0 + HALL.width - H, e, FLOOR_HEIGHT, openings, !(north && south)));
      }
      if (south) walls.push(wall(`hw-${f}-${c}-z42`, ownerOf(1), "x", 42, x0 + H, x0 + HALL.width - H, e, FLOOR_HEIGHT, [clerestory(x0 + 8, x0 + 12)], true));
    }
    for (let r = 0; r < HALL.rowZ.length; r++) {
      const z0 = HALL.rowZ[r]!;
      for (let c = 1; c <= HALL.cols; c++) {
        const left = isOpen(f, r, c - 1);
        const right = c < HALL.cols && isOpen(f, r, c);
        if (!left && !right) continue;
        const x = HALL.x0 + c * HALL.width;
        const both = left && right;
        const opening: WallOpening = both ? { kind: "door", start: z0 + 5, end: z0 + 9, bottom: 0, top: 3.6 } : clerestory(z0 + 5, z0 + 9);
        walls.push(wall(`hw-${f}-${r}-x${c}`, `hall-${f}-${(left ? c - 1 : c) * 2 + r + 1}`, "z", x, z0 - H, z0 + HALL.depth + H, e, FLOOR_HEIGHT, [opening], !both));
      }
    }
  }

  // Frames in fill order: floor by floor, balcony before halls (chronological storeys).
  for (let f = 0; f <= topFloor; f++) {
    const b = plan.balconies.find((x) => x.floor === f);
    if (b) placements.push(...balconyFrames(f, b.frames));
    for (const h of halls) if (h.floor === f) placements.push(...hallFrames(h));
  }

  // Runners: from the portico / lift / stairs to the hall doors on every floor with halls.
  const runners: Box3Data[] = [];
  const carpet = (minX: number, maxX: number, minZ: number, maxZ: number, y: number): Box3Data => ({ minX, maxX, minZ, maxZ, minY: y + 0.004, maxY: y + 0.03 });
  for (let f = 0; f <= topFloor; f++) {
    if (!halls.some((h) => h.floor === f)) continue;
    const y = f * FLOOR_HEIGHT;
    if (f === 0) {
      runners.push(carpet(-1.6, 9.7, 36.0, 37.4, y));
      runners.push(carpet(9.7, 11.2, 17.2, 37.4, y));
    } else {
      runners.push(carpet(6.4, 9.7, 15.0, 16.4, y));
      runners.push(carpet(9.7, 11.2, 15.0, 37.2, y));
      if (f === 1) runners.push(carpet(-9.0, 9.7, 35.8, 37.2, y));
    }
  }

  const maxCol = Math.max(0, ...halls.map((h) => h.col));
  return {
    halls,
    topFloor,
    atriumHeight,
    walls,
    ceilings,
    floors,
    areas,
    placements,
    stairs,
    platforms,
    railings,
    liftShaft,
    liftStops,
    hallShells,
    rooftop,
    lecterns,
    runners,
    maxX: halls.length ? HALL.x0 + (maxCol + 1) * HALL.width + 1 : ATRIUM.maxX + 1,
  };
}

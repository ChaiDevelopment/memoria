import { facingToNormal } from "@/lib/math";
import type { Interactable } from "@/systems/interaction/interactables";
import type { Facing, PhotoPlacement } from "@/types/memory";
import type { AreaDef, Box3Data, BoxCollider, Collider, CylinderCollider } from "@/types/world";
import type { PlayWorld } from "./playWorld";

/**
 * The wedding venue: one layout for both settings — an outdoor garden
 * (hedge walls, string lights, sunset) or an indoor ballroom (walls,
 * ceiling, chandeliers). Guests enter under a flower arch, walk the aisle
 * between the chairs to the pelaminan (the couple's stage), with prewedding
 * photos along both sides. Pure data — unit tested.
 *
 *   north (-z)  ── pelaminan ──
 *               chairs | aisle | chairs        photo panels on both sides
 *   south (+z)  ── flower arch · info board · envelope · spawn ──
 */

export type WeddingSetting = "outdoor" | "indoor";

export const VENUE = {
  minX: -16,
  maxX: 16,
  minZ: -21,
  maxZ: 27,
  /** Hedge (outdoor) / wall (indoor) height. */
  wallHeight: { outdoor: 2.8, indoor: 7 },
  ceiling: 7,
  aisleHalfWidth: 1.2,
} as const;

export const STAGE = { minX: -6, maxX: 6, minZ: -19.6, maxZ: -14.4, height: 0.3 } as const;
export const ARCH = { z: 17, halfWidth: 2.2, height: 3.6 } as const;
export const THRONES = [-0.95, 0.95].map((x) => ({ x, z: -17.6 }));
export const INFO_BOARD = { x: -5.2, z: 21.5, facing: "+x" as Facing, width: 1.6 };
export const ENVELOPE_BOX = { x: 5.2, z: 21.5, facing: "-x" as Facing };
export const WISHES_WALL = { x: -11.7, z: -13.2, facing: "+z" as Facing, width: 4.6, height: 2.6 };
/** Rows of guest chairs: z of each row, chairs from |x| = 1.7 to 7. */
export const CHAIR_ROWS = [-9.5, -7.9, -6.3, -4.7, -3.1, -1.5, 0.1, 1.7];
export const CHAIR_SPAN = { inner: 1.7, outer: 7 } as const;
/** String-light poles (outdoor) / chandeliers (indoor) run along these lines. */
export const LIGHT_POLES = [-12, -4, 4, 12].flatMap((z) => [-8.5, 8.5].map((x) => ({ x, z })));
/** Flower stands lining the aisle where there are no chairs. */
export const AISLE_FLOWERS = [-12.2, 4, 7.5, 11, 14.5].flatMap((z) => [-1.6, 1.6].map((x) => ({ x, z })));
export const SPAWN_WEDDING = { x: 0, y: 0, z: 24, facing: Math.PI } as const;

/**
 * Garden Sunset (outdoor): a wooden pergola over the deck instead of a solid
 * backdrop, trees inside the hedges, a fountain and benches by the entrance,
 * lanterns along the aisle and natural wooden chairs in rows.
 */
export const GARDEN = {
  pergolaPosts: [-4.3, 4.3].flatMap((x) => [-15.1, -19.1].map((z) => ({ x, z }))),
  pergolaHeight: 3.9,
  trees: [
    { x: -13.3, z: -17.6, s: 1.25 },
    { x: 13.3, z: -17.6, s: 1.15 },
    { x: -13.5, z: 18.8, s: 1.05 },
    { x: 13.4, z: 25.0, s: 1.1 },
  ],
  fountain: { x: -10.2, z: 23.6, radius: 1.5 },
  /** "Welcome to our Wedding" easel by the entrance (faces arriving guests). */
  welcomeSign: { x: -7.4, z: 18.6 },
  benches: [
    { x: 10.6, z: 22.6 },
    { x: 10.6, z: 25.3 },
  ],
  lanterns: [15.7, 12.9, 9.3, 5.7, 2.6, -11.0, -13.4].flatMap((z) => [-1.35, 1.35].map((x) => ({ x, z }))),
} as const;

/**
 * Grand Ballroom (indoor): a two-level stage, classical pillars along the
 * walls and beside the stage, round banquet tables instead of rows, and
 * crystal chandeliers.
 */
export const BALLROOM = {
  /** The modelled stage (stage-ballroom.glb): a 0,25 m step across the front, the 0,5 m platform behind. */
  stage: [
    { minX: -8, maxX: 8, minZ: -19.9, maxZ: -12.4, top: 0.25 },
    { minX: -8, maxX: 8, minZ: -19.9, maxZ: -15.8, top: 0.5 },
  ],
  /** Where stage-ballroom.glb sits (its backdrop at the back wall). */
  stageAt: { x: 0, z: -16.34 },
  /** The couple's sofa on the platform (sofa-wedding.glb). */
  sofa: { x: 0, z: -17.7 },
  /** ballroom-shell.glb is centred on the venue: x 0, z 3. */
  shellAt: { x: 0, z: 3 },
  /** Centres of the tall arched windows on each long wall (curtains hang here). */
  windows: [-15, -3, 9, 21],
  /** The blank wall bays between the windows (photo frames hang here). */
  photoBays: [-9, 3, 15],
  wallPillars: [] as { x: number; z: number; r: number }[],
  stagePillars: [] as { x: number; z: number; r: number }[],
  tables: [-9.2, -4.6, 0, 4.6, 9.2].flatMap((z) => [-4.6, 4.6].map((x) => ({ x, z }))),
  tableRadius: 0.9,
  /** Chairs sit on this ring around each table (table-round-set.glb); the collider covers it. */
  chairRing: 1.3,
  /** Under the ceiling medallions of ballroom-shell.glb. */
  chandeliers: [
    { x: 0, z: 1, big: true },
    { x: -8, z: 17, big: false },
    { x: 8, z: 17, big: false },
    { x: -8, z: 5, big: false },
    { x: 8, z: 5, big: false },
    { x: -8, z: -7, big: false },
    { x: 8, z: -7, big: false },
    { x: 0, z: 17, big: false },
  ],
} as const;

/** Where the thrones stand (top of the stage they're on). */
export function stageTop(setting: WeddingSetting): number {
  return setting === "indoor" ? BALLROOM.stage[1].top : STAGE.height;
}

/**
 * Somewhere to sit. The player stands at `exit` to use it (the interactable
 * faces that way), sits facing `facing` (radians, 0 = +Z) and stands up at
 * `exit` again. `y` is the floor under the seat (the stage for the thrones).
 */
export interface Seat {
  id: string;
  x: number;
  z: number;
  y: number;
  facing: number;
  exit: { x: number; z: number };
  /** The thrones: only the bride and groom may sit there. */
  coupleOnly?: boolean;
}

export interface WeddingWorld extends PlayWorld {
  setting: WeddingSetting;
  seats: Seat[];
}

/** X positions of the chairs in one half-row (garden rows; rendering and seats share them). */
export function rowChairXs(): number[] {
  const xs: number[] = [];
  for (let x = CHAIR_SPAN.inner + 0.32; x <= CHAIR_SPAN.outer - 0.25; x += 0.66) xs.push(Math.round(x * 100) / 100);
  return xs;
}

/** The eight chairs around a banquet table (as in table-round-set.glb): position and the angle they sit at. */
export function tableChairs(t: { x: number; z: number }, ring: number): { x: number; z: number; angle: number }[] {
  return Array.from({ length: 8 }, (_, i) => {
    const angle = -(i / 8) * Math.PI * 2;
    return { x: t.x + Math.cos(angle) * ring, z: t.z + Math.sin(angle) * ring, angle };
  });
}

/** Every seat in the venue: garden rows and benches, or ballroom tables — plus the thrones. */
export function weddingSeats(setting: WeddingSetting): Seat[] {
  const seats: Seat[] = [];
  const top = stageTop(setting);
  // The couple's seats: two thrones in the garden, the sofa in the ballroom.
  const couple = setting === "indoor" ? [-0.48, 0.48].map((dx) => ({ x: BALLROOM.sofa.x + dx, z: BALLROOM.sofa.z })) : THRONES;
  couple.forEach((t, i) => seats.push({ id: `throne-${i}`, x: t.x, z: t.z + 0.02, y: top, facing: 0, exit: { x: t.x, z: t.z + 0.85 }, coupleOnly: true }));
  if (setting === "outdoor") {
    // Rows face the pelaminan (-z); step in from the gap in front of the row.
    CHAIR_ROWS.forEach((z, r) => {
      for (const s of [-1, 1]) rowChairXs().forEach((x, c) => seats.push({ id: `chair-${r}-${s > 0 ? "e" : "w"}${c}`, x: s * x, z: z + 0.02, y: 0, facing: Math.PI, exit: { x: s * x, z: z - 0.62 } }));
    });
    GARDEN.benches.forEach((b, i) => {
      const facing = i === 0 ? 0 : Math.PI;
      const dz = Math.cos(facing);
      for (const dx of [-0.45, 0.45]) seats.push({ id: `bench-${i}-${dx > 0 ? "r" : "l"}`, x: b.x + dx, z: b.z - dz * 0.02, y: 0, facing, exit: { x: b.x + dx, z: b.z + dz * 0.75 } });
    });
  } else {
    // Banquet chairs face their table; step in from behind the chair (outside the table's ring).
    BALLROOM.tables.forEach((t, ti) => {
      for (const [ci, c] of tableChairs(t, BALLROOM.chairRing).entries()) {
        const ox = Math.cos(c.angle);
        const oz = Math.sin(c.angle);
        seats.push({ id: `table-${ti}-${ci}`, x: c.x + ox * 0.04, z: c.z + oz * 0.04, y: 0, facing: Math.atan2(-ox, -oz), exit: { x: t.x + ox * (BALLROOM.chairRing + 0.65), z: t.z + oz * (BALLROOM.chairRing + 0.65) } });
      }
    });
  }
  return seats;
}

const box = (b: Box3Data, blocksCamera: boolean): BoxCollider => ({ kind: "box", blocksCamera, ...b });
const cylinder = (x: number, z: number, radius: number, minY: number, maxY: number): CylinderCollider => ({ kind: "cylinder", x, z, radius, minY, maxY, blocksCamera: false });

/** Every photo frame in the venue, in fill order (best spots first). */
export function weddingPlacements(setting: WeddingSetting): PhotoPlacement[] {
  const out: PhotoPlacement[] = [];
  let n = 0;
  const id = () => `wp${String(++n).padStart(2, "0")}`;
  // Two hero portraits flanking the flower arch, facing the arriving guests.
  for (const x of [-3.7, 3.7]) out.push({ memoryId: id(), x, y: 1.35, z: ARCH.z + 0.6, facing: "+z", height: 1.15, frame: "gold", mount: "easel", aspect: 0.75 });
  // Freestanding photo panels along both sides of the chairs.
  for (let i = 0; i < 11; i++) {
    const z = -10 + i * 2.4;
    const aspect = i % 2 === 0 ? 1.5 : 0.8;
    out.push({ memoryId: id(), x: -11, y: 1.3, z, facing: "+x", height: 0.95, frame: "white", mount: "easel", aspect });
    out.push({ memoryId: id(), x: 11, y: 1.3, z, facing: "-x", height: 0.95, frame: "white", mount: "easel", aspect });
  }
  // Frames on the garden hedges, or the ballroom's blank wall bays (the rest of its walls are windows).
  const wallX = VENUE.maxX - 0.18;
  if (setting === "indoor") {
    for (const z of BALLROOM.photoBays) {
      out.push({ memoryId: id(), x: -wallX, y: 3.0, z, facing: "+x", height: 1.9, frame: "gold", mount: "wall", aspect: 1.4 });
      out.push({ memoryId: id(), x: wallX, y: 3.0, z, facing: "-x", height: 1.9, frame: "gold", mount: "wall", aspect: 1.4 });
    }
    return out;
  }
  for (let i = 0; i < 16; i++) {
    const z = -17 + i * 2.6;
    out.push({ memoryId: id(), x: -wallX, y: 1.75, z, facing: "+x", height: 1.05, frame: "gold", mount: "wall", aspect: 1.4 });
    out.push({ memoryId: id(), x: wallX, y: 1.75, z, facing: "-x", height: 1.05, frame: "gold", mount: "wall", aspect: 1.4 });
  }
  return out;
}

export const WEDDING_AREAS: AreaDef[] = [
  { id: "w-stage", name: "Pelaminan", subtitle: "Tempat kedua mempelai", bounds: { minX: -16, maxX: 16, minZ: -21, maxZ: -11 }, indoor: false },
  { id: "w-entrance", name: "Gerbang Bahagia", subtitle: "Selamat datang", bounds: { minX: -16, maxX: 16, minZ: 16, maxZ: 27 }, indoor: false },
  { id: "w-gallery", name: "Galeri Prewedding", subtitle: "Perjalanan kami", bounds: { minX: -16, maxX: -9, minZ: -11, maxZ: 16 }, indoor: false },
  { id: "w-gallery", name: "Galeri Prewedding", subtitle: "Perjalanan kami", bounds: { minX: 9, maxX: 16, minZ: -11, maxZ: 16 }, indoor: false },
  { id: "w-hall", name: "Area Tamu", subtitle: "Silakan duduk", bounds: { minX: -9, maxX: 9, minZ: -11, maxZ: 16 }, indoor: false },
];

/** Frames only for the photos there are (the two hero frames always stand). */
export function framesFor(photoCount: number, setting: WeddingSetting): PhotoPlacement[] {
  const all = weddingPlacements(setting);
  return all.slice(0, Math.max(2, Math.min(all.length, photoCount)));
}

export const MAX_WEDDING_FRAMES = weddingPlacements("outdoor").length;

export function buildWeddingWorld(setting: WeddingSetting, photoCount = 0): WeddingWorld {
  const colliders: Collider[] = [];
  const wallH = VENUE.wallHeight[setting];
  const t = 0.4;
  // Perimeter: hedges or walls on all four sides.
  colliders.push(box({ minX: VENUE.minX - t, maxX: VENUE.minX, minY: 0, maxY: wallH, minZ: VENUE.minZ, maxZ: VENUE.maxZ }, true));
  colliders.push(box({ minX: VENUE.maxX, maxX: VENUE.maxX + t, minY: 0, maxY: wallH, minZ: VENUE.minZ, maxZ: VENUE.maxZ }, true));
  colliders.push(box({ minX: VENUE.minX - t, maxX: VENUE.maxX + t, minY: 0, maxY: wallH, minZ: VENUE.minZ - t, maxZ: VENUE.minZ }, true));
  colliders.push(box({ minX: VENUE.minX - t, maxX: VENUE.maxX + t, minY: 0, maxY: wallH, minZ: VENUE.maxZ, maxZ: VENUE.maxZ + t }, true));
  if (setting === "indoor") colliders.push(box({ minX: VENUE.minX - t, maxX: VENUE.maxX + t, minY: VENUE.ceiling, maxY: VENUE.ceiling + 0.3, minZ: VENUE.minZ - t, maxZ: VENUE.maxZ + t }, true));

  // Flower arch posts and the aisle's flower stands (both venues).
  // The flower arch stands in the garden only.
  if (setting === "outdoor") for (const s of [-1, 1]) colliders.push(cylinder(s * ARCH.halfWidth, ARCH.z, 0.28, 0, ARCH.height));
  for (const f of AISLE_FLOWERS) colliders.push(cylinder(f.x, f.z, 0.22, 0, 1.3));
  const top = stageTop(setting);
  if (setting === "indoor") {
    const s = BALLROOM.sofa;
    colliders.push(box({ minX: s.x - 1.0, maxX: s.x + 1.0, minY: top, maxY: top + 0.6, minZ: s.z - 0.42, maxZ: s.z + 0.38 }, false));
  } else {
    for (const th of THRONES) colliders.push(box({ minX: th.x - 0.42, maxX: th.x + 0.42, minY: top, maxY: top + 0.6, minZ: th.z - 0.4, maxZ: th.z + 0.4 }, false));
  }

  if (setting === "outdoor") {
    // Wooden deck (one step up) under an open pergola — no solid backdrop.
    colliders.push(box({ minX: STAGE.minX, maxX: STAGE.maxX, minY: 0, maxY: STAGE.height, minZ: STAGE.minZ, maxZ: STAGE.maxZ }, false));
    for (const p of GARDEN.pergolaPosts) colliders.push({ ...cylinder(p.x, p.z, 0.17, STAGE.height, GARDEN.pergolaHeight), blocksCamera: true });
    // Natural wooden chairs in rows (gaps between rows stay walkable).
    for (const z of CHAIR_ROWS) {
      for (const s of [-1, 1]) {
        const [a, b] = [s * CHAIR_SPAN.inner, s * CHAIR_SPAN.outer];
        colliders.push(box({ minX: Math.min(a, b), maxX: Math.max(a, b), minY: 0, maxY: 0.95, minZ: z - 0.26, maxZ: z + 0.26 }, false));
      }
    }
    for (const p of LIGHT_POLES) colliders.push(cylinder(p.x, p.z, 0.12, 0, 3.6));
    for (const t of GARDEN.trees) colliders.push({ ...cylinder(t.x, t.z, 0.38 * t.s, 0, 6 * t.s), blocksCamera: true });
    const f = GARDEN.fountain;
    colliders.push(cylinder(f.x, f.z, f.radius, 0, 0.75));
    colliders.push({ ...cylinder(f.x, f.z, 0.4, 0, 2.3), blocksCamera: true });
    for (const b of GARDEN.benches) colliders.push(box({ minX: b.x - 0.95, maxX: b.x + 0.95, minY: 0, maxY: 0.85, minZ: b.z - 0.3, maxZ: b.z + 0.3 }, false));
    for (const l of GARDEN.lanterns) colliders.push(cylinder(l.x, l.z, 0.13, 0, 0.5));
    const w = GARDEN.welcomeSign;
    colliders.push(box({ minX: w.x - 0.65, maxX: w.x + 0.65, minY: 0, maxY: 1.6, minZ: w.z - 0.3, maxZ: w.z + 0.3 }, false));
  } else {
    // Two-level stage (each step 0.25 m, under the climbing limit) and its backdrop.
    for (const lv of BALLROOM.stage) colliders.push(box({ minX: lv.minX, maxX: lv.maxX, minY: 0, maxY: lv.top, minZ: lv.minZ, maxZ: lv.maxZ }, false));
    colliders.push(box({ minX: -8, maxX: 8, minY: 0, maxY: 6.2, minZ: -20.6, maxZ: -19.9 }, true));
    for (const p of [...BALLROOM.wallPillars, ...BALLROOM.stagePillars]) colliders.push({ ...cylinder(p.x, p.z, p.r, 0, VENUE.ceiling), blocksCamera: true });
    // Round banquet tables: one collider covers the table and its ring of chairs.
    for (const t of BALLROOM.tables) colliders.push(cylinder(t.x, t.z, BALLROOM.chairRing + 0.3, 0, 1.0));
  }

  const interactables: Interactable[] = [];
  const placements = framesFor(photoCount, setting);
  for (const p of placements) {
    const n = facingToNormal(p.facing);
    interactables.push({ id: `photo:${p.memoryId}`, kind: "photo", memoryId: p.memoryId, label: "Foto prewedding", x: p.x, y: p.y, z: p.z, normalX: n.x, normalZ: n.z });
    if (p.mount === "easel") {
      const halfW = (p.height * (p.aspect ?? 1)) / 2 + 0.1;
      const [hx, hz] = n.x !== 0 ? [0.3, halfW] : [halfW, 0.3];
      colliders.push(box({ minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz, minY: 0, maxY: 2 }, false));
    }
  }

  // Info board, envelope box and the wishes wall.
  {
    const b = INFO_BOARD;
    colliders.push(box({ minX: b.x - 0.2, maxX: b.x + 0.2, minY: 0, maxY: 2.2, minZ: b.z - b.width / 2, maxZ: b.z + b.width / 2 }, false));
    interactables.push({ id: "info", kind: "info", memoryId: "info", label: "Info Acara", x: b.x, y: 1.4, z: b.z, normalX: 1, normalZ: 0 });
  }
  {
    const e = ENVELOPE_BOX;
    colliders.push(box({ minX: e.x - 0.55, maxX: e.x + 0.55, minY: 0, maxY: 1.25, minZ: e.z - 0.55, maxZ: e.z + 0.55 }, false));
    interactables.push({ id: "envelope", kind: "envelope", memoryId: "envelope", label: "Amplop Digital", x: e.x, y: 1.1, z: e.z, normalX: -1, normalZ: 0 });
  }
  {
    const w = WISHES_WALL;
    colliders.push(box({ minX: w.x - w.width / 2, maxX: w.x + w.width / 2, minY: 0, maxY: w.height + 0.4, minZ: w.z - 0.25, maxZ: w.z + 0.05 }, true));
    interactables.push({ id: "guestbook", kind: "guestbook", memoryId: "guestbook", label: "Ucapan & Doa", x: w.x, y: 1.5, z: w.z, normalX: 0, normalZ: 1 });
  }

  // Seats: the interactable stands where the guest steps in, facing them.
  const seats = weddingSeats(setting);
  for (const s of seats) {
    const nx = s.exit.x - s.x;
    const nz = s.exit.z - s.z;
    const len = Math.hypot(nx, nz) || 1;
    interactables.push({ id: `seat:${s.id}`, kind: "seat", memoryId: s.id, label: s.coupleOnly ? "Kursi pengantin" : "Duduk", x: s.x, y: s.y + 0.75, z: s.z, normalX: nx / len, normalZ: nz / len });
  }

  return {
    setting,
    seats,
    colliders,
    cameraColliders: colliders.filter((c) => c.blocksCamera),
    interactables,
    areas: WEDDING_AREAS,
    placements,
    bounds: { minX: VENUE.minX - 2, maxX: VENUE.maxX + 2, minZ: VENUE.minZ - 2, maxZ: VENUE.maxZ + 2 },
    spawn: SPAWN_WEDDING,
  };
}

const cache = new Map<string, WeddingWorld>();
export function getWeddingWorld(setting: WeddingSetting, photoCount = 0): WeddingWorld {
  const frames = Math.max(2, Math.min(MAX_WEDDING_FRAMES, photoCount));
  const key = `${setting}:${frames}`;
  let w = cache.get(key);
  if (!w) cache.set(key, (w = buildWeddingWorld(setting, frames)));
  return w;
}

/** Frame slots for the client's photo assignment (same ids as the placements). */
export function weddingFrameSlots(setting: WeddingSetting, photoCount: number) {
  return framesFor(photoCount, setting).map((p) => ({ slotId: p.memoryId, aspect: p.aspect ?? 1, section: "gallery" as const }));
}

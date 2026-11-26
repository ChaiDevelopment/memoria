import type { BenchDef } from "@/config/decorLayout";
import type { PhotoPlacement } from "@/types/memory";
import type { AreaDef, CeilingDef, FloorDef, WallDef } from "@/types/world";
import { TIMELINE_HEIGHT, WALL_THICKNESS } from "./museumLayout";

/**
 * The Memory Wing: a chain of identical rooms beyond the Timeline Hall that
 * grows with the collection. The museum's 34 original frames are filled
 * first; every further 10 photos open another room. The rooms are pure
 * data — walls, floors, ceilings, frames and benches — so geometry and
 * collision are generated exactly like the rest of the building.
 *
 *   Timeline Hall │ Memory Room 1 │ Memory Room 2 │ …  (x = 41 → east)
 *                 door           door            window
 */

const T = WALL_THICKNESS;
const H = T / 2;

export const WING = {
  startX: 41,
  roomLength: 14,
  minZ: 1,
  maxZ: 13,
  height: TIMELINE_HEIGHT,
  framesPerRoom: 10,
  maxRooms: 12,
} as const;

export const MAX_WING_FRAMES = WING.maxRooms * WING.framesPerRoom;

export function wingRoomsFor(frames: number): number {
  return Math.min(WING.maxRooms, Math.ceil(Math.max(0, frames) / WING.framesPerRoom));
}

export interface WingLayout {
  rooms: number;
  walls: WallDef[];
  ceilings: CeilingDef[];
  floors: FloorDef[];
  areas: AreaDef[];
  placements: PhotoPlacement[];
  benches: BenchDef[];
  /** Easternmost x of the building (for the playable bounds). */
  maxX: number;
}

const LANDSCAPE = { aspect: 3 / 2, height: 1.1, y: 2.0 };
const PORTRAIT = { aspect: 2 / 3, height: 1.4, y: 2.1 };
const OFFSET = 0.23; // photo surface distance from the wall centreline

/** Frames of room `k` (0-based), in fill order: north ×3, south ×3, west ×2, east ×2. */
function roomFrames(k: number, x0: number): PhotoPlacement[] {
  const x1 = x0 + WING.roomLength;
  const id = (i: number) => `w${k + 1}-${i + 1}`;
  const frames: Omit<PhotoPlacement, "memoryId">[] = [];
  for (const dx of [3.5, 7, 10.5]) {
    frames.push({ x: x0 + dx, y: LANDSCAPE.y, z: WING.minZ + OFFSET, facing: "+z", height: LANDSCAPE.height, aspect: LANDSCAPE.aspect, frame: "oak", mount: "wall" });
  }
  for (const dx of [3.5, 7, 10.5]) {
    frames.push({ x: x0 + dx, y: LANDSCAPE.y, z: WING.maxZ - OFFSET, facing: "-z", height: LANDSCAPE.height, aspect: LANDSCAPE.aspect, frame: "black", mount: "wall" });
  }
  for (const z of [3, 11]) {
    frames.push({ x: x0 + OFFSET, y: PORTRAIT.y, z, facing: "+x", height: PORTRAIT.height, aspect: PORTRAIT.aspect, frame: "gold", mount: "wall" });
  }
  for (const z of [3, 11]) {
    frames.push({ x: x1 - OFFSET, y: PORTRAIT.y, z, facing: "-x", height: PORTRAIT.height, aspect: PORTRAIT.aspect, frame: "gold", mount: "wall" });
  }
  return frames.map((f, i) => ({ ...f, memoryId: id(i) }));
}

/**
 * Layout for a wing holding `frames` photos (rooms = ceil(frames / 10),
 * capped). Only frames that will hold a photo are created, so the last room
 * may be partly empty — it never shows blank frames.
 */
export function buildWingLayout(frames: number): WingLayout {
  const rooms = wingRoomsFor(frames);
  const total = Math.min(frames, rooms * WING.framesPerRoom);
  const layout: WingLayout = { rooms, walls: [], ceilings: [], floors: [], areas: [], placements: [], benches: [], maxX: WING.startX };
  if (rooms === 0) return layout;

  for (let k = 0; k < rooms; k++) {
    const x0 = WING.startX + k * WING.roomLength;
    const x1 = x0 + WING.roomLength;
    const area = `room-${k + 1}` as const;
    layout.areas.push({
      id: area,
      name: `Memory Room ${k + 1}`,
      subtitle: k === 0 ? "The collection keeps growing" : "More moments",
      bounds: { minX: x0, maxX: x1, minZ: WING.minZ, maxZ: WING.maxZ },
      indoor: true,
    });
    // Long walls between the dividing walls.
    for (const [side, z] of [
      ["north", WING.minZ],
      ["south", WING.maxZ],
    ] as const) {
      layout.walls.push({ id: `wing-${k + 1}-${side}`, area, axis: "x", at: z, from: x0 + H, to: x1 - H, height: WING.height, thickness: T, exterior: true, openings: [] });
    }
    layout.ceilings.push({
      area,
      rect: { minX: x0 + H, maxX: x1 + H, minZ: WING.minZ - H, maxZ: WING.maxZ + H },
      height: WING.height,
      thickness: 0.35,
      skylights: [{ minX: x0 + 4.5, maxX: x1 - 4.5, minZ: 5, maxZ: 9 }],
    });
    layout.floors.push({ area, rect: { minX: x0 + H, maxX: x1 + H, minZ: WING.minZ - H, maxZ: WING.maxZ + H }, material: "wood" });
    layout.benches.push({ x: x0 + WING.roomLength / 2, z: (WING.minZ + WING.maxZ) / 2, along: "x", length: 2.2 });
    layout.placements.push(...roomFrames(k, x0));
  }

  // Dividing walls: the doorway from the Timeline Hall, the doors between
  // rooms, and a window at the far end.
  for (let k = 0; k <= rooms; k++) {
    const x = WING.startX + k * WING.roomLength;
    const last = k === rooms;
    layout.walls.push({
      id: `wing-divider-${k}`,
      area: `room-${Math.min(k + 1, rooms)}`,
      axis: "z",
      at: x,
      from: WING.minZ - H,
      to: WING.maxZ + H,
      height: WING.height,
      thickness: T,
      exterior: last,
      openings: [last ? { kind: "window", start: 5, end: 9, bottom: 0.6, top: 4.2 } : { kind: "door", start: 5, end: 9, bottom: 0, top: 3.6 }],
    });
  }

  layout.placements = layout.placements.slice(0, total);
  layout.maxX = WING.startX + rooms * WING.roomLength;
  return layout;
}

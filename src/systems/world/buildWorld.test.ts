import { describe, expect, it } from "vitest";
import { PLAYER } from "@/config/gameConfig";
import { BALCONY_FRAMES, FLOOR_HEIGHT, HALLS_PER_FLOOR, HALL, MAX_HALL_FLOORS, MAX_HALL_FRAMES, planGrand, planHalls } from "@/config/grandMuseum";
import { AREAS, SPAWN } from "@/config/museumLayout";
import { isBlocked } from "@/systems/movement/collision";
import { createMotorState, stepMotor, type MotorState } from "@/systems/movement/characterMotor";
import { findInteractable } from "@/systems/interaction/interactables";
import type { AreaId, Collider } from "@/types/world";
import { areaAt } from "./areas";
import { buildWorld, type WorldData } from "./buildWorld";
import { validateWall } from "./wallBuilder";

const STEP = 0.25;

/** Is there something to stand on at height y (the ground, or the top of a collider)? */
function supported(x: number, z: number, y: number, colliders: readonly Collider[]): boolean {
  if (Math.abs(y) < 1e-6) return true;
  return colliders.some((c) => c.kind === "box" && Math.abs(c.maxY - y) < 0.05 && x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ);
}

/** Grid flood fill of every spot the player can stand on at height y, starting at (x, z). */
function floodFill(world: WorldData, start: { x: number; y: number; z: number }) {
  const b = { minX: -46, maxX: world.bounds.maxX + 2, minZ: -32, maxZ: 54 };
  const cols = Math.round((b.maxX - b.minX) / STEP) + 1;
  const rows = Math.round((b.maxZ - b.minZ) / STEP) + 1;
  const visited = new Uint8Array(cols * rows);
  const idx = (c: number, r: number) => r * cols + c;
  const toWorld = (c: number, r: number) => ({ x: b.minX + c * STEP, y: start.y, z: b.minZ + r * STEP });
  const startC = Math.round((start.x - b.minX) / STEP);
  const startR = Math.round((start.z - b.minZ) / STEP);
  const queue: number[] = [startC, startR];
  visited[idx(startC, startR)] = 2;
  while (queue.length) {
    const r = queue.pop()!;
    const c = queue.pop()!;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || visited[idx(nc, nr)]) continue;
      visited[idx(nc, nr)] = 1;
      const p = toWorld(nc, nr);
      if (isBlocked(p, PLAYER, world.colliders) || !supported(p.x, p.z, p.y, world.colliders)) continue;
      visited[idx(nc, nr)] = 2;
      queue.push(nc, nr);
    }
  }
  return (x: number, z: number) => {
    const c = Math.round((x - b.minX) / STEP);
    const r = Math.round((z - b.minZ) / STEP);
    return c >= 0 && r >= 0 && c < cols && r < rows && visited[idx(c, r)] === 2;
  };
}

function walk(world: WorldData, state: MotorState, moveX: number, moveZ: number, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) stepMotor(state, { moveX, moveZ, run: false, jump: false }, 1 / 60, world.colliders);
}

function viewable(reachable: (x: number, z: number) => boolean, it: { x: number; z: number; normalX: number; normalZ: number }) {
  const x = it.x + it.normalX * 1.4;
  const z = it.z + it.normalZ * 1.4;
  for (let dx = -1; dx <= 1; dx += 0.25) for (let dz = -1; dz <= 1; dz += 0.25) if (reachable(x + dx, z + dz)) return true;
  return false;
}

describe("museum world (small collection)", () => {
  const world = buildWorld();
  const reachable = floodFill(world, SPAWN);

  it("spawns the visitor in free space in the Entrance Court", () => {
    expect(isBlocked(SPAWN, PLAYER, world.colliders)).toBe(false);
    expect(areaAt(SPAWN.x, SPAWN.z, world.areas)?.id).toBe("entrance");
  });

  it("connects every ground-floor area by walkable paths", () => {
    const probes: Partial<Record<AreaId, [number, number]>> = {
      lobby: [0, 11],
      gallery: [-9, -5],
      timeline: [36, 7],
      garden: [-35, -20],
      atrium: [-6, 20],
      entrance: [6, 44],
    };
    for (const id of [...AREAS.map((a) => a.id), "atrium", "entrance"] as AreaId[]) {
      const [x, z] = probes[id]!;
      expect(areaAt(x, z, world.areas)?.id).toBe(id);
      expect(reachable(x, z), `${id} should be reachable from spawn`).toBe(true);
    }
  });

  it("keeps the player inside the building and grounds (sealed envelope)", () => {
    const outside: [number, number][] = [
      [0, 52], // beyond the entrance court hedge
      [25, 13], // south of Timeline Hall (no halls yet)
      [25, 0], // north of Timeline Hall
      [20, -12], // east of the gallery
      [0, -27], // north of the gallery
      [-44, 0], // beyond the west hedge
      [-25, 20], // beyond the south hedge
      [-14, 30], // west of the atrium
      [16, 46], // east of the entrance court
    ];
    for (const [x, z] of outside) expect(reachable(x, z), `(${x}, ${z}) must not be reachable`).toBe(false);
  });

  it("lets the player stand in front of every ground-floor photograph", () => {
    for (const it of world.interactables.filter((i) => i.kind === "photo")) expect(viewable(reachable, it), `viewing spot for ${it.memoryId}`).toBe(true);
  });

  it("walks from the lobby into the gallery through the doorway", () => {
    const state = createMotorState(0, 0, 3, Math.PI);
    walk(world, state, 0, -1, 4);
    expect(areaAt(state.position.x, state.position.z, world.areas)?.id).toBe("gallery");
  });

  it("walks from the entrance court through the atrium into the lobby", () => {
    const s2 = createMotorState(0, 0, 44, Math.PI);
    walk(world, s2, 0, -1, 3);
    expect(s2.position.z).toBeLessThan(38);
    const s3 = createMotorState(-4, 0, 22, Math.PI);
    walk(world, s3, 0.6, -1, 4);
    expect(areaAt(s3.position.x, s3.position.z, world.areas)?.id).toBe("lobby");
  });

  it("is stopped by the gallery's east wall", () => {
    const state = createMotorState(8, 0, -5, Math.PI / 2);
    walk(world, state, 1, 0, 4);
    expect(state.position.x).toBeLessThanOrEqual(12 - 0.2 - PLAYER.radius + 1e-6);
  });

  it("cannot jump over garden hedges", () => {
    const state = createMotorState(-40, 0, 0, -Math.PI / 2);
    for (let i = 0; i < 240; i++) stepMotor(state, { moveX: -1, moveZ: 0, run: true, jump: i % 20 === 0 }, 1 / 60, world.colliders);
    expect(state.position.x).toBeGreaterThan(-41.4);
  });

  it("climbs the imperial staircase to the Floor 1 balcony", () => {
    const s = createMotorState(0, 0, 33, Math.PI);
    walk(world, s, 0, -1, 4); // centre flight → landing
    expect(s.position.y).toBeCloseTo(3, 1);
    walk(world, s, 1, 0, 2.5); // across the landing to the east return flight
    walk(world, s, 0, 1, 4); // up the return flight onto the connector
    expect(s.position.y).toBeCloseTo(FLOOR_HEIGHT, 1);
    walk(world, s, 1, 0, 1.5); // onto the balcony ring
    expect(areaAt(s.position.x, s.position.z, world.areas, s.position.y)?.id).toBe("balcony-1");
  });

  it("can't fall into the atrium void from the balcony", () => {
    const s = createMotorState(-10.5, FLOOR_HEIGHT, 25, Math.PI / 2);
    walk(world, s, 1, 0, 3);
    expect(s.position.y).toBeCloseTo(FLOOR_HEIGHT, 1);
  });

  it("has a lift call panel on every floor", () => {
    const lifts = world.interactables.filter((i) => i.kind === "lift");
    expect(lifts).toHaveLength(world.grand.topFloor + 2); // every floor + the rooftop
    for (const stop of world.grand.liftStops) {
      expect(isBlocked(stop, PLAYER, world.colliders)).toBe(false);
      const it = findInteractable(stop.x, stop.z, 0, world.interactables, undefined, stop.y);
      expect(it?.kind).toBe("lift");
      expect(it?.memoryId).toBe(`lift-${stop.floor}`);
    }
  });

  it("only flags architecture as camera-blocking", () => {
    expect(world.cameraColliders.length).toBeGreaterThan(10);
    expect(world.cameraColliders.every((c) => c.kind === "box")).toBe(true);
  });
});

describe("grand museum capacity", () => {
  it("plans halls in fill order and never more than the maximum", () => {
    expect(planHalls(0)).toHaveLength(0);
    expect(planHalls(1)).toHaveLength(1);
    expect(planHalls(HALL.frames)).toHaveLength(1);
    expect(planHalls(HALL.frames + 1)).toHaveLength(2);
    const all = planHalls(10_000);
    expect(all.length).toBe(MAX_HALL_FLOORS * HALLS_PER_FLOOR);
    expect(all.length * HALL.frames + (MAX_HALL_FLOORS - 1) * BALCONY_FRAMES).toBe(MAX_HALL_FRAMES);
    expect(all[HALLS_PER_FLOOR]!.floor).toBe(1);
    expect(all.slice(0, 3).map((h) => [h.row, h.col])).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
    ]);
  });

  it("fills each upper balcony before that floor's halls", () => {
    const groundFull = HALLS_PER_FLOOR * HALL.frames;
    expect(planGrand(groundFull).balconies).toEqual([]);
    expect(planGrand(groundFull + 5)).toMatchObject({ balconies: [{ floor: 1, frames: 5 }] });
    expect(planGrand(groundFull + 5).halls).toHaveLength(HALLS_PER_FLOOR);
    const next = planGrand(groundFull + BALCONY_FRAMES + 1);
    expect(next.halls.at(-1)).toMatchObject({ floor: 1, index: 0, frames: 1 });
    // Placements come out in that order too (chronological storeys).
    const ids = buildWorld(groundFull + BALCONY_FRAMES + 1).placements.slice(34).map((p) => p.memoryId);
    expect(ids.indexOf("b1-1")).toBe(groundFull);
    expect(ids.at(-1)).toBe("h1-1-1");
  });

  it("holds 900 photos", () => {
    expect(34 + MAX_HALL_FRAMES).toBeGreaterThanOrEqual(900);
    expect(buildWorld(900 - 34).placements).toHaveLength(900);
  });

  for (const extra of [1, 27, 200, 900 - 34, MAX_HALL_FRAMES]) {
    describe(`with ${extra} extra photos`, () => {
      const world = buildWorld(extra);

      it("builds only valid walls and unique frame ids", () => {
        const ids = new Set(world.placements.map((p) => p.memoryId));
        expect(ids.size).toBe(world.placements.length);
        expect(world.placements.length).toBe(34 + extra);
      });

      it("lets the visitor reach every photograph on every floor", () => {
        const fills = world.grand.liftStops.map((stop) => (stop.floor === 0 ? floodFill(world, SPAWN) : floodFill(world, stop)));
        for (const it of world.interactables.filter((i) => i.kind === "photo")) {
          const floor = Math.max(0, Math.round((it.y - 2) / FLOOR_HEIGHT));
          expect(viewable(fills[floor]!, it), `viewing spot for ${it.memoryId} on floor ${floor}`).toBe(true);
        }
      });

      it("reaches each hall from the atrium and keeps the floor sealed", () => {
        for (const stop of world.grand.liftStops) {
          const reach = stop.floor === 0 ? floodFill(world, SPAWN) : floodFill(world, stop);
          for (const h of world.grand.halls.filter((x) => x.floor === stop.floor)) {
            const cx = HALL.x0 + h.col * HALL.width + 3;
            const cz = HALL.rowZ[h.row]! + 3;
            expect(reach(cx, cz), `hall ${h.floor}-${h.index}`).toBe(true);
            expect(areaAt(cx, cz, world.areas, stop.y)?.id).toBe(`hall-${h.floor}-${h.index + 1}`);
          }
          // Nothing past the last hall column.
          expect(reach(world.grand.maxX + 1, 21)).toBe(false);
        }
      });
    });
  }

  it("rejects no wall", () => {
    const world = buildWorld(MAX_HALL_FRAMES);
    expect(world.grand.walls.flatMap(validateWall)).toEqual([]);
  });
});

describe("rooftop café", () => {
  const world = buildWorld(500);
  const roof = world.grand.liftStops.at(-1)!;
  const reach = floodFill(world, roof);

  it("is served by the lift and enclosed by a parapet", () => {
    expect(roof.rooftop).toBe(true);
    expect(roof.y).toBeCloseTo(world.grand.rooftop.y);
    expect(areaAt(roof.x, roof.z, world.areas, roof.y)?.id).toBe("rooftop");
    // Walk around the dome to the far side of the deck…
    expect(reach(-10, 36)).toBe(true);
    expect(reach(10.5, 26)).toBe(true);
    // …but never over the edge or onto the dome.
    expect(reach(0, 26)).toBe(false);
    expect(reach(-13, 26)).toBe(false);
    expect(reach(0, 39)).toBe(false);
  });

  it("can't walk off the roof", () => {
    const s = createMotorState(0, roof.y, 36, 0);
    walk(world, s, 0, 1, 3);
    expect(s.position.y).toBeCloseTo(roof.y, 1);
    expect(s.position.z).toBeLessThan(38);
  });
});

describe("Album Kata lecterns", () => {
  const world = buildWorld(105, 9);

  it("can be reached and read on the balcony", () => {
    expect(world.grand.lecterns).toHaveLength(9);
    for (const l of world.grand.lecterns) {
      const stop = world.grand.liftStops[l.floor]!;
      const reach = floodFill(world, stop);
      const it = world.interactables.find((i) => i.id === `album:${l.index}`)!;
      const x = it.x + it.normalX * 0.9;
      const z = it.z + it.normalZ * 0.9;
      expect(reach(x, z), `reading spot for chapter ${l.index + 1}`).toBe(true);
      const facing = Math.atan2(-it.normalX, -it.normalZ);
      expect(findInteractable(x, z, facing, world.interactables, undefined, l.y)?.id).toBe(it.id);
    }
  });

  it("leaves both staircases and the lift free", () => {
    const s = createMotorState(0, 0, 33, Math.PI);
    walk(world, s, 0, -1, 4);
    walk(world, s, -1, 0, 2.5);
    walk(world, s, 0, 1, 4);
    expect(s.position.y).toBeCloseTo(FLOOR_HEIGHT, 1);
    walk(world, s, -1, 0, 1.5);
    expect(areaAt(s.position.x, s.position.z, world.areas, s.position.y)?.id).toBe("balcony-1");
  });
});

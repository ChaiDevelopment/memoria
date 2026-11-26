import { describe, expect, it } from "vitest";
import { PHOTO_PLACEMENTS } from "@/config/memories";
import { buildWingLayout, MAX_WING_FRAMES, WING, wingRoomsFor } from "@/config/memoryWing";
import { PLAYER } from "@/config/gameConfig";
import { SPAWN } from "@/config/museumLayout";
import { frameSlotsFor } from "@/hooks/useMuseumExhibits";
import { isBlocked } from "@/systems/movement/collision";
import { createMotorState, stepMotor } from "@/systems/movement/characterMotor";
import { areaAt } from "./areas";
import { buildWorld } from "./buildWorld";
import { validateWall } from "./wallBuilder";

/** Flood fill of standable positions from spawn (0.25 m grid) over the given bounds. */
function reachableIn(world: ReturnType<typeof buildWorld>) {
  const STEP = 0.25;
  const B = { minX: -46, maxX: world.bounds.maxX + 4, minZ: -32, maxZ: 26 };
  const cols = Math.round((B.maxX - B.minX) / STEP) + 1;
  const rows = Math.round((B.maxZ - B.minZ) / STEP) + 1;
  const seen = new Uint8Array(cols * rows);
  const at = (c: number, r: number) => ({ x: B.minX + c * STEP, y: 0, z: B.minZ + r * STEP });
  const sc = Math.round((SPAWN.x - B.minX) / STEP);
  const sr = Math.round((SPAWN.z - B.minZ) / STEP);
  const queue = [sc, sr];
  seen[sr * cols + sc] = 2;
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
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || seen[nr * cols + nc]) continue;
      seen[nr * cols + nc] = 1;
      if (isBlocked(at(nc, nr), PLAYER, world.colliders)) continue;
      seen[nr * cols + nc] = 2;
      queue.push(nc, nr);
    }
  }
  return (x: number, z: number) => seen[Math.round((z - B.minZ) / STEP) * cols + Math.round((x - B.minX) / STEP)] === 2;
}

describe("Memory Rooms", () => {
  it("opens one room per 10 extra photos, up to a cap", () => {
    expect(wingRoomsFor(0)).toBe(0);
    expect(wingRoomsFor(1)).toBe(1);
    expect(wingRoomsFor(10)).toBe(1);
    expect(wingRoomsFor(11)).toBe(2);
    expect(wingRoomsFor(24)).toBe(3);
    expect(wingRoomsFor(10_000)).toBe(WING.maxRooms);
  });

  it("creates exactly one frame per extra photo, all with valid walls", () => {
    const wing = buildWingLayout(24);
    expect(wing.rooms).toBe(3);
    expect(wing.placements).toHaveLength(24);
    expect(new Set(wing.placements.map((p) => p.memoryId)).size).toBe(24);
    for (const w of wing.walls) expect(validateWall(w), w.id).toEqual([]);
  });

  it("matches the photo count: 58 photos → 34 museum frames + 24 in 3 rooms", () => {
    const { slots, wingFrames } = frameSlotsFor(58);
    expect(slots).toHaveLength(58);
    expect(wingFrames).toBe(24);
    expect(frameSlotsFor(20).wingFrames).toBe(0);
    expect(frameSlotsFor(PHOTO_PLACEMENTS.length + MAX_WING_FRAMES + 50).slots).toHaveLength(PHOTO_PLACEMENTS.length + MAX_WING_FRAMES);
  });

  it("keeps the museum unchanged when there are no extra photos", () => {
    const world = buildWorld(0);
    expect(world.wingRooms).toBe(0);
    expect(world.placements).toHaveLength(PHOTO_PLACEMENTS.length);
    expect(world.bounds.maxX).toBe(42);
  });

  it("makes every room reachable from the lobby, through the Timeline Hall, while staying sealed", () => {
    const world = buildWorld(24);
    const reachable = reachableIn(world);
    for (let k = 0; k < 3; k++) {
      const x = WING.startX + k * WING.roomLength + WING.roomLength / 2;
      expect(areaAt(x, 4, world.areas)?.id).toBe(`room-${k + 1}`);
      expect(reachable(x, 4), `Memory Room ${k + 1}`).toBe(true);
    }
    // Outside the wing, beyond the far window and next to the rooms.
    expect(reachable(world.bounds.maxX + 2, 7)).toBe(false);
    expect(reachable(50, 15)).toBe(false);
    expect(reachable(50, -1)).toBe(false);
  });

  it("lets the player stand in front of every Memory Room photo", () => {
    const world = buildWorld(24);
    const reachable = reachableIn(world);
    const roomFrames = world.interactables.filter((i) => i.memoryId.startsWith("w"));
    expect(roomFrames).toHaveLength(24);
    for (const it of roomFrames) {
      const x = it.x + it.normalX * 1.4;
      const z = it.z + it.normalZ * 1.4;
      let ok = false;
      for (let dx = -1; dx <= 1 && !ok; dx += 0.25) for (let dz = -1; dz <= 1 && !ok; dz += 0.25) ok = reachable(x + dx, z + dz);
      expect(ok, `viewing spot for ${it.memoryId}`).toBe(true);
    }
  });

  it("walks from the Timeline Hall into Memory Room 1", () => {
    const world = buildWorld(24);
    const state = createMotorState(36, 0, 7, Math.PI / 2);
    for (let i = 0; i < 240; i++) stepMotor(state, { moveX: 1, moveZ: 0, run: false, jump: false }, 1 / 60, world.colliders);
    expect(areaAt(state.position.x, state.position.z, world.areas)?.id).toBe("room-1");
  });
});

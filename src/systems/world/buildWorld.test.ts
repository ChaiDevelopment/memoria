import { describe, expect, it } from "vitest";
import { PLAYER } from "@/config/gameConfig";
import { AREAS, SPAWN } from "@/config/museumLayout";
import { isBlocked } from "@/systems/movement/collision";
import { createMotorState, stepMotor } from "@/systems/movement/characterMotor";
import type { AreaId } from "@/types/world";
import { areaAt } from "./areas";
import { buildWorld } from "./buildWorld";

const world = buildWorld();
const STEP = 0.25;
const BOUNDS = { minX: -46, maxX: 46, minZ: -32, maxZ: 26 };

/** Grid flood fill of every position the player cylinder can stand in, starting at spawn. */
function floodFill() {
  const cols = Math.round((BOUNDS.maxX - BOUNDS.minX) / STEP) + 1;
  const rows = Math.round((BOUNDS.maxZ - BOUNDS.minZ) / STEP) + 1;
  const visited = new Uint8Array(cols * rows);
  const idx = (c: number, r: number) => r * cols + c;
  const toWorld = (c: number, r: number) => ({ x: BOUNDS.minX + c * STEP, y: 0, z: BOUNDS.minZ + r * STEP });
  const startC = Math.round((SPAWN.x - BOUNDS.minX) / STEP);
  const startR = Math.round((SPAWN.z - BOUNDS.minZ) / STEP);
  const queue: number[] = [startC, startR];
  visited[idx(startC, startR)] = 1;
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
      if (isBlocked(toWorld(nc, nr), PLAYER, world.colliders)) continue;
      visited[idx(nc, nr)] = 2;
      queue.push(nc, nr);
    }
  }
  return (x: number, z: number) => {
    const c = Math.round((x - BOUNDS.minX) / STEP);
    const r = Math.round((z - BOUNDS.minZ) / STEP);
    return visited[idx(c, r)] === 2 || (c === startC && r === startR);
  };
}

const reachable = floodFill();

describe("museum world", () => {
  it("spawns the player in free space inside the lobby", () => {
    expect(isBlocked(SPAWN, PLAYER, world.colliders)).toBe(false);
    expect(areaAt(SPAWN.x, SPAWN.z)?.id).toBe("lobby");
  });

  it("connects all four areas by walkable paths", () => {
    const probes: Record<AreaId, [number, number]> = {
      lobby: [0, 11],
      gallery: [-9, -5],
      timeline: [36, 7],
      garden: [-35, -20],
    };
    for (const area of AREAS) {
      const [x, z] = probes[area.id];
      expect(areaAt(x, z)?.id).toBe(area.id);
      expect(reachable(x, z), `${area.name} should be reachable from spawn`).toBe(true);
    }
  });

  it("keeps the player inside the building and garden (sealed envelope)", () => {
    const outside: [number, number][] = [
      [0, 20], // entrance plaza (glass doors are closed)
      [25, 13], // south of Timeline Hall
      [25, 0], // north of Timeline Hall
      [20, -12], // east of the gallery
      [0, -27], // north of the gallery
      [-44, 0], // beyond the west hedge
      [-25, 20], // beyond the south hedge
    ];
    for (const [x, z] of outside) expect(reachable(x, z), `(${x}, ${z}) must not be reachable`).toBe(false);
  });

  it("lets the player stand in front of every photograph", () => {
    for (const it of world.interactables) {
      const x = it.x + it.normalX * 1.4;
      const z = it.z + it.normalZ * 1.4;
      // Allow a small search around the viewing spot (benches may sit right there).
      let ok = false;
      for (let dx = -1; dx <= 1 && !ok; dx += 0.25)
        for (let dz = -1; dz <= 1 && !ok; dz += 0.25) ok = reachable(x + dx, z + dz);
      expect(ok, `viewing spot for ${it.label}`).toBe(true);
    }
  });

  it("walks from the lobby into the gallery through the doorway", () => {
    const state = createMotorState(0, 0, 3, Math.PI);
    for (let i = 0; i < 240; i++) stepMotor(state, { moveX: 0, moveZ: -1, run: false, jump: false }, 1 / 60, world.colliders);
    expect(areaAt(state.position.x, state.position.z)?.id).toBe("gallery");
  });

  it("is stopped by the gallery's east wall", () => {
    const state = createMotorState(8, 0, -5, Math.PI / 2);
    for (let i = 0; i < 240; i++) stepMotor(state, { moveX: 1, moveZ: 0, run: true, jump: false }, 1 / 60, world.colliders);
    expect(state.position.x).toBeLessThanOrEqual(12 - 0.2 - PLAYER.radius + 1e-6);
  });

  it("cannot jump over garden hedges", () => {
    const state = createMotorState(-40, 0, 0, -Math.PI / 2);
    for (let i = 0; i < 240; i++) stepMotor(state, { moveX: -1, moveZ: 0, run: true, jump: i % 20 === 0 }, 1 / 60, world.colliders);
    expect(state.position.x).toBeGreaterThan(-41.4);
  });

  it("only flags architecture as camera-blocking", () => {
    expect(world.cameraColliders.length).toBeGreaterThan(10);
    expect(world.cameraColliders.every((c) => c.kind === "box")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { PLAYER } from "@/config/gameConfig";
import type { BoxCollider, Collider } from "@/types/world";
import { createMotorState, stepMotor, type MotorInput } from "./characterMotor";

const DT = 1 / 60;

function box(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): BoxCollider {
  return { kind: "box", minX, minY, minZ, maxX, maxY, maxZ, blocksCamera: false };
}

function simulate(colliders: Collider[], start: [number, number, number], inputFor: (frame: number) => Partial<MotorInput>, frames: number) {
  const state = createMotorState(start[0], start[1], start[2], 0);
  let landed = 0;
  let maxY = 0;
  for (let i = 0; i < frames; i++) {
    const ev = stepMotor(state, { moveX: 0, moveZ: 0, run: false, jump: false, ...inputFor(i) }, DT, colliders);
    if (ev.landed) landed++;
    maxY = Math.max(maxY, state.position.y);
  }
  return { state, landed, maxY };
}

describe("character motor", () => {
  it("walks at walk speed and runs at run speed", () => {
    const walk = simulate([], [0, 0, 0], () => ({ moveZ: 1 }), 120);
    expect(walk.state.horizontalSpeed).toBeCloseTo(PLAYER.walkSpeed, 1);
    const run = simulate([], [0, 0, 0], () => ({ moveZ: 1, run: true }), 120);
    expect(run.state.horizontalSpeed).toBeCloseTo(PLAYER.runSpeed, 1);
  });

  it("stops at walls instead of passing through", () => {
    const wall = box(2, 0, -5, 2.4, 4, 5);
    const { state } = simulate([wall], [0, 0, 0], () => ({ moveX: 1, run: true }), 240);
    expect(state.position.x).toBeLessThanOrEqual(2 - PLAYER.radius + 1e-6);
    expect(state.position.x).toBeGreaterThan(2 - PLAYER.radius - 0.05);
  });

  it("does not tunnel through thin walls even with a huge frame time", () => {
    const wall = box(1, 0, -5, 1.1, 4, 5);
    const state = createMotorState(0, 0, 0, 0);
    state.velocity.x = 40;
    stepMotor(state, { moveX: 1, moveZ: 0, run: true, jump: false }, 0.05, [wall]);
    expect(state.position.x).toBeLessThan(1);
  });

  it("slides along a wall when moving diagonally", () => {
    const wall = box(2, 0, -50, 2.4, 4, 50);
    const { state } = simulate([wall], [1.5, 0, 0], () => ({ moveX: 0.7, moveZ: 0.7 }), 120);
    expect(state.position.z).toBeGreaterThan(2);
    expect(state.position.x).toBeLessThanOrEqual(2 - PLAYER.radius + 1e-6);
  });

  it("jumps, reaches the expected height and lands again", () => {
    const { state, landed, maxY } = simulate([], [0, 0, 0], (f) => ({ jump: f === 1 }), 120);
    const expectedApex = (PLAYER.jumpVelocity * PLAYER.jumpVelocity) / (2 * PLAYER.gravity);
    expect(maxY).toBeGreaterThan(expectedApex * 0.9);
    expect(maxY).toBeLessThan(expectedApex * 1.05);
    expect(state.grounded).toBe(true);
    expect(state.position.y).toBe(0);
    expect(landed).toBe(1);
  });

  it("stops upward motion at ceilings", () => {
    const ceiling = box(-5, 2.2, -5, 5, 2.5, 5);
    const { maxY } = simulate([ceiling], [0, 0, 0], (f) => ({ jump: f === 1 }), 90);
    expect(maxY + PLAYER.height).toBeLessThanOrEqual(2.2 + 1e-6);
  });

  it("steps onto low ledges but is blocked by tall ones", () => {
    const step = box(1, 0, -5, 3, 0.2, 5);
    const low = simulate([step], [0, 0, 0], () => ({ moveX: 1 }), 60);
    expect(low.state.position.x).toBeGreaterThan(1.2);
    expect(low.state.position.y).toBeCloseTo(0.2);

    const bench = box(1, 0, -5, 3, 0.46, 5);
    const blocked = simulate([bench], [0, 0, 0], () => ({ moveX: 1 }), 60);
    expect(blocked.state.position.x).toBeLessThanOrEqual(1 - PLAYER.radius + 1e-6);
  });

  it("can jump onto a bench and stand on it", () => {
    const bench = box(1, 0, -5, 3, 0.46, 5);
    const { state } = simulate([bench], [0.3, 0, 0], (f) => ({ moveX: f > 5 ? 1 : 0, jump: f === 6 }), 50);
    expect(state.position.y).toBeCloseTo(0.46);
    expect(state.grounded).toBe(true);
  });

  it("falls with gravity from a ledge", () => {
    const { state } = simulate([], [0, 3, 0], () => ({}), 120);
    expect(state.position.y).toBe(0);
    expect(state.grounded).toBe(true);
  });

  it("turns to face the movement direction", () => {
    const { state } = simulate([], [0, 0, 0], () => ({ moveX: 1 }), 60);
    expect(state.facing).toBeCloseTo(Math.PI / 2, 2);
  });
});
